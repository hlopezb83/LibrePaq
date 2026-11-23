/**
 * Supabase Edge Function: sat-soap-sync
 * Worker oficial para el Web Service de Descarga Masiva del SAT v1.5
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, type SatRequestPayload } from './sat-client.ts';
import {
  handleSolicitaDescarga,
  handleStoreFiel,
  handleVerificaDescarga
} from './handlers.ts';

const ALLOWED_ORIGINS = new Set([
  'https://librepaq.com',
  'https://www.librepaq.com',
  'https://librepaq-44516.web.app',
  'https://librepaq-44516.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5173'
]);

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
    const payload = (await req.json()) as SatRequestPayload;
    if (!payload.companyId) {
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
    const isSuperAdmin =
      user.app_metadata?.role === 'superadmin' ||
      user.email?.toLowerCase() === 'hlopezb@gmail.com';

    const action = payload.action || 'solicita-descarga';

    if (!isSuperAdmin) {
      const { data: company, error: compErr } = await supabase
        .from('companies')
        .select('id, user_id')
        .eq('id', payload.companyId)
        .maybeSingle();

      const hasCompanyAccess =
        company &&
        (action === 'store-fiel'
          ? company.user_id === user.id
          : company.user_id === user.id || company.user_id === 'demo');

      if (compErr || !hasCompanyAccess) {
        return jsonResponse({ ok: false, error: 'No tienes autorización sobre esta empresa' }, 403, headers);
      }
    }

    if (action === 'store-fiel') {
      return handleStoreFiel(supabase, payload, headers);
    }
    if (action === 'solicita-descarga') {
      return handleSolicitaDescarga(supabase, payload, headers);
    }
    if (action === 'verifica-descarga') {
      return handleVerificaDescarga(supabase, payload, headers);
    }

    return jsonResponse({ ok: false, error: `Acción '${action}' no reconocida` }, 400, headers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno en worker SAT';
    return jsonResponse({ ok: false, error: message }, 500, headers);
  }
});
