import type { SupabaseClient, User } from 'jsr:@supabase/supabase-js@2';
import {
  DESPACHO_ROLE_RANK,
  isSuperAdminEmail,
  resolveEffectiveCompanyRole,
  type DespachoRole
} from '../_shared/admin-edge-auth.ts';

export type { DespachoRole };
export const VALID_ROLES = new Set<DespachoRole>(['SOCIO', 'CONTADOR', 'AUXILIAR', 'CLIENTE_LECTURA']);
export const ROLE_RANK: Record<DespachoRole, number> = DESPACHO_ROLE_RANK;

export interface WorkspaceInvitesReqBody {
  action?: string;
  workspaceId?: string;
  memberId?: string;
  email?: string;
  role?: string;
  companyId?: string;
  companyIds?: string[];
  roleOverride?: string | null;
  entityType?: string;
  entityId?: string | null;
  auditAction?: string;
  metadata?: Record<string, unknown>;
  limit?: number;
}

export function mapAccess(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    companyId: String(r.company_id),
    memberId: String(r.member_id),
    userId: r.user_id ? String(r.user_id) : null,
    roleOverride: r.role_override ? (String(r.role_override) as DespachoRole) : null,
    createdAt: String(r.created_at)
  };
}

export function mapMember(r: Record<string, unknown>, access: Record<string, unknown>[] = []) {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    userId: r.user_id ? String(r.user_id) : null,
    email: String(r.email),
    role: String(r.role) as DespachoRole,
    status: String(r.status),
    invitedBy: String(r.invited_by || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    companyAccess: access.map(mapAccess)
  };
}

export function mapAudit(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    companyId: String(r.company_id),
    actorUserId: r.actor_user_id ? String(r.actor_user_id) : null,
    actorEmail: String(r.actor_email),
    action: String(r.action),
    entityType: String(r.entity_type),
    entityId: r.entity_id ? String(r.entity_id) : null,
    metadata: (r.metadata && typeof r.metadata === 'object' ? r.metadata : {}) as Record<string, unknown>,
    createdAt: String(r.created_at)
  };
}

export async function getCallerContext(supabase: SupabaseClient, user: User) {
  const email = (user.email || '').trim().toLowerCase();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('status, platform_role, is_superadmin, workspace_id')
    .eq('id', user.id)
    .maybeSingle();

  const suspended = String(profile?.status || '').toUpperCase() === 'SUSPENDIDO';
  const isSuper =
    isSuperAdminEmail(email) ||
    user.app_metadata?.role === 'superadmin' ||
    Boolean(profile?.is_superadmin) ||
    String(profile?.platform_role || '').toUpperCase() === 'SUPERADMIN';
  const isSupport = String(profile?.platform_role || '').toUpperCase() === 'SUPPORT_READONLY';
  return {
    userId: user.id,
    email,
    suspended,
    isSuper,
    isSupport,
    profileWorkspaceId: profile?.workspace_id ? String(profile.workspace_id) : null,
    defaultWsId: `ws_${user.id.slice(0, 8)}`
  };
}

export type CallerContext = Awaited<ReturnType<typeof getCallerContext>>;

export async function isWorkspaceSocio(
  supabase: SupabaseClient,
  wsId: string,
  ctx: CallerContext
): Promise<boolean> {
  if (ctx.isSuper) return true;
  if (wsId === ctx.userId || wsId === ctx.defaultWsId) return true;
  const { data } = await supabase
    .from('workspace_members')
    .select('id, user_id, email, access_scope')
    .eq('workspace_id', wsId)
    .eq('status', 'ACTIVO')
    .eq('role', 'SOCIO');
  return (data || []).some(
    (m) =>
      String(m.access_scope || 'ALL_COMPANIES').toUpperCase() === 'ALL_COMPANIES' &&
      (m.user_id === ctx.userId ||
        (!m.user_id && ctx.email !== '' && String(m.email || '').trim().toLowerCase() === ctx.email))
  );
}

export async function isWorkspaceMember(
  supabase: SupabaseClient,
  wsId: string,
  ctx: CallerContext
): Promise<boolean> {
  if (await isWorkspaceSocio(supabase, wsId, ctx)) return true;
  if (ctx.isSupport) return true;
  const { data } = await supabase
    .from('workspace_members')
    .select('id, user_id, email, role')
    .eq('workspace_id', wsId)
    .eq('status', 'ACTIVO');
  return (data || []).some(
    (m) =>
      String(m.role || '').toUpperCase() !== 'CLIENTE_LECTURA' &&
      (m.user_id === ctx.userId ||
        (!m.user_id && ctx.email !== '' && String(m.email || '').trim().toLowerCase() === ctx.email))
  );
}

export async function assertCompaniesBelongToWorkspace(
  supabase: SupabaseClient,
  wsId: string,
  companyIds: string[],
  ctx: CallerContext
): Promise<string | null> {
  if (companyIds.length === 0 || ctx.isSuper) return null;
  const { data: comps, error } = await supabase
    .from('companies')
    .select('id, user_id, organization_id')
    .in('id', companyIds);
  if (error) return error.message;
  if ((comps || []).length !== companyIds.length) {
    return 'Una o más empresas seleccionadas no existen';
  }
  for (const c of comps || []) {
    const uid = c.user_id ? String(c.user_id) : '';
    const orgId = c.organization_id ? String(c.organization_id).trim() : '';
    const ok =
      (orgId !== '' && orgId === wsId) ||
      (uid !== '' &&
        uid !== 'demo' &&
        (uid === ctx.userId || uid === wsId || `ws_${uid.slice(0, 8)}` === wsId));
    if (!ok) return 'No tienes autorización sobre una o más empresas seleccionadas';
  }
  return null;
}

export async function resolveCompanyRole(
  supabase: SupabaseClient,
  companyId: string,
  ctx: CallerContext
): Promise<{ role: DespachoRole | 'OWNER' | null; canWrite: boolean; isReadOnlyClient: boolean }> {
  if (ctx.isSuper) return { role: 'OWNER', canWrite: true, isReadOnlyClient: false };
  if (ctx.isSupport) return { role: 'CLIENTE_LECTURA', canWrite: false, isReadOnlyClient: true };
  return await resolveEffectiveCompanyRole(supabase, companyId, ctx.userId, ctx.email);
}
