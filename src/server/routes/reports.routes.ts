import { Hono } from 'hono';
import {
  computeTrialBalance,
  getCfdiDocuments,
  getDiotReport,
  getPolizas
} from '../db';
import { buildFinancialStatementsFromTrialBalance } from '../../shared/engine/financial-reports.engine';
import {
  isValidSatNumOrden,
  isValidSatNumTramite,
  type Anexo24CfdiMetadata,
  type SatAnexo24Options
} from '../../shared/sat-anexo24';
import { buildSatAnexo24Xml, resolveYearAndPeriod } from '../validators';
import { getAuthorizedCompanyForRoute } from './route-helpers';

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

  const rawTipoEnvio = c.req.query('tipoEnvio')?.toUpperCase();
  const tipoEnvio = rawTipoEnvio === 'C' ? 'C' : rawTipoEnvio === 'N' ? 'N' : undefined;
  const fechaModBal = c.req.query('fechaModBal') || undefined;
  const rawSol = c.req.query('tipoSolicitud')?.toUpperCase();
  const tipoSolicitud =
    rawSol === 'AF' || rawSol === 'FC' || rawSol === 'DE' || rawSol === 'CO' ? rawSol : undefined;
  const numOrden = c.req.query('numOrden')?.trim().toUpperCase() || undefined;
  const numTramite = c.req.query('numTramite')?.trim().toUpperCase() || undefined;

  if (numOrden && !isValidSatNumOrden(numOrden)) {
    return c.json({ error: 'Formato inválido de NumOrden SAT (ej. ABC1234567/01).' }, 400);
  }
  if (numTramite && !isValidSatNumTramite(numTramite)) {
    return c.json({ error: 'Formato inválido de NumTramite SAT (10-14 alfanuméricos).' }, 400);
  }

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );
  const trialBalance = computeTrialBalance(company.id, year, period);
  const needsPolizas =
    type === 'polizas' || type === 'auxiliar_folios' || type === 'auxiliar_cuentas';
  const needsCfdiLookup = type === 'polizas' || type === 'auxiliar_folios';

  const polizas = needsPolizas ? getPolizas(company.id, year, period) : [];
  let cfdiLookup: Map<string, Anexo24CfdiMetadata> | undefined;
  if (needsCfdiLookup) {
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

  const options: SatAnexo24Options = {
    tipoEnvio,
    fechaModBal,
    tipoSolicitud,
    numOrden,
    numTramite,
    cfdiLookup
  };
  return c.json(buildSatAnexo24Xml(company, year, period, type, trialBalance, polizas, options));
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
