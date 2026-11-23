export type DespachoRole = 'SOCIO' | 'CONTADOR' | 'AUXILIAR' | 'CLIENTE_LECTURA';

export type WorkspaceMemberStatus = 'ACTIVO' | 'INVITADO' | 'REVOCADO';

export const DESPACHO_ROLES: readonly DespachoRole[] = [
  'SOCIO',
  'CONTADOR',
  'AUXILIAR',
  'CLIENTE_LECTURA'
] as const;

export const DESPACHO_ROLE_RANK: Record<DespachoRole, number> = {
  CLIENTE_LECTURA: 1,
  AUXILIAR: 2,
  CONTADOR: 3,
  SOCIO: 4
};

export const DESPACHO_ROLE_LABELS: Record<DespachoRole, string> = {
  SOCIO: 'Socio (Control total)',
  CONTADOR: 'Contador (Operación contable y fiscal)',
  AUXILIAR: 'Auxiliar (Captura de pólizas y CFDIs)',
  CLIENTE_LECTURA: 'Cliente (Solo lectura)'
};

export interface CompanyMemberAccessRecord {
  id: string;
  companyId: string;
  memberId: string;
  userId: string | null;
  roleOverride: DespachoRole | null;
  createdAt: string;
}

export interface WorkspaceMemberRecord {
  id: string;
  workspaceId: string;
  userId: string | null;
  email: string;
  role: DespachoRole;
  status: WorkspaceMemberStatus;
  invitedBy: string;
  createdAt: string;
  updatedAt: string;
  companyAccess?: CompanyMemberAccessRecord[];
}

export interface CompanyAuditLogRecord {
  id: string;
  companyId: string;
  actorUserId: string | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface InviteMemberPayload {
  workspaceId: string;
  email: string;
  role: DespachoRole;
  invitedBy?: string;
  companyIds?: string[];
}

export interface AssignCompanyAccessPayload {
  workspaceId: string;
  memberId: string;
  companyIds: string[];
  roleOverride?: DespachoRole | null;
}

export interface RecordCompanyAuditPayload {
  companyId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  actorUserId?: string | null;
  actorEmail?: string;
}

export interface EffectiveCompanyRoleResult {
  companyId: string;
  role: DespachoRole | 'OWNER' | null;
  canWrite: boolean;
  isReadOnlyClient: boolean;
}

/** Devuelve true cuando el rol del despacho permite operaciones de escritura contable. */
export function canRoleWrite(role: DespachoRole): boolean {
  return role === 'SOCIO' || role === 'CONTADOR' || role === 'AUXILIAR';
}

/** Verifica si un rol cumple el nivel mínimo requerido en la jerarquía del despacho. */
export function hasMinDespachoRole(
  role: DespachoRole | null | undefined,
  minRole: DespachoRole
): boolean {
  if (!role) return false;
  return (DESPACHO_ROLE_RANK[role] ?? 0) >= DESPACHO_ROLE_RANK[minRole];
}
