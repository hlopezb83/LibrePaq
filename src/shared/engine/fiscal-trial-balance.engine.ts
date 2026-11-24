import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  FiscalWorkpaperResponse,
  RetencionDesgloseItem,
  TaxParametersRecord
} from '../types';
import { parseCalendarDate } from '../date-utils';
import { computeCashBasisFiscalSummary } from './cash-basis-fiscal.engine';
import { computeFiscalWorkpaper, type UsdMonetaryItemInput } from './fiscal.engine';
import { fromCents, sumCents, toCents } from './invariants-and-math';

function resolveOpenUsdPpdCfdis(
  cfdis: readonly CfdiDocument[],
  ejercicio: number,
  periodo: number
): UsdMonetaryItemInput[] {
  const targetPeriod = periodo === 13 ? 12 : Math.max(1, Math.min(12, periodo));
  const isOnOrBeforeCutoff = (fecha: string): boolean => {
    const cal = parseCalendarDate(fecha, ejercicio, targetPeriod);
    return cal.year < ejercicio || (cal.year === ejercicio && cal.month <= targetPeriod);
  };

  const usdPpdDocs = cfdis.filter(
    (c) =>
      c.moneda?.toUpperCase() === 'USD' &&
      c.statusSat !== 'CANCELADO' &&
      c.metodoPago === 'PPD' &&
      (c.tipoComprobante === 'I' ||
        (c.tipoComprobante === 'E' && !c.uuidRelacionado && !(c.relatedDocs && c.relatedDocs.length > 0))) &&
      isOnOrBeforeCutoff(c.fecha)
  );
  const usdByUuid = new Map<string, CfdiDocument>();
  for (const doc of usdPpdDocs) {
    const key = (doc.uuid || '').trim().toUpperCase();
    if (key) usdByUuid.set(key, doc);
  }

  const settledUsdCents = new Map<string, number>();
  const minInsolutoCents = new Map<string, number>();
  const addSettled = (uuid: string, cents: number) => {
    if (!uuid || cents <= 0) return;
    settledUsdCents.set(uuid, (settledUsdCents.get(uuid) ?? 0) + cents);
  };

  for (const c of cfdis) {
    if (c.statusSat === 'CANCELADO') continue;
    if (c.tipoComprobante !== 'P' && c.tipoComprobante !== 'E') continue;
    if (!isOnOrBeforeCutoff(c.fecha)) continue;

    if (c.relatedDocs && c.relatedDocs.length > 0) {
      for (const dr of c.relatedDocs) {
        const targetUuid = (dr.idDocumento || '').trim().toUpperCase();
        if (!targetUuid) continue;
        const drCur = (dr.monedaDr || 'USD').toUpperCase();
        const targetInv = usdByUuid.get(targetUuid);
        const invTc = targetInv && targetInv.tipoCambio > 1 ? targetInv.tipoCambio : 1;
        const paidUsdCents =
          drCur === 'USD' ? toCents(dr.impPagado) : drCur === 'MXN' ? toCents(dr.impPagado / invTc) : 0;
        addSettled(targetUuid, paidUsdCents);

        if (c.tipoComprobante === 'P' && drCur === 'USD' && dr.impSaldoInsoluto !== undefined) {
          const isValidZero =
            dr.impSaldoInsoluto === 0 && (dr.impSaldoAnt <= 0 || dr.impPagado >= dr.impSaldoAnt - 0.01);
          if (dr.impSaldoInsoluto > 0 || isValidZero) {
            const insCents = Math.max(0, toCents(dr.impSaldoInsoluto));
            const prev = minInsolutoCents.get(targetUuid);
            minInsolutoCents.set(targetUuid, prev === undefined ? insCents : Math.min(prev, insCents));
          }
        }
      }
    } else if (c.uuidRelacionado) {
      const targetUuid = c.uuidRelacionado.trim().toUpperCase();
      const targetInv = usdByUuid.get(targetUuid);
      const cur = (c.moneda || 'MXN').toUpperCase();
      const invTc = targetInv && targetInv.tipoCambio > 1 ? targetInv.tipoCambio : 1;
      const usdCents =
        cur === 'USD' ? toCents(c.total) : cur === 'MXN' ? toCents(c.total / invTc) : 0;
      addSettled(targetUuid, usdCents);
    }
  }

  const result: UsdMonetaryItemInput[] = [];
  for (const doc of usdPpdDocs) {
    const key = (doc.uuid || '').trim().toUpperCase();
    const origCents = toCents(doc.total);
    const paidCents = key ? (settledUsdCents.get(key) ?? 0) : 0;
    let remainingCents = Math.max(0, origCents - paidCents);
    const minIns = key ? minInsolutoCents.get(key) : undefined;
    if (minIns !== undefined) remainingCents = Math.min(remainingCents, minIns);
    if (remainingCents <= 0) continue;
    result.push({ ...doc, saldoInsolutoUsd: fromCents(remainingCents) });
  }
  return result;
}

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
  const isIvaRetentionAcc = (a: AccountWithBalance): boolean => {
    const sat = (a.satGroupCode ?? '').trim();
    if (sat === '216.10') return true;
    if (sat.startsWith('216.') && sat !== '216.10') return false;
    if (a.code === '216-01-002') return true;
    const lower = a.name.toLowerCase();
    return lower.includes('iva') && !lower.includes('isr');
  };
  const retention216Accounts = trialBalance.filter(
    (a) => a.isAffectable && (a.code.startsWith('216') || (a.satGroupCode ?? '').startsWith('216'))
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
    baseContableDevengada: tbIngresosPeriodo
  });

  const useCashFlow =
    cfdis.length > 0 && cashResult.isCashBasisRegime && cashResult.hasCfdiCashActivity;

  const tbIvaPagado = accIvaPagado?.periodCharges ?? 0;
  const prorationFactor = cashResult.ivaBreakdown.prorationFactor;
  const ivaAcreditablePagado =
    useCashFlow && cashResult.hasRecibidosCashActivity
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

  const tbIsrPorPagar = fromCents(
    sumCents(accRetIsrList.map((a) => Math.max(0, a.periodCredits)))
  );
  const isrRetenidoPorPagar =
    useCashFlow && cashResult.hasRecibidosCashActivity && tbIsrPorPagar === 0
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
    ivaBreakdown: effectiveIvaBreakdown,
    retencionesDesglose
  });
}
