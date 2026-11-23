import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  FiscalWorkpaperResponse,
  TaxParametersRecord
} from '../types';
import { SAFETY_BOUNDS } from '../sat-constants';
import { fromCents, sumCents, toCents } from './invariants-and-math';
import { calculateArt106PfIsr } from './art106-tax.engine';

export {
  buildDepreciationPolizaPlan,
  computeFixedAssetWithDepreciation
} from './fixed-assets.engine';

/**
 * Determina la tasa mensual progresiva de ISR RESICO Personas Físicas (Art. 113-E LISR).
 */
export function calculateResicoPfRate(monthlyRevenueCents: number): number {
  const rev = monthlyRevenueCents / 100;
  if (rev <= 25000) return 1.0;
  if (rev <= 50000) return 1.1;
  if (rev <= 83333.33) return 1.5;
  if (rev <= 208333.33) return 2.0;
  return 2.5;
}

export interface UsdMonetaryItemInput {
  total: number;
  tipoCambio: number;
  direction: 'EMITIDO' | 'RECIBIDO';
  metodoPago?: 'PUE' | 'PPD';
  statusSat?: 'VIGENTE' | 'CANCELADO';
  tipoComprobante?: CfdiDocument['tipoComprobante'];
}

/**
 * Fase 5: Cálculo de Papel de Trabajo Fiscal Día 17 (Pago Provisional ISR + IVA Definitivo + Fluctuación USD).
 */
