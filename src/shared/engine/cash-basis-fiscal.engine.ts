import type { CfdiDocument, Company, FiscalWorkpaperResponse, ThirdPartyRecord } from '../types';
import type { AccountingRuleRecord } from '../types/accounting-rules.types';
import { parseCalendarDate } from '../date-utils';
import {
  buildResicoAlert,
  extractBreakdownCents,
  getCfdiExchangeRate,
  resolveNonFixedAssetBaseCents,
  resolveRecibidoDeductiblePct,
  resolveRepBaseCents
} from './cash-basis-fiscal.helper';
import { fromCents, toCents } from './invariants-and-math';

export interface CashBasisFiscalParams {
  company: Company;
  ejercicio: number;
  periodo: number;
  cfdis: readonly CfdiDocument[];
  polizaIdsInPeriod?: ReadonlySet<string>;
  baseContableDevengada?: number;
  rules?: readonly AccountingRuleRecord[];
  thirdParties?: readonly ThirdPartyRecord[];
}

export interface CashBasisFiscalResult {
  isCashBasisRegime: boolean;
  hasCfdiCashActivity: boolean;
  hasEmitidosCashActivity: boolean;
  hasRecibidosCashActivity: boolean;
  hasPayrollCashActivity: boolean;
  hasUnpaidPpdInScope: boolean;
  ingresosPeriodo: number;
  ingresosAcumulados: number;
  deduccionesPeriodo: number;
  deduccionesAcumuladas: number;
  ivaTrasladadoCobradoPeriodo: number;
  ivaAcreditablePagadoPeriodo: number;
  ivaRetenidoFavorPeriodo: number;
  ivaRetenidoPorPagarPeriodo: number;
  isrRetenidoPorPagarPeriodo: number;
  isrRetenidoFavorAcumulado?: number;
  isrRetenidoFavorMesPeriodo?: number;
  cashBasisSummary: NonNullable<FiscalWorkpaperResponse['cashBasisSummary']>;
  resicoThresholdAlert: NonNullable<FiscalWorkpaperResponse['resicoThresholdAlert']>;
  ivaBreakdown: NonNullable<FiscalWorkpaperResponse['ivaBreakdown']>;
}

