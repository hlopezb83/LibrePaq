import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { isSuperAdminEmail, jsonResponse, resolvePlatformRole } from '../_shared/admin-edge-auth.ts';
import {
  type AdminActorContext,
  type AdminOpsAction,
  type AdminOpsRequestBody,
  type PlatformAlertStatus,
  VALID_ALERT_STATUSES,
  VALID_ROLES,
  VALID_TIERS,
  mapAlertRow,
  mapBroadcastRow,
  mapQuotaRow
} from './mappers.ts';

async function writeAudit(
  supabase: SupabaseClient,
  ctx: AdminActorContext,
  entry: { auditAction: string; targetType: string; targetId?: string | null; metadata?: Record<string, unknown> }
): Promise<void> {
  await supabase.from('admin_audit_logs').insert({
    id: `audit_${crypto.randomUUID().slice(0, 12)}`,
    actor_user_id: ctx.userId,
    actor_email: ctx.email,
    action: entry.auditAction,
    target_type: entry.targetType,
    target_id: entry.targetId ?? null,
    metadata: { actorRole: ctx.role, ...(entry.metadata ?? {}) },
    created_at: new Date().toISOString()
  });
}

async function handleSetUserStatus(
  supabase: SupabaseClient,
  ctx: AdminActorContext,
  body: AdminOpsRequestBody,
  headers: Record<string, string>
): Promise<Response> {
  const targetUserId = (body.userId || '').trim();
  const nextStatus = body.status;
  if (!targetUserId || (nextStatus !== 'ACTIVO' && nextStatus !== 'SUSPENDIDO')) {
    return jsonResponse({ ok: false, error: 'userId y status (ACTIVO | SUSPENDIDO) son requeridos' }, 400, headers);
  }
  if (targetUserId === ctx.userId) {
    return jsonResponse({ ok: false, error: 'No puedes cambiar el estado de tu propia cuenta administrativa' }, 400, headers);
  }

  const { data: targetProfile, error: targetLookupErr } = await supabase
    .from('user_profiles')
    .select('id, email, platform_role, is_superadmin')
    .eq('id', targetUserId)
    .maybeSingle();

  if (targetLookupErr) return jsonResponse({ ok: false, error: targetLookupErr.message }, 500, headers);
  if (!targetProfile) return jsonResponse({ ok: false, error: 'Usuario no encontrado' }, 404, headers);

  const targetRole = resolvePlatformRole(targetProfile.platform_role, targetProfile.is_superadmin, targetProfile.email);
  if (targetRole === 'SUPERADMIN') {
    return jsonResponse({ ok: false, error: 'No es posible suspender una cuenta SuperAdmin' }, 403, headers);
  }

  const { error: updErr } = await supabase.from('user_profiles').update({ status: nextStatus }).eq('id', targetUserId);
  if (updErr) return jsonResponse({ ok: false, error: updErr.message }, 500, headers);

  await writeAudit(supabase, ctx, {
    auditAction: 'SET_USER_STATUS',
    targetType: 'user',
    targetId: targetUserId,
    metadata: { status: nextStatus, reason: body.reason ?? null }
  });
  return jsonResponse({ ok: true, userId: targetUserId, status: nextStatus }, 200, headers);
}

async function handleSetUserRole(
  supabase: SupabaseClient,
  ctx: AdminActorContext,
  body: AdminOpsRequestBody,
  headers: Record<string, string>
): Promise<Response> {
  const targetUserId = (body.userId || '').trim();
  const nextRole = body.platformRole;
  if (!targetUserId || !nextRole || !VALID_ROLES.has(nextRole)) {
    return jsonResponse(
      { ok: false, error: 'userId y platformRole (SUPERADMIN|SUPPORT_READONLY|BILLING_OPS|NONE) son requeridos' },
      400,
      headers
    );
  }
  if (targetUserId === ctx.userId && nextRole !== 'SUPERADMIN') {
    return jsonResponse({ ok: false, error: 'No puedes revocar tu propio rol SUPERADMIN' }, 400, headers);
  }

  const { data: targetProfile, error: targetLookupErr } = await supabase
    .from('user_profiles')
    .select('id, email')
    .eq('id', targetUserId)
    .maybeSingle();

  if (targetLookupErr) return jsonResponse({ ok: false, error: targetLookupErr.message }, 500, headers);
  if (!targetProfile) return jsonResponse({ ok: false, error: 'Usuario no encontrado' }, 404, headers);
  if (isSuperAdminEmail(String(targetProfile.email || '')) && nextRole !== 'SUPERADMIN') {
    return jsonResponse({ ok: false, error: 'No es posible revocar el rol SUPERADMIN de la cuenta raíz' }, 403, headers);
  }

  const { error: roleErr } = await supabase
    .from('user_profiles')
    .update({ platform_role: nextRole, is_superadmin: nextRole === 'SUPERADMIN' })
    .eq('id', targetUserId);
  if (roleErr) return jsonResponse({ ok: false, error: roleErr.message }, 500, headers);

  await writeAudit(supabase, ctx, {
    auditAction: 'SET_USER_ROLE',
    targetType: 'user',
    targetId: targetUserId,
    metadata: { platformRole: nextRole }
  });
  return jsonResponse({ ok: true, userId: targetUserId, platformRole: nextRole }, 200, headers);
}

