import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  FiscalWorkpaperResponse,
  Poliza,
  RetencionDesgloseItem,
  TaxParametersRecord,
  ThirdPartyRecord
} from '../types';
import type { AccountingRuleRecord } from '../types/accounting-rules.types';
import { computeCashBasisFiscalSummary } from './cash-basis-fiscal.engine';
import { computeFiscalWorkpaper } from './fiscal.engine';
import {
  hasUnpaidPpdInvoicesByDirection,
  isImss216Account,
  isIvaRetentionAccount,
  isNonCfdiCashDeductionAccount,
  isPpdPendingRetentionAccount,
  reconstructGrossIvaAfterProvision,
  resolveOpenUsdPpdCfdis
} from './fiscal-trial-balance.helper';
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
  rules?: readonly AccountingRuleRecord[];
  thirdParties?: readonly ThirdPartyRecord[];
  ytdIsrRetenidoCharges?: number;
  periodPolizas?: readonly Poliza[];
}): FiscalWorkpaperResponse {
  const {
    company,
    ejercicio,
    periodo,
    parameters,
    trialBalance,
    cfdis,
    rules,
    thirdParties,
    ytdIsrRetenidoCharges,
    periodPolizas
  } = params;

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
    sumCents(ingresosAccounts.map((a) => (a.nature === 'DEUDORA' ? -a.finalBalance : a.finalBalance)))
  );
  const tbDeduccionesPeriodo = fromCents(
    sumCents(egresosAccounts.map((a) => a.periodCharges - a.periodCredits))
  );
  const tbDeduccionesAcumuladas = fromCents(
    sumCents(egresosAccounts.map((a) => (a.nature === 'ACREEDORA' ? -a.finalBalance : a.finalBalance)))
  );

  const ivaCobradoAccounts = trialBalance.filter((a) => {
    if (!a.isAffectable) return false;
    const sat = (a.satGroupCode ?? '').trim();
    if (sat === '208.02' || a.code.startsWith('208-02')) return false;
    return (
      sat === '208.01' ||
      sat.startsWith('208.01') ||
      a.code.startsWith('208-01') ||
      (sat.startsWith('208') && a.name.toLowerCase().includes('iva'))
    );
  });
  const ivaPagadoAccounts = trialBalance.filter((a) => {
    if (!a.isAffectable) return false;
    const sat = (a.satGroupCode ?? '').trim();
    if (sat === '118.03' || a.code.startsWith('118-03')) return false;
    return (
      sat === '118.01' ||
      sat === '118.02' ||
      a.code.startsWith('118-01') ||
      a.code.startsWith('118-02') ||
      (sat.startsWith('118') && a.name.toLowerCase().includes('iva'))
    );
  });
  const retention216Accounts = trialBalance.filter(
    (a) =>
      a.isAffectable &&
      (a.code.startsWith('216') || (a.satGroupCode ?? '').startsWith('216')) &&
      !isImss216Account(a) &&
      !isPpdPendingRetentionAccount(a)
  );
  const accRetIvaList = retention216Accounts.filter(isIvaRetentionAccount);
  const accRetIsrList = retention216Accounts.filter((a) => !isIvaRetentionAccount(a));
  const accIsrFavor = trialBalance.find(
    (a) => a.code === '113-02-001' || a.satGroupCode === '113.02'
  );
  const accIvaFavor = trialBalance.find((a) => a.code === '113-01-002');

  const usdCfdis = resolveOpenUsdPpdCfdis(cfdis, ejercicio, periodo);

  const cashResult = computeCashBasisFiscalSummary({
    company,
    ejercicio,
    periodo,
    cfdis,
    baseContableDevengada: tbIngresosPeriodo,
    rules,
    thirdParties
  });

  const esResico = company.regimenFiscal.slice(0, 3) === '626';
  const esResicoPf = esResico && company.rfc.trim().length === 13;
  const {
    hasUnpaidEmitidos: hasUnpaidPpdEmitidos,
    hasUnpaidRecibidos: hasUnpaidPpdRecibidos
  } = hasUnpaidPpdInvoicesByDirection(cfdis, ejercicio, periodo);
  const useCashFlow =
    cfdis.length > 0 &&
    cashResult.isCashBasisRegime &&
    (cashResult.hasCfdiCashActivity || cashResult.hasUnpaidPpdInScope);

  const { tbIvaCobrado, tbIvaPagado } = reconstructGrossIvaAfterProvision(
    trialBalance,
    ivaCobradoAccounts,
    ivaPagadoAccounts,
    periodPolizas
  );
  const prorationFactor = cashResult.ivaBreakdown.prorationFactor;
  const ivaAcreditablePagado =
    useCashFlow && (cashResult.hasRecibidosCashActivity || hasUnpaidPpdRecibidos)
      ? cashResult.ivaAcreditablePagadoPeriodo
      : prorationFactor < 1
        ? fromCents(Math.round(toCents(tbIvaPagado) * prorationFactor))
        : tbIvaPagado;
  const effectiveIvaBreakdown =
    !useCashFlow && prorationFactor < 1 && tbIvaPagado > 0 && cashResult.ivaBreakdown.ivaAcreditableSinProrrateo === 0
      ? {
          ...cashResult.ivaBreakdown,
          ivaAcreditableSinProrrateo: tbIvaPagado,
          ivaAcreditableProrrateado: ivaAcreditablePagado
        }
      : cashResult.ivaBreakdown;

  const ivaTrasladadoCobrado =
    useCashFlow && (cashResult.hasEmitidosCashActivity || hasUnpaidPpdEmitidos)
      ? cashResult.ivaTrasladadoCobradoPeriodo
      : tbIvaCobrado;

  const has113Activity =
    accIsrFavor !== undefined &&
    (accIsrFavor.finalBalance > 0 || accIsrFavor.periodCharges > 0 || accIsrFavor.periodCredits > 0);
  const tbIsrMes = Math.max(0, accIsrFavor?.periodCharges ?? 0);
  const tbIsrYtd =
    ytdIsrRetenidoCharges !== undefined
      ? Math.max(ytdIsrRetenidoCharges, tbIsrMes, accIsrFavor?.finalBalance ?? 0)
      : Math.max(tbIsrMes, accIsrFavor?.finalBalance ?? 0);
  const cfdiIsrFavorAcum =
    cashResult.cashBasisSummary.isrRetenidoFavorAcumulado ?? cashResult.isrRetenidoFavorAcumulado ?? 0;
  const cfdiIsrFavorMes =
    cashResult.isrRetenidoFavorMesPeriodo ?? cashResult.cashBasisSummary.retencionResico125;

  const isrRetenidoFavorPeriodo = esResicoPf
    ? useCashFlow
      ? cashResult.cashBasisSummary.retencionResico125 > 0
        ? cashResult.cashBasisSummary.retencionResico125
        : hasUnpaidPpdEmitidos
          ? 0
          : tbIsrMes
      : tbIsrMes
    : useCashFlow
      ? cfdiIsrFavorAcum > 0
        ? hasUnpaidPpdEmitidos
          ? cfdiIsrFavorAcum
          : Math.max(cfdiIsrFavorAcum, tbIsrYtd)
        : hasUnpaidPpdEmitidos
          ? 0
          : tbIsrYtd
      : tbIsrYtd;

  const rawIsrMes = esResicoPf
    ? isrRetenidoFavorPeriodo
    : useCashFlow
      ? cfdiIsrFavorMes > 0
        ? hasUnpaidPpdEmitidos
          ? cfdiIsrFavorMes
          : Math.max(cfdiIsrFavorMes, tbIsrMes)
        : hasUnpaidPpdEmitidos
          ? 0
          : tbIsrMes
      : tbIsrMes;
  const isrRetenidoMesActual = has113Activity
    ? fromCents(Math.min(toCents(rawIsrMes), Math.max(0, toCents(accIsrFavor!.finalBalance))))
    : rawIsrMes;

  const tbIvaFavor = Math.max(0, accIvaFavor?.periodCharges ?? 0);
  const ivaRetenidoFavorPeriodo = useCashFlow
    ? cashResult.ivaRetenidoFavorPeriodo > 0
      ? cashResult.ivaRetenidoFavorPeriodo
      : hasUnpaidPpdEmitidos
        ? 0
        : tbIvaFavor
    : tbIvaFavor;

  const tbIsrPorPagar = fromCents(
    sumCents(accRetIsrList.map((a) => Math.max(0, a.periodCredits)))
  );
  const isrRetenidoPorPagar =
    useCashFlow &&
    (cashResult.hasRecibidosCashActivity || cashResult.hasPayrollCashActivity) &&
    tbIsrPorPagar === 0
      ? cashResult.isrRetenidoPorPagarPeriodo
      : tbIsrPorPagar;

  const tbIvaPorPagar = fromCents(
    sumCents(accRetIvaList.map((a) => Math.max(0, a.periodCredits)))
  );
  const ivaRetenidoPorPagar =
    useCashFlow && cashResult.hasRecibidosCashActivity && tbIvaPorPagar === 0
      ? cashResult.ivaRetenidoPorPagarPeriodo
      : tbIvaPorPagar;

  const retencionesDesglose: RetencionDesgloseItem[] = retention216Accounts
    .filter((a) => toCents(a.periodCredits) > 0)
    .map((a) => {
      const isIva = isIvaRetentionAccount(a);
      return {
        code: a.code,
        satGroupCode: a.satGroupCode || (isIva ? '216.10' : '216.01'),
        name: a.name,
        tipo: isIva ? 'IVA' : 'ISR',
        amount: fromCents(Math.max(0, toCents(a.periodCredits)))
      };
    });
  if (retencionesDesglose.length === 0) {
    if (isrRetenidoPorPagar > 0) {
      retencionesDesglose.push({
        code: '216-01-001',
        satGroupCode: '216.04',
        name: 'ISR Retenido por Pagar (CFDIs)',
        tipo: 'ISR',
        amount: isrRetenidoPorPagar
      });
    }
    if (ivaRetenidoPorPagar > 0) {
      retencionesDesglose.push({
        code: '216-01-002',
        satGroupCode: '216.10',
        name: 'IVA Retenido por Pagar (CFDIs)',
        tipo: 'IVA',
        amount: ivaRetenidoPorPagar
      });
    }
  }

  const includeNonCfdiPayrollAndDep = useCashFlow && !esResicoPf;
  let extraDedPeriodoCents = 0;
  let extraDedAcumCents = 0;
  if (includeNonCfdiPayrollAndDep) {
    for (const a of egresosAccounts) {
      if (!isNonCfdiCashDeductionAccount(a)) continue;
      extraDedPeriodoCents += Math.max(0, toCents(a.periodCharges - a.periodCredits));
      extraDedAcumCents += Math.max(
        0,
        toCents(a.nature === 'ACREEDORA' ? -a.finalBalance : a.finalBalance)
      );
    }
  }
  const cashDedPeriodo = fromCents(toCents(cashResult.deduccionesPeriodo) + extraDedPeriodoCents);
  const cashDedAcum = fromCents(toCents(cashResult.deduccionesAcumuladas) + extraDedAcumCents);
  const effectiveCashSummary =
    includeNonCfdiPayrollAndDep && extraDedPeriodoCents > 0
      ? { ...cashResult.cashBasisSummary, deduccionesPagadasFlujo: cashDedPeriodo }
      : cashResult.cashBasisSummary;

  return computeFiscalWorkpaper({
    company,
    ejercicio,
    periodo,
    parameters,
    ingresosPeriodo: useCashFlow ? cashResult.ingresosPeriodo : tbIngresosPeriodo,
    ingresosAcumuladosEjercicio: useCashFlow ? cashResult.ingresosAcumulados : tbIngresosAcumulados,
    deduccionesAutorizadasPeriodo: useCashFlow ? cashDedPeriodo : tbDeduccionesPeriodo,
    deduccionesAcumuladasEjercicio: useCashFlow ? cashDedAcum : tbDeduccionesAcumuladas,
    ivaTrasladadoCobrado,
    ivaAcreditablePagado,
    isrRetenidoPorPagar,
    ivaRetenidoPorPagar,
    isrRetenidoFavorPeriodo,
    isrRetenidoMesActual,
    ivaRetenidoFavorPeriodo,
    usdCfdis,
    cashBasisSummary: effectiveCashSummary,
    resicoThresholdAlert: cashResult.resicoThresholdAlert,
    ivaBreakdown: effectiveIvaBreakdown,
    retencionesDesglose
  });
}
