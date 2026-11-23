import { Hono } from 'hono';
import {
  computeTrialBalance,
  getCfdiDocuments,
  getDiotReport,
  getPolizas
} from '../db';
import { buildFinancialStatementsFromTrialBalance } from '../../shared/engine/financial-reports.engine';
import { buildSatAnexo24Xml, resolveYearAndPeriod } from '../validators';
import { getAuthorizedCompanyForRoute } from './route-helpers';
import type { Anexo24CfdiMetadata } from '../../shared/sat-anexo24';

export const reportsRoutes = new Hono();

reportsRoutes.get('/reports', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const company = getAuthorizedCompanyForRoute(c, companyId);
  if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );

  const trialBalance = computeTrialBalance(company.id, year, period);
  return c.json(buildFinancialStatementsFromTrialBalance(company, trialBalance, year, period));
});

reportsRoutes.get('/sat-xml', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const type = c.req.query('type') || 'balanza';
  const company = getAuthorizedCompanyForRoute(c, companyId);
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
  const company = getAuthorizedCompanyForRoute(c, companyId);
  if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );
  return c.json(getDiotReport(company.id, year, period));
});
