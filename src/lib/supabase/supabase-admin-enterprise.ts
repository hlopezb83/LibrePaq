import { supabase } from '../supabase';
import type {
  AdminAuditLogEntry, AdminAuditLogsPageQuery, AdminCompaniesPageQuery, AdminCompanySummary,
  AdminPaginatedResponse, AdminPlatformAlert, AdminUsersPageQuery, AdminUserSummary,
  PlatformAlertCategory, PlatformAlertSeverity, PlatformAlertStatus, PlatformRole,
  WorkspacePlanTier, WorkspaceQuota, WorkspaceQuotaPayload
} from '../../shared/admin-types';
import { normalizePlatformRole } from '../../shared/superadmin';
import { supabaseAdminApi } from './supabase-admin';
import { supabaseAdminOpsApi } from './supabase-admin-ops';

type Row = Record<string, unknown>;

const DEFAULT_QUOTA = (workspaceId: string): WorkspaceQuota => ({
  workspaceId, userId: null, planTier: 'FREE', maxCompanies: 3,
  maxCfdisPerMonth: 500, maxStorageMb: 250, notes: null,
  updatedAt: new Date().toISOString(), updatedBy: null
});

function isForbiddenMsg(msg?: string): boolean {
  const upper = String(msg || '').toUpperCase();
  return upper.includes('FORBIDDEN') || upper.includes('UNAUTHORIZED');
}

function paginateSlice<T>(items: T[], page: number, pageSize: number): AdminPaginatedResponse<T> {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(100, Math.max(1, pageSize));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const start = (safePage - 1) * safeSize;
  return { items: items.slice(start, start + safeSize), total, page: safePage, pageSize: safeSize, totalPages };
}

function mapQuotaRow(row: Row): WorkspaceQuota {
  return {
    workspaceId: String(row.workspace_id || ''),
    userId: row.user_id ? String(row.user_id) : null,
    planTier: String(row.plan_tier || 'FREE') as WorkspacePlanTier,
    maxCompanies: Number(row.max_companies ?? 3),
    maxCfdisPerMonth: Number(row.max_cfdis_per_month ?? 500),
    maxStorageMb: Number(row.max_storage_mb ?? 250),
    notes: row.notes ? String(row.notes) : null,
    updatedAt: String(row.updated_at || new Date().toISOString()),
    updatedBy: row.updated_by ? String(row.updated_by) : null
  };
}

function mapAlertRow(row: Row): AdminPlatformAlert {
  return {
    id: String(row.id || ''),
    code: String(row.code || ''),
    severity: String(row.severity || 'info') as PlatformAlertSeverity,
    category: String(row.category || 'system') as PlatformAlertCategory,
    title: String(row.title || ''),
    message: String(row.message || ''),
    targetType: String(row.target_type || 'platform'),
    targetId: row.target_id ? String(row.target_id) : null,
    status: String(row.status || 'open') as PlatformAlertStatus,
    metadata: (row.metadata as Record<string, unknown>) || {},
    detectedAt: String(row.detected_at || new Date().toISOString()),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : null
  };
}

async function callPaginatedRpc<T>(fnName: string, params: Record<string, unknown>): Promise<AdminPaginatedResponse<T> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(fnName, params);
  if (!error && data && typeof data === 'object') return data as AdminPaginatedResponse<T>;
  if (error && isForbiddenMsg(error.message)) throw new Error(error.message);
  return null;
}

