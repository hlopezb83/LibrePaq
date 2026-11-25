import { MESES_SAT } from '../sat-constants';
import type {
  AccountWithBalance,
  CfdiDocument,
  DashboardSummary,
  FiscalWorkpaperResponse,
  Poliza
} from '../types';
import {
  classifyPnlBucket,
  getLeafIds,
  normalizePostCloseP13Accounts
} from './financial-reports-helpers';
import type { ClosingMovementCents } from './financial-reports-rollup';
import { fromCents, toCents } from './invariants-and-math';

/**
 * Calcula la razón de cobertura de efectivo sobre el Pasivo Total (Efectivo / Total Pasivo).
 */
export function computeDashboardCashCoverage(efectivoBancos: number, totalPasivo: number): string {
  return totalPasivo > 0 ? (efectivoBancos / totalPasivo).toFixed(2) : 'S/D';
}

function sumCashGroupCents(
  trialBalance: readonly AccountWithBalance[],
  byCode: ReadonlyMap<string, AccountWithBalance>,
  prefix: '101' | '102'
): number {
  const header = byCode.get(`${prefix}-00-000`);
  if (header) {
    return (header.nature === 'DEUDORA' ? 1 : -1) * toCents(header.finalBalance);
  }
  const leaves = trialBalance.filter(
    (a) =>
      a.isAffectable !== false &&
      (a.code.startsWith(prefix) || a.satGroupCode?.startsWith(prefix))
  );
  return leaves.reduce(
    (sum, a) => sum + (a.nature === 'DEUDORA' ? 1 : -1) * toCents(a.finalBalance),
    0
  );
}

/**
 * Construye los KPIs ejecutivos y listas recientes del Dashboard a partir de la balanza,
 * pólizas y CFDIs, compartiendo las mismas fórmulas entre SQLite local y Supabase Cloud.
 */