async function handleDeleteCompany(
  supabase: SupabaseClient,
  ctx: AdminActorContext,
  body: AdminOpsRequestBody,
  headers: Record<string, string>
): Promise<Response> {
  const companyId = (body.companyId || '').trim();
  if (!companyId) return jsonResponse({ ok: false, error: 'companyId es requerido' }, 400, headers);

  const { data: comp, error: compErr } = await supabase
    .from('companies')
    .select('id, name, rfc')
    .eq('id', companyId)
    .maybeSingle();

  if (compErr) return jsonResponse({ ok: false, error: compErr.message }, 500, headers);
  if (!comp) return jsonResponse({ ok: false, error: 'Empresa no encontrada' }, 404, headers);

  const { data: deleted, error: rpcErr } = await supabase.rpc('delete_company_cascade', { company_id_param: companyId });
  if (rpcErr) return jsonResponse({ ok: false, error: rpcErr.message }, 500, headers);

  await writeAudit(supabase, ctx, {
    auditAction: 'DELETE_COMPANY',
    targetType: 'company',
    targetId: companyId,
    metadata: { companyName: comp.name ?? null, companyRfc: comp.rfc ?? null }
  });
  return jsonResponse({ ok: true, deleted: Boolean(deleted ?? true), companyId }, 200, headers);
}

async function handlePublishBroadcast(
  supabase: SupabaseClient,
  ctx: AdminActorContext,
  body: AdminOpsRequestBody,
  headers: Record<string, string>
): Promise<Response> {
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
  await supabase.from('platform_broadcasts').update({ active: false, updated_at: nowIso }).eq('active', true);

  const { data: inserted, error: insErr } = await supabase
    .from('platform_broadcasts')
    .insert({
      id: `bcast_${crypto.randomUUID().slice(0, 12)}`,
      title,
      message,
      type,
      active: true,
      starts_at: nowIso,
      expires_at: expiresAtIso,
      created_by: ctx.email,
      created_at: nowIso,
      updated_at: nowIso
    })
    .select('*')
    .single();

  if (insErr || !inserted) {
    return jsonResponse({ ok: false, error: insErr?.message || 'No se pudo publicar el comunicado' }, 500, headers);
  }

  await writeAudit(supabase, ctx, {
    auditAction: 'PUBLISH_BROADCAST',
    targetType: 'broadcast',
    targetId: inserted.id,
    metadata: { title, type, expiresAt: expiresAtIso }
  });
  return jsonResponse({ ok: true, broadcast: mapBroadcastRow(inserted) }, 200, headers);
}

async function handleClearBroadcast(
  supabase: SupabaseClient,
  ctx: AdminActorContext,
  headers: Record<string, string>
): Promise<Response> {
  const { error: clrErr } = await supabase
    .from('platform_broadcasts')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('active', true);
  if (clrErr) return jsonResponse({ ok: false, error: clrErr.message }, 500, headers);

  await writeAudit(supabase, ctx, { auditAction: 'CLEAR_BROADCAST', targetType: 'broadcast', targetId: null, metadata: {} });
  return jsonResponse({ ok: true }, 200, headers);
}

