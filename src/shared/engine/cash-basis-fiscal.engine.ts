import type { CfdiDocument, Company, FiscalWorkpaperResponse, ThirdPartyRecord } from '../types';
import type { AccountingRuleRecord } from '../types/accounting-rules.types';
import { parseCalendarDate } from '../date-utils';
import { fromCents, sumCents, toCents } from './invariants-and-math';

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
  cashBasisSummary: NonNullable<FiscalWorkpaperResponse['cashBasisSummary']>;
  resicoThresholdAlert: NonNullable<FiscalWorkpaperResponse['resicoThresholdAlert']>;
  ivaBreakdown: NonNullable<FiscalWorkpaperResponse['ivaBreakdown']>;
}

function resolveRecibidoDeductiblePct(
  doc: CfdiDocument,
  rules?: readonly AccountingRuleRecord[],
  thirdPartyByRfc?: ReadonlyMap<string, ThirdPartyRecord>
): number {
  if (doc.deductiblePct !== undefined && Number.isFinite(Number(doc.deductiblePct))) {
    return Math.max(0, Math.min(100, Number(doc.deductiblePct)));
  }
  if (rules && rules.length > 0) {
    const rfc = doc.emisorRfc.trim().toUpperCase();
    const clave = (doc.claveProdServ || '').trim();
    const uso = (doc.usoCfdi || '').trim().toUpperCase();
    const sorted = [...rules]
      .filter((r) => r.direction === 'RECIBIDO')
      .sort((a, b) => a.priority - b.priority);
    for (const r of sorted) {
      if (r.matchRfc && r.matchRfc.trim().toUpperCase() !== rfc) continue;
      if (r.matchClaveProdServ && r.matchClaveProdServ.trim() !== clave) continue;
      if (r.matchUsoCfdi && r.matchUsoCfdi.trim().toUpperCase() !== uso) continue;
      return Math.max(0, Math.min(100, Number(r.deductiblePct ?? 100)));
    }
  }
  const tp = thirdPartyByRfc?.get(doc.emisorRfc.trim().toUpperCase()) as
    | (ThirdPartyRecord & { deductiblePct?: number })
    | undefined;
  if (tp?.deductiblePct !== undefined && Number.isFinite(Number(tp.deductiblePct))) {
    return Math.max(0, Math.min(100, Number(tp.deductiblePct)));
  }
  return 100;
}

function getRate(doc: CfdiDocument): number {
  return doc.moneda && doc.moneda.toUpperCase() !== 'MXN' && (doc.tipoCambio || 1) > 0
    ? doc.tipoCambio
    : 1;
}

function resolveRepBaseCents(doc: CfdiDocument, tc: number): number {
  const tb = doc.taxBreakdown;
  if (tb) {
    const tbSum = tb.base16 + tb.base8 + tb.base0 + tb.baseExento;
    if (tbSum > 0) return toCents(tbSum * tc);
  }
  const hasForeignDr = Boolean(doc.relatedDocs?.some((dr) => dr.monedaDr && dr.monedaDr !== 'MXN'));
  const grossPaidCents =
    doc.relatedDocs && doc.relatedDocs.length > 0 && !(doc.moneda === 'MXN' && hasForeignDr && doc.total > 0)
      ? sumCents(doc.relatedDocs.map((dr) => dr.impPagado * tc))
      : toCents(doc.total * tc);
  if (doc.subtotal > 0 && toCents(doc.subtotal * tc) <= grossPaidCents) {
    return toCents(doc.subtotal * tc);
  }
  return Math.max(0, grossPaidCents - toCents(doc.ivaTrasladado * tc));
}

function extractBreakdownCents(doc: CfdiDocument, baseCents: number, tc: number) {
  const tb = doc.taxBreakdown;
  const hasTb =
    tb &&
    (tb.base16 > 0 || tb.base8 > 0 || tb.base0 > 0 || tb.baseExento > 0 || tb.ieps > 0 || tb.iva16 > 0 || tb.iva8 > 0);
  if (hasTb) {
    return {
      b16: toCents(tb.base16 * tc), i16: toCents(tb.iva16 * tc),
      b8: toCents(tb.base8 * tc), i8: toCents(tb.iva8 * tc),
      b0: toCents(tb.base0 * tc), bEx: toCents(tb.baseExento * tc),
      ieps: toCents(tb.ieps * tc)
    };
  }
  const ivaCents = toCents(doc.ivaTrasladado * tc);
  if (ivaCents > 0) {
    const is8 = Math.abs((baseCents > 0 ? ivaCents / baseCents : 0.16) - 0.08) < 0.015;
    return is8
      ? { b16: 0, i16: 0, b8: baseCents, i8: ivaCents, b0: 0, bEx: 0, ieps: 0 }
      : { b16: baseCents, i16: ivaCents, b8: 0, i8: 0, b0: 0, bEx: 0, ieps: 0 };
  }
  const isEx = doc.conceptoPrincipal.toLowerCase().includes('exento');
  return { b16: 0, i16: 0, b8: 0, i8: 0, b0: isEx ? 0 : baseCents, bEx: isEx ? baseCents : 0, ieps: 0 };
}

