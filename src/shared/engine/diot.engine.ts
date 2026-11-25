import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  DiotReportResponse,
  DiotSupplierRow,
  Poliza,
  ThirdPartyRecord
} from '../types';
import { parseCalendarDate } from '../date-utils';
import { computeCashBasisFiscalSummary } from './cash-basis-fiscal.engine';
import { reconstructGrossIvaAfterProvision } from './fiscal-trial-balance.helper';
import { fromCents, sumCents, toCents } from './invariants-and-math';
import {
  buildDiot54BatchLine,
  generateDiotTxt,
  normalizeDiotTipoOperacion,
  resolveDiotDocAmounts,
  validateDiotBatchLines,
  type DiotBatchValidationWarning,
  type DiotTipoOperacion,
  type DiotTipoTercero,
  type DiotTxtRowInput
} from './diot-txt';

export {
  buildDiot54BatchLine,
  generateDiotTxt,
  validateDiotBatchLines,
  type DiotBatchValidationWarning,
  type DiotTipoOperacion,
  type DiotTipoTercero,
  type DiotTxtRowInput
};

export interface DiotComputationParams {
  company: Company;
  ejercicio: number;
  periodo: number;
  cfdis: readonly CfdiDocument[];
  polizaIdsInPeriod: ReadonlySet<string>;
  trialBalance: readonly AccountWithBalance[];
  thirdParties?: readonly ThirdPartyRecord[];
  periodPolizas?: readonly Poliza[];
  prorationFactor?: number;
}

const ACCUM_KEYS = [
  'actosPagados16', 'actosPagados8', 'actosPagados0', 'actosExentos', 'iepsPagado',
  'ivaAcreditable16Only', 'ivaAcreditable8', 'ivaRetenido', 'isrRetenido', 'totalPagado',
  'devolucionesMxn', 'devoluciones8', 'importacionesTangibles16', 'importacionesIntangibles16',
  'importacionesExentas', 'actosNoObjeto', 'actosNoObjetoExtranjero', 'ivaNoAcreditable16',
  'ivaNoAcreditable16Prorrata', 'ivaNoAcreditable8', 'ivaNoAcreditable8Prorrata',
  'ivaNoAcreditableImportacionesTangibles', 'ivaNoAcreditableImportacionesTangiblesProrrata',
  'ivaNoAcreditableImportacionesIntangibles', 'ivaNoAcreditableImportacionesIntangiblesProrrata'
] as const;

type AccumKey = (typeof ACCUM_KEYS)[number];
type InternalDiotRow = Omit<DiotSupplierRow, 'tipoOperacion'> &
  Record<AccumKey, number> & {
    tipoOperacion: DiotTipoOperacion;
    pais?: string;
    nacionalidad?: string;
    jurisdiccionFiscal?: string;
    idFiscal?: string;
    regionFronteriza: 'NORTE' | 'SUR';
  };

type ExtendedThirdParty = ThirdPartyRecord & {
  pais?: string | null;
  nacionalidad?: string | null;
  jurisdiccionFiscal?: string | null;
  idFiscal?: string | null;
};

const normVendor = (s: string) =>
  s.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const foreignNamesMatch = (a: string, b: string): boolean => {
  const na = normVendor(a), nb = normVendor(b);
  return Boolean(na && nb && (na === nb || (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na)))));
};

function computeReconstructedIvaTrasladado(trialBalance: readonly AccountWithBalance[], periodPolizas?: readonly Poliza[]): number {
  const ivaCobradoAccs = trialBalance.filter(
    (a) => a.isAffectable !== false && (a.satGroupCode === '208.01' || a.satGroupCode?.startsWith('208.01') || a.code.startsWith('208-01'))
  );
  const ivaPagadoAccs = trialBalance.filter(
    (a) => a.isAffectable !== false && (a.satGroupCode === '118.01' || a.satGroupCode === '118.02' || a.code.startsWith('118-01') || a.code.startsWith('118-02'))
  );
  const { tbIvaCobrado } = reconstructGrossIvaAfterProvision(trialBalance, ivaCobradoAccs, ivaPagadoAccs, periodPolizas);
  if (tbIvaCobrado > 0) return tbIvaCobrado;
  const netCobradoCents = sumCents(ivaCobradoAccs.map((a) => a.periodCredits - a.periodCharges));
  const sum208ChargesCents = sumCents(ivaCobradoAccs.map((a) => a.periodCharges));
  const hasProvisionCred = trialBalance.some(
    (a) => a.isAffectable !== false && (a.code === '213-01-001' || a.code === '113-01-001' || a.satGroupCode === '213.01' || a.satGroupCode === '113.01') && (toCents(a.periodCredits) > 0 || toCents(a.periodCharges) > 0)
  );
  return netCobradoCents === 0 && sum208ChargesCents > 0 && hasProvisionCred ? fromCents(sum208ChargesCents) : 0;
}

