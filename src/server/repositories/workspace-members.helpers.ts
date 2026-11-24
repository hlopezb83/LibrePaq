import type {
  CompanyAuditLogRecord,
  CompanyMemberAccessRecord,
  DespachoRole,
  WorkspaceMemberRecord
} from '../../shared/types/despacho-rbac.types';

export interface MemberDbRow {
  id: string;
  workspace_id: string;
  user_id: string | null;
  email: string;
  role: DespachoRole;
  access_scope?: 'ALL_COMPANIES' | 'RESTRICTED' | null;
  status: 'ACTIVO' | 'INVITADO' | 'REVOCADO';
  invited_by: string;
  created_at: string;
  updated_at: string;
}

export interface AccessDbRow {
  id: string;
  company_id: string;
  member_id: string;
  user_id: string | null;
  role_override: DespachoRole | null;
  created_at: string;
}

export interface AuditDbRow {
  id: string;
  company_id: string;
  actor_user_id: string | null;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata_json: string;
  created_at: string;
}

export const DESPACHO_RBAC_DDL = `
  CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('SOCIO','CONTADOR','AUXILIAR','CLIENTE_LECTURA')),
    access_scope TEXT NOT NULL DEFAULT 'ALL_COMPANIES' CHECK (access_scope IN ('ALL_COMPANIES','RESTRICTED')),
    status TEXT NOT NULL DEFAULT 'INVITADO' CHECK (status IN ('ACTIVO','INVITADO','REVOCADO')),
    invited_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_members_ws_email
    ON workspace_members (workspace_id, lower(email));
  CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
    ON workspace_members (user_id);

  CREATE TABLE IF NOT EXISTS company_member_access (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
    user_id TEXT,
    role_override TEXT CHECK (role_override IN ('SOCIO','CONTADOR','AUXILIAR','CLIENTE_LECTURA')),
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_company_member_access_comp_member
    ON company_member_access (company_id, member_id);

  CREATE TABLE IF NOT EXISTS company_audit_logs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    actor_user_id TEXT,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_company_audit_logs_comp_created
    ON company_audit_logs (company_id, created_at DESC);
`;

export function mapAccessRow(row: AccessDbRow): CompanyMemberAccessRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    memberId: row.member_id,
    userId: row.user_id ?? null,
    roleOverride: row.role_override ?? null,
    createdAt: row.created_at
  };
}

export function mapMemberRow(row: MemberDbRow, access: AccessDbRow[] = []): WorkspaceMemberRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id ?? null,
    email: row.email,
    role: row.role,
    status: row.status,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    companyAccess: access.map(mapAccessRow)
  };
}

export function mapAuditRow(row: AuditDbRow): CompanyAuditLogRecord {
  let metadata: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.metadata_json || '{}');
    if (parsed && typeof parsed === 'object') metadata = parsed as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  return {
    id: row.id,
    companyId: row.company_id,
    actorUserId: row.actor_user_id ?? null,
    actorEmail: row.actor_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ?? null,
    metadata,
    createdAt: row.created_at
  };
}