export function computeCashBasisFiscalSummary({
  company,
  ejercicio,
  periodo,
  cfdis,
  polizaIdsInPeriod,
  baseContableDevengada = 0,
  rules,
  thirdParties
}: CashBasisFiscalParams): CashBasisFiscalResult {
  const regimenClave = company.regimenFiscal.slice(0, 3);
  const isPersonaFisica = company.rfc.trim().length === 13;
  const esResico = regimenClave === '626';
  const esResicoPf = esResico && isPersonaFisica;
  const isCashBasisRegime = esResico || isPersonaFisica;
  const targetPeriod = periodo === 13 ? 12 : Math.max(1, Math.min(12, periodo));
  const thirdPartyByRfc = new Map<string, ThirdPartyRecord>();
  for (const tp of thirdParties ?? []) {
    if (tp.rfc) thirdPartyByRfc.set(tp.rfc.trim().toUpperCase(), tp);
  }

  let pueIngCents = 0;
  let repIngCents = 0;
  let ncIngCents = 0;
  let ingAcumCents = 0;
  let dedPerCents = 0;
  let dedAcumCents = 0;
  let retResico125Cents = 0;
  let isrRetFavorAcumCents = 0;
  let isrRetFavorMesCents = 0;
  let ivaRetFavorCents = 0;
  let ivaRetPagarCents = 0;
  let isrRetPagarCents = 0;

  let emB16 = 0, emI16 = 0, emB8 = 0, emI8 = 0, emB0 = 0, emBEx = 0;
  let recI16 = 0, recI8 = 0, recIeps = 0;
  let hasEmitidosCashActivity = false;
  let hasRecibidosCashActivity = false;
  let hasPayrollCashActivity = false;
  let hasUnpaidPpdInScope = false;

  const cfdiByUuid = new Map<string, CfdiDocument>();
  const ppdInvoiceUuids = new Set<string>();
  const paidPpdUuidsUpToCutoff = new Set<string>();

  for (const c of cfdis) {
    if (c.statusSat === 'CANCELADO') continue;
    const upperUuid = (c.uuid || '').trim().toUpperCase();
    if (upperUuid && !cfdiByUuid.has(upperUuid)) cfdiByUuid.set(upperUuid, c);
    if (c.tipoComprobante === 'I' && c.metodoPago === 'PPD') {
      if (upperUuid) ppdInvoiceUuids.add(upperUuid);
      const calPpd = parseCalendarDate(c.fecha, ejercicio, targetPeriod);
      if (calPpd.year === ejercicio && calPpd.month <= targetPeriod) {
        hasUnpaidPpdInScope = true;
      }
    } else if (c.tipoComprobante === 'P') {
      const calP = parseCalendarDate(c.fechaPago || c.fecha, ejercicio, targetPeriod);
      if (calP.year < ejercicio || (calP.year === ejercicio && calP.month <= targetPeriod)) {
        if (c.uuidRelacionado) {
          for (const u of c.uuidRelacionado.split(/[\s,;]+/)) {
            const clean = u.trim().toUpperCase();
            if (clean) paidPpdUuidsUpToCutoff.add(clean);
          }
        }
        for (const dr of c.relatedDocs ?? []) {
          const clean = (dr.idDocumento || '').trim().toUpperCase();
          if (clean) paidPpdUuidsUpToCutoff.add(clean);
        }
      }
    }
  }

  for (const doc of cfdis) {
    if (doc.statusSat === 'CANCELADO') continue;
    if (doc.tipoComprobante === 'T') continue;
    if (doc.tipoComprobante === 'N') {
      if (doc.direction !== 'EMITIDO') continue;
      const calN = parseCalendarDate(doc.fechaPago || doc.fecha, ejercicio, targetPeriod);
      if (calN.year !== ejercicio || calN.month > targetPeriod) continue;
      const tcN = getCfdiExchangeRate(doc);
      const nominaCents = Math.max(0, toCents((doc.subtotal > 0 ? doc.subtotal : doc.total) * tcN));
      const retIsrNCents = Math.max(0, toCents((doc.isrRetenido || 0) * tcN));
      if (nominaCents <= 0 && retIsrNCents <= 0) continue;
      hasPayrollCashActivity = true;
      if (!esResicoPf) dedAcumCents += nominaCents;
      const inPeriodN =
        calN.month === targetPeriod ||
        Boolean(polizaIdsInPeriod && doc.polizaId && polizaIdsInPeriod.has(doc.polizaId));
      if (inPeriodN) {
        if (!esResicoPf) dedPerCents += nominaCents;
        isrRetPagarCents += retIsrNCents;
      }
      continue;
    }
    if (doc.tipoComprobante === 'I' && doc.metodoPago === 'PPD') continue;
    if (doc.tipoComprobante === 'E') {
      if (doc.metodoPago === 'PPD') continue;
      const relList = [
        ...(doc.uuidRelacionado || '').split(/[\s,;]+/).map((u) => u.trim().toUpperCase()).filter(Boolean),
        ...(doc.relatedDocs ?? []).map((dr) => (dr.idDocumento || '').trim().toUpperCase()).filter(Boolean)
      ];
      if (relList.some((u) => ppdInvoiceUuids.has(u) && !paidPpdUuidsUpToCutoff.has(u))) {
        continue;
      }
    }

    const effectiveDate = doc.tipoComprobante === 'P' ? (doc.fechaPago || doc.fecha) : doc.fecha;
    const cal = parseCalendarDate(effectiveDate, ejercicio, targetPeriod);
    if (cal.year !== ejercicio || cal.month > targetPeriod) continue;
    const inPeriod =
      cal.month === targetPeriod ||
      Boolean(polizaIdsInPeriod && doc.polizaId && polizaIdsInPeriod.has(doc.polizaId));

    const tc = getCfdiExchangeRate(doc);
    const isCreditNote = doc.tipoComprobante === 'E';
    const sign = isCreditNote ? -1 : 1;
    const baseCents =
      doc.tipoComprobante === 'P'
        ? resolveRepBaseCents(doc, tc)
        : Math.max(0, toCents((doc.subtotal - (doc.descuento || 0)) * tc));

    if (doc.direction === 'EMITIDO') {
      hasEmitidosCashActivity = true;
      ingAcumCents += sign * baseCents;
      isrRetFavorAcumCents += sign * toCents(doc.isrRetenido * tc);
      if (inPeriod) {
        if (doc.tipoComprobante === 'P') repIngCents += baseCents;
        else if (isCreditNote) ncIngCents += baseCents;
        else pueIngCents += baseCents;

        const retMes = sign * toCents(doc.isrRetenido * tc);
        isrRetFavorMesCents += retMes;
        if (esResicoPf) retResico125Cents += retMes;
        ivaRetFavorCents += sign * toCents(doc.ivaRetenido * tc);
        const bd = extractBreakdownCents(doc, baseCents, tc);
        emB16 += sign * bd.b16;
        emI16 += sign * bd.i16;
        emB8 += sign * bd.b8;
        emI8 += sign * bd.i8;
        emB0 += sign * bd.b0;
        emBEx += sign * bd.bEx;
      }
    } else if (doc.direction === 'RECIBIDO') {
      hasRecibidosCashActivity = true;
      const nonFixedBaseCents = resolveNonFixedAssetBaseCents(doc, baseCents, cfdiByUuid);
      const dedPct = resolveRecibidoDeductiblePct(doc, rules, thirdPartyByRfc);
      const dedBaseCents =
        nonFixedBaseCents === 0
          ? 0
          : dedPct === 100
            ? nonFixedBaseCents
            : Math.round((nonFixedBaseCents * dedPct) / 100);
      dedAcumCents += sign * dedBaseCents;
      if (inPeriod) {
        dedPerCents += sign * dedBaseCents;
        ivaRetPagarCents += sign * toCents(doc.ivaRetenido * tc);
        isrRetPagarCents += sign * toCents(doc.isrRetenido * tc);
        const bd = extractBreakdownCents(doc, baseCents, tc);
        const scaledI16 = dedPct === 100 ? bd.i16 : Math.round((bd.i16 * dedPct) / 100);
        const scaledI8 = dedPct === 100 ? bd.i8 : Math.round((bd.i8 * dedPct) / 100);
        recI16 += sign * scaledI16;
        recI8 += sign * scaledI8;
        recIeps += sign * bd.ieps;
      }
    }
  }

  const ingresosPeriodoCents = Math.max(0, pueIngCents + repIngCents - ncIngCents);
  const ingresosAcumMxn = fromCents(Math.max(0, ingAcumCents));
  const resicoThresholdAlert = buildResicoAlert(esResico, isPersonaFisica, ingresosAcumMxn);

  const gravadosCents = Math.max(0, emB16 + emB8 + emB0);
  const exentosCents = Math.max(0, emBEx);
  const totalActosCents = gravadosCents + exentosCents;
  const prorationFactor =
    exentosCents > 0
      ? totalActosCents > 0
        ? Math.floor((gravadosCents / totalActosCents + 1e-12) * 10000) / 10000
        : 0
      : 1;
  const ivaSinCents = Math.max(0, recI16 + recI8);
  const ivaProrrateadoCents = Math.round(ivaSinCents * prorationFactor);

  return {
    isCashBasisRegime,
    hasCfdiCashActivity: hasEmitidosCashActivity || hasRecibidosCashActivity || hasPayrollCashActivity,
    hasEmitidosCashActivity,
    hasRecibidosCashActivity,
    hasPayrollCashActivity,
    hasUnpaidPpdInScope,
    ingresosPeriodo: fromCents(ingresosPeriodoCents),
    ingresosAcumulados: ingresosAcumMxn,
    deduccionesPeriodo: fromCents(Math.max(0, dedPerCents)),
    deduccionesAcumuladas: fromCents(Math.max(0, dedAcumCents)),
    ivaTrasladadoCobradoPeriodo: fromCents(Math.max(0, emI16 + emI8)),
    ivaAcreditablePagadoPeriodo: fromCents(ivaProrrateadoCents),
    ivaRetenidoFavorPeriodo: fromCents(Math.max(0, ivaRetFavorCents)),
    ivaRetenidoPorPagarPeriodo: fromCents(Math.max(0, ivaRetPagarCents)),
    isrRetenidoPorPagarPeriodo: fromCents(Math.max(0, isrRetPagarCents)),
    isrRetenidoFavorAcumulado: fromCents(Math.max(0, isrRetFavorAcumCents)),
    isrRetenidoFavorMesPeriodo: fromCents(Math.max(0, isrRetFavorMesCents)),
    cashBasisSummary: {
      isCashBasisRegime,
      baseContableDevengada,
      ingresosCobradosFlujo: fromCents(ingresosPeriodoCents),
      deduccionesPagadasFlujo: fromCents(Math.max(0, dedPerCents)),
      retencionResico125: fromCents(Math.max(0, retResico125Cents)),
      pueIngresos: fromCents(pueIngCents),
      repIngresos: fromCents(repIngCents),
      creditNotesRestados: fromCents(ncIngCents),
      ...(!esResicoPf ? { isrRetenidoFavorAcumulado: fromCents(Math.max(0, isrRetFavorAcumCents)) } : {})
    },
    resicoThresholdAlert,
    ivaBreakdown: {
      base16: fromCents(Math.max(0, emB16)),
      base8: fromCents(Math.max(0, emB8)),
      base0: fromCents(Math.max(0, emB0)),
      baseExento: fromCents(exentosCents),
      iepsAcreditable: fromCents(Math.max(0, recIeps)),
      prorationFactor,
      ivaAcreditableSinProrrateo: fromCents(ivaSinCents),
      ivaAcreditableProrrateado: fromCents(ivaProrrateadoCents)
    }
  };
}
