import { Hono } from 'hono';
import {
  closeYearPolizaTransaction,
  createPolizaTransaction,
  deletePolizaTransaction,
  getPolizas,
  updatePolizaTransaction
} from '../db';
import { resolveYearAndPeriod, validatePolizaPayload } from '../validators';
import { parseCalendarDate } from '../../shared/date-utils';
import { errorStatus, getAuthorizedCompanyForRoute } from './route-helpers';

export const polizasRoutes = new Hono();

polizasRoutes.get('/polizas', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const company = getAuthorizedCompanyForRoute(c, companyId);
  if (!company) return c.json([]);

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );
  return c.json(getPolizas(company.id, year, period));
});

polizasRoutes.post('/polizas', async (c) => {
  try {
    const payload = validatePolizaPayload(await c.req.json());
    const company = getAuthorizedCompanyForRoute(c, payload.companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const { year: pYear, month: pPeriod } = parseCalendarDate(
      payload.fecha,
      company.currentYear,
      company.currentPeriod
    );
    const resolvedPeriod =
      payload.periodo && payload.periodo >= 1 && payload.periodo <= 13
        ? payload.periodo
        : pPeriod;

    const created = createPolizaTransaction({
      ...payload,
      ejercicio: pYear,
      periodo: resolvedPeriod
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
