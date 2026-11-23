import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export type PlatformRole = 'SUPERADMIN' | 'SUPPORT_READONLY' | 'BILLING_OPS' | 'NONE';
export type DespachoRole = 'SOCIO' | 'CONTADOR' | 'AUXILIAR' | 'CLIENTE_LECTURA';
export type EffectiveCompanyRole = DespachoRole | 'OWNER';

export const DESPACHO_ROLE_RANK: Record<DespachoRole, number> = {
  CLIENTE_LECTURA: 1,
  AUXILIAR: 2,
  CONTADOR: 3,
  SOCIO: 4
};

export const ALLOWED_ORIGINS = new Set([
  'https://librepaq.com',
  'https://www.librepaq.com',
  'https://librepaq-44516.web.app',
  'https://librepaq-44516.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5173'
]);

/** Construye los encabezados CORS restringidos a los orígenes permitidos. */
export function corsHeaders(origin: string | null, extraAllowHeaders = ''): Record<string, string> {
  const allowHeaders = extraAllowHeaders
    ? `authorization, x-client-info, apikey, content-type, ${extraAllowHeaders}`
    : 'authorization, x-client-info, apikey, content-type';
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://librepaq.com',
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}

/** Serializa una respuesta JSON con código de estado y encabezados CORS. */
export function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

/** Obtiene la lista de correos SuperAdmin desde `SUPERADMIN_EMAILS` con respaldo seguro. */
export function getSuperAdminEmails(): string[] {
  const raw = (Deno.env.get('SUPERADMIN_EMAILS') || '').trim();
  if (!raw) return ['hlopezb@gmail.com'];
  const parsed = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return parsed.length > 0 ? parsed : ['hlopezb@gmail.com'];
}

/** Verifica si un correo pertenece a la lista canónica de SuperAdmin. */
export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getSuperAdminEmails().includes(email.trim().toLowerCase());
}

/** Normaliza el rol administrativo de plataforma a partir de perfil y correo. */
export function resolvePlatformRole(rawRole?: unknown, isSuperAdminFlag?: unknown, email?: string): PlatformRole {
  if (isSuperAdminEmail(email)) return 'SUPERADMIN';
  const upper = String(rawRole || '').trim().toUpperCase() as PlatformRole;
  if (upper === 'SUPERADMIN' || upper === 'SUPPORT_READONLY' || upper === 'BILLING_OPS') return upper;
  if (Boolean(isSuperAdminFlag)) return 'SUPERADMIN';
  return 'NONE';
}

export type AdminAuthResult =
  | { ok: true; user: { id: string; email: string }; actorEmail: string; role: PlatformRole }
  | { ok: false; status: number; error: string };

/** Verifica si la cuenta del usuario está marcada como SUSPENDIDO en `user_profiles`. */
export async function isUserSuspended(supabase: SupabaseClient, userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('status')
    .eq('id', userId)
    .maybeSingle();
  return String(profile?.status || '').trim().toUpperCase() === 'SUSPENDIDO';
}

/** Autentica un Bearer JWT y valida que el usuario no esté suspendido y tenga rol administrativo. */
export async function authenticateAdminRequest(
  req: Request,
  supabase: SupabaseClient,
  missingTokenError = 'Header Authorization Bearer requerido'
): Promise<AdminAuthResult> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, status: 401, error: missingTokenError };

  const { data: authData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authData?.user) {
    return { ok: false, status: 401, error: 'Token de sesión inválido o expirado' };
  }

  const user = authData.user;
  const actorEmail = (user.email || '').toLowerCase();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('status, platform_role, is_superadmin')
    .eq('id', user.id)
    .maybeSingle();

  if (String(profile?.status || '').trim().toUpperCase() === 'SUSPENDIDO') {
    return { ok: false, status: 403, error: 'Acceso denegado: cuenta suspendida' };
  }

  const role: PlatformRole = resolvePlatformRole(profile?.platform_role, profile?.is_superadmin, actorEmail);

  if (role === 'NONE') {
    return { ok: false, status: 403, error: 'Acceso denegado: requiere rol administrativo de plataforma' };
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email || actorEmail || 'superadmin' },
    actorEmail,
    role
  };
}

export interface CompanyRoleResolution {
  role: EffectiveCompanyRole | null;
  canWrite: boolean;
  isReadOnlyClient: boolean;
}

/**
 * Resuelve el rol efectivo de un usuario sobre una empresa en `companies`,
 * evaluando propiedad directa y membresías activas en `workspace_members` / `company_member_access`.
 */