export function buildDashboardKpisFromTrialBalance(params: {
  trialBalance: readonly AccountWithBalance[];
  polizas: readonly Poliza[];
  cfdis: readonly CfdiDocument[];
  year: number;
  period: number;
  fiscalWorkpaper?: FiscalWorkpaperResponse | null;
}): {
  kpis: DashboardSummary['kpis'];
  recentPolizas: Poliza[];
  pendingCfdis: CfdiDocument[];
} {
  const { trialBalance, polizas, cfdis, year, period, fiscalWorkpaper } = params;
  const byCode = new Map(trialBalance.map((a) => [a.code, a]));

  let closingMap: Map<string, ClosingMovementCents> | undefined;
  if (period === 13) {
    const tmp = new Map<string, ClosingMovementCents>();
    for (const pol of polizas) {
      if (pol.ejercicio !== year || pol.periodo !== 13) continue;
      if (String((pol as { origin?: string }).origin || '') !== 'CIERRE_ANUAL') continue;
      for (const m of pol.movements) {
        const prev = tmp.get(m.accountId) ?? { cargoCents: 0, abonoCents: 0 };
        prev.cargoCents += toCents(m.cargo);
        prev.abonoCents += toCents(m.abono);
        tmp.set(m.accountId, prev);
      }
    }
    if (tmp.size > 0) closingMap = tmp;
  }

  const erAccounts =
    period === 13
      ? normalizePostCloseP13Accounts(trialBalance, period, closingMap).accounts
      : trialBalance;
  const erByCode = new Map(erAccounts.map((a) => [a.code, a]));
  const erLeafIds = getLeafIds(erAccounts);

  const isP13 = period === 13;
  const readCreditFlow = (acc?: AccountWithBalance): number =>
    acc
      ? isP13
        ? (acc.nature === 'ACREEDORA' ? 1 : -1) * toCents(acc.finalBalance)
        : toCents(acc.periodCredits) - toCents(acc.periodCharges)
      : 0;
  const readDebitFlow = (acc?: AccountWithBalance): number =>
    acc
      ? isP13
        ? (acc.nature === 'DEUDORA' ? 1 : -1) * toCents(acc.finalBalance)
        : toCents(acc.periodCharges) - toCents(acc.periodCredits)
      : 0;

  const pnlLeaves = erAccounts.filter(
    (a) =>
      (a.type === 'INGRESOS' || a.type === 'COSTOS' || a.type === 'GASTOS') &&
      erLeafIds.has(a.id)
  );

  let ingresosCents = 0;
  let egresosCents = 0;
  if (pnlLeaves.length > 0) {
    for (const acc of pnlLeaves) {
      const bucket = classifyPnlBucket(acc);
      if (bucket === 'INGRESOS' || bucket === 'RIF_PRODUCTOS') {
        ingresosCents += readCreditFlow(acc);
      } else {
        egresosCents += readDebitFlow(acc);
      }
    }
  } else {
    const ingresosAcc = erByCode.get('400-00-000');
    const costosAcc = erByCode.get('500-00-000');
    const gastosAcc = erByCode.get('600-00-000');
    const acc800 = erByCode.get('800-00-000');
    const isrCandidate =
      (acc800 && acc800.type !== 'ORDEN' ? acc800 : undefined) ||
      erByCode.get('801-00-000') ||
      erByCode.get('801-01-000');
    const isrAcc = isrCandidate && isrCandidate.type !== 'ORDEN' ? isrCandidate : undefined;
    ingresosCents = readCreditFlow(ingresosAcc) + readCreditFlow(erByCode.get('702-00-000'));
    egresosCents =
      readDebitFlow(costosAcc) +
      readDebitFlow(gastosAcc) +
      readDebitFlow(erByCode.get('701-00-000')) +
      readDebitFlow(isrAcc);
  }

  // Alinear IVA Neto del Mes con Día 17 (flujo del periodo en vez de acumulado YTD 208-118)
  let ivaPorPagarNetoCents: number;
  if (fiscalWorkpaper) {
    ivaPorPagarNetoCents =
      fiscalWorkpaper.ivaDefinitivo.ivaNetoAPagar > 0
        ? toCents(fiscalWorkpaper.ivaDefinitivo.ivaNetoAPagar)
        : -toCents(fiscalWorkpaper.ivaDefinitivo.saldoFavorIvaRemanente);
  } else {
    const iva208Leafs = trialBalance.filter(
      (a) =>
        a.isAffectable !== false &&
        (a.code.startsWith('208-01') || a.satGroupCode?.startsWith('208.01'))
    );
    const iva118Leafs = trialBalance.filter(
      (a) =>
        a.isAffectable !== false &&
        (a.code.startsWith('118-01') || a.satGroupCode?.startsWith('118.01'))
    );
    const ivaCobradoMesCents =
      iva208Leafs.length > 0
        ? iva208Leafs.reduce((sum, a) => sum + toCents(a.periodCredits), 0)
        : toCents(byCode.get('208-00-000')?.periodCredits);
    const ivaPagadoMesCents =
      iva118Leafs.length > 0
        ? iva118Leafs.reduce((sum, a) => sum + toCents(a.periodCharges), 0)
        : toCents(byCode.get('118-00-000')?.periodCharges);
    const ivaRetAcredMesCents = toCents(byCode.get('113-01-002')?.periodCharges);
    ivaPorPagarNetoCents = ivaCobradoMesCents - ivaPagadoMesCents - ivaRetAcredMesCents;
  }

  const pasivoCodes = new Set(
    trialBalance.filter((a) => a.type === 'PASIVO').map((a) => a.code)
  );
  const totalPasivoCents = trialBalance
    .filter((a) => a.type === 'PASIVO' && (!a.parentCode || !pasivoCodes.has(a.parentCode)))
    .reduce((sum, a) => sum + (a.nature === 'ACREEDORA' ? 1 : -1) * toCents(a.finalBalance), 0);

  const periodPrefix = `${year}-${String(period).padStart(2, '0')}`;
  const periodCfdis = cfdis.filter(
    (doc) => doc.fecha?.startsWith(periodPrefix) && doc.statusSat !== 'CANCELADO'
  );
  const pendingCfdis = periodCfdis.filter((doc) => !doc.polizaId);

  const cajaCents = sumCashGroupCents(trialBalance, byCode, '101');
  const bancosCents = sumCashGroupCents(trialBalance, byCode, '102');

  return {
    kpis: {
      ingresosPeriodo: fromCents(ingresosCents),
      egresosPeriodo: fromCents(egresosCents),
      utilidadNeta: fromCents(ingresosCents - egresosCents),
      efectivoBancos: fromCents(cajaCents + bancosCents),
      cuentasPorCobrar: byCode.get('105-00-000')?.finalBalance ?? 0,
      cuentasPorPagar: byCode.get('201-00-000')?.finalBalance ?? 0,
      totalPasivo: fromCents(totalPasivoCents),
      ivaPorPagarNeto: fromCents(ivaPorPagarNetoCents),
      totalPolizasPeriodo: polizas.length,
      cfdisPendientesContabilizar: pendingCfdis.length,
      cfdisTotalesPeriodo: periodCfdis.length
    },
    recentPolizas: polizas.slice(0, 5),
    pendingCfdis: pendingCfdis.slice(0, 5)
  };
}

export interface DashboardTrendPolizaInput {
  periodo: number;
  poliza_movements?: Array<{
    cargo?: number | null;
    abono?: number | null;
    accounts?: { type?: string } | null;
  }> | null;
}

export function buildMonthlyTrendFromPolizas(
  months: number[],
  tPols: DashboardTrendPolizaInput[]
): DashboardSummary['monthlyTrend'] {
  const mTrendMap = new Map<number, { ing: number; cos: number; gas: number }>();
  for (const m of months) mTrendMap.set(m, { ing: 0, cos: 0, gas: 0 });

  for (const pol of tPols) {
    const entry = mTrendMap.get(pol.periodo);
    if (!entry) continue;
    for (const mov of pol.poliza_movements || []) {
      const accType = mov.accounts?.type;
      const c = Number(mov.cargo || 0);
      const a = Number(mov.abono || 0);
      if (accType === 'INGRESOS') entry.ing += a - c;
      else if (accType === 'COSTOS') entry.cos += c - a;
      else if (accType === 'GASTOS') entry.gas += c - a;
    }
  }

  return months.map((mIdx) => {
    const mesObj = MESES_SAT.find((m) => m.periodo === mIdx);
    const d = mTrendMap.get(mIdx) || { ing: 0, cos: 0, gas: 0 };
    const ingVal = fromCents(toCents(d.ing));
    const egVal = fromCents(toCents(d.cos + d.gas));
    return {
      periodo: mIdx,
      mesNombre: mesObj?.nombre || `M${mIdx}`,
      ingresos: ingVal,
      egresos: egVal,
      utilidad: fromCents(toCents(ingVal - egVal))
    };
  });
}
