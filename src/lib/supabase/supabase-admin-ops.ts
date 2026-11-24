import { isGuestDemoMode } from '../sandbox/guest-demo-mode';
import { supabase } from '../supabase';
import type {
  AdminAuditLogEntry, AdminBroadcastMessage, AdminCompanyDetail, AdminSatHealthResponse, AdminUserStatusPayload
} from '../../shared/admin-types';
import { isDemoCompanyRecord, isSatErrorCode } from '../../shared/admin-constants';
import { normalizePlatformRole } from '../../shared/superadmin';
import { invokeAdminEdge } from './supabase-edge-helper';

type Row = Record<string, unknown>;

const mapBroadcastRow = (row: Row): AdminBroadcastMessage => ({
  id: String(row.id), title: String(row.title || ''), message: String(row.message || ''),
  type: (row.type as AdminBroadcastMessage['type']) || 'info', active: Boolean(row.active),
  startsAt: row.starts_at ? String(row.starts_at) : null, expiresAt: row.expires_at ? String(row.expires_at) : null,
  createdBy: row.created_by ? String(row.created_by) : null,
  createdAt: String(row.created_at || new Date().toISOString()), updatedAt: String(row.updated_at || new Date().toISOString())
});

async function insertAuditFallback(payload: {
  action: string; targetType: string; targetId?: string | null; metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!supabase) return;
  try {
    const { data: authData } = await supabase.auth.getUser();
    await supabase.from('admin_audit_logs').insert({
      id: `audit_${crypto.randomUUID().slice(0, 12)}`, actor_user_id: authData?.user?.id ?? null,
      actor_email: authData?.user?.email || 'superadmin', action: payload.action,
      target_type: payload.targetType, target_id: payload.targetId ?? null,
      metadata: payload.metadata ?? {}, created_at: new Date().toISOString()
    });
  } catch { /* best-effort */ }
}

async function buildSatHealthFallback(): Promise<AdminSatHealthResponse> {
  if (!supabase) throw new Error('Supabase no disponible');
  const since7dIso = new Date(Date.now() - 7 * 86400000).toISOString();
  const [req7dRes, recentRes, compRes, fielRes] = await Promise.all([
    supabase.from('sat_download_requests').select('*').gte('created_at', since7dIso),
    supabase.from('sat_download_requests').select('*').order('created_at', { ascending: false }).limit(25),
    supabase.from('companies').select('id, name, rfc'),
    supabase.from('fiel_credentials').select('company_id, rfc_titular, numero_serie, valid_to')
  ]);
  if (req7dRes.error) throw new Error(req7dRes.error.message);

  const compMap = new Map<string, { name: string; rfc: string }>();
  for (const c of (compRes.data || []) as Row[]) compMap.set(String(c.id), { name: String(c.name || ''), rfc: String(c.rfc || '') });

  let completed = 0, pending = 0, failed = 0;
  const errCounts = new Map<string, number>();
  const reqs7d = (req7dRes.data || []) as Row[];
  for (const r of reqs7d) {
    const st = String(r.estado_solicitud || '').toUpperCase();
    const code = String(r.codigo_estado_sat || '').trim() || 'UNKNOWN';
    if (st === 'TERMINADA' || st === 'COMPLETADA') completed += 1;
    else if (st === 'ACEPTADA' || st === 'EN_PROCESO' || st === 'SOLICITADA') pending += 1;
    else failed += 1;
    if (isSatErrorCode(r.estado_solicitud, r.codigo_estado_sat)) errCounts.set(code, (errCounts.get(code) || 0) + 1);
  }

  const expiringFiels = ((fielRes.data || []) as Row[])
    .filter((f) => Boolean(f.valid_to))
    .map((f) => {
      const cid = String(f.company_id), validTo = String(f.valid_to);
      return {
        companyId: cid, companyName: compMap.get(cid)?.name || 'Empresa', companyRfc: compMap.get(cid)?.rfc || '',
        rfcTitular: String(f.rfc_titular || ''), numeroSerie: String(f.numero_serie || ''), validTo,
        daysRemaining: Math.ceil((new Date(validTo).getTime() - Date.now()) / 86400000)
      };
    })
    .filter((f) => Number.isFinite(f.daysRemaining) && f.daysRemaining <= 90)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    totalRequests7d: reqs7d.length, completedRequests7d: completed, pendingRequests7d: pending, failedRequests7d: failed,
    errorCodeBreakdown: Array.from(errCounts.entries()).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
    recentRequests: ((recentRes.data || []) as Row[]).map((r) => ({
      id: String(r.id), companyId: String(r.company_id),
      companyName: compMap.get(String(r.company_id))?.name || 'Empresa', companyRfc: compMap.get(String(r.company_id))?.rfc || '',
      tipoSolicitud: String(r.tipo_solicitud || ''), estadoSolicitud: String(r.estado_solicitud || ''),
      codigoEstadoSat: String(r.codigo_estado_sat || ''), mensajeSat: String(r.mensaje_sat || ''),
      cfdisDescargados: Number(r.cfdis_descargados || 0), createdAt: String(r.created_at || '')
    })),
    expiringFiels, checkedAtIso: new Date().toISOString()
  };
}

