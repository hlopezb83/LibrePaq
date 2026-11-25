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
import type { PolizaTemplateMovement, PolizaType } from '../../shared/types';
import {
  createBusinessSegmentRepo,
  createPolizaTemplateRepo,
  deleteBusinessSegmentRepo,
  deletePolizaTemplateRepo,
  extractRonda11MovementFields,
  getSegmentFinancialStatementsRepo,
  listBusinessSegmentsRepo,
  listPolizaTemplatesRepo,
  updateBusinessSegmentRepo,
  updatePolizaTemplateRepo
} from '../repositories/ronda11.repo';
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

    const rawMovs = Array.isArray(raw.movements) ? raw.movements : [];
    const enrichedMovements = payload.movements.map((m, idx) => ({
      ...m,
      ...extractRonda11MovementFields(rawMovs[idx])
    }));

    const created = createPolizaTransaction({
      ...payload,
      movements: enrichedMovements,
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
    const rawMovs = Array.isArray(raw.movements) ? raw.movements : [];
    const enrichedMovements = payload.movements.map((m, idx) => ({
      ...m,
      ...extractRonda11MovementFields(rawMovs[idx])
    }));
    const updated = updatePolizaTransaction(polizaId, { ...payload, movements: enrichedMovements });
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

polizasRoutes.get('/poliza-templates', (c) => {
  const q = readQueryCompanyId(c);
  if (!q.ok) return q.response;
  const denied = assertRouteCompanyAccess(c, q.companyId);
  if (denied) return denied;
  return c.json(listPolizaTemplatesRepo(q.companyId));
});

polizasRoutes.post('/poliza-templates', async (c) => {
  try {
    const raw = (await c.req.json()) as Record<string, unknown>;
    const cid = readBodyCompanyId(c, raw);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, { requireWrite: true });
    if (denied) return denied;
    const created = createPolizaTemplateRepo({
      companyId: cid.companyId,
      name: String(raw.name ?? ''),
      tipo: (String(raw.tipo ?? 'DIARIO') as PolizaType),
      conceptoDefault: String(raw.conceptoDefault ?? ''),
      movementsJson: Array.isArray(raw.movementsJson) ? (raw.movementsJson as PolizaTemplateMovement[]) : []
    });
    return c.json(created, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

polizasRoutes.put('/poliza-templates/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const raw = (await c.req.json()) as Record<string, unknown>;
    const cid = readBodyCompanyId(c, raw);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, { requireWrite: true });
    if (denied) return denied;
    const updated = updatePolizaTemplateRepo(id, cid.companyId, {
      name: String(raw.name ?? ''),
      tipo: (String(raw.tipo ?? 'DIARIO') as PolizaType),
      conceptoDefault: String(raw.conceptoDefault ?? ''),
      movementsJson: Array.isArray(raw.movementsJson) ? (raw.movementsJson as PolizaTemplateMovement[]) : []
    });
    if (!updated) return c.json({ error: 'Plantilla no encontrada' }, 404);
    return c.json(updated);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

polizasRoutes.delete('/poliza-templates/:id', (c) => {
  const q = readQueryCompanyId(c);
  if (!q.ok) return q.response;
  const denied = assertRouteCompanyAccess(c, q.companyId, { requireWrite: true });
  if (denied) return denied;
  const deleted = deletePolizaTemplateRepo(c.req.param('id'), q.companyId);
  return c.json({ deleted });
});

polizasRoutes.get('/business-segments', (c) => {
  const q = readQueryCompanyId(c);
  if (!q.ok) return q.response;
  const denied = assertRouteCompanyAccess(c, q.companyId);
  if (denied) return denied;
  return c.json(listBusinessSegmentsRepo(q.companyId));
});

polizasRoutes.post('/business-segments', async (c) => {
  try {
    const raw = (await c.req.json()) as Record<string, unknown>;
    const cid = readBodyCompanyId(c, raw);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, { requireWrite: true });
    if (denied) return denied;
    const created = createBusinessSegmentRepo({
      companyId: cid.companyId,
      code: String(raw.code ?? ''),
      name: String(raw.name ?? ''),
      parentId: raw.parentId ? String(raw.parentId) : null,
      isActive: raw.isActive === undefined ? true : Boolean(raw.isActive)
    });
    return c.json(created, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

polizasRoutes.put('/business-segments/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const raw = (await c.req.json()) as Record<string, unknown>;
    const cid = readBodyCompanyId(c, raw);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, { requireWrite: true });
    if (denied) return denied;
    const updated = updateBusinessSegmentRepo(id, cid.companyId, {
      code: String(raw.code ?? ''),
      name: String(raw.name ?? ''),
      parentId: raw.parentId ? String(raw.parentId) : null,
      isActive: raw.isActive === undefined ? true : Boolean(raw.isActive)
    });
    if (!updated) return c.json({ error: 'Segmento no encontrado' }, 404);
    return c.json(updated);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

polizasRoutes.delete('/business-segments/:id', (c) => {
  const q = readQueryCompanyId(c);
  if (!q.ok) return q.response;
  const denied = assertRouteCompanyAccess(c, q.companyId, { requireWrite: true });
  if (denied) return denied;
  const deleted = deleteBusinessSegmentRepo(c.req.param('id'), q.companyId);
  return c.json({ deleted });
});

polizasRoutes.get('/reports/by-segment', (c) => {
  const q = readQueryCompanyId(c);
  if (!q.ok) return q.response;
  const denied = assertRouteCompanyAccess(c, q.companyId);
  if (denied) return denied;
  const company = getAuthorizedCompanyForRoute(c, q.companyId);
  if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);
  const segmentId = String(c.req.query('segmentId') || '').trim();
  if (!segmentId) return c.json({ error: 'segmentId requerido' }, 400);
  const { year, period } = resolveYearAndPeriod(c.req.query('year'), c.req.query('period'), company);
  const data = getSegmentFinancialStatementsRepo(company.id, year, period, segmentId);
  if (!data) return c.json({ error: 'No se pudo calcular el reporte por segmento' }, 404);
  return c.json(data);
});
