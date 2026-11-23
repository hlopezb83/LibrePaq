import { MESES_SAT } from '../sat-constants';
import type {
  AccountWithBalance,
  CfdiDocument,
  DashboardSummary,
  Poliza
} from '../types';
import { fromCents, toCents } from './invariants-and-math';

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
}): {
  kpis: DashboardSummary['kpis'];
  recentPolizas: Poliza[];
  pendingCfdis: CfdiDocument[];
} {
  const { trialBalance, polizas, cfdis, year, period } = params;
  const byCode = new Map(trialBalance.map((a) => [a.code, a]));

  const ingresosAcc = byCode.get('400-00-000');
  const costosAcc = byCode.get('500-00-000');
  const gastosAcc = byCode.get('600-00-000');
  const isrAcc = byCode.get('800-00-000') || byCode.get('801-00-000') || byCode.get('801-01-000');

  const ingresosCents = ingresosAcc
    ? toCents(ingresosAcc.periodCredits) - toCents(ingresosAcc.periodCharges)
    : 0;
  const costosCents = costosAcc
    ? toCents(costosAcc.periodCharges) - toCents(costosAcc.periodCredits)
    : 0;
  const gastosCents = gastosAcc
    ? toCents(gastosAcc.periodCharges) - toCents(gastosAcc.periodCredits)
    : 0;
  const isrCents = isrAcc ? toCents(isrAcc.periodCharges) - toCents(isrAcc.periodCredits) : 0;
  const egresosCents = costosCents + gastosCents + isrCents;

  const ivaTrasladadoCents = toCents(byCode.get('208-00-000')?.finalBalance);
  const ivaAcreditableCents = toCents(byCode.get('118-00-000')?.finalBalance);

  const periodPrefix = `${year}-${String(period).padStart(2, '0')}`;
  const periodCfdis = cfdis.filter(
    (doc) => doc.fecha?.startsWith(periodPrefix) && doc.statusSat !== 'CANCELADO'
  );
  const pendingCfdis = periodCfdis.filter((doc) => !doc.polizaId);

  return {
    kpis: {
      ingresosPeriodo: fromCents(ingresosCents),
      egresosPeriodo: fromCents(egresosCents),
      utilidadNeta: fromCents(ingresosCents - egresosCents),
      efectivoBancos: byCode.get('102-00-000')?.finalBalance ?? 0,
      cuentasPorCobrar: byCode.get('105-00-000')?.finalBalance ?? 0,
      cuentasPorPagar: byCode.get('201-00-000')?.finalBalance ?? 0,
      ivaPorPagarNeto: fromCents(ivaTrasladadoCents - ivaAcreditableCents),
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
