import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  FiscalWorkpaperResponse,
  RetencionDesgloseItem,
  TaxParametersRecord,
  ThirdPartyRecord
} from '../types';
import type { AccountingRuleRecord } from '../types/accounting-rules.types';
import { computeCashBasisFiscalSummary } from './cash-basis-fiscal.engine';
import { computeFiscalWorkpaper } from './fiscal.engine';
import {
  isNonCfdiCashDeductionAccount,
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
}): FiscalWorkpaperResponse {
  const { company, ejercicio, periodo, parameters, trialBalance, cfdis, rules, thirdParties } = params;

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
  const isIvaRetentionAcc = (a: AccountWithBalance): boolean => {
    const sat = (a.satGroupCode ?? '').trim();
    if (sat === '216.10') return true;
    if (sat.startsWith('216.') && sat !== '216.10') return false;
    if (a.code === '216-01-002') return true;
    const lower = a.name.toLowerCase();
    return lower.includes('iva') && !lower.includes('isr');
  };
  const isImss216Account = (a: AccountWithBalance): boolean => {
    const sat = (a.satGroupCode ?? '').trim();
    const lower = a.name.toLowerCase();
    return sat === '216.11' && (!lower.includes('isr') || lower.includes('imss'));
  };
  const retention216Accounts = trialBalance.filter(
    (a) =>
      a.isAffectable &&
      (a.code.startsWith('216') || (a.satGroupCode ?? '').startsWith('216')) &&
      !isImss216Account(a)
  );
  const accRetIvaList = retention216Accounts.filter(isIvaRetentionAcc);
  const accRetIsrList = retention216Accounts.filter((a) => !isIvaRetentionAcc(a));
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
  const hasUnpaidPpdEmitidos = cfdis.some(
    (c) => c.statusSat !== 'CANCELADO' && c.direction === 'EMITIDO' && c.metodoPago === 'PPD'
  );
  const hasUnpaidPpdRecibidos = cfdis.some(
    (c) => c.statusSat !== 'CANCELADO' && c.direction === 'RECIBIDO' && c.metodoPago === 'PPD'
  );
  const useCashFlow =
    cfdis.length > 0 &&
    cashResult.isCashBasisRegime &&
    (cashResult.hasCfdiCashActivity || cashResult.hasUnpaidPpdInScope);

  const tbIvaPagado = fromCents(
    Math.max(0, sumCents(ivaPagadoAccounts.map((a) => a.periodCharges - a.periodCredits)))
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

  const tbIvaCobrado = fromCents(
    Math.max(0, sumCents(ivaCobradoAccounts.map((a) => a.periodCredits - a.periodCharges)))
  );
  const ivaTrasladadoCobrado =
    useCashFlow && (cashResult.hasEmitidosCashActivity || hasUnpaidPpdEmitidos)
      ? cashResult.ivaTrasladadoCobradoPeriodo
      : tbIvaCobrado;

  const tbIsrFavor = esResicoPf
    ? (accIsrFavor?.periodCharges ?? 0)
    : Math.max(accIsrFavor?.periodCharges ?? 0, accIsrFavor?.finalBalance ?? 0);
  const cfdiIsrFavorAcum =
    cashResult.cashBasisSummary.isrRetenidoFavorAcumulado ?? cashResult.isrRetenidoFavorAcumulado ?? 0;
  const isrRetenidoFavorPeriodo = esResicoPf
    ? (useCashFlow && cashResult.cashBasisSummary.retencionResico125 > 0
        ? cashResult.cashBasisSummary.retencionResico125
        : tbIsrFavor)
    : cfdiIsrFavorAcum > 0
      ? Math.max(cfdiIsrFavorAcum, tbIsrFavor)
      : tbIsrFavor;

  const tbIvaFavor = accIvaFavor?.periodCharges ?? 0;
  const ivaRetenidoFavorPeriodo =
    useCashFlow && cashResult.ivaRetenidoFavorPeriodo > 0
      ? cashResult.ivaRetenidoFavorPeriodo
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
      const isIva = isIvaRetentionAcc(a);
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
    ivaRetenidoFavorPeriodo,
    usdCfdis,
    cashBasisSummary: effectiveCashSummary,
    resicoThresholdAlert: cashResult.resicoThresholdAlert,
    ivaBreakdown: effectiveIvaBreakdown,
    retencionesDesglose
  });
}
