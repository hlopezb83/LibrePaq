import { CANONICAL_DEMO_COMPANY_ID } from '../sandbox-demo-constants';
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

const demoMembersByWs = new Map<string, WorkspaceMemberRecord[]>();
const demoAuditLogsByCompany = new Map<string, CompanyAuditLogRecord[]>();

function ensureDemoMembers(workspaceId: string): WorkspaceMemberRecord[] {
  const existing = demoMembersByWs.get(workspaceId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const initial: WorkspaceMemberRecord[] = [
    {
      id: 'mem_demo_1',
      workspaceId,
      userId: 'usr_demo_contador',
      email: 'contador.fiscal@despacho-demo.mx',
      role: 'CONTADOR',
      status: 'ACTIVO',
      invitedBy: 'demo@librepaq.com',
      createdAt: now,
      updatedAt: now,
      companyAccess: []
    },
    {
      id: 'mem_demo_2',
      workspaceId,
      userId: 'usr_demo_auxiliar',
      email: 'auxiliar.polizas@despacho-demo.mx',
      role: 'AUXILIAR',
      status: 'ACTIVO',
      invitedBy: 'demo@librepaq.com',
      createdAt: now,
      updatedAt: now,
      companyAccess: [
        {
          id: 'cma_demo_1',
          companyId: CANONICAL_DEMO_COMPANY_ID,
          memberId: 'mem_demo_2',
          userId: 'usr_demo_auxiliar',
          roleOverride: null,
          createdAt: now
        }
      ]
    }
  ];
  demoMembersByWs.set(workspaceId, initial);
  return initial;
}

function ensureDemoAuditLogs(companyId: string): CompanyAuditLogRecord[] {
  const existing = demoAuditLogsByCompany.get(companyId);
  if (existing) return existing;
  const now = Date.now();
  const initial: CompanyAuditLogRecord[] = [
    {
      id: 'aud_demo_1',
      companyId,
      actorUserId: 'usr_guest_demo',
      actorEmail: 'demo@librepaq.com',
      action: 'COMPANY_CREATE',
      entityType: 'company',
      entityId: companyId,
      metadata: { source: 'sandbox_demo', preset: 'SAT_STANDARD' },
      createdAt: new Date(now - 3600_000).toISOString()
    },
    {
      id: 'aud_demo_2',
      companyId,
      actorUserId: 'usr_demo_contador',
      actorEmail: 'contador.fiscal@despacho-demo.mx',
      action: 'CREATE_POLIZA',
      entityType: 'poliza',
      entityId: 'pol_demo_open_1',
      metadata: { tipo: 'DIARIO', folio: 1 },
      createdAt: new Date(now - 1800_000).toISOString()
    }
  ];
  demoAuditLogsByCompany.set(companyId, initial);
  return initial;
}

export const guestDemoRbac = {
  async listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberRecord[]> {
    return ensureDemoMembers(workspaceId).map((m) => ({ ...m }));
  },

  async inviteWorkspaceMember(payload: InviteMemberPayload): Promise<WorkspaceMemberRecord> {
    const members = ensureDemoMembers(payload.workspaceId);
    const email = payload.email.trim().toLowerCase();
    const existing = members.find((m) => m.email === email && m.status !== 'REVOCADO');
    if (existing) {
      throw new Error('Este correo ya está registrado o invitado en el despacho');
    }
    const now = new Date().toISOString();
    const id = `mem_demo_${crypto.randomUUID().slice(0, 8)}`;
    const access: CompanyMemberAccessRecord[] = (payload.companyIds || []).map((cid) => ({
      id: `cma_demo_${crypto.randomUUID().slice(0, 8)}`,
      companyId: cid,
      memberId: id,
      userId: null,
      roleOverride: null,
      createdAt: now
    }));
    const created: WorkspaceMemberRecord = {
      id,
      workspaceId: payload.workspaceId,
      userId: null,
      email,
      role: payload.role,
      status: 'INVITADO',
      invitedBy: payload.invitedBy || 'demo@librepaq.com',
      createdAt: now,
      updatedAt: now,
      companyAccess: access
    };
    members.push(created);
    return { ...created };
  },

  async updateWorkspaceMemberRole(
    workspaceId: string,
    memberId: string,
    role: DespachoRole
  ): Promise<WorkspaceMemberRecord> {
    const members = ensureDemoMembers(workspaceId);
    const target = members.find((m) => m.id === memberId);
    if (!target) throw new Error('Miembro no encontrado');
    target.role = role;
    target.updatedAt = new Date().toISOString();
    return { ...target };
  },

  async revokeWorkspaceMember(workspaceId: string, memberId: string): Promise<WorkspaceMemberRecord> {
    const members = ensureDemoMembers(workspaceId);
    const target = members.find((m) => m.id === memberId);
    if (!target) throw new Error('Miembro no encontrado');
    target.status = 'REVOCADO';
    target.updatedAt = new Date().toISOString();
    return { ...target };
  },

  async assignCompanyAccess(payload: AssignCompanyAccessPayload): Promise<CompanyMemberAccessRecord[]> {
    const members = ensureDemoMembers(payload.workspaceId);
    const target = members.find((m) => m.id === payload.memberId);
    if (!target) throw new Error('Miembro no encontrado');
    const now = new Date().toISOString();
    const next: CompanyMemberAccessRecord[] = payload.companyIds.map((cid) => ({
      id: `cma_demo_${crypto.randomUUID().slice(0, 8)}`,
      companyId: cid,
      memberId: payload.memberId,
      userId: target.userId,
      roleOverride: payload.roleOverride ?? null,
      createdAt: now
    }));
    target.companyAccess = next;
    target.updatedAt = now;
    return next;
  },

  async acceptPendingInvites(): Promise<{ acceptedCount: number }> {
    return { acceptedCount: 0 };
  },

  async getEffectiveCompanyRole(companyId: string): Promise<EffectiveCompanyRoleResult> {
    return {
      companyId,
      role: 'OWNER',
      canWrite: true,
      isReadOnlyClient: false
    };
  },

  async listCompanyAuditLogs(companyId: string, limit = 50): Promise<CompanyAuditLogRecord[]> {
    return ensureDemoAuditLogs(companyId).slice(0, limit).map((l) => ({ ...l }));
  },

  async recordCompanyAuditLog(payload: RecordCompanyAuditPayload): Promise<CompanyAuditLogRecord> {
    const logs = ensureDemoAuditLogs(payload.companyId);
    const entry: CompanyAuditLogRecord = {
      id: `aud_demo_${crypto.randomUUID().slice(0, 8)}`,
      companyId: payload.companyId,
      actorUserId: payload.actorUserId ?? 'usr_guest_demo',
      actorEmail: payload.actorEmail || 'demo@librepaq.com',
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId ?? null,
      metadata: payload.metadata ?? {},
      createdAt: new Date().toISOString()
    };
    logs.unshift(entry);
    return entry;
  }
};
