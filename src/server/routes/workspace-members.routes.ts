import { Hono, type Context } from 'hono';
import { isUserSuspended, resolveRequestActor, resolveRequestActorAsync } from '../auth-actor';
import {
  acceptPendingInvitesRepo,
  assignCompanyAccessRepo,
  getEffectiveCompanyRoleRepo,
  inviteWorkspaceMemberRepo,
  isWorkspaceSocioRepo,
  listCompanyAuditLogsRepo,
  listWorkspaceMembersRepo,
  recordCompanyAuditLogRepo,
  revokeWorkspaceMemberRepo,
  updateWorkspaceMemberRoleRepo
} from '../repositories/workspace-members.repo';
import { errorStatus } from './route-helpers';
import type { DespachoRole } from '../../shared/types/despacho-rbac.types';

export const workspaceMembersRoutes = new Hono();

workspaceMembersRoutes.use('*', async (c, next) => {
  const actor = await resolveRequestActorAsync(c);
  if (actor.authError) return c.json({ error: actor.authError }, 401);
  if (isUserSuspended(actor.userId, actor.userEmail)) {
    return c.json({ error: 'USER_SUSPENDED: Tu cuenta ha sido suspendida por un administrador.' }, 403);
  }
  return next();
});

const readActor = (c: Context) => {
  const actor = resolveRequestActor(c);
  return { userId: actor.userId, userEmail: actor.userEmail };
};

workspaceMembersRoutes.get('/workspaces/:workspaceId/members', (c) => {
  const workspaceId = c.req.param('workspaceId');
  const { userId, userEmail } = readActor(c);
  const members = listWorkspaceMembersRepo(workspaceId);
  const ok =
    isWorkspaceSocioRepo(workspaceId, userId, userEmail) ||
    members.some(
      (m) =>
        m.status === 'ACTIVO' &&
        m.role !== 'CLIENTE_LECTURA' &&
        ((userId && m.userId === userId) ||
          (!m.userId && userEmail && m.email.toLowerCase() === userEmail.toLowerCase()))
    );
  return ok ? c.json(members) : c.json({ error: 'No perteneces a este despacho' }, 403);
});

workspaceMembersRoutes.post('/workspaces/:workspaceId/members/invite', async (c) => {
  try {
    const workspaceId = c.req.param('workspaceId');
    const { userId, userEmail } = readActor(c);
    if (!isWorkspaceSocioRepo(workspaceId, userId, userEmail)) return c.json({ error: 'Solo un SOCIO o dueño puede invitar' }, 403);
    const body = (await c.req.json()) as { email: string; role: DespachoRole; companyIds?: string[] };
    const created = inviteWorkspaceMemberRepo({
      workspaceId,
      email: body.email,
      role: body.role,
      invitedBy: userEmail || userId || 'socio@despacho.local',
      companyIds: body.companyIds
    });
    return c.json(created, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

workspaceMembersRoutes.patch('/workspaces/:workspaceId/members/:memberId/role', async (c) => {
  try {
    const { workspaceId, memberId } = c.req.param();
    const { userId, userEmail } = readActor(c);
    if (!isWorkspaceSocioRepo(workspaceId, userId, userEmail)) return c.json({ error: 'Solo un SOCIO o dueño puede cambiar roles' }, 403);
    const body = (await c.req.json()) as { role: DespachoRole };
    return c.json(updateWorkspaceMemberRoleRepo(workspaceId, memberId, body.role));
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

workspaceMembersRoutes.post('/workspaces/:workspaceId/members/:memberId/revoke', (c) => {
  try {
    const { workspaceId, memberId } = c.req.param();
    const { userId, userEmail } = readActor(c);
    if (!isWorkspaceSocioRepo(workspaceId, userId, userEmail)) return c.json({ error: 'Solo un SOCIO o dueño puede revocar' }, 403);
    return c.json(revokeWorkspaceMemberRepo(workspaceId, memberId));
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

workspaceMembersRoutes.put('/workspaces/:workspaceId/members/:memberId/companies', async (c) => {
  try {
    const { workspaceId, memberId } = c.req.param();
    const { userId, userEmail } = readActor(c);
    if (!isWorkspaceSocioRepo(workspaceId, userId, userEmail)) return c.json({ error: 'Solo un SOCIO o dueño puede asignar empresas' }, 403);
    const body = (await c.req.json()) as { companyIds: string[]; roleOverride?: DespachoRole | null };
    return c.json(assignCompanyAccessRepo({ workspaceId, memberId, companyIds: body.companyIds ?? [], roleOverride: body.roleOverride ?? null }));
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

workspaceMembersRoutes.post('/workspaces/invites/accept', (c) => {
  const { userId, userEmail } = readActor(c);
  if (!userId || !userEmail) return c.json({ acceptedCount: 0 });
  return c.json(acceptPendingInvitesRepo(userId, userEmail));
});

workspaceMembersRoutes.get('/companies/:companyId/effective-role', (c) => {
  const { userId, userEmail } = readActor(c);
  return c.json(getEffectiveCompanyRoleRepo(c.req.param('companyId'), userId, userEmail));
});

workspaceMembersRoutes.get('/companies/:companyId/audit-logs', (c) => {
  const companyId = c.req.param('companyId');
  const { userId, userEmail } = readActor(c);
  const eff = getEffectiveCompanyRoleRepo(companyId, userId, userEmail);
  if (!eff.role) return c.json({ error: 'Sin autorización para consultar bitácora de esta empresa' }, 403);
  return c.json(listCompanyAuditLogsRepo(companyId, Number(c.req.query('limit') || 50)));
});

workspaceMembersRoutes.post('/companies/:companyId/audit-logs', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const { userId, userEmail } = readActor(c);
    const eff = getEffectiveCompanyRoleRepo(companyId, userId, userEmail);
    if (!eff.role) return c.json({ error: 'Sin autorización sobre esta empresa' }, 403);
    if (!eff.canWrite) return c.json({ error: 'Rol CLIENTE_LECTURA: escritura bloqueada en bitácora' }, 403);
    const body = (await c.req.json()) as { action: string; entityType: string; entityId?: string | null; metadata?: Record<string, unknown> };
    return c.json(
      recordCompanyAuditLogRepo({
        companyId,
        action: body.action,
        entityType: body.entityType,
        entityId: body.entityId ?? null,
        metadata: body.metadata,
        actorUserId: userId,
        actorEmail: userEmail || userId || 'usuario@despacho.local'
      }),
      201
    );
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});
