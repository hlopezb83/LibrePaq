/**
 * Supabase Edge Function: admin-ops
 * Operaciones privilegiadas del panel SuperAdmin con RBAC granular y auditoría obligatoria.
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

type PlatformRole = 'SUPERADMIN' | 'SUPPORT_READONLY' | 'BILLING_OPS' | 'NONE';
type WorkspacePlanTier = 'FREE' | 'PRO' | 'DESPACHO' | 'ENTERPRISE';
type PlatformAlertStatus = 'open' | 'acknowledged' | 'resolved';

type AdminOpsAction =
  | 'SET_USER_STATUS'
  | 'SET_USER_ROLE'
  | 'DELETE_COMPANY'
  | 'PUBLISH_BROADCAST'
  | 'CLEAR_BROADCAST'
  | 'UPSERT_WORKSPACE_QUOTA'
  | 'RESOLVE_PLATFORM_ALERT'
  | 'RECORD_AUDIT';

interface AdminOpsRequestBody {
  action?: AdminOpsAction;
  userId?: string;
  status?: 'ACTIVO' | 'SUSPENDIDO' | PlatformAlertStatus;
  platformRole?: PlatformRole;
  reason?: string;
  companyId?: string;
  workspaceId?: string;
  planTier?: WorkspacePlanTier;
  maxCompanies?: number;
  maxCfdisPerMonth?: number;
  maxStorageMb?: number;
  notes?: string | null;
  alertId?: string;
  alertStatus?: PlatformAlertStatus;
  title?: string;
  message?: string;
  type?: 'info' | 'warning' | 'success';
  expiresAt?: string | null;
  auditAction?: string;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

const VALID_ROLES = new Set<PlatformRole>(['SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS', 'NONE']);
const VALID_TIERS = new Set<WorkspacePlanTier>(['FREE', 'PRO', 'DESPACHO', 'ENTERPRISE']);
const VALID_ALERT_STATUSES = new Set<PlatformAlertStatus>(['open', 'acknowledged', 'resolved']);

const ACTION_ALLOWED_ROLES: Record<AdminOpsAction, ReadonlySet<PlatformRole>> = {
  DELETE_COMPANY: new Set<PlatformRole>(['SUPERADMIN']),
  PUBLISH_BROADCAST: new Set<PlatformRole>(['SUPERADMIN']),
  CLEAR_BROADCAST: new Set<PlatformRole>(['SUPERADMIN']),
  SET_USER_ROLE: new Set<PlatformRole>(['SUPERADMIN']),
  SET_USER_STATUS: new Set<PlatformRole>(['SUPERADMIN', 'BILLING_OPS']),
  UPSERT_WORKSPACE_QUOTA: new Set<PlatformRole>(['SUPERADMIN', 'BILLING_OPS']),
  RECORD_AUDIT: new Set<PlatformRole>(['SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS']),
  RESOLVE_PLATFORM_ALERT: new Set<PlatformRole>(['SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS'])
};

function resolvePlatformRole(rawRole?: unknown, isSuperAdminFlag?: unknown, email?: string): PlatformRole {
  if ((email || '').trim().toLowerCase() === 'hlopezb@gmail.com') return 'SUPERADMIN';
  const upper = String(rawRole || '').trim().toUpperCase() as PlatformRole;
  if (upper === 'SUPERADMIN' || upper === 'SUPPORT_READONLY' || upper === 'BILLING_OPS') return upper;
  if (Boolean(isSuperAdminFlag)) return 'SUPERADMIN';
  return 'NONE';
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

    let callerRole: PlatformRole = actorEmail === 'hlopezb@gmail.com' ? 'SUPERADMIN' : 'NONE';
    if (callerRole !== 'SUPERADMIN') {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('platform_role, is_superadmin')
        .eq('id', user.id)
        .maybeSingle();
      callerRole = resolvePlatformRole(profile?.platform_role, profile?.is_superadmin, actorEmail);
    }

    if (callerRole === 'NONE') {
      return jsonResponse({ ok: false, error: 'Acceso denegado: requiere rol administrativo de plataforma' }, 403, headers);
    }

    const body = (await req.json()) as AdminOpsRequestBody;
    const action = body.action;
    if (!action) {
      return jsonResponse({ ok: false, error: 'action es requerido' }, 400, headers);
    }

    const allowedRoles = ACTION_ALLOWED_ROLES[action];
    if (!allowedRoles) {
      return jsonResponse({ ok: false, error: `Acción '${action}' no reconocida` }, 400, headers);
    }
    if (!allowedRoles.has(callerRole)) {
      return jsonResponse(
        { ok: false, error: `Tu rol (${callerRole}) no tiene permiso para ejecutar ${action}` },
        403,
        headers
      );
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
        metadata: { actorRole: callerRole, ...(entry.metadata ?? {}) },
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
        return jsonResponse({ ok: false, error: 'No puedes suspender tu propia cuenta administrativa' }, 400, headers);
      }

      const { data: targetProfile, error: targetLookupErr } = await supabase
        .from('user_profiles')
        .select('id, email, platform_role, is_superadmin')
        .eq('id', targetUserId)
        .maybeSingle();

      if (targetLookupErr) {
        return jsonResponse({ ok: false, error: targetLookupErr.message }, 500, headers);
      }
      if (!targetProfile) {
        return jsonResponse({ ok: false, error: 'Usuario no encontrado' }, 404, headers);
      }

      const targetRole = resolvePlatformRole(
        targetProfile.platform_role,
        targetProfile.is_superadmin,
        targetProfile.email
      );
      if (targetRole === 'SUPERADMIN') {
        return jsonResponse({ ok: false, error: 'No es posible suspender una cuenta SuperAdmin' }, 403, headers);
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

    if (action === 'SET_USER_ROLE') {
      const targetUserId = (body.userId || '').trim();
      const nextRole = body.platformRole;
      if (!targetUserId || !nextRole || !VALID_ROLES.has(nextRole)) {
        return jsonResponse(
          { ok: false, error: 'userId y platformRole (SUPERADMIN|SUPPORT_READONLY|BILLING_OPS|NONE) son requeridos' },
          400,
          headers
        );
      }
      if (targetUserId === user.id && nextRole !== 'SUPERADMIN') {
        return jsonResponse({ ok: false, error: 'No puedes revocar tu propio rol SUPERADMIN' }, 400, headers);
      }

      const { error: roleErr } = await supabase
        .from('user_profiles')
        .update({
          platform_role: nextRole,
          is_superadmin: nextRole === 'SUPERADMIN'
        })
        .eq('id', targetUserId);

      if (roleErr) {
        return jsonResponse({ ok: false, error: roleErr.message }, 500, headers);
      }

      await writeAudit({
        auditAction: 'SET_USER_ROLE',
        targetType: 'user',
        targetId: targetUserId,
        metadata: { platformRole: nextRole }
      });

      return jsonResponse({ ok: true, userId: targetUserId, platformRole: nextRole }, 200, headers);
    }

    if (action === 'DELETE_COMPANY') {
      const companyId = (body.companyId || '').trim();
      if (!companyId) {
        return jsonResponse({ ok: false, error: 'companyId es requerido' }, 400, headers);
      }

      const { data: comp, error: compErr } = await supabase
        .from('companies')
        .select('id, name, rfc')
        .eq('id', companyId)
        .maybeSingle();

      if (compErr) {
        return jsonResponse({ ok: false, error: compErr.message }, 500, headers);
      }
      if (!comp) {
        return jsonResponse({ ok: false, error: 'Empresa no encontrada' }, 404, headers);
      }

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
        metadata: { companyName: comp.name ?? null, companyRfc: comp.rfc ?? null }
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

      const rawExpiresAt = typeof body.expiresAt === 'string' ? body.expiresAt.trim() : '';
      let expiresAtIso: string | null = null;
      if (rawExpiresAt) {
        const parsedMs = Date.parse(rawExpiresAt);
        if (!Number.isFinite(parsedMs) || parsedMs <= Date.now()) {
          return jsonResponse({ ok: false, error: 'La fecha de expiración debe ser futura' }, 400, headers);
        }
        expiresAtIso = new Date(parsedMs).toISOString();
      } else if (body.expiresAt !== undefined && body.expiresAt !== null && typeof body.expiresAt !== 'string') {
        return jsonResponse({ ok: false, error: 'La fecha de expiración debe ser futura' }, 400, headers);
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
          expires_at: expiresAtIso,
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
        metadata: { title, type, expiresAt: expiresAtIso }
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

    if (action === 'UPSERT_WORKSPACE_QUOTA') {
      const workspaceId = (body.workspaceId || '').trim();
      const planTier = body.planTier;
      const maxCompanies = Number(body.maxCompanies);
      const maxCfdisPerMonth = Number(body.maxCfdisPerMonth);
      const maxStorageMb = Number(body.maxStorageMb);

      if (
        !workspaceId ||
        !planTier ||
        !VALID_TIERS.has(planTier) ||
        !Number.isFinite(maxCompanies) ||
        maxCompanies < 1 ||
        !Number.isFinite(maxCfdisPerMonth) ||
        maxCfdisPerMonth < 1 ||
        !Number.isFinite(maxStorageMb) ||
        maxStorageMb < 10
      ) {
        return jsonResponse(
          {
            ok: false,
            error: 'workspaceId, planTier y límites numéricos válidos son requeridos (maxCompanies >= 1, maxCfdisPerMonth >= 1, maxStorageMb >= 10)'
          },
          400,
          headers
        );
      }

      const nowIso = new Date().toISOString();
      const { data: upserted, error: qErr } = await supabase
        .from('workspace_quotas')
        .upsert(
          {
            workspace_id: workspaceId,
            user_id: body.userId ?? null,
            plan_tier: planTier,
            max_companies: Math.trunc(maxCompanies),
            max_cfdis_per_month: Math.trunc(maxCfdisPerMonth),
            max_storage_mb: Math.trunc(maxStorageMb),
            notes: body.notes ?? null,
            updated_at: nowIso,
            updated_by: user.email || user.id
          },
          { onConflict: 'workspace_id' }
        )
        .select('*')
        .single();

      if (qErr || !upserted) {
        return jsonResponse({ ok: false, error: qErr?.message || 'Error al guardar cuota del workspace' }, 500, headers);
      }

      await writeAudit({
        auditAction: 'UPSERT_WORKSPACE_QUOTA',
        targetType: 'workspace',
        targetId: workspaceId,
        metadata: {
          planTier,
          maxCompanies: Math.trunc(maxCompanies),
          maxCfdisPerMonth: Math.trunc(maxCfdisPerMonth),
          maxStorageMb: Math.trunc(maxStorageMb)
        }
      });

      return jsonResponse(
        {
          ok: true,
          quota: {
            workspaceId: upserted.workspace_id,
            userId: upserted.user_id,
            planTier: upserted.plan_tier,
            maxCompanies: upserted.max_companies,
            maxCfdisPerMonth: upserted.max_cfdis_per_month,
            maxStorageMb: upserted.max_storage_mb,
            notes: upserted.notes,
            updatedAt: upserted.updated_at,
            updatedBy: upserted.updated_by
          }
        },
        200,
        headers
      );
    }

    if (action === 'RESOLVE_PLATFORM_ALERT') {
      const alertId = (body.alertId || '').trim();
      const nextAlertStatus = (body.alertStatus || body.status) as PlatformAlertStatus | undefined;
      if (!alertId || !nextAlertStatus || !VALID_ALERT_STATUSES.has(nextAlertStatus)) {
        return jsonResponse(
          { ok: false, error: 'alertId y status (open|acknowledged|resolved) son requeridos' },
          400,
          headers
        );
      }

      const nowIso = new Date().toISOString();
      const { data: updatedAlert, error: alertErr } = await supabase
        .from('platform_alerts')
        .update({
          status: nextAlertStatus,
          resolved_at: nextAlertStatus === 'resolved' ? nowIso : null,
          resolved_by: nextAlertStatus === 'resolved' ? (user.email || user.id) : null
        })
        .eq('id', alertId)
        .select('*')
        .single();

      if (alertErr || !updatedAlert) {
        return jsonResponse({ ok: false, error: alertErr?.message || 'Alerta no encontrada' }, 500, headers);
      }

      await writeAudit({
        auditAction: 'RESOLVE_PLATFORM_ALERT',
        targetType: 'platform_alert',
        targetId: alertId,
        metadata: { status: nextAlertStatus, code: updatedAlert.code }
      });

      return jsonResponse(
        {
          ok: true,
          alert: {
            id: updatedAlert.id,
            code: updatedAlert.code,
            severity: updatedAlert.severity,
            category: updatedAlert.category,
            title: updatedAlert.title,
            message: updatedAlert.message,
            targetType: updatedAlert.target_type,
            targetId: updatedAlert.target_id,
            status: updatedAlert.status,
            metadata: updatedAlert.metadata || {},
            detectedAt: updatedAlert.detected_at,
            resolvedAt: updatedAlert.resolved_at,
            resolvedBy: updatedAlert.resolved_by
          }
        },
        200,
        headers
      );
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
