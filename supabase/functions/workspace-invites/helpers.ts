import type { SupabaseClient, User } from 'jsr:@supabase/supabase-js@2';
import { isSuperAdminEmail } from '../_shared/admin-edge-auth.ts';

export type DespachoRole = 'SOCIO' | 'CONTADOR' | 'AUXILIAR' | 'CLIENTE_LECTURA';
export const VALID_ROLES = new Set<DespachoRole>(['SOCIO', 'CONTADOR', 'AUXILIAR', 'CLIENTE_LECTURA']);
export const ROLE_RANK: Record<DespachoRole, number> = {
  CLIENTE_LECTURA: 1,
  AUXILIAR: 2,
  CONTADOR: 3,
  SOCIO: 4
};

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
  if (wsId === ctx.userId || wsId === ctx.defaultWsId || wsId === ctx.profileWorkspaceId) return true;
  const { data } = await supabase
    .from('workspace_members')
    .select('id, user_id, email')
    .eq('workspace_id', wsId)
    .eq('status', 'ACTIVO')
    .eq('role', 'SOCIO');
  return (data || []).some(
    (m) => m.user_id === ctx.userId || (!m.user_id && String(m.email || '').toLowerCase() === ctx.email)
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
    .select('id, user_id, email')
    .eq('workspace_id', wsId)
    .eq('status', 'ACTIVO');
  return (data || []).some(
    (m) => m.user_id === ctx.userId || (!m.user_id && String(m.email || '').toLowerCase() === ctx.email)
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
    .select('id, user_id')
    .in('id', companyIds);
  if (error) return error.message;
  if ((comps || []).length !== companyIds.length) {
    return 'Una o más empresas seleccionadas no existen';
  }
  const { data: wsOwners } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('workspace_id', wsId);
  const wsOwnerIds = new Set((wsOwners || []).map((u) => String(u.id)));
  for (const c of comps || []) {
    const uid = c.user_id ? String(c.user_id) : '';
    const ok =
      uid === ctx.userId ||
      uid === wsId ||
      (uid !== '' && (`ws_${uid.slice(0, 8)}` === wsId || wsOwnerIds.has(uid)));
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

  const { data: comp } = await supabase.from('companies').select('id, user_id').eq('id', companyId).maybeSingle();
  if (!comp) return { role: null, canWrite: false, isReadOnlyClient: false };
  if (comp.user_id === ctx.userId) return { role: 'OWNER', canWrite: true, isReadOnlyClient: false };

  const { data: members } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('status', 'ACTIVO')
    .or(`user_id.eq.${ctx.userId},email.ilike.${ctx.email}`);

  const active = (members || []).filter(
    (m) => m.user_id === ctx.userId || (!m.user_id && String(m.email || '').toLowerCase() === ctx.email)
  );
  if (active.length === 0) return { role: null, canWrite: false, isReadOnlyClient: false };

  const memberIds = active.map((m) => String(m.id));
  const { data: allAccess } = await supabase
    .from('company_member_access')
    .select('*')
    .in('member_id', memberIds);

  const accessByMember = new Map<string, Record<string, unknown>[]>();
  for (const row of allAccess || []) {
    const mid = String(row.member_id);
    const list = accessByMember.get(mid) || [];
    list.push(row);
    accessByMember.set(mid, list);
  }

  let bestRole: DespachoRole | null = null;
  for (const m of active) {
    const mid = String(m.id);
    const restricted = accessByMember.get(mid) || [];
    let candidate: DespachoRole | null = null;
    if (restricted.length > 0) {
      const match = restricted.find((r) => String(r.company_id) === companyId);
      if (match) candidate = (match.role_override || m.role) as DespachoRole;
    } else if (
      comp.user_id &&
      (m.workspace_id === comp.user_id || m.workspace_id === `ws_${String(comp.user_id).slice(0, 8)}`)
    ) {
      candidate = m.role as DespachoRole;
    }
    if (candidate && (!bestRole || ROLE_RANK[candidate] > ROLE_RANK[bestRole])) {
      bestRole = candidate;
    }
  }
  return {
    role: bestRole,
    canWrite: bestRole ? bestRole !== 'CLIENTE_LECTURA' : false,
    isReadOnlyClient: bestRole === 'CLIENTE_LECTURA'
  };
}
