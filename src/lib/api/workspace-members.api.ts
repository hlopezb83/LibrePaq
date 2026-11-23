import type {
  AssignCompanyAccessPayload,
  CompanyAuditLogRecord,
  CompanyMemberAccessRecord,
  DespachoRole,
  EffectiveCompanyRoleResult,
  InviteMemberPayload,
  RecordCompanyAuditPayload,
  WorkspaceMemberRecord
} from '../../shared/types/despacho-rbac.types';
import { fetchWithTimeout, getAuthHeaders, handleResponse } from './api-helpers';

const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

export const workspaceMembersApi = {
  listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberRecord[]> {
    return fetchWithTimeout(`/api/workspaces/${encodeURIComponent(workspaceId)}/members`, {
      headers: getAuthHeaders()
    }).then((r) => handleResponse<WorkspaceMemberRecord[]>(r));
  },

  inviteWorkspaceMember(payload: InviteMemberPayload): Promise<WorkspaceMemberRecord> {
    return fetchWithTimeout(`/api/workspaces/${encodeURIComponent(payload.workspaceId)}/members/invite`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email: payload.email, role: payload.role, companyIds: payload.companyIds })
    }).then((r) => handleResponse<WorkspaceMemberRecord>(r));
  },

  updateWorkspaceMemberRole(
    workspaceId: string,
    memberId: string,
    role: DespachoRole
  ): Promise<WorkspaceMemberRecord> {
    return fetchWithTimeout(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}/role`,
      {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify({ role })
      }
    ).then((r) => handleResponse<WorkspaceMemberRecord>(r));
  },

  revokeWorkspaceMember(workspaceId: string, memberId: string): Promise<WorkspaceMemberRecord> {
    return fetchWithTimeout(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}/revoke`,
      {
        method: 'POST',
        headers: jsonHeaders()
      }
    ).then((r) => handleResponse<WorkspaceMemberRecord>(r));
  },

  assignCompanyAccess(payload: AssignCompanyAccessPayload): Promise<CompanyMemberAccessRecord[]> {
    return fetchWithTimeout(
      `/api/workspaces/${encodeURIComponent(payload.workspaceId)}/members/${encodeURIComponent(payload.memberId)}/companies`,
      {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({ companyIds: payload.companyIds, roleOverride: payload.roleOverride ?? null })
      }
    ).then((r) => handleResponse<CompanyMemberAccessRecord[]>(r));
  },

  acceptPendingInvites(): Promise<{ acceptedCount: number }> {
    return fetchWithTimeout('/api/workspaces/invites/accept', {
      method: 'POST',
      headers: jsonHeaders()
    }).then((r) => handleResponse<{ acceptedCount: number }>(r));
  },

  getEffectiveCompanyRole(companyId: string): Promise<EffectiveCompanyRoleResult> {
    return fetchWithTimeout(`/api/companies/${encodeURIComponent(companyId)}/effective-role`, {
      headers: getAuthHeaders()
    }).then((r) => handleResponse<EffectiveCompanyRoleResult>(r));
  },

  listCompanyAuditLogs(companyId: string, limit = 50): Promise<CompanyAuditLogRecord[]> {
    return fetchWithTimeout(`/api/companies/${encodeURIComponent(companyId)}/audit-logs?limit=${limit}`, {
      headers: getAuthHeaders()
    }).then((r) => handleResponse<CompanyAuditLogRecord[]>(r));
  },

  recordCompanyAuditLog(payload: RecordCompanyAuditPayload): Promise<CompanyAuditLogRecord> {
    return fetchWithTimeout(`/api/companies/${encodeURIComponent(payload.companyId)}/audit-logs`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId ?? null,
        metadata: payload.metadata ?? {}
      })
    }).then((r) => handleResponse<CompanyAuditLogRecord>(r));
  }
};
