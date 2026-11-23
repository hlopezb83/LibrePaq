import { db } from '../connection';
import { normalizePlatformRole } from '../../shared/superadmin';
import type {
  AdminAuditLogEntry,
  AdminAuditLogsPageQuery,
  AdminCompaniesPageQuery,
  AdminCompanySummary,
  AdminPaginatedResponse,
  AdminUserSummary,
  AdminUsersPageQuery
} from '../../shared/admin-types';
import { getAdminCompaniesRepo, getAdminUsersRepo } from './admin.repo';
import {
  escapeLikePattern,
  paginateItems,
  parseMetadataJson,
  sortAdminCompanies,
  tableExists,
  type AdminCompanySortBy,
  type AdminCompanySortDir
} from './admin-enterprise.helpers';

interface UserProfileRow {
  id: string;
  email?: string | null;
  full_name?: string | null;
  workspace_id?: string | null;
  workspace_name?: string | null;
  provider?: string | null;
  is_superadmin?: number | boolean | null;
  platform_role?: string | null;
  status?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
}

export type AdminCompaniesPaginatedQuery = AdminCompaniesPageQuery & {
  sortBy?: AdminCompanySortBy;
  sortDir?: AdminCompanySortDir;
};

/**
 * Lista empresas con filtros, ordenamiento global y paginación para el directorio SuperAdmin.
 */
export function getAdminCompaniesPaginatedRepo(
  query: AdminCompaniesPaginatedQuery
): AdminPaginatedResponse<AdminCompanySummary> {
  const search = (query.search || '').trim().toLowerCase();
  const ownerType = query.ownerType || 'ALL';
  const fielFilter = query.fielFilter || 'ALL';
  const filtered = getAdminCompaniesRepo().filter((c) => {
    if (ownerType !== 'ALL' && c.ownerType !== ownerType) return false;
    if (fielFilter === 'WITH_FIEL' && !c.hasFiel) return false;
    if (fielFilter === 'WITHOUT_FIEL' && c.hasFiel) return false;
    if (
      search &&
      ![c.name, c.rfc, c.userEmail, c.userFullName, c.userId].some((v) => String(v || '').toLowerCase().includes(search))
    ) {
      return false;
    }
    return true;
  });
  const sorted = sortAdminCompanies(filtered, query.sortBy ?? 'createdAt', query.sortDir ?? 'desc');
  return paginateItems(sorted, query.page, query.pageSize);
}

/**
 * Lista usuarios con perfiles fusionados, filtros por estatus/rol y paginación.
 */