export function computeFiscalWorkpaper(params: {
  company: Company;
  ejercicio: number;
  periodo: number;
  parameters: TaxParametersRecord;
  ingresosPeriodo: number;
  ingresosAcumuladosEjercicio: number;
  deduccionesAutorizadasPeriodo: number;
  deduccionesAcumuladasEjercicio?: number;
  ivaTrasladadoCobrado: number;
  ivaAcreditablePagado: number;
  isrRetenidoPorPagar: number;
  ivaRetenidoPorPagar: number;
  isrRetenidoFavorPeriodo: number;
  ivaRetenidoFavorPeriodo?: number;
  usdCfdis: readonly UsdMonetaryItemInput[];
}): FiscalWorkpaperResponse {
  const {
    company,
    ejercicio,
    periodo,
    parameters,
    ingresosPeriodo,
    ingresosAcumuladosEjercicio,
    deduccionesAutorizadasPeriodo,
    ivaTrasladadoCobrado,
    ivaAcreditablePagado,
    isrRetenidoPorPagar,
    ivaRetenidoPorPagar,
    isrRetenidoFavorPeriodo,
    ivaRetenidoFavorPeriodo,
    usdCfdis
  } = params;

  const regimenClave = company.regimenFiscal.slice(0, 3);
  const esResico = regimenClave === '626';
  const isPersonaFisica = company.rfc.trim().length === 13;

  const ingresosAcumCents = toCents(ingresosAcumuladosEjercicio);
  const ingresosMesCents = toCents(ingresosPeriodo);
  const deduccionesMesCents = toCents(deduccionesAutorizadasPeriodo);
  const deduccionesAcumCents = toCents(
    params.deduccionesAcumuladasEjercicio !== undefined
      ? params.deduccionesAcumuladasEjercicio
      : deduccionesAutorizadasPeriodo
  );
  const cu = Math.max(0, Math.min(1, parameters.coeficienteUtilidad));
  const perdidasDisponiblesCents = toCents(parameters.perdidasFiscalesPendientes);
  const pagosPreviosCents = toCents(parameters.pagosProvisionalesAnteriores);
  const isrRetenidoAcreditableCents = toCents(isrRetenidoFavorPeriodo);

  let utilidadFiscalEstimadaCents = 0;
  let perdidasAplicadasCents = 0;
  let baseGravableIsrCents = 0;
  let tasaIsrPct = 30.0;
  let isrCausadoCents = 0;
  let isrNetoAPagarCents = 0;

  if (esResico && isPersonaFisica) {
    const positiveMesCents = Math.max(0, ingresosMesCents);
    utilidadFiscalEstimadaCents = positiveMesCents;
    perdidasAplicadasCents = 0;
    baseGravableIsrCents = positiveMesCents;
    tasaIsrPct = calculateResicoPfRate(positiveMesCents);
    isrCausadoCents = Math.round(baseGravableIsrCents * (tasaIsrPct / 100));
    isrNetoAPagarCents = Math.max(0, isrCausadoCents - isrRetenidoAcreditableCents);
  } else if (esResico && !isPersonaFisica) {
    utilidadFiscalEstimadaCents = Math.max(0, ingresosAcumCents - deduccionesAcumCents);
    perdidasAplicadasCents = Math.min(utilidadFiscalEstimadaCents, perdidasDisponiblesCents);
    baseGravableIsrCents = Math.max(0, utilidadFiscalEstimadaCents - perdidasAplicadasCents);
    tasaIsrPct = 30.0;
    isrCausadoCents = Math.round(baseGravableIsrCents * 0.30);
    isrNetoAPagarCents = Math.max(
      0,
      isrCausadoCents - pagosPreviosCents - isrRetenidoAcreditableCents
    );
  } else if (isPersonaFisica && !esResico) {
    utilidadFiscalEstimadaCents = Math.max(0, ingresosAcumCents - deduccionesAcumCents);
    perdidasAplicadasCents = Math.min(utilidadFiscalEstimadaCents, perdidasDisponiblesCents);
    baseGravableIsrCents = Math.max(0, utilidadFiscalEstimadaCents - perdidasAplicadasCents);
    const pfCalc = calculateArt106PfIsr(baseGravableIsrCents, periodo, ejercicio);
    tasaIsrPct = pfCalc.effectiveRatePct;
    isrCausadoCents = pfCalc.isrCents;
    isrNetoAPagarCents = Math.max(
      0,
      isrCausadoCents - pagosPreviosCents - isrRetenidoAcreditableCents
    );
  } else {
    utilidadFiscalEstimadaCents = Math.max(0, Math.round(ingresosAcumCents * cu));
    perdidasAplicadasCents = Math.min(utilidadFiscalEstimadaCents, perdidasDisponiblesCents);
    baseGravableIsrCents = Math.max(0, utilidadFiscalEstimadaCents - perdidasAplicadasCents);
    tasaIsrPct = 30.0;
    isrCausadoCents = Math.round(baseGravableIsrCents * 0.30);
    isrNetoAPagarCents = Math.max(
      0,
      isrCausadoCents - pagosPreviosCents - isrRetenidoAcreditableCents
    );
  }

  // Determinación Definitiva de IVA (Art. 5-D LIVA)
  const ivaCobradoCents = toCents(ivaTrasladadoCobrado);
  const ivaPagadoCents = toCents(ivaAcreditablePagado);
  const ivaRetenidoCents = toCents(ivaRetenidoPorPagar);
  const ivaRetenidoFavorCents = toCents(ivaRetenidoFavorPeriodo ?? 0);
  const saldoFavorAnteriorCents = toCents(parameters.saldoFavorIvaAnterior);
  const actosGravados16Cents = Math.round(ivaCobradoCents / 0.16);

  const rawIvaDiffCents =
    ivaCobradoCents - ivaPagadoCents - ivaRetenidoFavorCents - saldoFavorAnteriorCents;
  const ivaNetoAPagarCents = Math.max(0, rawIvaDiffCents);
  const saldoFavorRemanenteCents = rawIvaDiffCents < 0 ? Math.abs(rawIvaDiffCents) : 0;

  // Fluctuación Cambiaria USD (NIF B-15: solo partidas monetarias vigentes PPD / insolutas)
  const tcDof = parameters.tipoCambioDofCierre > 0 ? parameters.tipoCambioDofCierre : 19.85;
  let netUsdCents = 0;
  let bookMxnCents = 0;
  let grossUsdCents = 0;
  let grossBookMxnCents = 0;
  let validUsdCount = 0;
  const boundUsd = Math.min(usdCfdis.length, SAFETY_BOUNDS.MAX_BATCH_CFDI);

  for (let i = 0; i < boundUsd; i += 1) {
    const doc = usdCfdis[i];
    if (!doc) continue;
    if (doc.statusSat === 'CANCELADO') continue;
    if (doc.metodoPago !== undefined && doc.metodoPago !== 'PPD') continue;
    if (
      doc.tipoComprobante !== undefined &&
      doc.tipoComprobante !== 'I' &&
      doc.tipoComprobante !== 'E'
    ) {
      continue;
    }

    const creditNoteFlip = doc.tipoComprobante === 'E' ? -1 : 1;
    const sign = (doc.direction === 'EMITIDO' ? 1 : -1) * creditNoteFlip;
    const usdAmountCents = toCents(doc.total);
    const tcDoc = doc.tipoCambio > 1 ? doc.tipoCambio : 19.5;
    const mxnAmountCents = Math.round(usdAmountCents * tcDoc);
    netUsdCents += sign * usdAmountCents;
    bookMxnCents += sign * mxnAmountCents;
    grossUsdCents += Math.abs(usdAmountCents);
    grossBookMxnCents += Math.abs(mxnAmountCents);
    validUsdCount += 1;
  }

  const closingDofMxnCents = Math.round(netUsdCents * tcDof);
  const diffCambiariaCents = closingDofMxnCents - bookMxnCents;
  const tcPromedio =
    grossUsdCents > 0
      ? Number((grossBookMxnCents / grossUsdCents).toFixed(4))
      : Number(tcDof.toFixed(4));

  const retIsrEnterarCents = toCents(isrRetenidoPorPagar);
  const totalDia17Cents =
    isrNetoAPagarCents + ivaNetoAPagarCents + retIsrEnterarCents + ivaRetenidoCents;

  return {
    company,
    ejercicio,
    periodo,
    parameters,
    isrProvisional: {
      regimenClave,
      esResico,
      ingresosPeriodo: fromCents(ingresosMesCents),
      ingresosAcumuladosEjercicio: fromCents(ingresosAcumCents),
      deduccionesAutorizadasPeriodo: fromCents(deduccionesMesCents),
      coeficienteUtilidadAplicado: cu,
      utilidadFiscalEstimada: fromCents(utilidadFiscalEstimadaCents),
      perdidasFiscalesAplicadas: fromCents(perdidasAplicadasCents),
      baseGravableIsr: fromCents(baseGravableIsrCents),
      tasaIsrPct,
      isrCausado: fromCents(isrCausadoCents),
      pagosProvisionalesPrevios: fromCents(pagosPreviosCents),
      isrRetenidoPeriodo: fromCents(isrRetenidoAcreditableCents),
      isrNetoAPagar: fromCents(isrNetoAPagarCents)
    },
    ivaDefinitivo: {
      actosGravadosCobrado16: fromCents(actosGravados16Cents),
      ivaTrasladadoCobrado: fromCents(ivaCobradoCents),
      ivaAcreditablePagado: fromCents(ivaPagadoCents),
      ivaRetenidoPorPagar: fromCents(ivaRetenidoCents),
      ivaRetenidoAcreditable: fromCents(ivaRetenidoFavorCents),
      saldoFavorIvaAcreditable: fromCents(saldoFavorAnteriorCents),
      ivaNetoAPagar: fromCents(ivaNetoAPagarCents),
      saldoFavorIvaRemanente: fromCents(saldoFavorRemanenteCents)
    },
    fluctuacionCambiaria: {
      cfdisUsdCount: validUsdCount,
      saldoMonedaExtranjeraUsd: fromCents(netUsdCents),
      tipoCambioPromedioRegistro: tcPromedio,
      tipoCambioDofCierre: tcDof,
      valuacionLibrosMxn: fromCents(bookMxnCents),
      valuacionCierreDofMxn: fromCents(closingDofMxnCents),
      diferenciaCambiariaMxn: fromCents(diffCambiariaCents),
      tipoDiferencia:
        diffCambiariaCents > 0
          ? 'UTILIDAD_CAMBIARIA'
          : diffCambiariaCents < 0
            ? 'PERDIDA_CAMBIARIA'
            : 'SIN_CAMBIO'
    },
    resumenLineaCapturaSat: {
      isrProvisionalAPagar: fromCents(isrNetoAPagarCents),
      ivaDefinitivoAPagar: fromCents(ivaNetoAPagarCents),
      retencionesIsrPorEnterar: fromCents(retIsrEnterarCents),
      retencionesIvaPorEnterar: fromCents(ivaRetenidoCents),
      totalEstimadoDia17: fromCents(totalDia17Cents)
    }
  };
}

