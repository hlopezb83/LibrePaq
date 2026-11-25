import { Hono } from 'hono';
import { readBodyCompanyId, readQueryCompanyId, rejectNonStringBodyCompanyId } from '../auth-actor';
import {
  addBankStatementLinesTransaction,
  autoMatchBankLinesTransaction,
  createPolizaFromBankLineTransaction,
  db,
  getBankReconciliation,
  unmatchBankLineTransaction
} from '../db';
import {
  deleteBankStatementLineTransaction,
  manualMatchBankLineTransaction
} from '../repositories/bank.repo';
import { upsertBankClosureBalanceSqlite } from '../repositories/bank-reconciliation-helpers';
import type { BankCounterLineInput } from '../../shared/engine/bank-and-closing.engine';
import { resolveYearAndPeriod } from '../validators';
import { assertRouteCompanyAccess, errorStatus, getAuthorizedCompanyForRoute } from './route-helpers';

export const bankRoutes = new Hono();

bankRoutes.get('/bank-reconciliation', (c) => {
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
  const accountId = c.req.query('accountId') || `${company.id}_102-01-001`;
  const data = getBankReconciliation(company.id, accountId, year, period);
  if (!data) return c.json({ error: 'Cuenta bancaria no encontrada' }, 404);
  return c.json(data);
});

bankRoutes.post('/bank-reconciliation/lines', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const cid = readBodyCompanyId(c, body);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, { requireWrite: true });
    if (denied) return denied;
    const company = getAuthorizedCompanyForRoute(c, cid.companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const accountId = String(body.accountId ?? `${company.id}_102-01-001`);
    const lines = Array.isArray(body.lines)
      ? (body.lines as Array<Record<string, unknown>>)
      : [body];

    const reconciliation = addBankStatementLinesTransaction(company, accountId, lines);
    return c.json(reconciliation, 201);
  } catch (err) {
    const errObj = errorStatus(err, 400);
    return c.json({ error: errObj.message }, errObj.status);
  }
});

bankRoutes.post('/bank-reconciliation/auto-match', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const cid = readBodyCompanyId(c, body);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, { requireWrite: true });
    if (denied) return denied;
    const company = getAuthorizedCompanyForRoute(c, cid.companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const accountId = String(body.accountId ?? `${company.id}_102-01-001`);
    const year = body.year ? Number(body.year) : undefined;
    const period = body.period ? Number(body.period) : undefined;
    const res = autoMatchBankLinesTransaction(company, accountId, year, period);
    if (!res) return c.json({ error: 'Cuenta bancaria no encontrada' }, 404);
    return c.json(res);
  } catch (err) {
    const errObj = errorStatus(err, 400);
    return c.json({ error: errObj.message }, errObj.status);
  }
});

bankRoutes.post('/bank-reconciliation/:lineId/create-poliza', async (c) => {
  try {
    const lineId = c.req.param('lineId');
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const nonStr = rejectNonStringBodyCompanyId(c, body);
    if (nonStr) return nonStr;
    const row = db
      .query('SELECT company_id FROM bank_statement_lines WHERE id = ?')
      .get(lineId) as { company_id?: string } | null;
    if (!row?.company_id) return c.json({ error: 'Línea bancaria no encontrada' }, 404);
    const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
    if (denied) return denied;

    const counterLines = Array.isArray(body.counterLines)
      ? (body.counterLines as BankCounterLineInput[])
      : undefined;
    const res = createPolizaFromBankLineTransaction(lineId, {
      counterAccountCode: body.counterAccountCode ? String(body.counterAccountCode) : undefined,
      desglosarIva: body.desglosarIva !== undefined ? Boolean(body.desglosarIva) : true,
      counterLines
    });

    if (res.status === 'NOT_FOUND') {
      return c.json({ error: 'Línea bancaria no encontrada' }, 404);
    }
    if (res.status === 'ALREADY_MATCHED') {
      return c.json({ error: 'Esta línea bancaria ya está conciliada.' }, 409);
    }
    return c.json({
      createdPolizaId: res.createdPolizaId,
      reconciliation: res.reconciliation
    });
  } catch (err) {
    const errObj = errorStatus(err, 400);
    return c.json({ error: errObj.message }, errObj.status);
  }
});

