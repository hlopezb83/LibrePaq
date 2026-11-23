import { handleResponse, getAuthHeaders, fetchWithTimeout } from './api-helpers';
import type {
  AdminAuditLogEntry,
  AdminBroadcastMessage,
  AdminCompanyDetail,
  AdminCompanySummary,
  AdminPlatformMetrics,
  AdminSatHealthResponse,
  AdminUserStatusPayload,
  AdminUserSummary
} from '../../shared/admin-types';

const BROADCAST_STORAGE_KEY = 'librepaq_global_broadcast';

function jsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', ...getAuthHeaders() };
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

  async getAdminUsers(): Promise<AdminUserSummary[]> {
    const res = await fetchWithTimeout('/api/admin/users', { headers: getAuthHeaders() });
    return handleResponse<AdminUserSummary[]>(res);
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
