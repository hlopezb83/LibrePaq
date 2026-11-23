import { Hono } from 'hono';
import { resolveRequestActor } from '../auth-actor';
import { getInventoryPeriodRepo, saveInventoryPeriodRepo } from '../repositories/inventory.repo';
import { assertRouteCompanyAccess, errorStatus } from './route-helpers';

export const inventoryRoutes = new Hono();

inventoryRoutes.get('/companies/:companyId/inventory-cost', (c) => {
  try {
    const companyId = c.req.param('companyId');
    const denied = assertRouteCompanyAccess(c, companyId);
    if (denied) return denied;

    const { userId } = resolveRequestActor(c);
    const rawYear = c.req.query('year') ?? c.req.query('ejercicio');
    const rawPeriod = c.req.query('period') ?? c.req.query('periodo');
    const ejercicio = rawYear ? Number(rawYear) : undefined;
    const periodo = rawPeriod ? Number(rawPeriod) : undefined;

    return c.json(getInventoryPeriodRepo(companyId, ejercicio, periodo, userId));
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

inventoryRoutes.post('/companies/:companyId/inventory-cost', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const denied = assertRouteCompanyAccess(c, companyId, { requireWrite: true });
    if (denied) return denied;

    const { userId } = resolveRequestActor(c);
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const rawYear = body.ejercicio ?? body.year ?? c.req.query('year');
    const rawPeriod = body.periodo ?? body.period ?? c.req.query('period');

    const ejercicio = Number(rawYear ?? new Date().getFullYear());
    const periodo = Number(rawPeriod ?? 1);
    const purchasesOverride =
      body.purchasesOverride === null ||
      body.purchasesOverride === undefined ||
      body.purchasesOverride === ''
        ? null
        : Number(body.purchasesOverride);
    const polizaId =
      body.polizaId === undefined
        ? undefined
        : body.polizaId === null
          ? null
          : String(body.polizaId);

    const saved = saveInventoryPeriodRepo(
      companyId,
      {
        ejercicio,
        periodo,
        initialInventory: Number(body.initialInventory ?? 0),
        purchasesOverride,
        finalInventory: Number(body.finalInventory ?? 0),
        method: body.method === 'PERPETUO' ? 'PERPETUO' : 'ANALITICO',
        polizaId
      },
      userId
    );
    return c.json(saved);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});
