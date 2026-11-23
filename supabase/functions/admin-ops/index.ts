/**
 * Supabase Edge Function: admin-ops
 * Operaciones privilegiadas del panel SuperAdmin con RBAC granular y auditoría obligatoria.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authenticateAdminRequest, corsHeaders, jsonResponse } from '../_shared/admin-edge-auth.ts';
import { ACTION_ALLOWED_ROLES, type AdminOpsRequestBody } from './mappers.ts';
import { dispatchAdminOpsAction } from './handlers.ts';

Deno.serve(async (req: Request) => {
  const headers = { ...corsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, headers);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Configuración de servidor incompleta en Edge Function' }, 500, headers);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const auth = await authenticateAdminRequest(req, supabase);
    if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, headers);

    const body = (await req.json()) as AdminOpsRequestBody;
    const action = body.action;
    if (!action) return jsonResponse({ ok: false, error: 'action es requerido' }, 400, headers);

    const allowedRoles = ACTION_ALLOWED_ROLES[action];
    if (!allowedRoles) return jsonResponse({ ok: false, error: `Acción '${action}' no reconocida` }, 400, headers);
    if (!allowedRoles.has(auth.role)) {
      return jsonResponse({ ok: false, error: `Tu rol (${auth.role}) no tiene permiso para ejecutar ${action}` }, 403, headers);
    }

    return await dispatchAdminOpsAction(
      action,
      supabase,
      { userId: auth.user.id, email: auth.user.email, role: auth.role },
      body,
      headers
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno en admin-ops';
    return jsonResponse({ ok: false, error: message }, 500, headers);
  }
});
