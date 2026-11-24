import { Hono } from 'hono';
import { readBodyCompanyId, readQueryCompanyId, rejectNonStringBodyCompanyId } from '../auth-actor';
import {
  batchImportAccountsCatalog,
  computeTrialBalance,
  createAccountRecord,
  db,
  deleteAccountRecord,
  getAccountLedger,
  updateAccountRecord
} from '../db';
import {
  resolveYearAndPeriod,
  validateAccountCreatePayload,
  validateAccountUpdatePayload
} from '../validators';
import { assertRouteCompanyAccess, errorStatus, getAuthorizedCompanyForRoute } from './route-helpers';
import type { AccountNature, AccountType } from '../../shared/types';

export const accountsRoutes = new Hono();

accountsRoutes.get('/accounts', (c) => {
  const q = readQueryCompanyId(c);
  if (!q.ok) return q.response;
  const denied = assertRouteCompanyAccess(c, q.companyId);
  if (denied) return denied;
  const company = getAuthorizedCompanyForRoute(c, q.companyId);
  if (!company) return c.json([], 404);

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );
  return c.json(computeTrialBalance(company.id, year, period));
});

accountsRoutes.get('/accounts/:id/ledger', (c) => {
  const accountId = c.req.param('id');
  const q = readQueryCompanyId(c);
  if (!q.ok) return q.response;
  const denied = assertRouteCompanyAccess(c, q.companyId);
  if (denied) return denied;
  const company = getAuthorizedCompanyForRoute(c, q.companyId);
  if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );
  const rawPeriodTo = c.req.query('periodTo');
  const parsedTo = rawPeriodTo ? Number(rawPeriodTo) : undefined;
  const periodTo =
    parsedTo && Number.isInteger(parsedTo) && parsedTo >= 1 && parsedTo <= 13
      ? parsedTo
      : undefined;
  const ledger = getAccountLedger(company.id, accountId, year, period, periodTo);
  if (!ledger) return c.json({ error: 'Cuenta no encontrada' }, 404);
  return c.json(ledger);
});

accountsRoutes.post('/accounts', async (c) => {
  try {
    const raw = (await c.req.json()) as Record<string, unknown>;
    const nonStr = rejectNonStringBodyCompanyId(c, raw);
    if (nonStr) return nonStr;
    const payload = validateAccountCreatePayload(raw);
    const denied = assertRouteCompanyAccess(c, payload.companyId, { requireWrite: true });
    if (denied) return denied;
    const created = createAccountRecord(payload);
    return c.json(created, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

accountsRoutes.put('/accounts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const raw = (await c.req.json()) as Record<string, unknown>;
    const nonStr = rejectNonStringBodyCompanyId(c, raw);
    if (nonStr) return nonStr;
    const row = db
      .query('SELECT company_id FROM accounts WHERE id = ?')
      .get(id) as { company_id?: string } | null;
    if (!row?.company_id) return c.json({ error: 'Cuenta no encontrada.' }, 404);
    const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
    if (denied) return denied;

    const payload = validateAccountUpdatePayload(raw);
    const updated = updateAccountRecord(id, payload);
    if (!updated) return c.json({ error: 'Cuenta no encontrada.' }, 404);
    return c.json({ updated: true });
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

accountsRoutes.delete('/accounts/:id', (c) => {
  const id = c.req.param('id');
  const row = db
    .query('SELECT company_id FROM accounts WHERE id = ?')
    .get(id) as { company_id?: string } | null;
  if (!row?.company_id) return c.json({ error: 'Cuenta no encontrada.' }, 404);
  const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
  if (denied) return denied;

  const res = deleteAccountRecord(id);
  if (res.hasMovements) {
    return c.json(
      { error: 'No se puede eliminar una cuenta que ya tiene movimientos contables registrados.' },
      400
    );
  }
  if (res.hasChildren) {
    return c.json(
      { error: 'No se puede eliminar una cuenta que contiene subcuentas dependientes.' },
      400
    );
  }
  if (!res.deleted) {
    return c.json({ error: 'Cuenta no encontrada.' }, 404);
  }
  return c.json({ deleted: true });
});

accountsRoutes.post('/accounts/batch-import', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const cid = readBodyCompanyId(c, body);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, { requireWrite: true });
    if (denied) return denied;

    const rows = Array.isArray(body.rows)
      ? (body.rows as Array<{
          code: string;
          name: string;
          parentCode?: string | null;
          type?: AccountType;
          nature?: AccountNature;
          satGroupCode?: string;
          isAffectable?: boolean;
          initialBalance?: number;
        }>)
      : [];
    const res = batchImportAccountsCatalog(cid.companyId, rows);
    return c.json(res, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});
