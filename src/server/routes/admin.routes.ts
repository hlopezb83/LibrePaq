import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { isSuperAdminEmail } from '../../shared/superadmin';
import {
  getAdminCompaniesRepo,
  getAdminCompanyDetailRepo,
  getAdminMetricsRepo,
  getAdminSatHealthRepo,
  getAdminUsersRepo
} from '../repositories/admin.repo';
import {
  clearBroadcastRepo,
  deleteAdminCompanyRepo,
  getActiveBroadcastRepo,
  getAdminAuditLogsRepo,
  recordAdminAuditLogRepo,
  saveBroadcastRepo,
  setAdminUserStatusRepo
} from '../repositories/admin-ops.repo';
import {
  getAdminAuditLogsPaginatedRepo,
  getAdminCompaniesPaginatedRepo,
  getAdminPlatformAlertsRepo,
  getAdminUsersPaginatedRepo,
  getWorkspaceQuotaRepo,
  runAdminHealthScanRepo,
  setAdminUserRoleRepo,
  updateAdminPlatformAlertStatusRepo,
  upsertWorkspaceQuotaRepo
} from '../repositories/admin-enterprise.repo';

export const adminRoutes = new Hono();

const isoDateSchema = z.string().refine((val) => !Number.isNaN(Date.parse(val)), 'Fecha ISO inválida');

const broadcastSchema = z.object({
  title: z.string().trim().min(1, 'Título requerido').max(200),
  message: z.string().trim().min(1, 'Mensaje requerido').max(1000),
  type: z.enum(['info', 'warning', 'success']).optional(),
  startsAt: isoDateSchema.nullable().optional(),
  expiresAt: isoDateSchema.nullable().optional()
});

const userStatusSchema = z.object({
  status: z.enum(['ACTIVO', 'SUSPENDIDO']),
  reason: z.string().trim().max(300).optional()
});

const auditLogSchema = z.object({
  action: z.string().trim().min(1).max(120),
  targetType: z.string().trim().min(1).max(80),
  targetId: z.string().trim().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const emptyToUndef = (v: unknown) => (v === '' || v === undefined ? undefined : v);
const optEnum = <T extends string>(vals: [T, ...T[]]) => z.preprocess(emptyToUndef, z.enum(vals).optional());
const optInt = (max: number) => z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(max).optional());
const optStr = (max = 120) => z.preprocess(emptyToUndef, z.string().trim().max(max).optional());

const companiesPageQuerySchema = z.object({
  page: optInt(100000),
  pageSize: optInt(100),
  search: optStr(120),
  ownerType: optEnum(['ALL', 'user', 'superadmin', 'demo']),
  fielFilter: optEnum(['ALL', 'WITH_FIEL', 'WITHOUT_FIEL'])
});

const usersPageQuerySchema = z.object({
  page: optInt(100000),
  pageSize: optInt(100),
  search: optStr(120),
  status: optEnum(['ALL', 'ACTIVO', 'SUSPENDIDO']),
  role: optEnum(['ALL', 'SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS', 'NONE'])
});

const auditLogsPageQuerySchema = z.object({
  page: optInt(100000),
  pageSize: optInt(100),
  search: optStr(120),
  action: optStr(120),
  targetType: optStr(80)
});

const userRoleSchema = z.object({
  platformRole: z.enum(['SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS', 'NONE'])
});

const workspaceQuotaSchema = z.object({
  userId: z.string().trim().min(1).nullable().optional(),
  planTier: z.enum(['FREE', 'PRO', 'DESPACHO', 'ENTERPRISE']),
  maxCompanies: z.coerce.number().int().min(1).max(10000),
  maxCfdisPerMonth: z.coerce.number().int().min(1).max(10_000_000),
  maxStorageMb: z.coerce.number().int().min(10).max(10_000_000),
  notes: z.string().trim().max(500).nullable().optional()
});

const alertQuerySchema = z.object({ status: optEnum(['ALL', 'open', 'acknowledged', 'resolved']) });
const alertStatusSchema = z.object({ status: z.enum(['open', 'acknowledged', 'resolved']) });

function parseQuery<T>(c: Context, schema: z.ZodType<T>): { data: T } | { error: string } {
  const parsed = schema.safeParse(c.req.query());
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Parámetros de consulta inválidos.' };
  return { data: parsed.data };
}

function getActorContext(c: Context): { actorEmail: string; actorUserId: string | null } {
  const email = (c.req.header('X-User-Email') || c.req.header('x-user-email') || '').trim().toLowerCase();
  const userId = (c.req.header('X-User-Id') || c.req.header('x-user-id') || '').trim();
  return { actorEmail: email || 'hlopezb@gmail.com', actorUserId: userId || null };
}

async function parseJsonBody<T>(c: Context, schema: z.ZodType<T>): Promise<{ data: T } | { error: string }> {
  try {
    const raw: unknown = await c.req.json();
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Payload inválido.' };
    return { data: parsed.data };
  } catch {
    return { error: 'JSON inválido en la solicitud.' };
  }
}

// Exento del guard SuperAdmin para que BroadcastBanner pueda consultarlo para cualquier usuario
adminRoutes.get('/admin/broadcast/active', (c) => c.json(getActiveBroadcastRepo()));

adminRoutes.use('/admin/*', async (c, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  const adminSecret = process.env.ADMIN_SECRET || (isProd ? '' : 'librepaq-dev-secret');
  const authHeader = c.req.header('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  const hasSecret = Boolean(adminSecret && bearerToken === adminSecret);
  const userEmail = (c.req.header('X-User-Email') || c.req.header('x-user-email') || '').toLowerCase().trim();
  const isAuthorized = isProd ? hasSecret : hasSecret || isSuperAdminEmail(userEmail);

  if (!isAuthorized) {
    return c.json({ error: 'UNAUTHORIZED: Requiere autorización válida de SuperAdmin' }, 403);
  }
  return await next();
});

adminRoutes.get('/admin/metrics', (c) => c.json(getAdminMetricsRepo()));
adminRoutes.get('/admin/companies', (c) => c.json(getAdminCompaniesRepo()));
adminRoutes.get('/admin/users', (c) => c.json(getAdminUsersRepo()));
adminRoutes.get('/admin/sat-health', (c) => c.json(getAdminSatHealthRepo()));

adminRoutes.get('/admin/companies/:id/detail', (c) => {
  const detail = getAdminCompanyDetailRepo(c.req.param('id'));
  return detail ? c.json(detail) : c.json({ error: 'Empresa no encontrada.' }, 404);
});

adminRoutes.delete('/admin/companies/:id', (c) => {
  const { actorEmail, actorUserId } = getActorContext(c);
  const result = deleteAdminCompanyRepo(c.req.param('id'), actorEmail, actorUserId);
  return result.deleted ? c.json(result) : c.json({ error: 'Empresa no encontrada.' }, 404);
});

adminRoutes.patch('/admin/users/:id/status', async (c) => {
  const parsed = await parseJsonBody(c, userStatusSchema);
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);

  const { actorEmail, actorUserId } = getActorContext(c);
  try {
    return c.json(setAdminUserStatusRepo(c.req.param('id'), parsed.data.status, actorEmail, actorUserId, parsed.data.reason));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error actualizando estatus de usuario.';
    return c.json({ error: message }, message.includes('SuperAdmin') ? 403 : 400);
  }
});

adminRoutes.post('/admin/broadcast', async (c) => {
  const parsed = await parseJsonBody(c, broadcastSchema);
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);

  const { actorEmail, actorUserId } = getActorContext(c);
  return c.json(saveBroadcastRepo(parsed.data, actorEmail, actorUserId), 201);
});