async function invokeEdge<T>(fnName: string, body: Record<string, unknown>): Promise<{ data: T | null; unavailable: boolean }> {
  if (!supabase) throw new Error('Supabase no disponible');
  const { data, error } = await supabase.functions.invoke<T & { ok?: boolean; error?: string }>(fnName, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const status = ctx?.status;
    if (!status || status === 404 || status === 502 || status === 503) return { data: null, unavailable: true };
    let msg = error.message || `Error en Edge Function ${fnName}`;
    try {
      const json = (await ctx?.json()) as { error?: string } | undefined;
      if (json?.error) msg = json.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data && typeof data === 'object' && 'error' in data && data.error && !data.ok) throw new Error(String(data.error));
  return { data: (data as T) ?? null, unavailable: false };
}

export const supabaseAdminEnterpriseApi = {
  async getAdminCompaniesPaginated(
    query?: AdminCompaniesPageQuery & { sortBy?: 'createdAt' | 'polizasCount' | 'cfdisCount'; sortDir?: 'asc' | 'desc' }
  ): Promise<AdminPaginatedResponse<AdminCompanySummary>> {
    const page = query?.page ?? 1, pageSize = query?.pageSize ?? 20;
    const search = query?.search ?? '', ownerType = query?.ownerType ?? 'ALL', fielFilter = query?.fielFilter ?? 'ALL';
    const sortBy = query?.sortBy ?? 'createdAt', sortDir = query?.sortDir ?? 'desc';
    if (!supabase) return paginateSlice([], page, pageSize);

    const rpc7 = await callPaginatedRpc<AdminCompanySummary>('admin_list_companies_paginated', {
      p_page: page, p_page_size: pageSize, p_search: search, p_owner_type: ownerType, p_fiel_filter: fielFilter,
      p_sort_by: query?.sortBy ?? 'created_at', p_sort_dir: query?.sortDir ?? 'desc'
    });
    if (rpc7) return rpc7;

    if (sortBy === 'createdAt' && sortDir === 'desc') {
      const rpc5 = await callPaginatedRpc<AdminCompanySummary>('admin_list_companies_paginated', {
        p_page: page, p_page_size: pageSize, p_search: search, p_owner_type: ownerType, p_fiel_filter: fielFilter
      });
      if (rpc5) return rpc5;
    }

    const all = await supabaseAdminApi.getAdminCompanies();
    const q = search.trim().toLowerCase();
    const filtered = all.filter((c) => {
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.rfc.toLowerCase().includes(q)
        || (c.userEmail || '').toLowerCase().includes(q) || (c.userFullName || '').toLowerCase().includes(q);
      const matchesOwner = ownerType === 'ALL' || c.ownerType === ownerType;
      const matchesFiel = fielFilter === 'ALL'
        || (fielFilter === 'WITH_FIEL' && Boolean(c.hasFiel))
        || (fielFilter === 'WITHOUT_FIEL' && !c.hasFiel);
      return matchesSearch && matchesOwner && matchesFiel;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      if (sortBy === 'polizasCount') return ((a.polizasCount ?? 0) - (b.polizasCount ?? 0)) * dir;
      if (sortBy === 'cfdisCount') return ((a.cfdisCount ?? 0) - (b.cfdisCount ?? 0)) * dir;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    });
    return paginateSlice(filtered, page, pageSize);
  },

  async getAdminUsersPaginated(query?: AdminUsersPageQuery): Promise<AdminPaginatedResponse<AdminUserSummary>> {
    const page = query?.page ?? 1, pageSize = query?.pageSize ?? 20;
    const search = query?.search ?? '', status = query?.status ?? 'ALL', role = query?.role ?? 'ALL';
    if (!supabase) return paginateSlice([], page, pageSize);

    const rpc = await callPaginatedRpc<AdminUserSummary>('admin_list_users_paginated', {
      p_page: page, p_page_size: pageSize, p_search: search, p_status: status, p_role: role
    });
    if (rpc) return rpc;

    const all = await supabaseAdminApi.getAdminUsers();
    const q = search.trim().toLowerCase();
    const filtered = all
      .map((u) => ({ ...u, platformRole: normalizePlatformRole(u.platformRole, u.isSuperAdmin, u.email) }))
      .filter((u) => {
        const matchesSearch = !q || u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q)
          || (u.workspaceName || '').toLowerCase().includes(q) || (u.workspaceId || '').toLowerCase().includes(q);
        return matchesSearch && (status === 'ALL' || u.status === status) && (role === 'ALL' || u.platformRole === role);
      });
    return paginateSlice(filtered, page, pageSize);
  },

  async getAdminAuditLogsPaginated(query?: AdminAuditLogsPageQuery): Promise<AdminPaginatedResponse<AdminAuditLogEntry>> {
    const page = query?.page ?? 1, pageSize = query?.pageSize ?? 25;
    const search = query?.search ?? '', action = query?.action ?? '', targetType = query?.targetType ?? '';
    if (!supabase) return paginateSlice([], page, pageSize);

    const rpc = await callPaginatedRpc<AdminAuditLogEntry>('admin_list_audit_logs_paginated', {
      p_page: page, p_page_size: pageSize, p_search: search, p_action: action, p_target_type: targetType
    });
    if (rpc) return rpc;

    const all = await supabaseAdminOpsApi.getAdminAuditLogs(250);
    const q = search.trim().toLowerCase(), actFilter = action.trim().toUpperCase(), tgtFilter = targetType.trim().toLowerCase();
    const filtered = all.filter((entry) => {
      const matchesSearch = !q || entry.actorEmail.toLowerCase().includes(q) || entry.action.toLowerCase().includes(q)
        || entry.targetType.toLowerCase().includes(q) || (entry.targetId || '').toLowerCase().includes(q);
      const matchesAction = !actFilter || actFilter === 'ALL' || entry.action.toUpperCase() === actFilter;
      const matchesTarget = !tgtFilter || tgtFilter === 'all' || entry.targetType.toLowerCase() === tgtFilter;
      return matchesSearch && matchesAction && matchesTarget;
    });
    return paginateSlice(filtered, page, pageSize);
  },

  async setAdminUserRole(userId: string, platformRole: PlatformRole): Promise<{ userId: string; platformRole: PlatformRole }> {
    if (!supabase) throw new Error('Supabase no disponible');
    const res = await invokeEdge<{ userId: string; platformRole: PlatformRole }>('admin-ops', {
      action: 'SET_USER_ROLE', userId, platformRole
    });
    if (!res.unavailable && res.data) return { userId: res.data.userId, platformRole: res.data.platformRole };

    const { error } = await supabase
      .from('user_profiles')
      .update({ platform_role: platformRole, is_superadmin: platformRole === 'SUPERADMIN' })
      .eq('id', userId);
    if (error) throw new Error(error.message);

    await supabaseAdminOpsApi.recordAdminAuditLog({
      action: 'SET_USER_ROLE', targetType: 'user', targetId: userId, metadata: { platformRole }
    });
    return { userId, platformRole };
  },

  async getWorkspaceQuota(workspaceId: string): Promise<WorkspaceQuota> {
    if (!supabase || !workspaceId) return DEFAULT_QUOTA(workspaceId);
    const { data, error } = await supabase.from('workspace_quotas').select('*').eq('workspace_id', workspaceId).maybeSingle();
    if (error || !data) return DEFAULT_QUOTA(workspaceId);
    return mapQuotaRow(data as Row);
  },

  async upsertWorkspaceQuota(workspaceId: string, payload: WorkspaceQuotaPayload): Promise<WorkspaceQuota> {
    if (!supabase) throw new Error('Supabase no disponible');
    const res = await invokeEdge<{ quota: WorkspaceQuota }>('admin-ops', {
      action: 'UPSERT_WORKSPACE_QUOTA', workspaceId, ...payload
    });
    if (!res.unavailable && res.data?.quota) return res.data.quota;

    const { data: authData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('workspace_quotas')
      .upsert({
        workspace_id: workspaceId, user_id: payload.userId ?? null, plan_tier: payload.planTier,
        max_companies: payload.maxCompanies, max_cfdis_per_month: payload.maxCfdisPerMonth,
        max_storage_mb: payload.maxStorageMb, notes: payload.notes ?? null,
        updated_at: new Date().toISOString(), updated_by: authData?.user?.email || authData?.user?.id || null
      }, { onConflict: 'workspace_id' })
      .select('*').single();

    if (error || !data) throw new Error(error?.message || 'Error al guardar cuota de workspace');
    await supabaseAdminOpsApi.recordAdminAuditLog({
      action: 'UPSERT_WORKSPACE_QUOTA', targetType: 'workspace', targetId: workspaceId,
      metadata: { planTier: payload.planTier, maxCompanies: payload.maxCompanies }
    });
    return mapQuotaRow(data as Row);
  },

  async getAdminPlatformAlerts(status: 'ALL' | PlatformAlertStatus = 'ALL'): Promise<AdminPlatformAlert[]> {
    if (!supabase) return [];
    let query = supabase.from('platform_alerts').select('*').order('detected_at', { ascending: false }).limit(100);
    if (status !== 'ALL') query = query.eq('status', status);
    const { data, error } = await query;
    if (error || !data) return [];
    return (data as Row[]).map(mapAlertRow);
  },

  async runAdminHealthScan(): Promise<{ scannedAtIso: string; alertsCreated: number; openAlertsCount: number }> {
    if (!supabase) throw new Error('Supabase no disponible');
    const res = await invokeEdge<{ scannedAtIso: string; alertsCreated: number; openAlertsCount: number }>('admin-health-monitor', {});
    if (!res.unavailable && res.data) {
      return {
        scannedAtIso: String(res.data.scannedAtIso || new Date().toISOString()),
        alertsCreated: Number(res.data.alertsCreated ?? 0),
        openAlertsCount: Number(res.data.openAlertsCount ?? 0)
      };
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_run_health_scan');
    if (!rpcErr && rpcData && typeof rpcData === 'object') {
      const r = rpcData as Row;
      return {
        scannedAtIso: String(r.scannedAtIso || new Date().toISOString()),
        alertsCreated: Number(r.alertsCreated ?? 0),
        openAlertsCount: Number(r.openAlertsCount ?? 0)
      };
    }
    if (rpcErr && isForbiddenMsg(rpcErr.message)) throw new Error(rpcErr.message);
    return { scannedAtIso: new Date().toISOString(), alertsCreated: 0, openAlertsCount: 0 };
  },

  async updateAdminPlatformAlertStatus(alertId: string, status: PlatformAlertStatus): Promise<AdminPlatformAlert> {
    if (!supabase) throw new Error('Supabase no disponible');
    const res = await invokeEdge<{ alert: AdminPlatformAlert }>('admin-ops', {
      action: 'RESOLVE_PLATFORM_ALERT', alertId, status
    });
    if (!res.unavailable && res.data?.alert) return res.data.alert;

    const nowIso = new Date().toISOString();
    const { data: authData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('platform_alerts')
      .update({
        status,
        resolved_at: status === 'resolved' ? nowIso : null,
        resolved_by: status === 'resolved' ? (authData?.user?.email || authData?.user?.id || null) : null
      })
      .eq('id', alertId).select('*').single();

    if (error || !data) throw new Error(error?.message || 'No se pudo actualizar el estado de la alerta');
    await supabaseAdminOpsApi.recordAdminAuditLog({
      action: 'RESOLVE_PLATFORM_ALERT', targetType: 'platform_alert', targetId: alertId, metadata: { status }
    });
    return mapAlertRow(data as Row);
  }
};