function buildResicoAlert(
  esResico: boolean,
  isPersonaFisica: boolean,
  accumulatedRevenueMxn: number
): NonNullable<FiscalWorkpaperResponse['resicoThresholdAlert']> {
  const thresholdMxn = esResico ? (isPersonaFisica ? 3_500_000 : 35_000_000) : 0;
  const utilizationPct =
    esResico && thresholdMxn > 0 ? Number(((accumulatedRevenueMxn / thresholdMxn) * 100).toFixed(2)) : 0;
  const status = !esResico
    ? 'OK'
    : utilizationPct >= 100
      ? 'EXCEEDED'
      : utilizationPct >= 95
        ? 'CRITICAL_95'
        : utilizationPct >= 80
          ? 'WARNING_80'
          : 'OK';
  const labels = {
    OK: esResico ? 'Dentro del límite anual RESICO' : 'No aplica (Régimen distinto a RESICO)',
    WARNING_80: 'Precaución: >=80% del límite anual RESICO',
    CRITICAL_95: 'Alerta crítica: >=95% del límite anual RESICO',
    EXCEEDED: 'Límite anual RESICO excedido (>=100%)'
  } as const;
  return { applies: esResico, thresholdMxn, accumulatedRevenueMxn, utilizationPct, status, label: labels[status] };
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
  let ivaRetFavorCents = 0;
  let ivaRetPagarCents = 0;
  let isrRetPagarCents = 0;

  let emB16 = 0, emI16 = 0, emB8 = 0, emI8 = 0, emB0 = 0, emBEx = 0;
  let recI16 = 0, recI8 = 0, recIeps = 0;
  let hasEmitidosCashActivity = false;
  let hasRecibidosCashActivity = false;
  let hasPayrollCashActivity = false;
  let hasUnpaidPpdInScope = false;

  const ppdInvoiceUuids = new Set<string>();
  for (const c of cfdis) {
    if (c.statusSat === 'CANCELADO') continue;
    if (c.tipoComprobante === 'I' && c.metodoPago === 'PPD') {
      if (c.uuid) ppdInvoiceUuids.add(c.uuid.trim().toUpperCase());
      const calPpd = parseCalendarDate(c.fecha, ejercicio, targetPeriod);
      if (calPpd.year === ejercicio && calPpd.month <= targetPeriod) {
        hasUnpaidPpdInScope = true;
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
      const tcN = getRate(doc);
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
      const relUuid = doc.uuidRelacionado?.trim().toUpperCase();
      const relatesToPpd =
        (relUuid ? ppdInvoiceUuids.has(relUuid) : false) ||
        Boolean(doc.relatedDocs?.some((dr) => ppdInvoiceUuids.has((dr.idDocumento || '').trim().toUpperCase())));
      if (relatesToPpd) continue;
    }

    const effectiveDate = doc.tipoComprobante === 'P' ? (doc.fechaPago || doc.fecha) : doc.fecha;
    const cal = parseCalendarDate(effectiveDate, ejercicio, targetPeriod);
    if (cal.year !== ejercicio || cal.month > targetPeriod) continue;
    const inPeriod =
      cal.month === targetPeriod ||
      Boolean(polizaIdsInPeriod && doc.polizaId && polizaIdsInPeriod.has(doc.polizaId));

    const tc = getRate(doc);
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

        if (esResicoPf) retResico125Cents += sign * toCents(doc.isrRetenido * tc);
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
      const isFixedAssetUso = /^I0/i.test((doc.usoCfdi || '').trim());
      const dedPct = resolveRecibidoDeductiblePct(doc, rules, thirdPartyByRfc);
      const dedBaseCents = isFixedAssetUso
        ? 0
        : dedPct === 100
          ? baseCents
          : Math.round((baseCents * dedPct) / 100);
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
    exentosCents > 0 ? (totalActosCents > 0 ? Number((gravadosCents / totalActosCents).toFixed(4)) : 0) : 1;
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
