import { handleResponse, getAuthHeaders, fetchWithTimeout } from './api-helpers';
import type {
  AdminPlatformMetrics,
  AdminCompanySummary,
  AdminUserSummary,
  AdminBroadcastMessage
} from '../../shared/admin-types';

const BROADCAST_STORAGE_KEY = 'librepaq_global_broadcast';

export const adminApi = {
  async getAdminMetrics(): Promise<AdminPlatformMetrics> {
    const res = await fetchWithTimeout('/api/admin/metrics', {
      headers: getAuthHeaders()
    });
    return handleResponse<AdminPlatformMetrics>(res);
  },

  async getAdminCompanies(): Promise<AdminCompanySummary[]> {
    const res = await fetchWithTimeout('/api/admin/companies', {
      headers: getAuthHeaders()
    });
    return handleResponse<AdminCompanySummary[]>(res);
  },

  async getAdminUsers(): Promise<AdminUserSummary[]> {
    const res = await fetchWithTimeout('/api/admin/users', {
      headers: getAuthHeaders()
    });
    return handleResponse<AdminUserSummary[]>(res);
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
      // Notificar a otras pestañas si están abiertas
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
