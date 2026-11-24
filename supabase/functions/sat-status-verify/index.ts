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
  authenticateActiveUser,
  authorizeCompanyRole,
  corsHeaders,
  jsonResponse
} from '../_shared/admin-edge-auth.ts';
import {
  handleCheck69B,
  handleUpsert69BBatch,
  handleVerifyBatch,
  type Check69BPayload,
  type SatStatusVerifyPayload,
  type Upsert69BBatchPayload,
  type VerifyBatchPayload
} from './handlers.ts';

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
    const auth = await authenticateActiveUser(req, supabase);
    if (!auth.ok) {
      return jsonResponse({ ok: false, error: auth.error }, auth.status, headers);
    }

    let payload: SatStatusVerifyPayload;
    try {
      payload = (await req.json()) as SatStatusVerifyPayload;
    } catch {
      return jsonResponse({ ok: false, error: 'Cuerpo JSON inválido' }, 400, headers);
    }

    const action = payload.action || 'VERIFY_BATCH';
    if (action !== 'VERIFY_BATCH' && action !== 'CHECK_69B' && action !== 'UPSERT_69B_BATCH') {
      return jsonResponse({ ok: false, error: `Acción '${String(action)}' no reconocida` }, 400, headers);
    }

    if (action === 'VERIFY_BATCH') {
      if (!payload?.companyId || typeof payload.companyId !== 'string') {
        return jsonResponse({ ok: false, error: 'companyId es requerido' }, 400, headers);
      }
      const access = await authorizeCompanyRole(supabase, auth, payload.companyId, 'AUXILIAR');
      if (!access.ok) {
        return jsonResponse({ ok: false, error: access.error }, access.status, headers);
      }
      return await handleVerifyBatch(supabase, payload as VerifyBatchPayload, headers);
    }

    if (payload?.companyId && typeof payload.companyId === 'string') {
      const access = await authorizeCompanyRole(supabase, auth, payload.companyId, 'AUXILIAR');
      if (!access.ok) {
        return jsonResponse({ ok: false, error: access.error }, access.status, headers);
      }
    } else if (auth.platformRole === 'SUPPORT_READONLY') {
      return jsonResponse(
        { ok: false, error: 'Acceso denegado: soporte de solo lectura no tiene permisos de operación' },
        403,
        headers
      );
    }

    if (action === 'UPSERT_69B_BATCH') {
      return await handleUpsert69BBatch(supabase, payload as Upsert69BBatchPayload, headers);
    }
    return await handleCheck69B(supabase, payload as Check69BPayload, headers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno en sat-status-verify';
    return jsonResponse({ ok: false, error: message }, 500, headers);
  }
});
