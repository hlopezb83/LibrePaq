import { Hono, type Context } from 'hono';
import {
  canDeletePlatformTenants, canManageBillingAndQuotas, canManagePlatformRoles,
  canPublishPlatformBroadcast, hasPlatformAdminAccess
} from '../../shared/superadmin';
import type { PlatformRole } from '../../shared/admin-types';
import {
  getAdminCompaniesRepo, getAdminCompanyDetailRepo, getAdminMetricsRepo,
  getAdminSatHealthRepo, getAdminUsersRepo
} from '../repositories/admin.repo';
import {
  adminUserExistsRepo, clearBroadcastRepo, deleteAdminCompanyRepo, getActiveBroadcastRepo,
  getAdminAuditLogsRepo, recordAdminAuditLogRepo, saveBroadcastRepo, setAdminUserStatusRepo
} from '../repositories/admin-ops.repo';
import {
  getAdminAuditLogsPaginatedRepo, getAdminCompaniesPaginatedRepo, getAdminPlatformAlertsRepo,
  getAdminUsersPaginatedRepo, getWorkspaceQuotaRepo, runAdminHealthScanRepo,
  setAdminUserRoleRepo, updateAdminPlatformAlertStatusRepo, upsertWorkspaceQuotaRepo
} from '../repositories/admin-enterprise.repo';
import { resolveCallerPlatformRoleRepo } from '../repositories/admin-enterprise.helpers';
import { resolveRequestActorAsync } from '../auth-actor';
import {
  type AdminEnv, alertQuerySchema, alertStatusSchema, auditLogSchema, auditLogsPageQuerySchema,
  broadcastSchema, companiesPageQuerySchema, getActorContext, parseJsonBody, parseQuery,
  userRoleSchema, usersPageQuerySchema, userStatusSchema, workspaceQuotaSchema
} from './admin.schemas';

export const adminRoutes = new Hono<AdminEnv>();

function denyIfForbidden(c: Context<AdminEnv>, allow: (role: PlatformRole) => boolean, action: string) {
  const role = c.get('callerRole') ?? 'NONE';
  if (!allow(role)) {
    return c.json({ error: `FORBIDDEN: Tu rol (${role}) no tiene permiso para ejecutar ${action}` }, 403);
  }
  return null;
}

// Exento del guard SuperAdmin para que BroadcastBanner pueda consultarlo para cualquier usuario
adminRoutes.get('/admin/broadcast/active', (c) => c.json(getActiveBroadcastRepo()));

adminRoutes.use('/admin/*', async (c, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  const adminSecret = process.env.ADMIN_SECRET || (isProd ? '' : 'librepaq-dev-secret');
  const authHeader = c.req.header('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  const hasSecret = Boolean(adminSecret && bearerToken === adminSecret);
  let callerRole: PlatformRole = 'NONE';

  if (hasSecret) {
    callerRole = 'SUPERADMIN';
  } else {
    const actor = await resolveRequestActorAsync(c);
    if (actor.authError) {
      return c.json({ error: actor.authError }, 401);
    }
    c.set('verifiedActor', { userId: actor.userId, userEmail: actor.userEmail });
    callerRole = resolveCallerPlatformRoleRepo(actor.userId || '', actor.userEmail || '');
  }

  if (!hasPlatformAdminAccess(callerRole)) {
    return c.json({ error: 'UNAUTHORIZED: Requiere autorización válida de plataforma administrativa' }, 403);
  }
  c.set('callerRole', callerRole);
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
  const denied = denyIfForbidden(c, canDeletePlatformTenants, 'DELETE_COMPANY');
  if (denied) return denied;
  const { actorEmail, actorUserId } = getActorContext(c);
  const result = deleteAdminCompanyRepo(c.req.param('id'), actorEmail, actorUserId);
  return result.deleted ? c.json(result) : c.json({ error: 'Empresa no encontrada.' }, 404);
});

adminRoutes.patch('/admin/users/:id/status', async (c) => {
  const denied = denyIfForbidden(c, canManageBillingAndQuotas, 'SET_USER_STATUS');
  if (denied) return denied;
  const targetId = c.req.param('id');
  if (!adminUserExistsRepo(targetId)) return c.json({ error: 'Usuario no encontrado.' }, 404);
  const parsed = await parseJsonBody(c, userStatusSchema);
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);

  const { actorEmail, actorUserId } = getActorContext(c);
  try {
    return c.json(setAdminUserStatusRepo(targetId, parsed.data.status, actorEmail, actorUserId, parsed.data.reason));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error actualizando estatus de usuario.';
    return c.json({ error: message }, message.includes('SuperAdmin') ? 403 : 400);
  }
});

adminRoutes.post('/admin/broadcast', async (c) => {
  const denied = denyIfForbidden(c, canPublishPlatformBroadcast, 'PUBLISH_BROADCAST');
  if (denied) return denied;
  const parsed = await parseJsonBody(c, broadcastSchema);
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);
  if (parsed.data.expiresAt && Date.parse(parsed.data.expiresAt) <= Date.now()) {
    return c.json({ error: 'La fecha de expiración (expiresAt) debe ser futura.' }, 400);
  }
  const { actorEmail, actorUserId } = getActorContext(c);
  return c.json(saveBroadcastRepo(parsed.data, actorEmail, actorUserId), 201);
});

adminRoutes.delete('/admin/broadcast', (c) => {
  const denied = denyIfForbidden(c, canPublishPlatformBroadcast, 'CLEAR_BROADCAST');
  if (denied) return denied;
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
    actorUserId, actorEmail, action: parsed.data.action,
    targetType: parsed.data.targetType, targetId: parsed.data.targetId ?? null, metadata: parsed.data.metadata
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
  const denied = denyIfForbidden(c, canManagePlatformRoles, 'SET_USER_ROLE');
  if (denied) return denied;
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
  const denied = denyIfForbidden(c, canManageBillingAndQuotas, 'UPSERT_WORKSPACE_QUOTA');
  if (denied) return denied;
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
