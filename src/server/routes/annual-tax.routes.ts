import { Hono } from 'hono';
import { resolveRequestActor } from '../auth-actor';
import {
  getAnnualTaxSummaryRepo,
  saveAnnualTaxInputsRepo
} from '../repositories/annual-tax.repo';
import { assertRouteCompanyAccess, errorStatus } from './route-helpers';

export const annualTaxRoutes = new Hono();

annualTaxRoutes.get('/companies/:companyId/annual-tax', (c) => {
  try {
    const companyId = c.req.param('companyId');
    const denied = assertRouteCompanyAccess(c, companyId);
    if (denied) return denied;

    const { userId } = resolveRequestActor(c);
    const rawYear = c.req.query('year') ?? c.req.query('ejercicio');
    const parsedYear = rawYear ? Number(rawYear) : undefined;
    const ejercicio =
      parsedYear && Number.isFinite(parsedYear) && parsedYear >= 2000
        ? Math.round(parsedYear)
        : undefined;

    return c.json(getAnnualTaxSummaryRepo(companyId, ejercicio, userId));
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

annualTaxRoutes.post('/companies/:companyId/annual-tax', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const denied = assertRouteCompanyAccess(c, companyId, { requireWrite: true });
    if (denied) return denied;

    const { userId } = resolveRequestActor(c);
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const rawYear = body.ejercicio ?? body.year ?? c.req.query('year');
    const ejercicio =
      rawYear !== undefined && Number.isFinite(Number(rawYear)) && Number(rawYear) >= 2000
        ? Math.round(Number(rawYear))
        : new Date().getFullYear();

    saveAnnualTaxInputsRepo(companyId, ejercicio, {
      inpcCierreAnterior:
        body.inpcCierreAnterior !== undefined ? Number(body.inpcCierreAnterior) : undefined,
      inpcCierreActual:
        body.inpcCierreActual !== undefined ? Number(body.inpcCierreActual) : undefined,
      cucaInicial: body.cucaInicial !== undefined ? Number(body.cucaInicial) : undefined,
      aportacionesCapital:
        body.aportacionesCapital !== undefined ? Number(body.aportacionesCapital) : undefined,
      reduccionesCapital:
        body.reduccionesCapital !== undefined ? Number(body.reduccionesCapital) : undefined,
      cufinInicial: body.cufinInicial !== undefined ? Number(body.cufinInicial) : undefined,
      dividendosPagados:
        body.dividendosPagados !== undefined ? Number(body.dividendosPagados) : undefined,
      ptuPagadaAnterior:
        body.ptuPagadaAnterior !== undefined ? Number(body.ptuPagadaAnterior) : undefined,
      noDeduciblesManual:
        body.noDeduciblesManual !== undefined ? Number(body.noDeduciblesManual) : undefined,
      deduccionesPersonales:
        body.deduccionesPersonales !== undefined ? Number(body.deduccionesPersonales) : undefined
    }, userId);

    return c.json(getAnnualTaxSummaryRepo(companyId, ejercicio, userId));
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});
