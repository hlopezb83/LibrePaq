import { Hono } from 'hono';
import {
  deleteAccountingRuleRepo,
  listAccountingRulesRepo,
  upsertAccountingRuleRepo
} from '../repositories/accounting-rules.repo';
import { assertRouteCompanyAccess, errorStatus } from './route-helpers';
import type { AccountingRuleDirection } from '../../shared/types/accounting-rules.types';

export const accountingRulesRoutes = new Hono();

accountingRulesRoutes.get('/companies/:companyId/accounting-rules', (c) => {
  try {
    const companyId = c.req.param('companyId');
    const denied = assertRouteCompanyAccess(c, companyId);
    if (denied) return denied;
    return c.json(listAccountingRulesRepo(companyId));
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

accountingRulesRoutes.post('/companies/:companyId/accounting-rules', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const denied = assertRouteCompanyAccess(c, companyId);
    if (denied) return denied;

    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const rawDirection = String(body.direction ?? 'RECIBIDO').toUpperCase();
    const direction: AccountingRuleDirection =
      rawDirection === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO';

    const saved = upsertAccountingRuleRepo({
      id: typeof body.id === 'string' ? body.id : undefined,
      companyId,
      name: typeof body.name === 'string' ? body.name : undefined,
      matchRfc: typeof body.matchRfc === 'string' ? body.matchRfc : null,
      matchClaveProdServ:
        typeof body.matchClaveProdServ === 'string' ? body.matchClaveProdServ : null,
      matchUsoCfdi: typeof body.matchUsoCfdi === 'string' ? body.matchUsoCfdi : null,
      direction,
      operationAccountCode: String(body.operationAccountCode ?? ''),
      counterAccountCode:
        typeof body.counterAccountCode === 'string' ? body.counterAccountCode : null,
      deductiblePct: body.deductiblePct !== undefined ? Number(body.deductiblePct) : 100,
      priority: body.priority !== undefined ? Number(body.priority) : 10,
      autoLearned: Boolean(body.autoLearned)
    });

    return c.json(saved, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

accountingRulesRoutes.delete('/companies/:companyId/accounting-rules/:ruleId', (c) => {
  try {
    const companyId = c.req.param('companyId');
    const denied = assertRouteCompanyAccess(c, companyId);
    if (denied) return denied;

    const ruleId = c.req.param('ruleId');
    const res = deleteAccountingRuleRepo(companyId, ruleId);
    if (!res.deleted) {
      return c.json({ error: 'Regla contable no encontrada.' }, 404);
    }
    return c.json({ deleted: true });
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});
