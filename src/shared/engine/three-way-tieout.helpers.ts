import type { CfdiDocument, Poliza } from '../types';
import { parseCalendarDate } from '../date-utils';
import { sumCents, toCents } from './invariants-and-math';

function getRate(doc: CfdiDocument): number {
  return doc.moneda && doc.moneda.toUpperCase() !== 'MXN' && (doc.tipoCambio || 1) > 0
    ? doc.tipoCambio
    : 1;
}

function resolveDocBaseMxnCents(doc: CfdiDocument): number {
  const tc = getRate(doc);
  const tb = doc.taxBreakdown;
  if (tb) {
    const tbBase = tb.base16 + tb.base8 + tb.base0 + tb.baseExento;
    if (tbBase > 0) return toCents(tbBase * tc);
  }
  if (doc.tipoComprobante === 'P') {
    const grossCents =
      doc.relatedDocs && doc.relatedDocs.length > 0
        ? sumCents(doc.relatedDocs.map((dr) => dr.impPagado * tc))
        : toCents(doc.total * tc);
    if (doc.subtotal > 0 && toCents(doc.subtotal * tc) <= grossCents) {
      return toCents(doc.subtotal * tc);
    }
    return Math.max(0, grossCents - toCents(doc.ivaTrasladado * tc));
  }
  return Math.max(0, toCents((doc.subtotal - (doc.descuento || 0)) * tc));
}

function resolveDocIvaMxnCents(doc: CfdiDocument): number {
  const tc = getRate(doc);
  const tb = doc.taxBreakdown;
  if (tb && (tb.iva16 > 0 || tb.iva8 > 0)) {
    return toCents((tb.iva16 + tb.iva8) * tc);
  }
  return toCents((doc.ivaTrasladado || 0) * tc);
}

function isInTargetPeriod(doc: CfdiDocument, ejercicio: number, periodo: number): boolean {
  const effectiveDate = doc.tipoComprobante === 'P' ? (doc.fechaPago || doc.fecha) : doc.fecha;
  const targetPeriod = periodo === 13 ? 12 : periodo;
  const cal = parseCalendarDate(effectiveDate, ejercicio, targetPeriod);
  return cal.year === ejercicio && cal.month === targetPeriod;
}

export function computeSatAddPillar(
  cfdis: readonly CfdiDocument[],
  ejercicio: number,
  periodo: number
) {
  let ingCents = 0;
  let gasCents = 0;
  let ivaTrasCents = 0;
  let ivaAcredCents = 0;
  let pendingCfdisCount = 0;

  const ppdUuids = new Set<string>();
  const paidUuidsInPeriod = new Set<string>();
  for (const doc of cfdis) {
    if (doc.statusSat === 'CANCELADO') continue;
    const upper = (doc.uuid || '').trim().toUpperCase();
    if (doc.metodoPago === 'PPD' && doc.tipoComprobante !== 'E' && upper) {
      ppdUuids.add(upper);
    }
    if (!isInTargetPeriod(doc, ejercicio, periodo)) continue;
    if (doc.tipoComprobante === 'P') {
      if (doc.uuidRelacionado) paidUuidsInPeriod.add(doc.uuidRelacionado.trim().toUpperCase());
      for (const dr of doc.relatedDocs ?? []) {
        if (dr.idDocumento) paidUuidsInPeriod.add(dr.idDocumento.trim().toUpperCase());
      }
    } else if (doc.metodoPago === 'PUE' && doc.tipoComprobante !== 'E' && upper) {
      paidUuidsInPeriod.add(upper);
    }
  }

  for (const doc of cfdis) {
    if (doc.statusSat === 'CANCELADO' || doc.tipoComprobante === 'T') continue;
    if (!isInTargetPeriod(doc, ejercicio, periodo)) continue;

    if (!doc.polizaId && toCents(doc.total) > 0) {
      pendingCfdisCount += 1;
    }

    if (doc.tipoComprobante === 'N') continue;
    const isCashFlow = doc.metodoPago === 'PUE' || doc.tipoComprobante === 'P';
    const isCreditNote = doc.tipoComprobante === 'E';
    if (!isCashFlow && !isCreditNote) continue;

    if (isCreditNote) {
      if (doc.metodoPago === 'PPD') continue;
      const relList = (doc.uuidRelacionado || '')
        .split(/[\s,;]+/)
        .map((u) => u.trim().toUpperCase())
        .filter(Boolean);
      if (relList.some((u) => ppdUuids.has(u) && !paidUuidsInPeriod.has(u))) continue;
    }

    const sign = isCreditNote ? -1 : 1;
    const baseCents = sign * resolveDocBaseMxnCents(doc);
    const ivaCents = sign * resolveDocIvaMxnCents(doc);

    if (doc.direction === 'EMITIDO') {
      ingCents += baseCents;
      ivaTrasCents += ivaCents;
    } else {
      gasCents += baseCents;
      ivaAcredCents += ivaCents;
    }
  }

  return { ingCents, gasCents, ivaTrasCents, ivaAcredCents, pendingCfdisCount };
}

export function detectManualIvaCauses(polizas: readonly Poliza[]): {
  count: number;
  impactCents: number;
} {
  let count = 0;
  let impactCents = 0;

  for (const pol of polizas) {
    const polHasCfdi = Boolean(pol.cfdiUuid || (pol.cfdiUuids && pol.cfdiUuids.length > 0));
    let polManualIvaCents = 0;
    for (const mov of pol.movements) {
      const code = (mov.accountCode || '').trim();
      const isIvaAcc = code.startsWith('118') || code.startsWith('208');
      if (!isIvaAcc) continue;
      const movHasCfdi = polHasCfdi || Boolean(mov.cfdiUuid);
      if (!movHasCfdi) {
        polManualIvaCents += Math.max(toCents(mov.cargo), toCents(mov.abono));
      }
    }
    if (polManualIvaCents > 0) {
      count += 1;
      impactCents += polManualIvaCents;
    }
  }

  return { count, impactCents };
}
