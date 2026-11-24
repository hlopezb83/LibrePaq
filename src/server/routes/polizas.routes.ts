import { Hono } from 'hono';
import { readBodyCompanyId, readQueryCompanyId, rejectNonStringBodyCompanyId } from '../auth-actor';
import {
  closeYearPolizaTransaction,
  createPolizaTransaction,
  db,
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
  const q = readQueryCompanyId(c);
  if (!q.ok) return q.response;
  const denied = assertRouteCompanyAccess(c, q.companyId);
  if (denied) return denied;
  const company = getAuthorizedCompanyForRoute(c, q.companyId);
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
    const raw = (await c.req.json()) as Record<string, unknown>;
    const nonStr = rejectNonStringBodyCompanyId(c, raw);
    if (nonStr) return nonStr;
    const payload = validatePolizaPayload(raw);
    const denied = assertRouteCompanyAccess(c, payload.companyId, { requireWrite: true });
    if (denied) return denied;
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
    const raw = (await c.req.json()) as Record<string, unknown>;
    const nonStr = rejectNonStringBodyCompanyId(c, raw);
    if (nonStr) return nonStr;
    const row = db
      .query('SELECT company_id FROM polizas WHERE id = ?')
      .get(polizaId) as { company_id?: string } | null;
    if (!row?.company_id) return c.json({ error: 'Póliza no encontrada' }, 404);
    const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
    if (denied) return denied;

    const payload = validatePolizaPayload(raw);
    if (payload.companyId !== row.company_id) {
      return c.json({ error: 'No se permite reasignar una póliza a otra empresa' }, 403);
    }
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
    const row = db
      .query('SELECT company_id FROM polizas WHERE id = ?')
      .get(id) as { company_id?: string } | null;
    if (!row?.company_id) return c.json({ error: 'Póliza no encontrada' }, 404);
    const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
    if (denied) return denied;
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
    const cid = readBodyCompanyId(c, body);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, { requireWrite: true });
    if (denied) return denied;
    const switchToPeriod13 =
      body.switchToPeriod13 !== undefined ? Boolean(body.switchToPeriod13) : true;
    const company = getAuthorizedCompanyForRoute(c, cid.companyId);
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
    const cid = readBodyCompanyId(c, body);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, {
      requireWrite: true,
      blockDemoWrite: true
    });
    if (denied) return denied;

    const result = reclassifyAccountMovements({
      companyId: cid.companyId,
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