async function handleUpsertWorkspaceQuota(
  supabase: SupabaseClient,
  ctx: AdminActorContext,
  body: AdminOpsRequestBody,
  headers: Record<string, string>
): Promise<Response> {
  const workspaceId = (body.workspaceId || '').trim();
  const planTier = body.planTier;
  const maxCompanies = Number(body.maxCompanies);
  const maxCfdisPerMonth = Number(body.maxCfdisPerMonth);
  const maxStorageMb = Number(body.maxStorageMb);

  if (
    !workspaceId || !planTier || !VALID_TIERS.has(planTier) ||
    !Number.isFinite(maxCompanies) || maxCompanies < 1 || maxCompanies > 10_000 ||
    !Number.isFinite(maxCfdisPerMonth) || maxCfdisPerMonth < 1 || maxCfdisPerMonth > 10_000_000 ||
    !Number.isFinite(maxStorageMb) || maxStorageMb < 10 || maxStorageMb > 10_000_000
  ) {
    return jsonResponse(
      {
        ok: false,
        error: 'workspaceId, planTier y límites numéricos válidos son requeridos (maxCompanies: 1..10000, maxCfdisPerMonth: 1..10000000, maxStorageMb: 10..10000000)'
      },
      400,
      headers
    );
  }

  let resolvedUserId: string | null = body.userId ?? null;
  if (body.userId === undefined) {
    const { data: existingQuota } = await supabase
      .from('workspace_quotas')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    resolvedUserId = existingQuota?.user_id ?? null;
  }

  const { data: upserted, error: qErr } = await supabase
    .from('workspace_quotas')
    .upsert(
      {
        workspace_id: workspaceId,
        user_id: resolvedUserId,
        plan_tier: planTier,
        max_companies: Math.trunc(maxCompanies),
        max_cfdis_per_month: Math.trunc(maxCfdisPerMonth),
        max_storage_mb: Math.trunc(maxStorageMb),
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
        updated_by: ctx.email
      },
      { onConflict: 'workspace_id' }
    )
    .select('*')
    .single();

  if (qErr || !upserted) {
    return jsonResponse({ ok: false, error: qErr?.message || 'Error al guardar cuota del workspace' }, 500, headers);
  }

  await writeAudit(supabase, ctx, {
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
  return jsonResponse({ ok: true, quota: mapQuotaRow(upserted) }, 200, headers);
}

async function handleResolvePlatformAlert(
  supabase: SupabaseClient,
  ctx: AdminActorContext,
  body: AdminOpsRequestBody,
  headers: Record<string, string>
): Promise<Response> {
  const alertId = (body.alertId || '').trim();
  const nextAlertStatus = (body.alertStatus || body.status) as PlatformAlertStatus | undefined;
  if (!alertId || !nextAlertStatus || !VALID_ALERT_STATUSES.has(nextAlertStatus)) {
    return jsonResponse({ ok: false, error: 'alertId y status (open|acknowledged|resolved) son requeridos' }, 400, headers);
  }

  const nowIso = new Date().toISOString();
  const { data: updatedAlert, error: alertErr } = await supabase
    .from('platform_alerts')
    .update({
      status: nextAlertStatus,
      resolved_at: nextAlertStatus === 'resolved' ? nowIso : null,
      resolved_by: nextAlertStatus === 'resolved' ? ctx.email : null
    })
    .eq('id', alertId)
    .select('*')
    .maybeSingle();

  if (alertErr) return jsonResponse({ ok: false, error: alertErr.message }, 500, headers);
  if (!updatedAlert) return jsonResponse({ ok: false, error: 'Alerta no encontrada' }, 404, headers);

  await writeAudit(supabase, ctx, {
    auditAction: 'RESOLVE_PLATFORM_ALERT',
    targetType: 'platform_alert',
    targetId: alertId,
    metadata: { status: nextAlertStatus, code: updatedAlert.code }
  });
  return jsonResponse({ ok: true, alert: mapAlertRow(updatedAlert) }, 200, headers);
}

async function handleRecordAudit(
  supabase: SupabaseClient,
  ctx: AdminActorContext,
  body: AdminOpsRequestBody,
  headers: Record<string, string>
): Promise<Response> {
  const auditAction = (body.auditAction || '').trim();
  const targetType = (body.targetType || '').trim() || 'platform';
  if (!auditAction) return jsonResponse({ ok: false, error: 'auditAction es requerido' }, 400, headers);

  await writeAudit(supabase, ctx, {
    auditAction,
    targetType,
    targetId: body.targetId ?? null,
    metadata: body.metadata ?? {}
  });
  return jsonResponse({ ok: true }, 200, headers);
}

/** Despacha una acción administrativa validada al manejador correspondiente. */
export async function dispatchAdminOpsAction(
  action: AdminOpsAction,
  supabase: SupabaseClient,
  ctx: AdminActorContext,
  body: AdminOpsRequestBody,
  headers: Record<string, string>
): Promise<Response> {
  switch (action) {
    case 'SET_USER_STATUS': return handleSetUserStatus(supabase, ctx, body, headers);
    case 'SET_USER_ROLE': return handleSetUserRole(supabase, ctx, body, headers);
    case 'DELETE_COMPANY': return handleDeleteCompany(supabase, ctx, body, headers);
    case 'PUBLISH_BROADCAST': return handlePublishBroadcast(supabase, ctx, body, headers);
    case 'CLEAR_BROADCAST': return handleClearBroadcast(supabase, ctx, headers);
    case 'UPSERT_WORKSPACE_QUOTA': return handleUpsertWorkspaceQuota(supabase, ctx, body, headers);
    case 'RESOLVE_PLATFORM_ALERT': return handleResolvePlatformAlert(supabase, ctx, body, headers);
    case 'RECORD_AUDIT': return handleRecordAudit(supabase, ctx, body, headers);
    default: return jsonResponse({ ok: false, error: `Acción '${action}' no reconocida` }, 400, headers);
  }
}