async function buildCompanyDetailFallback(companyId: string): Promise<AdminCompanyDetail> {
  if (!supabase) throw new Error('Supabase no disponible');
  const { data: comp, error } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle();
  if (error || !comp) throw new Error(error?.message || 'Empresa no encontrada');

  const c = comp as Row;
  const uid = c.user_id ? String(c.user_id) : undefined;
  const [profRes, accRes, polRes, cfdiRes, bankRes, fielRes, lockRes, lastPolRes, lastCfdiRes] = await Promise.all([
    uid && uid !== 'demo' ? supabase.from('user_profiles').select('email, full_name, provider, is_superadmin, platform_role, workspace_id').eq('id', uid).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('polizas').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('cfdi_documents').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('bank_statement_lines').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('fiel_credentials').select('company_id, valid_to, numero_serie').eq('company_id', companyId).maybeSingle(),
    supabase.from('period_locks').select('is_locked').eq('company_id', companyId).eq('ejercicio', Number(c.current_year || 2026)).eq('periodo', Number(c.current_period || 10)).maybeSingle(),
    supabase.from('polizas').select('created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1),
    supabase.from('cfdi_documents').select('fecha').eq('company_id', companyId).order('fecha', { ascending: false }).limit(1)
  ]);

  const prof = (profRes.data as Row | null) || null, fiel = (fielRes.data as Row | null) || null;
  const isSuper = normalizePlatformRole(
    prof?.platform_role ? String(prof.platform_role) : null, Boolean(prof?.is_superadmin), prof?.email ? String(prof.email) : undefined
  ) === 'SUPERADMIN';
  const isDemo = isDemoCompanyRecord({ rfc: c.rfc, name: c.name, user_id: uid });
  const lastPolizaAt = (lastPolRes.data?.[0] as Row | undefined)?.created_at ? String((lastPolRes.data?.[0] as Row).created_at) : null;
  const lastCfdiDate = (lastCfdiRes.data?.[0] as Row | undefined)?.fecha ? String((lastCfdiRes.data?.[0] as Row).fecha) : null;

  return {
    company: {
      id: String(c.id), name: String(c.name || ''), rfc: String(c.rfc || ''),
      regimenFiscal: String(c.regimen_fiscal || ''), codigoPostal: String(c.codigo_postal || ''),
      currentYear: Number(c.current_year || 2026), currentPeriod: Number(c.current_period || 10),
      userId: uid, userEmail: prof?.email ? String(prof.email) : undefined, userFullName: prof?.full_name ? String(prof.full_name) : undefined,
      userProvider: (prof?.provider as 'google' | 'email') || 'email',
      userWorkspaceId: prof?.workspace_id ? String(prof.workspace_id) : null, userIsSuperAdmin: isSuper,
      ownerType: isDemo ? 'demo' : isSuper ? 'superadmin' : 'user', createdAt: String(c.created_at || ''),
      polizasCount: polRes.count ?? 0, cfdisCount: cfdiRes.count ?? 0, hasFiel: Boolean(fiel),
      fielValidTo: fiel?.valid_to ? String(fiel.valid_to) : null, lastActivityAt: lastPolizaAt || lastCfdiDate
    },
    accountsCount: accRes.count ?? 0, polizasCount: polRes.count ?? 0, cfdisCount: cfdiRes.count ?? 0, bankLinesCount: bankRes.count ?? 0,
    hasFiel: Boolean(fiel), fielValidTo: fiel?.valid_to ? String(fiel.valid_to) : null, fielNumeroSerie: fiel?.numero_serie ? String(fiel.numero_serie) : null,
    isCurrentPeriodLocked: Boolean((lockRes.data as Row | null)?.is_locked), lastPolizaAt, lastCfdiDate
  };
}

export const supabaseAdminOpsApi = {
  async getActiveBroadcast(): Promise<AdminBroadcastMessage | null> {
    if (!supabase || isGuestDemoMode()) return null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) return null;
      const { data, error } = await supabase.from('platform_broadcasts').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1);
      if (error || !data || data.length === 0) return null;
      const row = data[0] as Row;
      if (row.starts_at && new Date(String(row.starts_at)).getTime() > Date.now()) return null;
      return row.expires_at && new Date(String(row.expires_at)).getTime() <= Date.now() ? null : mapBroadcastRow(row);
    } catch { return null; }
  },

  async publishBroadcast(payload: { title: string; message: string; type: 'info' | 'warning' | 'success'; expiresAt?: string | null }): Promise<AdminBroadcastMessage> {
    if (!supabase) throw new Error('Supabase no disponible');
    const res = await invokeAdminEdge<{ broadcast: AdminBroadcastMessage }>('admin-ops', { action: 'PUBLISH_BROADCAST', ...payload });
    if (!res.unavailable && res.data?.broadcast) return res.data.broadcast;

    const nowIso = new Date().toISOString();
    const { data: authData } = await supabase.auth.getUser();
    await supabase.from('platform_broadcasts').update({ active: false, updated_at: nowIso }).eq('active', true);
    const { data: inserted, error } = await supabase.from('platform_broadcasts').insert({
      id: `bcast_${crypto.randomUUID().slice(0, 12)}`, title: payload.title.trim(), message: payload.message.trim(),
      type: payload.type, active: true, starts_at: nowIso, expires_at: payload.expiresAt ?? null,
      created_by: authData?.user?.email || authData?.user?.id || null, created_at: nowIso, updated_at: nowIso
    }).select('*').single();
    if (error || !inserted) throw new Error(error?.message || 'Error al publicar comunicado');
    await insertAuditFallback({ action: 'PUBLISH_BROADCAST', targetType: 'broadcast', targetId: String((inserted as Row).id), metadata: { title: payload.title, type: payload.type } });
    return mapBroadcastRow(inserted as Row);
  },

  async clearBroadcast(): Promise<void> {
    if (!supabase) throw new Error('Supabase no disponible');
    const res = await invokeAdminEdge('admin-ops', { action: 'CLEAR_BROADCAST' });
    if (!res.unavailable) return;
    const { error } = await supabase.from('platform_broadcasts').update({ active: false, updated_at: new Date().toISOString() }).eq('active', true);
    if (error) throw new Error(error.message);
    await insertAuditFallback({ action: 'CLEAR_BROADCAST', targetType: 'broadcast' });
  },

  async getAdminSatHealth(): Promise<AdminSatHealthResponse> {
    if (!supabase) throw new Error('Supabase no disponible');
    const { data, error } = await supabase.rpc('admin_get_sat_health');
    if (!error && data) return data as AdminSatHealthResponse;
    return buildSatHealthFallback();
  },

  async getAdminCompanyDetail(companyId: string): Promise<AdminCompanyDetail> {
    if (!supabase) throw new Error('Supabase no disponible');
    const { data, error } = await supabase.rpc('admin_get_company_detail', { p_company_id: companyId });
    if (!error) {
      if (!data) throw new Error('Empresa no encontrada');
      return data as AdminCompanyDetail;
    }
    return buildCompanyDetailFallback(companyId);
  },

  async setAdminUserStatus(userId: string, payload: AdminUserStatusPayload): Promise<{ userId: string; status: 'ACTIVO' | 'SUSPENDIDO' }> {
    if (!supabase) throw new Error('Supabase no disponible');
    const res = await invokeAdminEdge<{ userId: string; status: 'ACTIVO' | 'SUSPENDIDO' }>('admin-ops', { action: 'SET_USER_STATUS', userId, status: payload.status, reason: payload.reason });
    if (!res.unavailable && res.data) return { userId: res.data.userId, status: res.data.status };

    if (payload.status === 'SUSPENDIDO') {
      const { data: targetProf } = await supabase.from('user_profiles').select('email, is_superadmin, platform_role').eq('id', userId).maybeSingle();
      const targetRole = normalizePlatformRole(targetProf?.platform_role ? String(targetProf.platform_role) : null, Boolean(targetProf?.is_superadmin), targetProf?.email ? String(targetProf.email) : userId);
      if (targetRole === 'SUPERADMIN') throw new Error('No es posible suspender una cuenta SuperAdmin');
    }

    const { data, error } = await supabase.from('user_profiles').update({ status: payload.status }).eq('id', userId).select('id');
    if (error) {
      const msgLower = error.message.toLowerCase();
      if (msgLower.includes('row-level security') || msgLower.includes('permission denied') || error.code === '42501') {
        throw new Error('No tienes permisos RLS para cambiar el estatus directamente. Habilita la Edge Function admin-ops para operadores BILLING_OPS.');
      }
      throw new Error(error.message);
    }
    if (!data || data.length === 0) throw new Error('No fue posible actualizar el estatus del usuario (usuario no encontrado o bloqueado por RLS; requiere Edge Function admin-ops).');
    await insertAuditFallback({ action: 'SET_USER_STATUS', targetType: 'user', targetId: userId, metadata: { status: payload.status, reason: payload.reason ?? null } });
    return { userId, status: payload.status };
  },

  async deleteAdminCompany(companyId: string): Promise<{ deleted: boolean; companyId: string }> {
    if (!supabase) throw new Error('Supabase no disponible');
    const res = await invokeAdminEdge<{ deleted: boolean; companyId: string }>('admin-ops', { action: 'DELETE_COMPANY', companyId });
    if (!res.unavailable && res.data) return { deleted: Boolean(res.data.deleted), companyId: res.data.companyId };
    const { error } = await supabase.rpc('delete_company_cascade', { company_id_param: companyId });
    if (error) throw new Error(error.message);
    await insertAuditFallback({ action: 'DELETE_COMPANY', targetType: 'company', targetId: companyId });
    return { deleted: true, companyId };
  },

  async getAdminAuditLogs(limit = 50): Promise<AdminAuditLogEntry[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error || !data) {
      if (error) console.warn('Error al consultar admin_audit_logs:', error.message);
      return [];
    }
    return (data as Row[]).map((r) => ({
      id: String(r.id), actorUserId: r.actor_user_id ? String(r.actor_user_id) : null, actorEmail: String(r.actor_email || ''),
      action: String(r.action || ''), targetType: String(r.target_type || ''), targetId: r.target_id ? String(r.target_id) : null,
      metadata: (r.metadata as Record<string, unknown>) || {}, createdAt: String(r.created_at || '')
    }));
  },

  async recordAdminAuditLog(payload: { action: string; targetType: string; targetId?: string; metadata?: Record<string, unknown> }): Promise<void> {
    if (!supabase) return;
    try {
      const res = await invokeAdminEdge('admin-ops', { action: 'RECORD_AUDIT', auditAction: payload.action, targetType: payload.targetType, targetId: payload.targetId ?? null, metadata: payload.metadata ?? {} });
      if (!res.unavailable) return;
    } catch { /* fallback */ }
    await insertAuditFallback(payload);
  }
};
