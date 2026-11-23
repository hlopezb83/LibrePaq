import { handleResponse, getAuthHeaders, fetchWithTimeout } from './api-helpers';
import type {
  AdminAuditLogEntry,
  AdminAuditLogsPageQuery,
  AdminBroadcastMessage,
  AdminCompaniesPageQuery,
  AdminCompanyDetail,
  AdminCompanySummary,
  AdminPaginatedResponse,
  AdminPlatformAlert,
  AdminPlatformMetrics,
  AdminSatHealthResponse,
  AdminUsersPageQuery,
  AdminUserStatusPayload,
  AdminUserSummary,
  PlatformAlertStatus,
  PlatformRole,
  WorkspaceQuota,
  WorkspaceQuotaPayload
} from '../../shared/admin-types';

const BROADCAST_STORAGE_KEY = 'librepaq_global_broadcast';

function jsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', ...getAuthHeaders() };
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== '') sp.set(key, String(val));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const adminApi = {
  async getAdminMetrics(): Promise<AdminPlatformMetrics> {
    const res = await fetchWithTimeout('/api/admin/metrics', { headers: getAuthHeaders() });
    return handleResponse<AdminPlatformMetrics>(res);
  },

  async getAdminCompanies(): Promise<AdminCompanySummary[]> {
    const res = await fetchWithTimeout('/api/admin/companies', { headers: getAuthHeaders() });
    return handleResponse<AdminCompanySummary[]>(res);
  },

  async getAdminCompaniesPaginated(
    query?: AdminCompaniesPageQuery
  ): Promise<AdminPaginatedResponse<AdminCompanySummary>> {
    const qs = toQueryString({
      page: query?.page,
      pageSize: query?.pageSize,
      search: query?.search,
      ownerType: query?.ownerType,
      fielFilter: query?.fielFilter
    });
    const res = await fetchWithTimeout(`/api/admin/companies/paginated${qs}`, { headers: getAuthHeaders() });
    return handleResponse<AdminPaginatedResponse<AdminCompanySummary>>(res);
  },

  async getAdminUsers(): Promise<AdminUserSummary[]> {
    const res = await fetchWithTimeout('/api/admin/users', { headers: getAuthHeaders() });
    return handleResponse<AdminUserSummary[]>(res);
  },

  async getAdminUsersPaginated(
    query?: AdminUsersPageQuery
  ): Promise<AdminPaginatedResponse<AdminUserSummary>> {
    const qs = toQueryString({
      page: query?.page,
      pageSize: query?.pageSize,
      search: query?.search,
      status: query?.status,
      role: query?.role
    });
    const res = await fetchWithTimeout(`/api/admin/users/paginated${qs}`, { headers: getAuthHeaders() });
    return handleResponse<AdminPaginatedResponse<AdminUserSummary>>(res);
  },

  async getActiveBroadcast(): Promise<AdminBroadcastMessage | null> {
    try {
      const res = await fetchWithTimeout('/api/admin/broadcast/active', { headers: getAuthHeaders() });
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType && !contentType.includes('application/json')) return null;
      return (await res.json()) as AdminBroadcastMessage | null;
    } catch {
      return null;
    }
  },

  async publishBroadcast(payload: {
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success';
    expiresAt?: string | null;
  }): Promise<AdminBroadcastMessage> {
    const res = await fetchWithTimeout('/api/admin/broadcast', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(payload)
    });
    return handleResponse<AdminBroadcastMessage>(res);
  },

  async clearBroadcast(): Promise<void> {
    const res = await fetchWithTimeout('/api/admin/broadcast', {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    await handleResponse<{ ok?: boolean }>(res);
  },

  async getAdminSatHealth(): Promise<AdminSatHealthResponse> {
    const res = await fetchWithTimeout('/api/admin/sat-health', { headers: getAuthHeaders() });
    return handleResponse<AdminSatHealthResponse>(res);
  },

  async getAdminCompanyDetail(companyId: string): Promise<AdminCompanyDetail> {
    const res = await fetchWithTimeout(`/api/admin/companies/${encodeURIComponent(companyId)}/detail`, {
      headers: getAuthHeaders()
    });
    return handleResponse<AdminCompanyDetail>(res);
  },

  async setAdminUserStatus(
    userId: string,
    payload: AdminUserStatusPayload
  ): Promise<{ userId: string; status: 'ACTIVO' | 'SUSPENDIDO' }> {
    const res = await fetchWithTimeout(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(payload)
    });
    return handleResponse<{ userId: string; status: 'ACTIVO' | 'SUSPENDIDO' }>(res);
  },

  async setAdminUserRole(
    userId: string,
    platformRole: PlatformRole
  ): Promise<{ userId: string; platformRole: PlatformRole }> {
    const res = await fetchWithTimeout(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({ platformRole })
    });
    return handleResponse<{ userId: string; platformRole: PlatformRole }>(res);
  },

  async deleteAdminCompany(companyId: string): Promise<{ deleted: boolean; companyId: string }> {
    const res = await fetchWithTimeout(`/api/admin/companies/${encodeURIComponent(companyId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse<{ deleted: boolean; companyId: string }>(res);
  },

  async getAdminAuditLogs(limit = 50): Promise<AdminAuditLogEntry[]> {
    const res = await fetchWithTimeout(`/api/admin/audit-logs?limit=${encodeURIComponent(String(limit))}`, {
      headers: getAuthHeaders()
    });
    return handleResponse<AdminAuditLogEntry[]>(res);
  },

  async getAdminAuditLogsPaginated(
    query?: AdminAuditLogsPageQuery
  ): Promise<AdminPaginatedResponse<AdminAuditLogEntry>> {
    const qs = toQueryString({
      page: query?.page,
      pageSize: query?.pageSize,
      search: query?.search,
      action: query?.action,
      targetType: query?.targetType
    });
    const res = await fetchWithTimeout(`/api/admin/audit-logs/paginated${qs}`, { headers: getAuthHeaders() });
    return handleResponse<AdminPaginatedResponse<AdminAuditLogEntry>>(res);
  },

  async recordAdminAuditLog(payload: {
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const res = await fetchWithTimeout('/api/admin/audit-logs', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(payload)
    });
    await handleResponse<{ ok?: boolean }>(res);
  },

  async getWorkspaceQuota(workspaceId: string): Promise<WorkspaceQuota> {
    const res = await fetchWithTimeout(`/api/admin/workspaces/${encodeURIComponent(workspaceId)}/quota`, {
      headers: getAuthHeaders()
    });
    return handleResponse<WorkspaceQuota>(res);
  },

  async upsertWorkspaceQuota(workspaceId: string, payload: WorkspaceQuotaPayload): Promise<WorkspaceQuota> {
    const res = await fetchWithTimeout(`/api/admin/workspaces/${encodeURIComponent(workspaceId)}/quota`, {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify(payload)
    });
    return handleResponse<WorkspaceQuota>(res);
  },

  async getAdminPlatformAlerts(status: 'ALL' | PlatformAlertStatus = 'ALL'): Promise<AdminPlatformAlert[]> {
    const res = await fetchWithTimeout(`/api/admin/alerts?status=${encodeURIComponent(status)}`, {
      headers: getAuthHeaders()
    });
    return handleResponse<AdminPlatformAlert[]>(res);
  },

  async runAdminHealthScan(): Promise<{ scannedAtIso: string; alertsCreated: number; openAlertsCount: number }> {
    const res = await fetchWithTimeout('/api/admin/health-scan', {
      method: 'POST',
      headers: jsonHeaders()
    });
    return handleResponse<{ scannedAtIso: string; alertsCreated: number; openAlertsCount: number }>(res);
  },

  async updateAdminPlatformAlertStatus(
    alertId: string,
    status: PlatformAlertStatus
  ): Promise<AdminPlatformAlert> {
    const res = await fetchWithTimeout(`/api/admin/alerts/${encodeURIComponent(alertId)}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({ status })
    });
    return handleResponse<AdminPlatformAlert>(res);
  },

  getBroadcastMessage(): AdminBroadcastMessage | null {
    try {
      const stored = localStorage.getItem(BROADCAST_STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as AdminBroadcastMessage;
      return parsed.active ? parsed : null;
    } catch {
      return null;
    }
  },

  setBroadcastMessage(msg: AdminBroadcastMessage | null): void {
    try {
      if (!msg) {
        localStorage.removeItem(BROADCAST_STORAGE_KEY);
      } else {
        localStorage.setItem(BROADCAST_STORAGE_KEY, JSON.stringify(msg));
      }
      window.dispatchEvent(new Event('storage'));
    } catch {
      // ignore
    }
  },

  async updateUserProfileWorkspace(_payload: {
    userId: string;
    workspaceId: string;
    workspaceName: string;
    acquisitionSource?: string;
    gclid?: string | null;
    utmCampaign?: string | null;
    utmTerm?: string | null;
  }): Promise<void> {
    // Local offline stub
  }
};
