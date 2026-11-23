import { db } from '../connection';
import { isSuperAdminEmail, normalizePlatformRole } from '../../shared/superadmin';
import type {
  AdminAuditLogEntry,
  AdminAuditLogsPageQuery,
  AdminCompaniesPageQuery,
  AdminCompanySummary,
  AdminPaginatedResponse,
  AdminPlatformAlert,
  AdminUserSummary,
  AdminUsersPageQuery,
  PlatformAlertStatus,
  PlatformRole,
  WorkspaceQuota,
  WorkspaceQuotaPayload
} from '../../shared/admin-types';
import { getAdminCompaniesRepo, getAdminUsersRepo } from './admin.repo';
import { recordAdminAuditLogRepo } from './admin-ops.repo';
import {
  alertDedupKey,
  collectHealthCandidates,
  escapeLikePattern,
  mapAlertRow,
  mapQuotaRow,
  paginateItems,
  parseMetadataJson,
  sortAdminCompanies,
  tableColumns,
  tableExists,
  type AdminCompanySortBy,
  type AdminCompanySortDir,
  type AlertDbRow,
  type QuotaDbRow
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

export function getAdminAuditLogsPaginatedRepo(
  query: AdminAuditLogsPageQuery
): AdminPaginatedResponse<AdminAuditLogEntry> {
  const safePageSize = Math.max(1, Math.min(100, Math.floor(Number(query.pageSize) || 20)));
  const safePage = Math.max(1, Math.floor(Number(query.page) || 1));
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
  const rows = db
    .query(
      `SELECT id, actor_user_id, actor_email, action, target_type, target_id, metadata_json, created_at FROM admin_audit_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, safePageSize, (safePage - 1) * safePageSize) as Array<{
      id: string;
      actor_user_id: string | null;
      actor_email: string;
      action: string;
      target_type: string;
      target_id: string | null;
      metadata_json: string;
      created_at: string;
    }>;
  return {
    items: rows.map((r) => ({
      id: r.id,
      actorUserId: r.actor_user_id,
      actorEmail: r.actor_email,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      metadata: parseMetadataJson(r.metadata_json),
      createdAt: r.created_at
    })),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(total / safePageSize))
  };
}

export function setAdminUserRoleRepo(
  userId: string,
  platformRole: PlatformRole,
  actorEmail: string,
  actorUserId: string | null
): { userId: string; platformRole: PlatformRole } {
  if (platformRole !== 'SUPERADMIN' && ((actorUserId && actorUserId === userId) || (userId === 'usr_owner_hlopez' && isSuperAdminEmail(actorEmail)))) {
    throw new Error('No puedes degradar tu propio rol SuperAdmin');
  }
  return db.transaction(() => {
    let updatedProfile = false;
    const profileCols = tableColumns('user_profiles');
    if (profileCols.size > 0) {
      const res = profileCols.has('is_superadmin')
        ? db.prepare('UPDATE user_profiles SET platform_role = ?, is_superadmin = ? WHERE id = ?').run(platformRole, platformRole === 'SUPERADMIN' ? 1 : 0, userId)
        : db.prepare('UPDATE user_profiles SET platform_role = ? WHERE id = ?').run(platformRole, userId);
      updatedProfile = res.changes > 0;
    }
    if (!updatedProfile) {
      if (!getAdminUsersRepo().some((u) => u.id === userId)) throw new Error('Usuario no encontrado.');
      db.prepare(`
        INSERT INTO admin_user_overrides (user_id, status, platform_role, updated_at, updated_by) VALUES (?, 'ACTIVO', ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET platform_role = excluded.platform_role, updated_at = excluded.updated_at, updated_by = excluded.updated_by
      `).run(userId, platformRole, new Date().toISOString(), actorEmail);
    }
    recordAdminAuditLogRepo({ actorUserId, actorEmail, action: 'SET_USER_ROLE', targetType: 'user', targetId: userId, metadata: { platformRole } });
    return { userId, platformRole };
  })();
}

export function getWorkspaceQuotaRepo(workspaceId: string): WorkspaceQuota {
  const row = db
    .query('SELECT workspace_id, user_id, plan_tier, max_companies, max_cfdis_per_month, max_storage_mb, notes, updated_at, updated_by FROM workspace_quotas WHERE workspace_id = ?')
    .get(workspaceId) as QuotaDbRow | null;
  return row ? mapQuotaRow(row) : { workspaceId, userId: null, planTier: 'FREE', maxCompanies: 3, maxCfdisPerMonth: 500, maxStorageMb: 250, notes: null, updatedAt: new Date().toISOString(), updatedBy: null };
}

export function upsertWorkspaceQuotaRepo(
  workspaceId: string,
  payload: WorkspaceQuotaPayload,
  actorEmail: string,
  actorUserId: string | null
): WorkspaceQuota {
  return db.transaction(() => {
    const now = new Date().toISOString();
    const existing = db.query('SELECT user_id FROM workspace_quotas WHERE workspace_id = ?').get(workspaceId) as { user_id: string | null } | null;
    const resolvedUserId = payload.userId !== undefined ? payload.userId : (existing?.user_id ?? null);
    db.prepare(`
      INSERT INTO workspace_quotas (workspace_id, user_id, plan_tier, max_companies, max_cfdis_per_month, max_storage_mb, notes, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id) DO UPDATE SET
        user_id = excluded.user_id, plan_tier = excluded.plan_tier, max_companies = excluded.max_companies,
        max_cfdis_per_month = excluded.max_cfdis_per_month, max_storage_mb = excluded.max_storage_mb,
        notes = excluded.notes, updated_at = excluded.updated_at, updated_by = excluded.updated_by
    `).run(workspaceId, resolvedUserId, payload.planTier, payload.maxCompanies, payload.maxCfdisPerMonth, payload.maxStorageMb, payload.notes ?? null, now, actorEmail);

    recordAdminAuditLogRepo({
      actorUserId,
      actorEmail,
      action: 'UPSERT_WORKSPACE_QUOTA',
      targetType: 'workspace',
      targetId: workspaceId,
      metadata: { planTier: payload.planTier, maxCompanies: payload.maxCompanies, maxCfdisPerMonth: payload.maxCfdisPerMonth, maxStorageMb: payload.maxStorageMb, userId: resolvedUserId }
    });
    return getWorkspaceQuotaRepo(workspaceId);
  })();
}

export function getAdminPlatformAlertsRepo(statusFilter?: 'ALL' | PlatformAlertStatus): AdminPlatformAlert[] {
  const rows =
    statusFilter && statusFilter !== 'ALL'
      ? (db.query('SELECT * FROM platform_alerts WHERE status = ? ORDER BY detected_at DESC').all(statusFilter) as AlertDbRow[])
      : (db.query('SELECT * FROM platform_alerts ORDER BY detected_at DESC').all() as AlertDbRow[]);
  return rows.map(mapAlertRow);
}

export function runAdminHealthScanRepo(
  actorEmail: string,
  actorUserId: string | null
): { scannedAtIso: string; alertsCreated: number; openAlertsCount: number } {
  const nowMs = Date.now();
  const scannedAtIso = new Date(nowMs).toISOString();
  const candidates = collectHealthCandidates(nowMs);
  return db.transaction(() => {
    const activeRows = db
      .query("SELECT id, code, category, target_type, target_id FROM platform_alerts WHERE status IN ('open', 'acknowledged')")
      .all() as Array<{ id: string; code: string; category: string; target_type: string; target_id: string | null }>;
    const activeByKey = new Map(activeRows.map((r) => [alertDedupKey(r.code, r.target_type, r.target_id), r]));
    const candidateKeys = new Set(candidates.map((c) => alertDedupKey(c.code, c.targetType, c.targetId)));
    let alertsCreated = 0;

    for (const c of candidates) {
      const existing = activeByKey.get(alertDedupKey(c.code, c.targetType, c.targetId));
      if (existing) {
        db.prepare('UPDATE platform_alerts SET severity = ?, title = ?, message = ?, metadata_json = ? WHERE id = ?').run(
          c.severity,
          c.title,
          c.message,
          JSON.stringify(c.metadata),
          existing.id
        );
      } else {
        db.prepare(
          'INSERT INTO platform_alerts (id, code, severity, category, title, message, target_type, target_id, status, metadata_json, detected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(crypto.randomUUID(), c.code, c.severity, c.category, c.title, c.message, c.targetType, c.targetId, 'open', JSON.stringify(c.metadata), scannedAtIso);
        alertsCreated += 1;
      }
    }
    for (const row of activeRows) {
      const key = alertDedupKey(row.code, row.target_type, row.target_id);
      if (!candidateKeys.has(key) && (row.category === 'fiel_expiry' || row.category === 'sat_error_spike' || row.category === 'quota_limit')) {
        db.prepare("UPDATE platform_alerts SET status = 'resolved', resolved_at = ?, resolved_by = ? WHERE id = ?").run(
          scannedAtIso,
          'system:health_scan',
          row.id
        );
      }
    }
    const openAlertsCount = Number(
      (db.query("SELECT COUNT(*) as c FROM platform_alerts WHERE status = 'open'").get() as { c: number } | null)?.c ?? 0
    );
    recordAdminAuditLogRepo({ actorUserId, actorEmail, action: 'RUN_HEALTH_SCAN', targetType: 'platform_alert', targetId: null, metadata: { alertsCreated, openAlertsCount } });
    return { scannedAtIso, alertsCreated, openAlertsCount };
  })();
}

export function updateAdminPlatformAlertStatusRepo(
  alertId: string,
  status: PlatformAlertStatus,
  actorEmail: string,
  actorUserId: string | null
): AdminPlatformAlert {
  const existing = db.query('SELECT * FROM platform_alerts WHERE id = ?').get(alertId) as AlertDbRow | null;
  if (!existing) throw new Error('Alerta no encontrada.');
  return db.transaction(() => {
    const resolvedAt = status === 'resolved' ? new Date().toISOString() : null;
    const resolvedBy = status === 'resolved' ? actorEmail : null;
    db.prepare('UPDATE platform_alerts SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?').run(status, resolvedAt, resolvedBy, alertId);
    recordAdminAuditLogRepo({ actorUserId, actorEmail, action: 'RESOLVE_PLATFORM_ALERT', targetType: 'platform_alert', targetId: alertId, metadata: { status, code: existing.code } });
    return mapAlertRow(db.query('SELECT * FROM platform_alerts WHERE id = ?').get(alertId) as AlertDbRow);
  })();
}
