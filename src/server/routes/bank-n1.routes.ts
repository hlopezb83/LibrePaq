import { Hono } from 'hono';
import { extractBankStatementMovements, validateBankPdfRequest } from '../../../supabase/functions/extract-bank-statement/handler';
import type { BankN1ApplyItem, BankN1MatchProposal } from '../../shared/types/bank-n1.types';
import { addBankStatementLinesTransaction } from '../repositories/bank.repo';
import {
  applyManyToOneMatchesRepo,
  proposeManyToOneMatchesRepo
} from '../repositories/bank-n1.repo';
import { resolveYearAndPeriod } from '../validators';
import { assertRouteCompanyAccess, errorStatus, getAuthorizedCompanyForRoute } from './route-helpers';

export const bankN1Routes = new Hono();

bankN1Routes.get('/companies/:companyId/bank-reconciliation/n-to-1', (c) => {
  const companyId = c.req.param('companyId');
  const accessErr = assertRouteCompanyAccess(c, companyId);
  if (accessErr) return accessErr;

  const company = getAuthorizedCompanyForRoute(c, companyId);
  if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

  const { year, period } = resolveYearAndPeriod(c.req.query('year'), c.req.query('period'), company);
  const accountId = c.req.query('accountId') || `${company.id}_102-01-001`;
  const maxGroupSize = c.req.query('maxGroupSize') ? Number(c.req.query('maxGroupSize')) : 5;
  const toleranceCents = c.req.query('toleranceCents') ? Number(c.req.query('toleranceCents')) : 5;

  const res = proposeManyToOneMatchesRepo(company.id, accountId, year, period, maxGroupSize, toleranceCents);
  if (!res) return c.json({ error: 'Cuenta bancaria no encontrada' }, 404);
  return c.json(res);
});

bankN1Routes.post('/companies/:companyId/bank-reconciliation/n-to-1', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const accessErr = assertRouteCompanyAccess(c, companyId, { requireWrite: true });
    if (accessErr) return accessErr;

    const company = getAuthorizedCompanyForRoute(c, companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const body = (await c.req.json().catch(() => ({}))) as {
      accountId?: string;
      year?: number;
      period?: number;
      proposals?: Array<BankN1ApplyItem | BankN1MatchProposal>;
    };
    const accountId = body.accountId || `${company.id}_102-01-001`;
    const items = Array.isArray(body.proposals) && body.proposals.length > 0
      ? body.proposals
      : proposeManyToOneMatchesRepo(company.id, accountId, body.year, body.period)?.proposals ?? [];

    const applied = applyManyToOneMatchesRepo(company.id, accountId, items, body.year, body.period);
    if (!applied) return c.json({ error: 'Cuenta bancaria no encontrada' }, 404);
    return c.json(applied);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

bankN1Routes.post('/companies/:companyId/bank-reconciliation/import-pdf-lines', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const accessErr = assertRouteCompanyAccess(c, companyId, { requireWrite: true });
    if (accessErr) return accessErr;

    const company = getAuthorizedCompanyForRoute(c, companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const body = (await c.req.json()) as {
      accountId?: string;
      lines?: Array<Record<string, unknown>>;
    };
    const accountId = body.accountId || `${company.id}_102-01-001`;
    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    const normalized = rawLines.map((l) => ({
      fecha: typeof l.fecha === 'string' ? l.fecha : undefined,
      referencia: typeof l.referencia === 'string' ? l.referencia : undefined,
      descripcion: typeof l.descripcion === 'string' ? l.descripcion : undefined,
      cargoBanco: Number(l.cargoBanco ?? l.cargo ?? 0),
      abonoBanco: Number(l.abonoBanco ?? l.abono ?? 0)
    }));

    const reconciliation = addBankStatementLinesTransaction(company, accountId, normalized);
    if (!reconciliation) return c.json({ error: 'Cuenta bancaria no encontrada' }, 404);
    return c.json(reconciliation, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

bankN1Routes.post('/companies/:companyId/bank-reconciliation/extract-pdf', async (c) => {
  const companyId = c.req.param('companyId');
  const accessErr = assertRouteCompanyAccess(c, companyId, { requireWrite: true });
  if (accessErr) return accessErr;

  const body = (await c.req.json().catch(() => ({}))) as { data?: unknown; mimeType?: unknown };
  const invalid = validateBankPdfRequest(body.data, body.mimeType);
  if (invalid) {
    const status = invalid === 'FILE_TOO_LARGE' ? 413 : 400;
    return c.json({ ok: false, code: invalid, error: 'Archivo PDF inválido o excede 10 MB.' }, status);
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const result = await extractBankStatementMovements(body.data as string, body.mimeType as string, apiKey);
  if (!result.ok) {
    const status = result.code === 'AI_NOT_CONFIGURED' ? 500 : result.code === 'INVALID_DOCUMENT' ? 422 : 503;
    return c.json({ ok: false, code: result.code, error: `Error IA (${result.code})` }, status);
  }
  return c.json(result);
});