/**
 * Motor único de cálculo y generación de layout DIOT (Formato SAT 2025/2026 de 54 campos)
 * compartido entre SQLite local y Supabase Cloud.
 */
export function computeDiotReportData({
  company, ejercicio, periodo, cfdis, polizaIdsInPeriod, trialBalance, thirdParties, periodPolizas, prorationFactor: explicitProration
}: DiotComputationParams): DiotReportResponse {
  const targetPeriod = periodo === 13 ? 12 : Math.max(1, Math.min(12, periodo));
  const ppdInvoiceUuids = new Set<string>();
  const paidDocUuidsAllUpToPeriod = new Set<string>();

  for (const c of cfdis) {
    if (c.direction !== 'RECIBIDO' || c.statusSat === 'CANCELADO') continue;
    const upperUuid = (c.uuid || '').trim().toUpperCase();
    if (c.metodoPago === 'PPD' && c.tipoComprobante !== 'E' && upperUuid) ppdInvoiceUuids.add(upperUuid);
    const effDate = c.tipoComprobante === 'P' ? (c.fechaPago || c.fecha) : c.fecha;
    const cal = parseCalendarDate(effDate, ejercicio, targetPeriod);
    const isPaidUp = (c.polizaId && polizaIdsInPeriod.has(c.polizaId)) || (Boolean(c.polizaId) && (cal.year < ejercicio || (cal.year === ejercicio && cal.month <= targetPeriod)));
    if (!isPaidUp) continue;
    if (c.tipoComprobante === 'P') {
      for (const u of (c.uuidRelacionado || '').split(/[\s,;]+/)) if (u.trim()) paidDocUuidsAllUpToPeriod.add(u.trim().toUpperCase());
      for (const dr of c.relatedDocs ?? []) if (dr.idDocumento) paidDocUuidsAllUpToPeriod.add(dr.idDocumento.trim().toUpperCase());
    } else if (c.metodoPago === 'PUE' && c.tipoComprobante !== 'E' && upperUuid) {
      paidDocUuidsAllUpToPeriod.add(upperUuid);
    }
  }

  const paidRecibidos = cfdis.filter((c) => {
    if (c.direction !== 'RECIBIDO' || c.statusSat === 'CANCELADO' || c.tipoComprobante === 'T' || c.tipoComprobante === 'N') return false;
    if (c.isForeignNoCfdi) {
      if (c.polizaId && polizaIdsInPeriod.has(c.polizaId)) return true;
      if (!c.polizaId) {
        const cal = parseCalendarDate(c.fecha, ejercicio, targetPeriod);
        return cal.year === ejercicio && cal.month === targetPeriod;
      }
      return false;
    }
    if (!c.polizaId || !polizaIdsInPeriod.has(c.polizaId)) return false;
    if (c.tipoComprobante === 'E') {
      if (c.metodoPago === 'PPD') return false;
      const relList = [
        ...(c.uuidRelacionado || '').split(/[\s,;]+/).map((u) => u.trim().toUpperCase()).filter(Boolean),
        ...(c.relatedDocs ?? []).map((dr) => (dr.idDocumento || '').trim().toUpperCase()).filter(Boolean)
      ];
      return !relList.some((u) => ppdInvoiceUuids.has(u) && !paidDocUuidsAllUpToPeriod.has(u));
    }
    return c.metodoPago === 'PUE' || c.tipoComprobante === 'P';
  });

  const thirdPartyByRfc = new Map<string, ExtendedThirdParty>();
  const foreignThirdParties: ExtendedThirdParty[] = [];
  for (const tp of thirdParties ?? []) {
    if (!tp.rfc) continue;
    const upper = tp.rfc.trim().toUpperCase();
    const ext = tp as ExtendedThirdParty;
    if (upper === 'XEXX010101000' || upper.startsWith('XEXX') || tp.tipoTerceroDiot === '05') foreignThirdParties.push(ext);
    if (!thirdPartyByRfc.has(upper)) thirdPartyByRfc.set(upper, ext);
  }

  let unpostedPaidCfdisCount = 0;
  for (const c of cfdis) {
    if (c.direction !== 'RECIBIDO' || c.statusSat === 'CANCELADO' || c.tipoComprobante === 'T' || c.tipoComprobante === 'N' || c.isForeignNoCfdi) continue;
    if (c.metodoPago !== 'PUE' && c.tipoComprobante !== 'P') continue;
    const cal = parseCalendarDate(c.tipoComprobante === 'P' ? (c.fechaPago || c.fecha) : c.fecha, ejercicio, periodo);
    if (cal.year === ejercicio && cal.month === periodo && (!c.polizaId || !polizaIdsInPeriod.has(c.polizaId))) unpostedPaidCfdisCount += 1;
  }

  const prorationFactor =
    explicitProration ??
    computeCashBasisFiscalSummary({ company, ejercicio, periodo, cfdis, polizaIdsInPeriod, thirdParties }).ivaBreakdown.prorationFactor;

  const byRfcOp = new Map<string, InternalDiotRow>();

  for (const doc of paidRecibidos) {
    const rfc = doc.emisorRfc.trim().toUpperCase();
    const docNameUpper = doc.emisorNombre.trim().toUpperCase();
    const isGenericForeignRfc = rfc === 'XEXX010101000' || rfc.startsWith('XEXX');
    const matchedForeignTp = isGenericForeignRfc
      ? foreignThirdParties.find((tp) => tp.rfc.trim().toUpperCase() === rfc && normVendor(tp.nombre) === normVendor(doc.emisorNombre)) ??
        (foreignThirdParties.length === 1 && foreignNamesMatch(foreignThirdParties[0]!.nombre, doc.emisorNombre) ? foreignThirdParties[0] : undefined)
      : undefined;
    const thirdParty = isGenericForeignRfc ? matchedForeignTp : thirdPartyByRfc.get(rfc);
    const tipoTercero: DiotTipoTercero = thirdParty?.tipoTerceroDiot ?? (doc.isForeignNoCfdi || isGenericForeignRfc ? '05' : '04');
    const concLower = doc.conceptoPrincipal.toLowerCase();
    const inferredOp = thirdParty?.tipoOperacionDiot ??
      (concLower.includes('pedimento') || concLower.includes('aduana') ? '07'
        : concLower.includes('renta') || concLower.includes('arrendamiento') ? '06'
        : concLower.includes('honorario') || concLower.includes('auditor') || concLower.includes('consultor') ? '03' : '85');
    const tipoOperacion = normalizeDiotTipoOperacion(inferredOp, tipoTercero);
    const isForeign = tipoTercero === '05' || isGenericForeignRfc || Boolean(doc.isForeignNoCfdi);
    const amt = resolveDiotDocAmounts(doc, thirdParty, { prorationFactor, tipoOperacion, isForeign });
    const sign = amt.isCreditNote ? -1 : 1;
    const groupKey = isForeign ? `${rfc}::${thirdParty?.idFiscal?.trim() || docNameUpper}::${tipoOperacion}` : `${rfc}::${tipoOperacion}`;

    const delta: Record<AccumKey, number> = {
      actosPagados16: amt.subtotal16, actosPagados8: amt.subtotal8, actosPagados0: amt.baseCero,
      actosExentos: amt.baseExenta, iepsPagado: amt.iepsPagado,
      ivaAcreditable16Only: fromCents(toCents(sign * amt.iva16Mxn)),
      ivaAcreditable8: fromCents(toCents(sign * amt.iva8Mxn)),
      ivaRetenido: sign * amt.ivaRetenidoMxn, isrRetenido: sign * amt.isrRetenidoMxn, totalPagado: sign * amt.totalMxn,
      devolucionesMxn: amt.devolucion16, devoluciones8: amt.devolucion8,
      importacionesTangibles16: amt.importacionesTangibles16, importacionesIntangibles16: amt.importacionesIntangibles16,
      importacionesExentas: amt.importacionesExentas, actosNoObjeto: amt.actosNoObjeto,
      actosNoObjetoExtranjero: amt.actosNoObjetoExtranjero, ivaNoAcreditable16: amt.ivaNoAcreditable16,
      ivaNoAcreditable16Prorrata: amt.ivaNoAcreditable16Prorrata, ivaNoAcreditable8: amt.ivaNoAcreditable8,
      ivaNoAcreditable8Prorrata: amt.ivaNoAcreditable8Prorrata,
      ivaNoAcreditableImportacionesTangibles: amt.ivaNoAcreditableImportacionesTangibles,
      ivaNoAcreditableImportacionesTangiblesProrrata: amt.ivaNoAcreditableImportacionesTangiblesProrrata,
      ivaNoAcreditableImportacionesIntangibles: amt.ivaNoAcreditableImportacionesIntangibles,
      ivaNoAcreditableImportacionesIntangiblesProrrata: amt.ivaNoAcreditableImportacionesIntangiblesProrrata
    };

    const existing = byRfcOp.get(groupKey);
    if (!existing) {
      const created: InternalDiotRow = {
        rfc, nombre: doc.emisorNombre, tipoTercero, tipoOperacion,
        ...Object.fromEntries(ACCUM_KEYS.map((k) => [k, fromCents(toCents(delta[k]))])) as Record<AccumKey, number>,
        ivaAcreditable16: fromCents(toCents(delta.ivaAcreditable16Only) + toCents(delta.ivaAcreditable8)),
        cfdiCount: 1, batchLine: '',
        pais: thirdParty?.pais ?? undefined, nacionalidad: thirdParty?.nacionalidad ?? undefined,
        jurisdiccionFiscal: thirdParty?.jurisdiccionFiscal ?? undefined, idFiscal: thirdParty?.idFiscal ?? undefined,
        regionFronteriza: thirdParty?.regionFronteriza === 'SUR' ? 'SUR' : 'NORTE'
      };
      byRfcOp.set(groupKey, created);
    } else {
      for (const k of ACCUM_KEYS) existing[k] = fromCents(toCents(existing[k]) + toCents(delta[k]));
      existing.ivaAcreditable16 = fromCents(toCents(existing.ivaAcreditable16Only) + toCents(existing.ivaAcreditable8));
      existing.cfdiCount += 1;
    }
  }

  const rows: DiotSupplierRow[] = Array.from(byRfcOp.values()).map((r) => ({
    rfc: r.rfc, nombre: r.nombre, tipoTercero: r.tipoTercero,
    tipoOperacion: r.tipoOperacion as DiotSupplierRow['tipoOperacion'],
    actosPagados16: r.actosPagados16, actosPagados8: r.actosPagados8, actosPagados0: r.actosPagados0,
    actosExentos: r.actosExentos, iepsPagado: r.iepsPagado, ivaAcreditable16: r.ivaAcreditable16,
    ivaRetenido: r.ivaRetenido, isrRetenido: r.isrRetenido, totalPagado: r.totalPagado,
    cfdiCount: r.cfdiCount,
    batchLine: buildDiot54BatchLine({ ...r, ivaAcreditable16: r.ivaAcreditable16Only })
  }));

  const actosPagados16 = fromCents(sumCents(rows.map((r) => r.actosPagados16)) + sumCents(rows.map((r) => r.actosPagados8 || 0)));
  const ivaAcreditable16 = fromCents(sumCents(rows.map((r) => r.ivaAcreditable16)));
  const ivaRetenido = fromCents(sumCents(rows.map((r) => r.ivaRetenido)));
  const isrRetenido = fromCents(sumCents(rows.map((r) => r.isrRetenido)));
  const ivaTrasladadoCobrado = computeReconstructedIvaTrasladado(trialBalance, periodPolizas);
  const ivaNetoCargoFavor = fromCents(toCents(ivaTrasladadoCobrado) - toCents(ivaAcreditable16));
  const mesStr = String(periodo).padStart(2, '0');

  return {
    company, ejercicio, periodo, rows,
    totals: { actosPagados16, ivaAcreditable16, ivaRetenido, isrRetenido, ivaTrasladadoCobrado, ivaNetoCargoFavor },
    batchTxtContent: rows.map((r) => r.batchLine).join('\n'),
    filename: `DIOT_${company.rfc}_${ejercicio}_${mesStr}.txt`,
    unpostedPaidCfdisCount
  };
}
