import { supabase } from '../supabase';
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

async function invokeWorkspaceInvites<T>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  if (!supabase) throw new Error('Supabase no disponible');
  const { data, error } = await supabase.functions.invoke<T & { ok?: boolean; error?: string }>(
    'workspace-invites',
    { body: { action, ...payload } }
  );
  if (error) {
    let msg = error.message || 'Error en Edge Function workspace-invites';
    try {
      const ctx = (error as { context?: Response }).context;
      const json = (await ctx?.json()) as { error?: string } | undefined;
      if (json?.error) msg = json.error;
    } catch {
      // ignore non-json error response
    }
    throw new Error(msg);
  }
  if (data && typeof data === 'object' && 'error' in data && data.error && !data.ok) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export const supabaseWorkspaceMembers = {
  async listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberRecord[]> {
    const res = await invokeWorkspaceInvites<{ members: WorkspaceMemberRecord[] }>('LIST_MEMBERS', {
      workspaceId
    });
    return res.members ?? [];
  },

  async inviteWorkspaceMember(payload: InviteMemberPayload): Promise<WorkspaceMemberRecord> {
    const res = await invokeWorkspaceInvites<{ member: WorkspaceMemberRecord }>('INVITE_MEMBER', {
      workspaceId: payload.workspaceId,
      email: payload.email,
      role: payload.role,
      companyIds: payload.companyIds
    });
    return res.member;
  },

  async updateWorkspaceMemberRole(
    workspaceId: string,
    memberId: string,
    role: DespachoRole
  ): Promise<WorkspaceMemberRecord> {
    const res = await invokeWorkspaceInvites<{ member: WorkspaceMemberRecord }>('UPDATE_MEMBER_ROLE', {
      workspaceId,
      memberId,
      role
    });
    return res.member;
  },

  async revokeWorkspaceMember(workspaceId: string, memberId: string): Promise<WorkspaceMemberRecord> {
    const res = await invokeWorkspaceInvites<{ member: WorkspaceMemberRecord }>('REVOKE_MEMBER', {
      workspaceId,
      memberId
    });
    return res.member;
  },

  async assignCompanyAccess(payload: AssignCompanyAccessPayload): Promise<CompanyMemberAccessRecord[]> {
    const res = await invokeWorkspaceInvites<{ companyAccess: CompanyMemberAccessRecord[] }>(
      'ASSIGN_COMPANY_ACCESS',
      {
        workspaceId: payload.workspaceId,
        memberId: payload.memberId,
        companyIds: payload.companyIds,
        roleOverride: payload.roleOverride ?? null
      }
    );
    return res.companyAccess ?? [];
  },

  async acceptPendingInvites(): Promise<{ acceptedCount: number }> {
    const res = await invokeWorkspaceInvites<{ acceptedCount: number }>('ACCEPT_PENDING_INVITES');
    return { acceptedCount: Number(res?.acceptedCount ?? 0) };
  },

  async getEffectiveCompanyRole(companyId: string): Promise<EffectiveCompanyRoleResult> {
    const res = await invokeWorkspaceInvites<EffectiveCompanyRoleResult>('GET_COMPANY_ROLE', {
      companyId
    });
    return {
      companyId: res.companyId ?? companyId,
      role: res.role ?? null,
      canWrite: Boolean(res.canWrite),
      isReadOnlyClient: Boolean(res.isReadOnlyClient)
    };
  },

  async listCompanyAuditLogs(companyId: string, limit = 50): Promise<CompanyAuditLogRecord[]> {
    const res = await invokeWorkspaceInvites<{ logs: CompanyAuditLogRecord[] }>('LIST_COMPANY_AUDIT', {
      companyId,
      limit
    });
    return res.logs ?? [];
  },

  async recordCompanyAuditLog(payload: RecordCompanyAuditPayload): Promise<CompanyAuditLogRecord> {
    const res = await invokeWorkspaceInvites<{ log: CompanyAuditLogRecord }>('RECORD_COMPANY_AUDIT', {
      companyId: payload.companyId,
      auditAction: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId ?? null,
      metadata: payload.metadata ?? {}
    });
    return res.log;
  }
};
