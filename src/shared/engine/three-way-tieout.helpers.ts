import type { CfdiDocument, Company, Poliza } from '../types';
import { sumCents, toCents } from './invariants-and-math';

export interface CancelledCfdiWithLivePoliza {
  uuid: string;
  cfdiId: string;
  polizaId: string;
  polizaFolio: string | null;
  direction: 'EMITIDO' | 'RECIBIDO';
  emisorRfc: string;
  receptorRfc: string;
  total: number;
  fecha: string;
}

export function isIvaAccount(
  code: string,
  satGroupCode?: string | null
): 'IVA_118' | 'IVA_208' | null {
  const cleanCode = (code || '').trim();
  const cleanSat = (satGroupCode || '').trim();
  if (cleanCode.startsWith('208-01') || cleanCode.startsWith('208.01') || cleanSat.startsWith('208.01')) {
    return 'IVA_208';
  }
  if (
    cleanCode.startsWith('118-01') ||
    cleanCode.startsWith('118.01') ||
    cleanSat.startsWith('118.01') ||
    cleanCode.startsWith('118-02') ||
    cleanCode.startsWith('118.02') ||
    cleanSat.startsWith('118.02')
  ) {
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

function isInTargetPeriod(doc: CfdiDocument, ejercicio: number, periodo: number, useAccrualDate = false): boolean {
  if (periodo < 1 || periodo > 12) return false;
  const effectiveDate = !useAccrualDate && doc.tipoComprobante === 'P' ? (doc.fechaPago || doc.fecha) : doc.fecha;
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
  periodo: number,
  company?: Pick<Company, 'regimenFiscal' | 'rfc'>
) {
  let ingCents = 0;
  let gasCents = 0;
  let ivaTrasCents = 0;
  let ivaAcredCents = 0;
  let pendingCfdisCount = 0;

  const regimenClave = (company?.regimenFiscal || '601').slice(0, 3);
  const isPf = (company?.rfc || '').trim().length === 13;
  const isPmAccrual = company ? regimenClave !== '626' && !isPf : false;

  const ppdUuids = new Set<string>();
  const paidUuidsUpToPeriod = new Set<string>();
  for (const doc of cfdis) {
    if (doc.statusSat === 'CANCELADO') continue;
    const upper = (doc.uuid || '').trim().toUpperCase();
    if (doc.metodoPago === 'PPD' && doc.tipoComprobante !== 'E' && upper) ppdUuids.add(upper);
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
    const inPeriodCash = isInTargetPeriod(doc, ejercicio, periodo, false);
    const inPeriodAccrual = isInTargetPeriod(doc, ejercicio, periodo, true);
    if (!inPeriodCash && !(isPmAccrual && inPeriodAccrual)) continue;

    if (inPeriodCash && !doc.polizaId && toCents(doc.total) > 0) {
      pendingCfdisCount += 1;
    }

    if (doc.tipoComprobante === 'N') continue;
    const isCreditNote = doc.tipoComprobante === 'E';
    const sign = isCreditNote ? -1 : 1;
    const baseCents = sign * resolveDocBaseMxnCents(doc);
    const ivaCents = sign * resolveDocIvaMxnCents(doc);

    // 1. Ingresos / Gastos: PM 601 usa devengado (I/E incl. PPD, sin P); RESICO/PF usa flujo (PUE+P-E)
    const includeAccrualBase =
      isPmAccrual && inPeriodAccrual && (doc.tipoComprobante === 'I' || doc.tipoComprobante === 'E');
    let eligibleCash = false;
    if (inPeriodCash) {
      const isCashFlow = doc.metodoPago === 'PUE' || doc.tipoComprobante === 'P';
      if (isCashFlow && !isCreditNote) {
        eligibleCash = true;
      } else if (isCreditNote && doc.metodoPago !== 'PPD') {
        const relList = (doc.uuidRelacionado || '')
          .split(/[\s,;]+/)
          .map((u) => u.trim().toUpperCase())
          .filter(Boolean);
        eligibleCash = !relList.some((u) => ppdUuids.has(u) && !paidUuidsUpToPeriod.has(u));
      }
    }

    if (isPmAccrual ? includeAccrualBase : eligibleCash) {
      if (doc.direction === 'EMITIDO') ingCents += baseCents;
      else gasCents += baseCents;
    }

    // 2. IVA (118/208): siempre sigue flujo de efectivo (PUE + REP - NC elegible)
    if (eligibleCash) {
      if (doc.direction === 'EMITIDO') ivaTrasCents += ivaCents;
      else ivaAcredCents += ivaCents;
    }
  }

  return { ingCents, gasCents, ivaTrasCents, ivaAcredCents, pendingCfdisCount };
}

export function detectManualIvaCauses(
  polizas: readonly Poliza[],
  ejercicio?: number,
  periodo?: number
): { count: number; impactCents: number } {
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
      if (!isIvaAccount((mov.accountCode || '').trim())) continue;
      if (!polHasCfdi && !mov.cfdiUuid) {
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

export function detectCancelledCfdisWithLivePoliza(
  cfdis: readonly CfdiDocument[],
  polizas: readonly Poliza[]
): CancelledCfdiWithLivePoliza[] {
  const polById = new Map<string, Poliza>();
  const polByUuid = new Map<string, Poliza>();
  for (const p of polizas) {
    polById.set(p.id, p);
    const uuids = [p.cfdiUuid, ...(p.cfdiUuids ?? []), ...p.movements.map((m) => m.cfdiUuid)];
    for (const u of uuids) {
      const clean = (u || '').trim().toUpperCase();
      if (clean && !polByUuid.has(clean)) polByUuid.set(clean, p);
    }
  }

  const seen = new Set<string>();
  const list: CancelledCfdiWithLivePoliza[] = [];
  for (const doc of cfdis) {
    if (doc.statusSat !== 'CANCELADO') continue;
    const upperUuid = (doc.uuid || '').trim().toUpperCase();
    if (!upperUuid || seen.has(upperUuid)) continue;
    const linkedPol = (doc.polizaId ? polById.get(doc.polizaId) : undefined) ?? polByUuid.get(upperUuid);
    const livePolizaId = linkedPol?.id ?? doc.polizaId ?? null;
    if (!livePolizaId) continue;
    seen.add(upperUuid);
    list.push({
      uuid: doc.uuid,
      cfdiId: doc.id,
      polizaId: livePolizaId,
      polizaFolio: linkedPol ? `${linkedPol.tipo}-${linkedPol.folio}` : (doc.polizaFolio ?? null),
      direction: doc.direction,
      emisorRfc: doc.emisorRfc,
      receptorRfc: doc.receptorRfc,
      total: doc.total,
      fecha: doc.fecha
    });
  }
  return list;
}
