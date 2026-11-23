import { Hono } from 'hono';
import {
  computeMonthlyTrendFast,
  computeTrialBalance,
  getCfdiDocuments,
  getCompanyById,
  getPolizas
} from '../db';
import { buildDashboardKpisFromTrialBalance } from '../../shared/engine/dashboard.engine';
import { resolveYearAndPeriod } from '../validators';
import type { DashboardSummary } from '../../shared/types';

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

  const { kpis, recentPolizas, pendingCfdis } = buildDashboardKpisFromTrialBalance({
    trialBalance,
    polizas,
    cfdis,
    year,
    period
  });

  const startMonth = Math.max(1, Math.min(7, period - 5));
  const monthsToQuery = Array.from({ length: 6 }, (_, idx) => startMonth + idx);
  const monthlyTrend = computeMonthlyTrendFast(company.id, year, monthsToQuery);

  const summary: DashboardSummary = {
    company,
    kpis,
    monthlyTrend,
    recentPolizas,
    pendingCfdis
  };

  return c.json(summary);
});