export async function resolveEffectiveCompanyRole(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  userEmail: string
): Promise<CompanyRoleResolution> {
  const email = userEmail.trim().toLowerCase();
  const { data: comp, error: compErr } = await supabase
    .from('companies')
    .select('id, user_id')
    .eq('id', companyId)
    .maybeSingle();

  if (compErr || !comp) {
    return { role: null, canWrite: false, isReadOnlyClient: false };
  }
  if (comp.user_id === userId) {
    return { role: 'OWNER', canWrite: true, isReadOnlyClient: false };
  }
  if (!comp.user_id || comp.user_id === 'demo') {
    return { role: null, canWrite: false, isReadOnlyClient: false };
  }

  const { data: byUser } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('status', 'ACTIVO')
    .eq('user_id', userId);

  let byEmail: Record<string, unknown>[] = [];
  if (email) {
    const { data: emailRows } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('status', 'ACTIVO')
      .eq('email', email);
    byEmail = emailRows || [];
  }

  const membersById = new Map<string, Record<string, unknown>>();
  for (const m of [...(byUser || []), ...byEmail]) {
    const id = String(m.id || '');
    if (id && !membersById.has(id)) membersById.set(id, m);
  }

  const active = Array.from(membersById.values()).filter(
    (m) =>
      m.user_id === userId ||
      (!m.user_id && email !== '' && String(m.email || '').trim().toLowerCase() === email)
  );
  if (active.length === 0) {
    return { role: null, canWrite: false, isReadOnlyClient: false };
  }

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

  const { data: ownerProfile } = await supabase
    .from('user_profiles')
    .select('workspace_id')
    .eq('id', comp.user_id)
    .maybeSingle();
  const ownerProfileWorkspaceId = ownerProfile?.workspace_id ? String(ownerProfile.workspace_id) : null;

  let bestRole: DespachoRole | null = null;
  for (const m of active) {
    const mid = String(m.id);
    const restricted = accessByMember.get(mid) || [];
    let candidate: DespachoRole | null = null;
    if (restricted.length > 0) {
      const match = restricted.find((r) => String(r.company_id) === companyId);
      if (match) candidate = (match.role_override || m.role) as DespachoRole;
    } else if (
      m.workspace_id === comp.user_id ||
      m.workspace_id === `ws_${String(comp.user_id).slice(0, 8)}` ||
      (ownerProfileWorkspaceId !== null && m.workspace_id === ownerProfileWorkspaceId)
    ) {
      candidate = m.role as DespachoRole;
    }
    if (candidate && (!bestRole || DESPACHO_ROLE_RANK[candidate] > DESPACHO_ROLE_RANK[bestRole])) {
      bestRole = candidate;
    }
  }

  return {
    role: bestRole,
    canWrite: bestRole ? bestRole !== 'CLIENTE_LECTURA' : false,
    isReadOnlyClient: bestRole === 'CLIENTE_LECTURA'
  };
}

/** Verifica si el rol efectivo sobre una empresa cumple con el rango mínimo exigido. */
export function hasMinimumCompanyRole(role: EffectiveCompanyRole | null, minRole: DespachoRole): boolean {
  if (!role) return false;
  if (role === 'OWNER') return true;
  return (DESPACHO_ROLE_RANK[role] ?? 0) >= DESPACHO_ROLE_RANK[minRole];
}

export type ActiveUserAuthResult =
  | { ok: true; user: { id: string; email: string }; platformRole: PlatformRole }
  | { ok: false; status: number; error: string };

/** Autentica un Bearer JWT de usuario estándar y bloquea cuentas marcadas como SUSPENDIDO. */
export async function authenticateActiveUser(
  req: Request,
  supabase: SupabaseClient
): Promise<ActiveUserAuthResult> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { ok: false, status: 401, error: 'Header Authorization Bearer requerido' };
  }

  const { data: authData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authData?.user) {
    return { ok: false, status: 401, error: 'Token de sesión inválido o expirado' };
  }

  const user = authData.user;
  const email = (user.email || '').trim().toLowerCase();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('status, platform_role, is_superadmin')
    .eq('id', user.id)
    .maybeSingle();

  if (String(profile?.status || '').trim().toUpperCase() === 'SUSPENDIDO') {
    return { ok: false, status: 403, error: 'Acceso denegado: cuenta suspendida' };
  }

  const platformRole: PlatformRole =
    user.app_metadata?.role === 'superadmin'
      ? 'SUPERADMIN'
      : resolvePlatformRole(profile?.platform_role, profile?.is_superadmin, email);

  return { ok: true, user: { id: user.id, email }, platformRole };
}

/** Valida que el usuario autenticado tenga al menos `minRole` sobre `companyId` (bloqueando SUPPORT_READONLY). */
export async function authorizeCompanyRole(
  supabase: SupabaseClient,
  authUser: { user: { id: string; email: string }; platformRole: PlatformRole },
  companyId: string,
  minRole: DespachoRole
): Promise<{ ok: true; companyRole: EffectiveCompanyRole } | { ok: false; status: number; error: string }> {
  if (authUser.platformRole === 'SUPERADMIN') {
    return { ok: true, companyRole: 'OWNER' };
  }
  if (authUser.platformRole === 'SUPPORT_READONLY') {
    return { ok: false, status: 403, error: 'Acceso denegado: soporte de solo lectura no tiene permisos de operación' };
  }

  const resolved = await resolveEffectiveCompanyRole(
    supabase,
    companyId,
    authUser.user.id,
    authUser.user.email
  );

  if (!hasMinimumCompanyRole(resolved.role, minRole)) {
    return { ok: false, status: 403, error: 'No tienes autorización sobre esta empresa' };
  }

  return { ok: true, companyRole: resolved.role! };
}
