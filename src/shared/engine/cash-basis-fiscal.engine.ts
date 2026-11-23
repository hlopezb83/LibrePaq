import type { CfdiDocument, Company, FiscalWorkpaperResponse } from '../types';
import { parseCalendarDate } from '../date-utils';
import { fromCents, sumCents, toCents } from './invariants-and-math';

export interface CashBasisFiscalParams {
  company: Company;
  ejercicio: number;
  periodo: number;
  cfdis: readonly CfdiDocument[];
  polizaIdsInPeriod?: ReadonlySet<string>;
  baseContableDevengada?: number;
}

export interface CashBasisFiscalResult {
  isCashBasisRegime: boolean;
  hasCfdiCashActivity: boolean;
  hasEmitidosCashActivity: boolean;
  hasRecibidosCashActivity: boolean;
  ingresosPeriodo: number;
  ingresosAcumulados: number;
  deduccionesPeriodo: number;
  deduccionesAcumuladas: number;
  ivaTrasladadoCobradoPeriodo: number;
  ivaAcreditablePagadoPeriodo: number;
  ivaRetenidoFavorPeriodo: number;
  ivaRetenidoPorPagarPeriodo: number;
  isrRetenidoPorPagarPeriodo: number;
  cashBasisSummary: NonNullable<FiscalWorkpaperResponse['cashBasisSummary']>;
  resicoThresholdAlert: NonNullable<FiscalWorkpaperResponse['resicoThresholdAlert']>;
  ivaBreakdown: NonNullable<FiscalWorkpaperResponse['ivaBreakdown']>;
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
  baseContableDevengada = 0
}: CashBasisFiscalParams): CashBasisFiscalResult {
  const regimenClave = company.regimenFiscal.slice(0, 3);
  const isPersonaFisica = company.rfc.trim().length === 13;
  const esResico = regimenClave === '626';
  const esResicoPf = esResico && isPersonaFisica;
  const isCashBasisRegime = esResico || isPersonaFisica;
  const targetPeriod = periodo === 13 ? 12 : Math.max(1, Math.min(12, periodo));

  let pueIngCents = 0;
  let repIngCents = 0;
  let ncIngCents = 0;
  let ingAcumCents = 0;
  let dedPerCents = 0;
  let dedAcumCents = 0;
  let retResico125Cents = 0;
  let ivaRetFavorCents = 0;
  let ivaRetPagarCents = 0;
  let isrRetPagarCents = 0;

  let emB16 = 0, emI16 = 0, emB8 = 0, emI8 = 0, emB0 = 0, emBEx = 0;
  let recI16 = 0, recI8 = 0, recIeps = 0;
  let hasEmitidosCashActivity = false;
  let hasRecibidosCashActivity = false;

  const ppdInvoiceUuids = new Set<string>();
  for (const c of cfdis) {
    if (c.statusSat === 'CANCELADO') continue;
    if (c.tipoComprobante === 'I' && c.metodoPago === 'PPD' && c.uuid) {
      ppdInvoiceUuids.add(c.uuid.trim().toUpperCase());
    }
  }

  for (const doc of cfdis) {
    if (doc.statusSat === 'CANCELADO') continue;
    if (doc.tipoComprobante === 'T' || doc.tipoComprobante === 'N') continue;
    if (doc.tipoComprobante === 'I' && doc.metodoPago === 'PPD') continue;
    if (doc.tipoComprobante === 'E') {
      if (doc.metodoPago === 'PPD') continue;
      const relUuid = doc.uuidRelacionado?.trim().toUpperCase();
      const relatesToPpd =
        (relUuid ? ppdInvoiceUuids.has(relUuid) : false) ||
        Boolean(doc.relatedDocs?.some((dr) => ppdInvoiceUuids.has((dr.idDocumento || '').trim().toUpperCase())));
      if (relatesToPpd) continue;
    }

    const cal = parseCalendarDate(doc.fecha, ejercicio, targetPeriod);
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
      dedAcumCents += sign * baseCents;
      if (inPeriod) {
        dedPerCents += sign * baseCents;
        ivaRetPagarCents += sign * toCents(doc.ivaRetenido * tc);
        isrRetPagarCents += sign * toCents(doc.isrRetenido * tc);
        const bd = extractBreakdownCents(doc, baseCents, tc);
        recI16 += sign * bd.i16;
        recI8 += sign * bd.i8;
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
    hasCfdiCashActivity: hasEmitidosCashActivity || hasRecibidosCashActivity,
    hasEmitidosCashActivity,
    hasRecibidosCashActivity,
    ingresosPeriodo: fromCents(ingresosPeriodoCents),
    ingresosAcumulados: ingresosAcumMxn,
    deduccionesPeriodo: fromCents(Math.max(0, dedPerCents)),
    deduccionesAcumuladas: fromCents(Math.max(0, dedAcumCents)),
    ivaTrasladadoCobradoPeriodo: fromCents(Math.max(0, emI16 + emI8)),
    ivaAcreditablePagadoPeriodo: fromCents(ivaProrrateadoCents),
    ivaRetenidoFavorPeriodo: fromCents(Math.max(0, ivaRetFavorCents)),
    ivaRetenidoPorPagarPeriodo: fromCents(Math.max(0, ivaRetPagarCents)),
    isrRetenidoPorPagarPeriodo: fromCents(Math.max(0, isrRetPagarCents)),
    cashBasisSummary: {
      isCashBasisRegime,
      baseContableDevengada,
      ingresosCobradosFlujo: fromCents(ingresosPeriodoCents),
      deduccionesPagadasFlujo: fromCents(Math.max(0, dedPerCents)),
      retencionResico125: fromCents(Math.max(0, retResico125Cents)),
      pueIngresos: fromCents(pueIngCents),
      repIngresos: fromCents(repIngCents),
      creditNotesRestados: fromCents(ncIngCents)
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
