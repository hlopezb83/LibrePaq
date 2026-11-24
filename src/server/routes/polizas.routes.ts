import { Hono } from 'hono';
import {
  closeYearPolizaTransaction,
  createPolizaTransaction,
  deletePolizaTransaction,
  getPolizas,
  reclassifyAccountMovements,
  updatePolizaTransaction
} from '../db';
import { resolveYearAndPeriod, validatePolizaPayload } from '../validators';
import { resolvePolizaYearPeriod } from '../../shared/date-utils';
import { assertRouteCompanyAccess, errorStatus, getAuthorizedCompanyForRoute } from './route-helpers';

export const polizasRoutes = new Hono();

polizasRoutes.get('/polizas', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const company = getAuthorizedCompanyForRoute(c, companyId);
  if (!company) return c.json([]);

  const rawPeriod = c.req.query('period');
  if (rawPeriod === 'ALL') {
    const { year } = resolveYearAndPeriod(c.req.query('year'), undefined, company);
    return c.json(getPolizas(company.id, year, undefined));
  }

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    rawPeriod,
    company
  );
  return c.json(getPolizas(company.id, year, period));
});

polizasRoutes.post('/polizas', async (c) => {
  try {
    const payload = validatePolizaPayload(await c.req.json());
    const company = getAuthorizedCompanyForRoute(c, payload.companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const resolved = resolvePolizaYearPeriod(
      payload.fecha,
      payload.periodo,
      company.currentYear,
      company.currentPeriod
    );

    const created = createPolizaTransaction({
      ...payload,
      ejercicio: resolved.ejercicio,
      periodo: resolved.periodo
    });
    return c.json(created, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

polizasRoutes.put('/polizas/:id', async (c) => {
  try {
    const polizaId = c.req.param('id');
    const payload = validatePolizaPayload(await c.req.json());
    const updated = updatePolizaTransaction(polizaId, payload);
    if (!updated) return c.json({ error: 'Póliza no encontrada' }, 404);
    return c.json({ updated: true });
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

polizasRoutes.delete('/polizas/:id', (c) => {
  try {
    const id = c.req.param('id');
    deletePolizaTransaction(id);
    return c.json({ deleted: true });
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

polizasRoutes.post('/polizas/close-year', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const companyId = String(body.companyId ?? 'comp_tnn_01');
    const switchToPeriod13 =
      body.switchToPeriod13 !== undefined ? Boolean(body.switchToPeriod13) : true;
    const company = getAuthorizedCompanyForRoute(c, companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const res = closeYearPolizaTransaction(company.id, company.currentYear, switchToPeriod13);
    return c.json(res);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

polizasRoutes.post('/polizas/reclassify-account', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const companyId = String(body.companyId ?? 'comp_tnn_01');
    const denied = assertRouteCompanyAccess(c, companyId, {
      requireWrite: true,
      blockDemoWrite: true
    });
    if (denied) return denied;

    const result = reclassifyAccountMovements({
      companyId,
      fromAccountId: String(body.fromAccountId ?? ''),
      toAccountId: String(body.toAccountId ?? ''),
      ejercicio: Number(body.ejercicio ?? 2026),
      periodFrom: body.periodFrom !== undefined ? Number(body.periodFrom) : undefined,
      periodTo: body.periodTo !== undefined ? Number(body.periodTo) : undefined
    });
    return c.json(result);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});
