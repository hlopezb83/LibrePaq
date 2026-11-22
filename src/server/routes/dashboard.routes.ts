import { Hono } from 'hono';
import {
  computeMonthlyTrendFast,
  computeTrialBalance,
  getCfdiDocuments,
  getCompanyById,
  getPolizas
} from '../db';
import { fromCents, toCents } from '../../shared/accounting-engine';
import { resolveYearAndPeriod } from '../validators';
import type { AccountWithBalance, DashboardSummary } from '../../shared/types';

export const dashboardRoutes = new Hono();

dashboardRoutes.get('/dashboard', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const company = getCompanyById(companyId);
  if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );

  const trialBalance = computeTrialBalance(company.id, year, period);
  const polizas = getPolizas(company.id, year, period);
  const cfdis = getCfdiDocuments(company.id);

  const byCode = new Map<string, AccountWithBalance>(trialBalance.map((a) => [a.code, a]));
  const ingresosAcc = byCode.get('400-00-000');
  const costosAcc = byCode.get('500-00-000');
  const gastosAcc = byCode.get('600-00-000');

  const ingresosCents = ingresosAcc
    ? toCents(ingresosAcc.periodCredits) - toCents(ingresosAcc.periodCharges)
    : 0;
  const costosCents = costosAcc
    ? toCents(costosAcc.periodCharges) - toCents(costosAcc.periodCredits)
    : 0;
  const gastosCents = gastosAcc
    ? toCents(gastosAcc.periodCharges) - toCents(gastosAcc.periodCredits)
    : 0;
  const isrAcc = byCode.get('800-00-000') || byCode.get('801-00-000') || byCode.get('801-01-000');
  const isrCents = isrAcc
    ? toCents(isrAcc.periodCharges) - toCents(isrAcc.periodCredits)
    : 0;
  const egresosCents = costosCents + gastosCents + isrCents;

  const efectivoBancos = byCode.get('102-00-000')?.finalBalance ?? 0;
  const cuentasPorCobrar = byCode.get('105-00-000')?.finalBalance ?? 0;
  const cuentasPorPagar = byCode.get('201-00-000')?.finalBalance ?? 0;

  const ivaTrasladadoCents = toCents(byCode.get('208-00-000')?.finalBalance);
  const ivaAcreditableCents = toCents(byCode.get('118-00-000')?.finalBalance);

  const periodPrefix = `${year}-${String(period).padStart(2, '0')}`;
  const periodCfdis = cfdis.filter(
    (doc) => doc.fecha?.startsWith(periodPrefix) && doc.statusSat !== 'CANCELADO'
  );
  const pendingCfdis = periodCfdis.filter((doc) => !doc.polizaId);
  const startMonth = Math.max(1, Math.min(7, period - 5));
  const monthsToQuery = Array.from({ length: 6 }, (_, idx) => startMonth + idx);
  const monthlyTrend = computeMonthlyTrendFast(company.id, year, monthsToQuery);

  const summary: DashboardSummary = {
    company,
    kpis: {
      ingresosPeriodo: fromCents(ingresosCents),
      egresosPeriodo: fromCents(egresosCents),
      utilidadNeta: fromCents(ingresosCents - egresosCents),
      efectivoBancos,
      cuentasPorCobrar,
      cuentasPorPagar,
      ivaPorPagarNeto: fromCents(ivaTrasladadoCents - ivaAcreditableCents),
      totalPolizasPeriodo: polizas.length,
      cfdisPendientesContabilizar: pendingCfdis.length,
      cfdisTotalesPeriodo: periodCfdis.length
    },
    monthlyTrend,
    recentPolizas: polizas.slice(0, 5),
    pendingCfdis: pendingCfdis.slice(0, 5)
  };

  return c.json(summary);
});
