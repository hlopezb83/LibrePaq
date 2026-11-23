/**
 * Supabase Edge Function: sat-soap-sync
 * Worker oficial para el Web Service de Descarga Masiva del SAT v1.5
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  authenticateActiveUser,
  authorizeCompanyRole,
  corsHeaders
} from '../_shared/admin-edge-auth.ts';
import { jsonResponse, type SatRequestPayload } from './sat-client.ts';
import {
  handleSolicitaDescarga,
  handleStoreFiel,
  handleVerificaDescarga
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

    let payload: SatRequestPayload;
    try {
      payload = (await req.json()) as SatRequestPayload;
    } catch {
      return jsonResponse({ ok: false, error: 'Cuerpo JSON inválido' }, 400, headers);
    }

    if (!payload?.companyId || typeof payload.companyId !== 'string') {
      return jsonResponse({ ok: false, error: 'companyId es requerido' }, 400, headers);
    }

    const action = payload.action || 'solicita-descarga';
    if (action !== 'store-fiel' && action !== 'solicita-descarga' && action !== 'verifica-descarga') {
      return jsonResponse({ ok: false, error: `Acción '${String(action)}' no reconocida` }, 400, headers);
    }

    const minRole = action === 'store-fiel' ? 'CONTADOR' : 'AUXILIAR';
    const access = await authorizeCompanyRole(supabase, auth, payload.companyId, minRole);
    if (!access.ok) {
      return jsonResponse({ ok: false, error: access.error }, access.status, headers);
    }

    if (action === 'store-fiel') {
      return handleStoreFiel(supabase, payload, headers);
    }
    if (action === 'solicita-descarga') {
      return handleSolicitaDescarga(supabase, payload, headers);
    }
    return handleVerificaDescarga(supabase, payload, headers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno en worker SAT';
    return jsonResponse({ ok: false, error: message }, 500, headers);
  }
});
