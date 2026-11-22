import { Hono } from 'hono';
import {
  computeTrialBalance,
  getCompanyById,
  getCfdiDocuments,
  getDiotReport,
  getPolizas
} from '../db';
import { fromCents, toCents } from '../../shared/accounting-engine';
import { buildSatAnexo24Xml, resolveYearAndPeriod } from '../validators';
import type { FinancialStatementsResponse } from '../../shared/types';
import type { Anexo24CfdiMetadata } from '../../shared/sat-anexo24';

export const reportsRoutes = new Hono();

reportsRoutes.get('/reports', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const company = getCompanyById(companyId);
  if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );

  const trialBalance = computeTrialBalance(company.id, year, period);
  const affectable = trialBalance.filter((a) => a.isAffectable);

  let initialDeudorCents = 0;
  let initialAcreedorCents = 0;
  let totalCargosCents = 0;
  let totalAbonosCents = 0;
  let finalDeudorCents = 0;
  let finalAcreedorCents = 0;

  for (const acc of affectable) {
    if (acc.nature === 'DEUDORA') {
      initialDeudorCents += toCents(acc.initialBalanceComputed);
      finalDeudorCents += toCents(acc.finalBalance);
    } else {
      initialAcreedorCents += toCents(acc.initialBalanceComputed);
      finalAcreedorCents += toCents(acc.finalBalance);
    }
    totalCargosCents += toCents(acc.periodCharges);
    totalAbonosCents += toCents(acc.periodCredits);
  }

  const ingresos = trialBalance.filter((a) => a.type === 'INGRESOS' && a.level >= 2);
  const costos = trialBalance.filter((a) => a.type === 'COSTOS' && a.level >= 2);
  const gastos = trialBalance.filter((a) => a.type === 'GASTOS' && a.level >= 2);

  const totalIngresosCents = toCents(
    trialBalance.find((a) => a.code === '400-00-000')?.finalBalance
  );
  const totalCostosCents = toCents(trialBalance.find((a) => a.code === '500-00-000')?.finalBalance);
  const utilidadBrutaCents = totalIngresosCents - totalCostosCents;
  const totalGastosCents = toCents(trialBalance.find((a) => a.code === '600-00-000')?.finalBalance);
  const isrEjercicio = trialBalance.filter(
    (a) =>
      (a.code.startsWith('801') || a.code.startsWith('800') || a.satGroupCode.startsWith('611')) &&
      a.level >= 2
  );
  const totalIsrCents = toCents(
    trialBalance.find((a) => a.code === '800-00-000' || a.code === '801-00-000')?.finalBalance ??
    trialBalance.find((a) => a.code === '801-01-000')?.finalBalance
  );
  const utilidadNetaCents = utilidadBrutaCents - totalGastosCents - totalIsrCents;

  const activos = trialBalance.filter((a) => a.type === 'ACTIVO' && a.level >= 2);
  const pasivos = trialBalance.filter((a) => a.type === 'PASIVO' && a.level >= 2);
  const capital = trialBalance.filter((a) => a.type === 'CAPITAL' && a.level >= 2);

  const totalActivoCents = toCents(trialBalance.find((a) => a.code === '100-00-000')?.finalBalance);
  const totalPasivoCents = toCents(trialBalance.find((a) => a.code === '200-00-000')?.finalBalance);
  const totalCapitalBaseCents = toCents(
    trialBalance.find((a) => a.code === '300-00-000')?.finalBalance
  );
  const totalPasivoMasCapitalCents =
    totalPasivoCents + totalCapitalBaseCents + utilidadNetaCents;

  const response: FinancialStatementsResponse = {
    company,
    ejercicio: year,
    periodo: period,
    trialBalance,
    totals: {
      initialDeudor: fromCents(initialDeudorCents),
      initialAcreedor: fromCents(initialAcreedorCents),
      totalCargos: fromCents(totalCargosCents),
      totalAbonos: fromCents(totalAbonosCents),
      finalDeudor: fromCents(finalDeudorCents),
      finalAcreedor: fromCents(finalAcreedorCents)
    },
    incomeStatement: {
      ingresos,
      totalIngresos: fromCents(totalIngresosCents),
      costos,
      totalCostos: fromCents(totalCostosCents),
      utilidadBruta: fromCents(utilidadBrutaCents),
      gastos,
      totalGastos: fromCents(totalGastosCents),
      isrEjercicio,
      totalIsr: fromCents(totalIsrCents),
      utilidadNeta: fromCents(utilidadNetaCents)
    },
    balanceSheet: {
      activos,
      totalActivo: fromCents(totalActivoCents),
      pasivos,
      totalPasivo: fromCents(totalPasivoCents),
      capital,
      totalCapitalBase: fromCents(totalCapitalBaseCents),
      utilidadEjercicio: fromCents(utilidadNetaCents),
      totalPasivoMasCapital: fromCents(totalPasivoMasCapitalCents),
      isBalanced: Math.abs(totalActivoCents - totalPasivoMasCapitalCents) <= 5
    }
  };

  return c.json(response);
});

reportsRoutes.get('/sat-xml', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const type = c.req.query('type') || 'balanza';
  const userId = c.req.header('X-User-Id') || c.req.header('x-user-id');
  const company = getCompanyById(companyId, userId);
  if (!company) return c.json({ error: 'Empresa no encontrada o no autorizada' }, 404);

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );
  const trialBalance = computeTrialBalance(company.id, year, period);
  const polizas = type === 'polizas' ? getPolizas(company.id, year, period) : [];
  let cfdiLookup: Map<string, Anexo24CfdiMetadata> | undefined;
  if (type === 'polizas') {
    const cfdis = getCfdiDocuments(company.id);
    cfdiLookup = new Map<string, Anexo24CfdiMetadata>();
    for (const cf of cfdis) {
      if (cf.uuid) {
        cfdiLookup.set(cf.uuid.toUpperCase(), {
          total: cf.total,
          rfcContraparte: cf.direction === 'EMITIDO' ? cf.receptorRfc : cf.emisorRfc,
          moneda: cf.moneda,
          tipoCambio: cf.tipoCambio
        });
      }
    }
  }
  return c.json(buildSatAnexo24Xml(company, year, period, type, trialBalance, polizas, { cfdiLookup }));
});

reportsRoutes.get('/diot', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const company = getCompanyById(companyId);
  if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );
  return c.json(getDiotReport(company.id, year, period));
});