/**
 * Extrae saldos fiscales desde una balanza de comprobación y CFDIs usando reglas unificadas
 * (excluye cuentas 801, grupo SAT 611 ISR y 601-01-006 depreciación contable) para alimentar
 * computeFiscalWorkpaper con paridad exacta entre SQLite local y Supabase Cloud.
 */
export function computeFiscalWorkpaperFromTrialBalance(params: {
  company: Company;
  ejercicio: number;
  periodo: number;
  parameters: TaxParametersRecord;
  trialBalance: readonly AccountWithBalance[];
  cfdis: readonly CfdiDocument[];
}): FiscalWorkpaperResponse {
  const { company, ejercicio, periodo, parameters, trialBalance, cfdis } = params;

  const ingresosAccounts = trialBalance.filter((a) => a.isAffectable && a.type === 'INGRESOS');
  const egresosAccounts = trialBalance.filter(
    (a) =>
      a.isAffectable &&
      (a.type === 'COSTOS' || a.type === 'GASTOS') &&
      !a.code.startsWith('801') &&
      !a.satGroupCode?.startsWith('801') &&
      !a.satGroupCode?.startsWith('611') &&
      a.code !== '601-01-006'
  );

  const ingresosPeriodo = fromCents(
    sumCents(ingresosAccounts.map((a) => a.periodCredits - a.periodCharges))
  );
  const ingresosAcumuladosEjercicio = fromCents(
    sumCents(ingresosAccounts.map((a) => a.finalBalance))
  );
  const deduccionesAutorizadasPeriodo = fromCents(
    sumCents(egresosAccounts.map((a) => a.periodCharges - a.periodCredits))
  );
  const deduccionesAcumuladasEjercicio = fromCents(
    sumCents(egresosAccounts.map((a) => a.finalBalance))
  );

  const accIvaCobrado = trialBalance.find(
    (a) => a.code === '208-01-001' || a.satGroupCode === '208.01'
  );
  const accIvaPagado = trialBalance.find(
    (a) => a.code === '118-01-001' || a.satGroupCode === '118.01'
  );
  const accRetIsr = trialBalance.find(
    (a) => a.code === '216-01-001' || a.satGroupCode === '216.01'
  );
  const accRetIva = trialBalance.find(
    (a) => a.code === '216-01-002' || a.satGroupCode === '216.02'
  );
  const accIsrFavor = trialBalance.find(
    (a) => a.code === '113-02-001' || a.satGroupCode === '113.02'
  );
  const accIvaFavor = trialBalance.find((a) => a.code === '113-01-002');

  const settledPpdUuids = new Set(
    cfdis
      .filter((c) => c.tipoComprobante === 'P' && c.statusSat !== 'CANCELADO' && c.uuidRelacionado)
      .map((c) => String(c.uuidRelacionado).toUpperCase())
  );

  const usdCfdis = cfdis.filter(
    (c) =>
      c.moneda?.toUpperCase() === 'USD' &&
      c.statusSat !== 'CANCELADO' &&
      c.metodoPago === 'PPD' &&
      !settledPpdUuids.has((c.uuid || '').toUpperCase())
  );

  return computeFiscalWorkpaper({
    company,
    ejercicio,
    periodo,
    parameters,
    ingresosPeriodo,
    ingresosAcumuladosEjercicio,
    deduccionesAutorizadasPeriodo,
    deduccionesAcumuladasEjercicio,
    ivaTrasladadoCobrado: accIvaCobrado?.periodCredits ?? 0,
    ivaAcreditablePagado: accIvaPagado?.periodCharges ?? 0,
    isrRetenidoPorPagar: accRetIsr?.periodCredits ?? 0,
    ivaRetenidoPorPagar: accRetIva?.periodCredits ?? 0,
    isrRetenidoFavorPeriodo: accIsrFavor?.periodCharges ?? 0,
    ivaRetenidoFavorPeriodo: accIvaFavor?.periodCharges ?? 0,
    usdCfdis
  });
}
