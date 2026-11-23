import { Hono } from 'hono';
import {
  batchImportAccountsCatalog,
  computeTrialBalance,
  createAccountRecord,
  deleteAccountRecord,
  getAccountLedger,
  getCompanyById,
  updateAccountRecord
} from '../db';
import {
  resolveYearAndPeriod,
  validateAccountCreatePayload,
  validateAccountUpdatePayload
} from '../validators';
import { errorStatus } from './route-helpers';
import type { AccountNature, AccountType } from '../../shared/types';

export const accountsRoutes = new Hono();

accountsRoutes.get('/accounts', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const company = getCompanyById(companyId);
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
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const company = getCompanyById(companyId);
  if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );
  const ledger = getAccountLedger(company.id, accountId, year, period);
  if (!ledger) return c.json({ error: 'Cuenta no encontrada' }, 404);
  return c.json(ledger);
});

accountsRoutes.post('/accounts', async (c) => {
  try {
    const payload = validateAccountCreatePayload(await c.req.json());
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
    const payload = validateAccountUpdatePayload(await c.req.json());
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
    const companyId = String(body.companyId ?? 'comp_tnn_01');
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
    const res = batchImportAccountsCatalog(companyId, rows);
    return c.json(res, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});
