import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  FiscalWorkpaperResponse,
  TaxParametersRecord
} from '../types';
import { computeCashBasisFiscalSummary } from './cash-basis-fiscal.engine';
import { computeFiscalWorkpaper } from './fiscal.engine';
import { fromCents, sumCents, toCents } from './invariants-and-math';

/**
 * Extrae saldos fiscales desde una balanza de comprobación y CFDIs usando reglas unificadas
 * (excluye cuentas 801, grupo SAT 611 ISR y 601-01-006 depreciación contable) para alimentar
 * computeFiscalWorkpaper con paridad exacta entre SQLite local y Supabase Cloud.
 * En regímenes de flujo de efectivo (RESICO / PF), prioriza ingresos cobrados y deducciones pagadas de CFDIs.
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

  const tbIngresosPeriodo = fromCents(
    sumCents(ingresosAccounts.map((a) => a.periodCredits - a.periodCharges))
  );
  const tbIngresosAcumulados = fromCents(
    sumCents(ingresosAccounts.map((a) => a.finalBalance))
  );
  const tbDeduccionesPeriodo = fromCents(
    sumCents(egresosAccounts.map((a) => a.periodCharges - a.periodCredits))
  );
  const tbDeduccionesAcumuladas = fromCents(
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

  const cashResult = computeCashBasisFiscalSummary({
    company,
    ejercicio,
    periodo,
    cfdis,
    baseContableDevengada: tbIngresosPeriodo
  });

  const useCashFlow =
    cfdis.length > 0 && cashResult.isCashBasisRegime && cashResult.hasCfdiCashActivity;

  const tbIvaPagado = accIvaPagado?.periodCharges ?? 0;
  const ivaAcreditablePagado =
    useCashFlow && cashResult.hasRecibidosCashActivity
      ? cashResult.ivaAcreditablePagadoPeriodo
      : useCashFlow && cashResult.ivaBreakdown.prorationFactor < 1
        ? fromCents(Math.round(toCents(tbIvaPagado) * cashResult.ivaBreakdown.prorationFactor))
        : tbIvaPagado;

  const ivaTrasladadoCobrado =
    useCashFlow && cashResult.hasEmitidosCashActivity
      ? cashResult.ivaTrasladadoCobradoPeriodo
      : (accIvaCobrado?.periodCredits ?? 0);

  const tbIsrFavor = accIsrFavor?.periodCharges ?? 0;
  const isrRetenidoFavorPeriodo =
    useCashFlow && cashResult.cashBasisSummary.retencionResico125 > 0
      ? cashResult.cashBasisSummary.retencionResico125
      : tbIsrFavor;

  const tbIvaFavor = accIvaFavor?.periodCharges ?? 0;
  const ivaRetenidoFavorPeriodo =
    useCashFlow && cashResult.ivaRetenidoFavorPeriodo > 0
      ? cashResult.ivaRetenidoFavorPeriodo
      : tbIvaFavor;

  const tbIsrPorPagar = accRetIsr?.periodCredits ?? 0;
  const isrRetenidoPorPagar =
    useCashFlow && cashResult.hasRecibidosCashActivity && tbIsrPorPagar === 0
      ? cashResult.isrRetenidoPorPagarPeriodo
      : tbIsrPorPagar;

  const tbIvaPorPagar = accRetIva?.periodCredits ?? 0;
  const ivaRetenidoPorPagar =
    useCashFlow && cashResult.hasRecibidosCashActivity && tbIvaPorPagar === 0
      ? cashResult.ivaRetenidoPorPagarPeriodo
      : tbIvaPorPagar;

  return computeFiscalWorkpaper({
    company,
    ejercicio,
    periodo,
    parameters,
    ingresosPeriodo: useCashFlow ? cashResult.ingresosPeriodo : tbIngresosPeriodo,
    ingresosAcumuladosEjercicio: useCashFlow ? cashResult.ingresosAcumulados : tbIngresosAcumulados,
    deduccionesAutorizadasPeriodo: useCashFlow ? cashResult.deduccionesPeriodo : tbDeduccionesPeriodo,
    deduccionesAcumuladasEjercicio: useCashFlow ? cashResult.deduccionesAcumuladas : tbDeduccionesAcumuladas,
    ivaTrasladadoCobrado,
    ivaAcreditablePagado,
    isrRetenidoPorPagar,
    ivaRetenidoPorPagar,
    isrRetenidoFavorPeriodo,
    ivaRetenidoFavorPeriodo,
    usdCfdis,
    cashBasisSummary: cashResult.cashBasisSummary,
    resicoThresholdAlert: cashResult.resicoThresholdAlert,
    ivaBreakdown: cashResult.ivaBreakdown
  });
}