bankRoutes.post('/bank-reconciliation/:lineId/unmatch', (c) => {
  try {
    const lineId = c.req.param('lineId');
    const row = db
      .query('SELECT company_id FROM bank_statement_lines WHERE id = ?')
      .get(lineId) as { company_id?: string } | null;
    if (!row?.company_id) return c.json({ error: 'Línea bancaria no encontrada' }, 404);
    const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
    if (denied) return denied;

    const res = unmatchBankLineTransaction(lineId);
    if (!res.found) return c.json({ error: 'Línea bancaria no encontrada' }, 404);
    return c.json({
      unmatched: true,
      reconciliation: res.reconciliation
    });
  } catch (err) {
    const errObj = errorStatus(err, 400);
    return c.json({ error: errObj.message }, errObj.status);
  }
});

bankRoutes.post('/bank-reconciliation/:lineId/manual-match', async (c) => {
  try {
    const lineId = c.req.param('lineId');
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const nonStr = rejectNonStringBodyCompanyId(c, body);
    if (nonStr) return nonStr;
    const row = db
      .query('SELECT company_id FROM bank_statement_lines WHERE id = ?')
      .get(lineId) as { company_id?: string } | null;
    if (!row?.company_id) return c.json({ error: 'Línea bancaria no encontrada' }, 404);
    const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
    if (denied) return denied;

    const movementId = String(body.movementId ?? '').trim();
    if (!movementId) return c.json({ error: 'movementId es obligatorio.' }, 400);
    const res = manualMatchBankLineTransaction(lineId, movementId);
    return c.json(res);
  } catch (err) {
    const errObj = errorStatus(err, 400);
    return c.json({ error: errObj.message }, errObj.status);
  }
});

bankRoutes.delete('/bank-reconciliation/:lineId', (c) => {
  try {
    const lineId = c.req.param('lineId');
    const row = db
      .query('SELECT company_id FROM bank_statement_lines WHERE id = ?')
      .get(lineId) as { company_id?: string } | null;
    if (!row?.company_id) return c.json({ error: 'Línea bancaria no encontrada' }, 404);
    const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
    if (denied) return denied;

    const res = deleteBankStatementLineTransaction(lineId);
    if (!res.deleted) return c.json({ error: 'Línea bancaria no encontrada' }, 404);
    return c.json({ deleted: true, reconciliation: res.reconciliation });
  } catch (err) {
    const errObj = errorStatus(err, 400);
    return c.json({ error: errObj.message }, errObj.status);
  }
});

bankRoutes.put('/bank-reconciliation/closure-balance', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const cid = readBodyCompanyId(c, body);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, { requireWrite: true });
    if (denied) return denied;
    const company = getAuthorizedCompanyForRoute(c, cid.companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const accountId = String(body.accountId ?? `${company.id}_102-01-001`);
    const { year, period } = resolveYearAndPeriod(
      body.ejercicio !== undefined ? String(body.ejercicio) : undefined,
      body.periodo !== undefined ? String(body.periodo) : undefined,
      company
    );
    const rawBal = body.saldoBancoCierre;
    const saldo = rawBal === null || rawBal === undefined ? null : Number(rawBal);
    if (saldo !== null && !Number.isFinite(saldo)) {
      return c.json({ error: 'Saldo bancario de cierre inválido.' }, 400);
    }
    upsertBankClosureBalanceSqlite(db, company.id, accountId, year, period, saldo);
    return c.json({ ok: true });
  } catch (err) {
    const errObj = errorStatus(err, 400);
    return c.json({ error: errObj.message }, errObj.status);
  }
});
