import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export type PlatformRole = 'SUPERADMIN' | 'SUPPORT_READONLY' | 'BILLING_OPS' | 'NONE';

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
  let role: PlatformRole = isSuperAdminEmail(actorEmail) ? 'SUPERADMIN' : 'NONE';

  if (role !== 'SUPERADMIN') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('status, platform_role, is_superadmin')
      .eq('id', user.id)
      .maybeSingle();
    if (String(profile?.status || '').toUpperCase() === 'SUSPENDIDO') {
      return { ok: false, status: 403, error: 'Acceso denegado: cuenta suspendida' };
    }
    role = resolvePlatformRole(profile?.platform_role, profile?.is_superadmin, actorEmail);
  }

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