adminRoutes.delete('/admin/broadcast', (c) => {
  const { actorEmail, actorUserId } = getActorContext(c);
  return c.json(clearBroadcastRepo(actorEmail, actorUserId));
});

adminRoutes.get('/admin/audit-logs', (c) => {
  const rawLimit = Number(c.req.query('limit') || '100');
  return c.json(getAdminAuditLogsRepo(Number.isFinite(rawLimit) ? rawLimit : 100));
});

adminRoutes.post('/admin/audit-logs', async (c) => {
  const parsed = await parseJsonBody(c, auditLogSchema);
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);

  const { actorEmail, actorUserId } = getActorContext(c);
  const entry = recordAdminAuditLogRepo({
    actorUserId,
    actorEmail,
    action: parsed.data.action,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId ?? null,
    metadata: parsed.data.metadata
  });
  return c.json(entry, 201);
});

adminRoutes.get('/admin/companies/paginated', (c) => {
  const parsed = parseQuery(c, companiesPageQuerySchema);
  return 'error' in parsed ? c.json({ error: parsed.error }, 400) : c.json(getAdminCompaniesPaginatedRepo(parsed.data));
});

adminRoutes.get('/admin/users/paginated', (c) => {
  const parsed = parseQuery(c, usersPageQuerySchema);
  return 'error' in parsed ? c.json({ error: parsed.error }, 400) : c.json(getAdminUsersPaginatedRepo(parsed.data));
});

adminRoutes.get('/admin/audit-logs/paginated', (c) => {
  const parsed = parseQuery(c, auditLogsPageQuerySchema);
  return 'error' in parsed ? c.json({ error: parsed.error }, 400) : c.json(getAdminAuditLogsPaginatedRepo(parsed.data));
});

adminRoutes.patch('/admin/users/:id/role', async (c) => {
  const parsed = await parseJsonBody(c, userRoleSchema);
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);
  const { actorEmail, actorUserId } = getActorContext(c);
  try {
    return c.json(setAdminUserRoleRepo(c.req.param('id'), parsed.data.platformRole, actorEmail, actorUserId));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error actualizando rol de usuario.';
    const status = message.includes('SuperAdmin') ? 403 : message.includes('no encontrado') ? 404 : 400;
    return c.json({ error: message }, status);
  }
});

adminRoutes.get('/admin/workspaces/:workspaceId/quota', (c) => c.json(getWorkspaceQuotaRepo(c.req.param('workspaceId'))));

adminRoutes.put('/admin/workspaces/:workspaceId/quota', async (c) => {
  const parsed = await parseJsonBody(c, workspaceQuotaSchema);
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);
  const { actorEmail, actorUserId } = getActorContext(c);
  return c.json(upsertWorkspaceQuotaRepo(c.req.param('workspaceId'), parsed.data, actorEmail, actorUserId));
});

adminRoutes.get('/admin/alerts', (c) => {
  const parsed = parseQuery(c, alertQuerySchema);
  return 'error' in parsed ? c.json({ error: parsed.error }, 400) : c.json(getAdminPlatformAlertsRepo(parsed.data.status));
});

adminRoutes.post('/admin/alerts/scan', (c) => {
  const { actorEmail, actorUserId } = getActorContext(c);
  return c.json(runAdminHealthScanRepo(actorEmail, actorUserId));
});

adminRoutes.patch('/admin/alerts/:id/status', async (c) => {
  const parsed = await parseJsonBody(c, alertStatusSchema);
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);
  const { actorEmail, actorUserId } = getActorContext(c);
  try {
    return c.json(updateAdminPlatformAlertStatusRepo(c.req.param('id'), parsed.data.status, actorEmail, actorUserId));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error actualizando alerta.';
    return c.json({ error: message }, message.includes('no encontrada') ? 404 : 400);
  }
});