export function getAdminUsersPaginatedRepo(query: AdminUsersPageQuery): AdminPaginatedResponse<AdminUserSummary> {
  const ovRows = db.query('SELECT user_id, platform_role FROM admin_user_overrides').all() as Array<{
    user_id: string;
    platform_role: string | null;
  }>;
  const overrideRoles = new Map(ovRows.map((r) => [r.user_id, r.platform_role]));
  const profileMap = new Map<string, UserProfileRow>();
  if (tableExists('user_profiles')) {
    for (const p of db.query('SELECT * FROM user_profiles').all() as UserProfileRow[]) {
      if (p.id) profileMap.set(p.id, p);
    }
  }

  const baseUsers = getAdminUsersRepo();
  const seenIds = new Set(baseUsers.map((u) => u.id));
  const merged: AdminUserSummary[] = baseUsers.map((u) => {
    const prof = profileMap.get(u.id);
    const rawRole = prof?.platform_role ?? overrideRoles.get(u.id) ?? u.platformRole;
    const isSuperFlag = prof?.is_superadmin != null ? Boolean(prof.is_superadmin) : u.isSuperAdmin;
    const platformRole = normalizePlatformRole(rawRole, isSuperFlag, prof?.email ?? u.email);
    const isSuper = platformRole === 'SUPERADMIN';
    return {
      ...u,
      email: prof?.email || u.email,
      fullName: prof?.full_name || u.fullName,
      workspaceId: isSuper ? undefined : (prof?.workspace_id ?? u.workspaceId),
      workspaceName: isSuper ? undefined : (prof?.workspace_name ?? u.workspaceName),
      isSuperAdmin: isSuper,
      platformRole
    };
  });

  for (const [pid, prof] of profileMap.entries()) {
    if (seenIds.has(pid)) continue;
    const email = String(prof.email || `${pid}@librepaq.local`);
    const platformRole = normalizePlatformRole(prof.platform_role, Boolean(prof.is_superadmin), email);
    const isSuper = platformRole === 'SUPERADMIN';
    const compRow = db.query('SELECT COUNT(*) as c FROM companies WHERE user_id = ?').get(pid) as { c: number } | null;
    merged.push({
      id: pid,
      email,
      fullName: String(prof.full_name || email.split('@')[0] || 'Usuario Registrado'),
      workspaceId: isSuper ? undefined : (prof.workspace_id ?? undefined),
      workspaceName: isSuper ? undefined : (prof.workspace_name ?? undefined),
      provider: prof.provider === 'google' ? 'google' : 'email',
      isSuperAdmin: isSuper,
      platformRole,
      createdAt: String(prof.created_at || new Date().toISOString()),
      lastSignInAt: prof.last_sign_in_at ?? undefined,
      companiesCount: Number(compRow?.c ?? 0),
      status: prof.status === 'SUSPENDIDO' ? 'SUSPENDIDO' : 'ACTIVO'
    });
  }

  const search = (query.search || '').trim().toLowerCase();
  const status = query.status || 'ALL';
  const role = query.role || 'ALL';
  const filtered = merged.filter((u) => {
    if (status !== 'ALL' && u.status !== status) return false;
    if (role !== 'ALL' && u.platformRole !== role) return false;
    if (search && ![u.email, u.fullName, u.id, u.workspaceName, u.workspaceId].some((v) => String(v || '').toLowerCase().includes(search))) {
      return false;
    }
    return true;
  });
  return paginateItems(filtered, query.page, query.pageSize);
}

/**
 * Consulta la bitácora de auditoría administrativa con filtros SQL y paginación.
 */
export function getAdminAuditLogsPaginatedRepo(
  query: AdminAuditLogsPageQuery
): AdminPaginatedResponse<AdminAuditLogEntry> {
  const safePageSize = Math.max(1, Math.min(100, Math.floor(Number(query.pageSize) || 20)));
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (query.action?.trim() && query.action !== 'ALL') {
    clauses.push('action = ?');
    params.push(query.action.trim());
  }
  if (query.targetType?.trim() && query.targetType !== 'ALL') {
    clauses.push('target_type = ?');
    params.push(query.targetType.trim());
  }
  if (query.search?.trim()) {
    const like = `%${escapeLikePattern(query.search.trim().toLowerCase())}%`;
    clauses.push(
      "(lower(actor_email) LIKE ? ESCAPE '\\' OR lower(action) LIKE ? ESCAPE '\\' OR lower(target_type) LIKE ? ESCAPE '\\' OR lower(COALESCE(target_id, '')) LIKE ? ESCAPE '\\' OR lower(metadata_json) LIKE ? ESCAPE '\\')"
    );
    params.push(like, like, like, like, like);
  }
  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = Number(
    (db.query(`SELECT COUNT(*) as c FROM admin_audit_logs ${whereSql}`).get(...params) as { c: number } | null)?.c ?? 0
  );
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(Number(query.page) || 1)), totalPages);
  const rows = db
    .query(
      `SELECT id, actor_user_id, actor_email, action, target_type, target_id, metadata_json, created_at FROM admin_audit_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, safePageSize, (safePage - 1) * safePageSize) as Array<{
      id: string; actor_user_id: string | null; actor_email: string; action: string;
      target_type: string; target_id: string | null; metadata_json: string; created_at: string;
    }>;
  return {
    items: rows.map((r) => ({
      id: r.id, actorUserId: r.actor_user_id, actorEmail: r.actor_email, action: r.action,
      targetType: r.target_type, targetId: r.target_id, metadata: parseMetadataJson(r.metadata_json), createdAt: r.created_at
    })),
    total, page: safePage, pageSize: safePageSize, totalPages
  };
}
