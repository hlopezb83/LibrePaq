import type { PlatformRole } from '../_shared/admin-edge-auth.ts';

export type WorkspacePlanTier = 'FREE' | 'PRO' | 'DESPACHO' | 'ENTERPRISE';
export type PlatformAlertStatus = 'open' | 'acknowledged' | 'resolved';

export type AdminOpsAction =
  | 'SET_USER_STATUS'
  | 'SET_USER_ROLE'
  | 'DELETE_COMPANY'
  | 'PUBLISH_BROADCAST'
  | 'CLEAR_BROADCAST'
  | 'UPSERT_WORKSPACE_QUOTA'
  | 'RESOLVE_PLATFORM_ALERT'
  | 'RECORD_AUDIT';

export interface AdminOpsRequestBody {
  action?: AdminOpsAction;
  userId?: string;
  status?: 'ACTIVO' | 'SUSPENDIDO' | PlatformAlertStatus;
  platformRole?: PlatformRole;
  reason?: string;
  companyId?: string;
  workspaceId?: string;
  planTier?: WorkspacePlanTier;
  maxCompanies?: number;
  maxCfdisPerMonth?: number;
  maxStorageMb?: number;
  notes?: string | null;
  alertId?: string;
  alertStatus?: PlatformAlertStatus;
  title?: string;
  message?: string;
  type?: 'info' | 'warning' | 'success';
  expiresAt?: string | null;
  auditAction?: string;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AdminActorContext {
  userId: string;
  email: string;
  role: PlatformRole;
}

export const VALID_ROLES = new Set<PlatformRole>(['SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS', 'NONE']);
export const VALID_TIERS = new Set<WorkspacePlanTier>(['FREE', 'PRO', 'DESPACHO', 'ENTERPRISE']);
export const VALID_ALERT_STATUSES = new Set<PlatformAlertStatus>(['open', 'acknowledged', 'resolved']);

export const ACTION_ALLOWED_ROLES: Record<AdminOpsAction, ReadonlySet<PlatformRole>> = {
  DELETE_COMPANY: new Set<PlatformRole>(['SUPERADMIN']),
  PUBLISH_BROADCAST: new Set<PlatformRole>(['SUPERADMIN']),
  CLEAR_BROADCAST: new Set<PlatformRole>(['SUPERADMIN']),
  SET_USER_ROLE: new Set<PlatformRole>(['SUPERADMIN']),
  SET_USER_STATUS: new Set<PlatformRole>(['SUPERADMIN', 'BILLING_OPS']),
  UPSERT_WORKSPACE_QUOTA: new Set<PlatformRole>(['SUPERADMIN', 'BILLING_OPS']),
  RECORD_AUDIT: new Set<PlatformRole>(['SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS']),
  RESOLVE_PLATFORM_ALERT: new Set<PlatformRole>(['SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS'])
};

type Row = Record<string, unknown>;

export function mapBroadcastRow(row: Row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    active: row.active,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapQuotaRow(row: Row) {
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    planTier: row.plan_tier,
    maxCompanies: row.max_companies,
    maxCfdisPerMonth: row.max_cfdis_per_month,
    maxStorageMb: row.max_storage_mb,
    notes: row.notes,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by
  };
}

export function mapAlertRow(row: Row) {
  return {
    id: row.id,
    code: row.code,
    severity: row.severity,
    category: row.category,
    title: row.title,
    message: row.message,
    targetType: row.target_type,
    targetId: row.target_id,
    status: row.status,
    metadata: row.metadata || {},
    detectedAt: row.detected_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by
  };
}
