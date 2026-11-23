/**
 * Supabase Edge Function: admin-ops
 * Operaciones privilegiadas del panel SuperAdmin con auditoría obligatoria.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

type AdminOpsAction =
  | 'SET_USER_STATUS'
  | 'DELETE_COMPANY'
  | 'PUBLISH_BROADCAST'
  | 'CLEAR_BROADCAST'
  | 'RECORD_AUDIT';

interface AdminOpsRequestBody {
  action?: AdminOpsAction;
  userId?: string;
  status?: 'ACTIVO' | 'SUSPENDIDO';
  reason?: string;
  companyId?: string;
  title?: string;
  message?: string;
  type?: 'info' | 'warning' | 'success';
  expiresAt?: string | null;
  auditAction?: string;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
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
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return jsonResponse({ ok: false, error: 'Header Authorization Bearer requerido' }, 401, headers);
    }

    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) {
      return jsonResponse({ ok: false, error: 'Token de sesión inválido o expirado' }, 401, headers);
    }

    const user = authData.user;
    const actorEmail = (user.email || '').toLowerCase();

    let isSuperAdmin = actorEmail === 'hlopezb@gmail.com';
    if (!isSuperAdmin) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_superadmin')
        .eq('id', user.id)
        .maybeSingle();
      isSuperAdmin = Boolean(profile?.is_superadmin);
    }

    if (!isSuperAdmin) {
      return jsonResponse({ ok: false, error: 'Acceso denegado: requiere privilegios de SuperAdmin' }, 403, headers);
    }

    const body = (await req.json()) as AdminOpsRequestBody;
    const action = body.action;
    if (!action) {
      return jsonResponse({ ok: false, error: 'action es requerido' }, 400, headers);
    }

    const writeAudit = async (entry: {
      auditAction: string;
      targetType: string;
      targetId?: string | null;
      metadata?: Record<string, unknown>;
    }) => {
      await supabase.from('admin_audit_logs').insert({
        id: `audit_${crypto.randomUUID().slice(0, 12)}`,
        actor_user_id: user.id,
        actor_email: user.email || actorEmail || 'superadmin',
        action: entry.auditAction,
        target_type: entry.targetType,
        target_id: entry.targetId ?? null,
        metadata: entry.metadata ?? {},
        created_at: new Date().toISOString()
      });
    };

    if (action === 'SET_USER_STATUS') {
      const targetUserId = (body.userId || '').trim();
      const nextStatus = body.status;
      if (!targetUserId || (nextStatus !== 'ACTIVO' && nextStatus !== 'SUSPENDIDO')) {
        return jsonResponse({ ok: false, error: 'userId y status (ACTIVO | SUSPENDIDO) son requeridos' }, 400, headers);
      }
      if (targetUserId === user.id && nextStatus === 'SUSPENDIDO') {
        return jsonResponse({ ok: false, error: 'No puedes suspender tu propia cuenta SuperAdmin' }, 400, headers);
      }

      const { error: updErr } = await supabase
        .from('user_profiles')
        .update({ status: nextStatus })
        .eq('id', targetUserId);

      if (updErr) {
        return jsonResponse({ ok: false, error: updErr.message }, 500, headers);
      }

      await writeAudit({
        auditAction: 'SET_USER_STATUS',
        targetType: 'user',
        targetId: targetUserId,
        metadata: { status: nextStatus, reason: body.reason ?? null }
      });

      return jsonResponse({ ok: true, userId: targetUserId, status: nextStatus }, 200, headers);
    }

    if (action === 'DELETE_COMPANY') {
      const companyId = (body.companyId || '').trim();
      if (!companyId) {
        return jsonResponse({ ok: false, error: 'companyId es requerido' }, 400, headers);
      }

      const { data: comp } = await supabase
        .from('companies')
        .select('id, name, rfc')
        .eq('id', companyId)
        .maybeSingle();

      const { data: deleted, error: rpcErr } = await supabase.rpc('delete_company_cascade', {
        company_id_param: companyId
      });

      if (rpcErr) {
        return jsonResponse({ ok: false, error: rpcErr.message }, 500, headers);
      }

      await writeAudit({
        auditAction: 'DELETE_COMPANY',
        targetType: 'company',
        targetId: companyId,
        metadata: {
          companyName: comp?.name ?? null,
          companyRfc: comp?.rfc ?? null
        }
      });

      return jsonResponse({ ok: true, deleted: Boolean(deleted ?? true), companyId }, 200, headers);
    }

    if (action === 'PUBLISH_BROADCAST') {
      const title = (body.title || '').trim();
      const message = (body.message || '').trim();
      const type = body.type;
      if (!title || !message || !type || !['info', 'warning', 'success'].includes(type)) {
        return jsonResponse({ ok: false, error: 'title, message y type (info|warning|success) son requeridos' }, 400, headers);
      }

      const nowIso = new Date().toISOString();
      await supabase
        .from('platform_broadcasts')
        .update({ active: false, updated_at: nowIso })
        .eq('active', true);

      const newId = `bcast_${crypto.randomUUID().slice(0, 12)}`;
      const { data: inserted, error: insErr } = await supabase
        .from('platform_broadcasts')
        .insert({
          id: newId,
          title,
          message,
          type,
          active: true,
          starts_at: nowIso,
          expires_at: body.expiresAt ?? null,
          created_by: user.email || user.id,
          created_at: nowIso,
          updated_at: nowIso
        })
        .select('*')
        .single();

      if (insErr || !inserted) {
        return jsonResponse({ ok: false, error: insErr?.message || 'No se pudo publicar el comunicado' }, 500, headers);
      }

      await writeAudit({
        auditAction: 'PUBLISH_BROADCAST',
        targetType: 'broadcast',
        targetId: inserted.id,
        metadata: { title, type, expiresAt: body.expiresAt ?? null }
      });

      return jsonResponse(
        {
          ok: true,
          broadcast: {
            id: inserted.id,
            title: inserted.title,
            message: inserted.message,
            type: inserted.type,
            active: inserted.active,
            startsAt: inserted.starts_at,
            expiresAt: inserted.expires_at,
            createdBy: inserted.created_by,
            createdAt: inserted.created_at,
            updatedAt: inserted.updated_at
          }
        },
        200,
        headers
      );
    }

    if (action === 'CLEAR_BROADCAST') {
      const nowIso = new Date().toISOString();
      const { error: clrErr } = await supabase
        .from('platform_broadcasts')
        .update({ active: false, updated_at: nowIso })
        .eq('active', true);

      if (clrErr) {
        return jsonResponse({ ok: false, error: clrErr.message }, 500, headers);
      }

      await writeAudit({
        auditAction: 'CLEAR_BROADCAST',
        targetType: 'broadcast',
        targetId: null,
        metadata: {}
      });

      return jsonResponse({ ok: true }, 200, headers);
    }

    if (action === 'RECORD_AUDIT') {
      const auditAction = (body.auditAction || '').trim();
      const targetType = (body.targetType || '').trim() || 'platform';
      if (!auditAction) {
        return jsonResponse({ ok: false, error: 'auditAction es requerido' }, 400, headers);
      }

      await writeAudit({
        auditAction,
        targetType,
        targetId: body.targetId ?? null,
        metadata: body.metadata ?? {}
      });

      return jsonResponse({ ok: true }, 200, headers);
    }

    return jsonResponse({ ok: false, error: `Acción '${action}' no reconocida` }, 400, headers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno en admin-ops';
    return jsonResponse({ ok: false, error: message }, 500, headers);
  }
});
