import type { CfdiDocument, Poliza } from '../types';
import { sumCents, toCents } from './invariants-and-math';

export function isIvaAccount(
  code: string,
  satGroupCode?: string | null
): 'IVA_118' | 'IVA_208' | null {
  const cleanCode = (code || '').trim();
  const cleanSat = (satGroupCode || '').trim();
  if (cleanCode.startsWith('208-01') || cleanCode.startsWith('208.01') || cleanSat.startsWith('208.01')) {
    return 'IVA_208';
  }
  if (cleanCode.startsWith('118-01') || cleanCode.startsWith('118.01') || cleanSat.startsWith('118.01')) {
    return 'IVA_118';
  }
  return null;
}

export function isMonthlyIvaProvisionPoliza(pol: Poliza): boolean {
  const origin = String((pol as { origin?: string }).origin || '');
  if (origin === 'CIERRE_MENSUAL' || origin === 'FISCAL_PROVISION') return true;
  if (pol.movements.some((m) => /^IVA-M\d*/i.test((m.referencia || '').trim()))) return true;

  const polHasCfdi = Boolean(pol.cfdiUuid || (pol.cfdiUuids && pol.cfdiUuids.length > 0));
  if (polHasCfdi) return false;

  let hasIva208 = false;
  let hasIva118 = false;
  let has213or113 = false;
  let has119 = false;
  for (const m of pol.movements) {
    const code = (m.accountCode || '').trim();
    const ivaKind = isIvaAccount(code);
    if (ivaKind === 'IVA_208') hasIva208 = true;
    else if (ivaKind === 'IVA_118') hasIva118 = true;
    else if (
      code.startsWith('213-01') ||
      code.startsWith('213.01') ||
      code.startsWith('113-01') ||
      code.startsWith('113.01')
    ) {
      has213or113 = true;
    } else if (code.startsWith('119-01') || code.startsWith('119.01')) {
      has119 = true;
    }
  }
  return (hasIva208 || hasIva118) && (has213or113 || (hasIva208 && (hasIva118 || has119)));
}

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

function parseDocYearMonth(dateStr: string | null | undefined): { year: number; month: number } | null {
  const clean = (dateStr ?? '').trim();
  const match = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(clean);
  if (!match) return null;
  const year = Number.parseInt(match[1] ?? '', 10);
  const month = Number.parseInt(match[2] ?? '', 10);
  if (year < 1990 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

function isInTargetPeriod(doc: CfdiDocument, ejercicio: number, periodo: number): boolean {
  if (periodo < 1 || periodo > 12) return false;
  const effectiveDate = doc.tipoComprobante === 'P' ? (doc.fechaPago || doc.fecha) : doc.fecha;
  const ym = parseDocYearMonth(effectiveDate);
  return Boolean(ym && ym.year === ejercicio && ym.month === periodo);
}

function isOnOrBeforeTargetPeriod(doc: CfdiDocument, ejercicio: number, periodo: number): boolean {
  if (periodo < 1) return false;
  const effectivePeriod = Math.min(12, periodo);
  const effectiveDate = doc.tipoComprobante === 'P' ? (doc.fechaPago || doc.fecha) : doc.fecha;
  const ym = parseDocYearMonth(effectiveDate);
  if (!ym) return false;
  return ym.year < ejercicio || (ym.year === ejercicio && ym.month <= effectivePeriod);
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
  const paidUuidsUpToPeriod = new Set<string>();
  for (const doc of cfdis) {
    if (doc.statusSat === 'CANCELADO') continue;
    const upper = (doc.uuid || '').trim().toUpperCase();
    if (doc.metodoPago === 'PPD' && doc.tipoComprobante !== 'E' && upper) {
      ppdUuids.add(upper);
    }
    if (!isOnOrBeforeTargetPeriod(doc, ejercicio, periodo)) continue;
    if (doc.tipoComprobante === 'P') {
      if (doc.uuidRelacionado) paidUuidsUpToPeriod.add(doc.uuidRelacionado.trim().toUpperCase());
      for (const dr of doc.relatedDocs ?? []) {
        if (dr.idDocumento) paidUuidsUpToPeriod.add(dr.idDocumento.trim().toUpperCase());
      }
    } else if (doc.metodoPago === 'PUE' && doc.tipoComprobante !== 'E' && upper) {
      paidUuidsUpToPeriod.add(upper);
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
      if (relList.some((u) => ppdUuids.has(u) && !paidUuidsUpToPeriod.has(u))) continue;
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

export function detectManualIvaCauses(
  polizas: readonly Poliza[],
  ejercicio?: number,
  periodo?: number
): {
  count: number;
  impactCents: number;
} {
  let count = 0;
  let impactCents = 0;

  for (const pol of polizas) {
    if (ejercicio !== undefined && periodo !== undefined) {
      if (pol.ejercicio !== ejercicio || pol.periodo !== periodo) continue;
    }
    if (isMonthlyIvaProvisionPoliza(pol)) continue;

    const polHasCfdi = Boolean(pol.cfdiUuid || (pol.cfdiUuids && pol.cfdiUuids.length > 0));
    let polManualIvaCents = 0;
    for (const mov of pol.movements) {
      const code = (mov.accountCode || '').trim();
      if (!isIvaAccount(code)) continue;
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
