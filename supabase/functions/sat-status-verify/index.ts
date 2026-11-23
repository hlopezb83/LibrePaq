/**
 * Supabase Edge Function: sat-status-verify
 * Verificación en vivo de vigencia CFDI 4.0 ante el SAT (ConsultaCFDIService.svc)
 * y cruce contra lista negra EFOS 69-B (public.sat_efos_69b + third_parties).
 *
 * Configurada con verify_jwt: false (--no-verify-jwt); valida manualmente el Bearer JWT
 * con supabase.auth.getUser(token) y autoriza acceso por companyId o rol superadmin.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  ALLOWED_ORIGINS,
  isSuperAdminEmail,
  jsonResponse
} from '../_shared/admin-edge-auth.ts';
import {
  handleCheck69B,
  handleVerifyBatch,
  type Check69BPayload,
  type SatStatusVerifyPayload,
  type VerifyBatchPayload
} from './handlers.ts';

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://librepaq.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, headers);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Configuración de servidor incompleta en Edge Function' }, 500, headers);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    let payload: SatStatusVerifyPayload;
    try {
      payload = (await req.json()) as SatStatusVerifyPayload;
    } catch {
      return jsonResponse({ ok: false, error: 'Cuerpo JSON inválido' }, 400, headers);
    }

    if (!payload?.companyId || typeof payload.companyId !== 'string') {
      return jsonResponse({ ok: false, error: 'companyId es requerido' }, 400, headers);
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return jsonResponse({ ok: false, error: 'Header Authorization Bearer requerido' }, 401, headers);
    }

    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) {
      return jsonResponse({ ok: false, error: 'Token de sesión inválido o expirado' }, 401, headers);
    }

    const user = authData.user;
    let isSuperAdmin =
      user.app_metadata?.role === 'superadmin' ||
      isSuperAdminEmail(user.email);

    if (!isSuperAdmin) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('status, platform_role, is_superadmin')
        .eq('id', user.id)
        .maybeSingle();

      if (String(profile?.status || '').toUpperCase() === 'SUSPENDIDO') {
        return jsonResponse({ ok: false, error: 'Acceso denegado: cuenta suspendida' }, 403, headers);
      }

      if (profile?.is_superadmin || String(profile?.platform_role || '').toUpperCase() === 'SUPERADMIN') {
        isSuperAdmin = true;
      }
    }

    if (!isSuperAdmin) {
      const { data: company, error: compErr } = await supabase
        .from('companies')
        .select('id, user_id')
        .eq('id', payload.companyId)
        .maybeSingle();

      const hasCompanyAccess =
        Boolean(company) &&
        (company!.user_id === user.id || company!.user_id === 'demo' || company!.user_id === null);

      if (compErr || !hasCompanyAccess) {
        return jsonResponse({ ok: false, error: 'No tienes autorización sobre esta empresa' }, 403, headers);
      }
    }

    const action = payload.action || 'VERIFY_BATCH';
    if (action === 'VERIFY_BATCH') {
      return await handleVerifyBatch(supabase, payload as VerifyBatchPayload, headers);
    }
    if (action === 'CHECK_69B') {
      return await handleCheck69B(supabase, payload as Check69BPayload, headers);
    }

    return jsonResponse({ ok: false, error: `Acción '${String(action)}' no reconocida` }, 400, headers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno en sat-status-verify';
    return jsonResponse({ ok: false, error: message }, 500, headers);
  }
});
