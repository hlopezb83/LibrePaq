import { db } from '../connection';
import { isSuperAdminEmail, normalizePlatformRole } from '../../shared/superadmin';
import type {
  AdminAuditLogEntry, AdminAuditLogsPageQuery, AdminCompaniesPageQuery, AdminCompanySummary,
  AdminPaginatedResponse, AdminPlatformAlert, AdminUserSummary, AdminUsersPageQuery,
  PlatformAlertCategory, PlatformAlertSeverity, PlatformAlertStatus, PlatformRole,
  WorkspacePlanTier, WorkspaceQuota, WorkspaceQuotaPayload
} from '../../shared/admin-types';
import { getAdminCompaniesRepo, getAdminUsersRepo } from './admin.repo';
import { recordAdminAuditLogRepo } from './admin-ops.repo';

interface QuotaDbRow {
  workspace_id: string; user_id: string | null; plan_tier: string; max_companies: number;
  max_cfdis_per_month: number; max_storage_mb: number; notes: string | null; updated_at: string; updated_by: string | null;
}

interface AlertDbRow {
  id: string; code: string; severity: string; category: string; title: string; message: string;
  target_type: string; target_id: string | null; status: string; metadata_json: string;
  detected_at: string; resolved_at: string | null; resolved_by: string | null;
}

interface UserProfileRow {
  id: string; email?: string | null; full_name?: string | null; provider?: string | null;
  is_superadmin?: number | boolean | null; platform_role?: string | null; status?: string | null;
  created_at?: string | null; last_sign_in_at?: string | null;
}

interface AlertCandidate {
  code: string; severity: PlatformAlertSeverity; category: PlatformAlertCategory;
  title: string; message: string; targetType: string; targetId: string | null; metadata: Record<string, unknown>;
}

const VALID_PLAN_TIERS: ReadonlySet<WorkspacePlanTier> = new Set(['FREE', 'PRO', 'DESPACHO', 'ENTERPRISE']);

function parseMetadataJson(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function paginateItems<T>(items: T[], page?: number, pageSize?: number): AdminPaginatedResponse<T> {
  const safePageSize = Math.max(1, Math.min(100, Math.floor(Number(pageSize) || 20)));
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const total = items.length;
  const start = (safePage - 1) * safePageSize;
  return { items: items.slice(start, start + safePageSize), total, page: safePage, pageSize: safePageSize, totalPages: Math.max(1, Math.ceil(total / safePageSize)) };
}

function tableExists(name: string): boolean {
  return Boolean(db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function mapQuotaRow(row: QuotaDbRow): WorkspaceQuota {
  const planTier = VALID_PLAN_TIERS.has(row.plan_tier as WorkspacePlanTier) ? (row.plan_tier as WorkspacePlanTier) : 'FREE';
  return {
    workspaceId: row.workspace_id, userId: row.user_id ?? null, planTier,
    maxCompanies: Number(row.max_companies), maxCfdisPerMonth: Number(row.max_cfdis_per_month),
    maxStorageMb: Number(row.max_storage_mb), notes: row.notes ?? null, updatedAt: row.updated_at, updatedBy: row.updated_by ?? null
  };
}

function mapAlertRow(row: AlertDbRow): AdminPlatformAlert {
  const severity: PlatformAlertSeverity = row.severity === 'critical' || row.severity === 'warning' ? row.severity : 'info';
  const category: PlatformAlertCategory =
    row.category === 'fiel_expiry' || row.category === 'sat_error_spike' || row.category === 'quota_limit' ? row.category : 'system';
  const status: PlatformAlertStatus = row.status === 'acknowledged' || row.status === 'resolved' ? row.status : 'open';
  return {
    id: row.id, code: row.code, severity, category, title: row.title, message: row.message,
    targetType: row.target_type, targetId: row.target_id, status, metadata: parseMetadataJson(row.metadata_json),
    detectedAt: row.detected_at, resolvedAt: row.resolved_at, resolvedBy: row.resolved_by
  };
}

export function getAdminCompaniesPaginatedRepo(query: AdminCompaniesPageQuery): AdminPaginatedResponse<AdminCompanySummary> {
  const search = (query.search || '').trim().toLowerCase();
  const ownerType = query.ownerType || 'ALL';
  const fielFilter = query.fielFilter || 'ALL';
  const filtered = getAdminCompaniesRepo().filter((c) => {
    if (ownerType !== 'ALL' && c.ownerType !== ownerType) return false;
    if (fielFilter === 'WITH_FIEL' && !c.hasFiel) return false;
    if (fielFilter === 'WITHOUT_FIEL' && c.hasFiel) return false;
    if (search && ![c.name, c.rfc, c.userEmail, c.userFullName, c.userId].some((v) => String(v || '').toLowerCase().includes(search))) return false;
    return true;
  });
  return paginateItems(filtered, query.page, query.pageSize);
}

export function getAdminUsersPaginatedRepo(query: AdminUsersPageQuery): AdminPaginatedResponse<AdminUserSummary> {
  const ovRows = db.query('SELECT user_id, platform_role FROM admin_user_overrides').all() as Array<{ user_id: string; platform_role: string | null }>;
  const overrideRoles = new Map(ovRows.map((r) => [r.user_id, r.platform_role]));
  const profileMap = new Map<string, UserProfileRow>();
  if (tableExists('user_profiles')) {
    for (const p of db.query('SELECT * FROM user_profiles').all() as UserProfileRow[]) if (p.id) profileMap.set(p.id, p);
  }

  const baseUsers = getAdminUsersRepo();
  const seenIds = new Set(baseUsers.map((u) => u.id));
  const merged: AdminUserSummary[] = baseUsers.map((u) => {
    const prof = profileMap.get(u.id);
    const rawRole = prof?.platform_role ?? overrideRoles.get(u.id) ?? u.platformRole;
    const isSuperFlag = prof?.is_superadmin != null ? Boolean(prof.is_superadmin) : u.isSuperAdmin;
    const platformRole = normalizePlatformRole(rawRole, isSuperFlag, prof?.email ?? u.email);
    return { ...u, email: prof?.email || u.email, fullName: prof?.full_name || u.fullName, isSuperAdmin: platformRole === 'SUPERADMIN', platformRole };
  });

  for (const [pid, prof] of profileMap.entries()) {
    if (seenIds.has(pid)) continue;
    const email = String(prof.email || `${pid}@librepaq.local`);
    const platformRole = normalizePlatformRole(prof.platform_role, Boolean(prof.is_superadmin), email);
    const compRow = db.query('SELECT COUNT(*) as c FROM companies WHERE user_id = ?').get(pid) as { c: number } | null;
    merged.push({
      id: pid, email, fullName: String(prof.full_name || email.split('@')[0] || 'Usuario Registrado'),
      provider: prof.provider === 'google' ? 'google' : 'email', isSuperAdmin: platformRole === 'SUPERADMIN', platformRole,
      createdAt: String(prof.created_at || new Date().toISOString()), lastSignInAt: prof.last_sign_in_at ?? undefined,
      companiesCount: Number(compRow?.c ?? 0), status: prof.status === 'SUSPENDIDO' ? 'SUSPENDIDO' : 'ACTIVO'
    });
  }

  const search = (query.search || '').trim().toLowerCase();
  const status = query.status || 'ALL';
  const role = query.role || 'ALL';
  const filtered = merged.filter((u) => {
    if (status !== 'ALL' && u.status !== status) return false;
    if (role !== 'ALL' && u.platformRole !== role) return false;
    if (search && ![u.email, u.fullName, u.id, u.workspaceName].some((v) => String(v || '').toLowerCase().includes(search))) return false;
    return true;
  });
  return paginateItems(filtered, query.page, query.pageSize);
}

export function getAdminAuditLogsPaginatedRepo(query: AdminAuditLogsPageQuery): AdminPaginatedResponse<AdminAuditLogEntry> {
  const safePageSize = Math.max(1, Math.min(100, Math.floor(Number(query.pageSize) || 20)));
  const safePage = Math.max(1, Math.floor(Number(query.page) || 1));
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (query.action?.trim() && query.action !== 'ALL') { clauses.push('action = ?'); params.push(query.action.trim()); }
  if (query.targetType?.trim() && query.targetType !== 'ALL') { clauses.push('target_type = ?'); params.push(query.targetType.trim()); }
  if (query.search?.trim()) {
    const like = `%${query.search.trim().toLowerCase()}%`;
    clauses.push("(lower(actor_email) LIKE ? OR lower(action) LIKE ? OR lower(target_type) LIKE ? OR lower(COALESCE(target_id, '')) LIKE ? OR lower(metadata_json) LIKE ?)");
    params.push(like, like, like, like, like);
  }
  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = Number((db.query(`SELECT COUNT(*) as c FROM admin_audit_logs ${whereSql}`).get(...params) as { c: number } | null)?.c ?? 0);
  const rows = db.query(`SELECT id, actor_user_id, actor_email, action, target_type, target_id, metadata_json, created_at FROM admin_audit_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, safePageSize, (safePage - 1) * safePageSize) as Array<{
      id: string; actor_user_id: string | null; actor_email: string; action: string; target_type: string; target_id: string | null; metadata_json: string; created_at: string;
    }>;
  return {
    items: rows.map((r) => ({ id: r.id, actorUserId: r.actor_user_id, actorEmail: r.actor_email, action: r.action, targetType: r.target_type, targetId: r.target_id, metadata: parseMetadataJson(r.metadata_json), createdAt: r.created_at })),
    total, page: safePage, pageSize: safePageSize, totalPages: Math.max(1, Math.ceil(total / safePageSize))
  };
}

export function setAdminUserRoleRepo(
  userId: string, platformRole: PlatformRole, actorEmail: string, actorUserId: string | null
): { userId: string; platformRole: PlatformRole } {
  if (platformRole !== 'SUPERADMIN' && ((actorUserId && actorUserId === userId) || (userId === 'usr_owner_hlopez' && isSuperAdminEmail(actorEmail)))) {
    throw new Error('No puedes degradar tu propio rol SuperAdmin');
  }
  return db.transaction(() => {
    let updatedProfile = false;
    if (tableExists('user_profiles')) {
      const cols = db.query('PRAGMA table_info(user_profiles)').all() as Array<{ name: string }>;
      const hasIsSuper = cols.some((c) => c.name === 'is_superadmin');
      const res = hasIsSuper
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
  const row = db.query('SELECT workspace_id, user_id, plan_tier, max_companies, max_cfdis_per_month, max_storage_mb, notes, updated_at, updated_by FROM workspace_quotas WHERE workspace_id = ?')
    .get(workspaceId) as QuotaDbRow | null;
  return row ? mapQuotaRow(row) : { workspaceId, userId: null, planTier: 'FREE', maxCompanies: 3, maxCfdisPerMonth: 500, maxStorageMb: 250, notes: null, updatedAt: new Date().toISOString(), updatedBy: null };
}

export function upsertWorkspaceQuotaRepo(
  workspaceId: string, payload: WorkspaceQuotaPayload, actorEmail: string, actorUserId: string | null
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
      actorUserId, actorEmail, action: 'UPSERT_WORKSPACE_QUOTA', targetType: 'workspace_quota', targetId: workspaceId,
      metadata: { planTier: payload.planTier, maxCompanies: payload.maxCompanies, maxCfdisPerMonth: payload.maxCfdisPerMonth, maxStorageMb: payload.maxStorageMb, userId: resolvedUserId }
    });
    return getWorkspaceQuotaRepo(workspaceId);
  })();
}

export function getAdminPlatformAlertsRepo(statusFilter?: 'ALL' | PlatformAlertStatus): AdminPlatformAlert[] {
  const rows = statusFilter && statusFilter !== 'ALL'
    ? (db.query('SELECT * FROM platform_alerts WHERE status = ? ORDER BY detected_at DESC').all(statusFilter) as AlertDbRow[])
    : (db.query('SELECT * FROM platform_alerts ORDER BY detected_at DESC').all() as AlertDbRow[]);
  return rows.map(mapAlertRow);
}

function collectHealthCandidates(nowMs: number): AlertCandidate[] {
  const candidates: AlertCandidate[] = [];
  const fielRows = db.query('SELECT f.company_id, c.name as company_name, c.rfc as company_rfc, f.valid_to FROM fiel_credentials f INNER JOIN companies c ON c.id = f.company_id')
    .all() as Array<{ company_id: string; company_name: string; company_rfc: string; valid_to: string }>;
  for (const r of fielRows) {
    const days = Math.ceil((new Date(r.valid_to).getTime() - nowMs) / 86_400_000);
    if (Number.isFinite(days) && days <= 30) {
      candidates.push({
        code: `FIEL_EXPIRING:${r.company_id}`, severity: days <= 0 ? 'critical' : 'warning', category: 'fiel_expiry',
        title: days <= 0 ? 'FIEL vencida' : 'FIEL próxima a vencer',
        message: days <= 0 ? `La e.firma de ${r.company_name} (${r.company_rfc}) venció hace ${Math.abs(days)} días.` : `La e.firma de ${r.company_name} (${r.company_rfc}) vence en ${days} días.`,
        targetType: 'company', targetId: r.company_id,
        metadata: { companyId: r.company_id, companyName: r.company_name, rfc: r.company_rfc, validTo: r.valid_to, daysRemaining: days }
      });
    }
  }

  const since24hIso = new Date(nowMs - 24 * 3_600_000).toISOString();
  const satAgg = db.query("SELECT COUNT(*) as total, SUM(CASE WHEN estado_solicitud = 'ERROR' OR COALESCE(codigo_estado_sat, '') NOT IN ('', '5000', '3') THEN 1 ELSE 0 END) as failed FROM sat_download_requests WHERE created_at >= ?")
    .get(since24hIso) as { total: number; failed: number | null } | null;
  const satTotal = Number(satAgg?.total ?? 0);
  const satFailed = Number(satAgg?.failed ?? 0);
  if (satTotal >= 3 && satFailed / satTotal > 0.2) {
    const pct = Math.round((satFailed / satTotal) * 100);
    candidates.push({
      code: 'SAT_ERROR_SPIKE', severity: 'critical', category: 'sat_error_spike', title: 'Pico de errores en descargas SAT',
      message: `${satFailed} de ${satTotal} solicitudes SAT en las últimas 24h fallaron (${pct}%).`,
      targetType: 'sat', targetId: null, metadata: { total24h: satTotal, failed24h: satFailed, errorRatePct: pct }
    });
  }

  const quotaRows = db.query("SELECT wq.workspace_id, wq.user_id, wq.plan_tier, wq.max_companies, (SELECT COUNT(*) FROM companies c WHERE c.user_id = wq.user_id) as companies_count FROM workspace_quotas wq WHERE wq.user_id IS NOT NULL AND wq.user_id != ''")
    .all() as Array<{ workspace_id: string; user_id: string; plan_tier: string; max_companies: number; companies_count: number }>;
  for (const q of quotaRows) {
    const count = Number(q.companies_count);
    const max = Number(q.max_companies);
    if (count >= max) {
      candidates.push({
        code: `QUOTA_LIMIT:${q.workspace_id}`, severity: 'warning', category: 'quota_limit', title: 'Límite de empresas alcanzado en workspace',
        message: `El workspace ${q.workspace_id} (${q.plan_tier}) alcanzó ${count}/${max} empresas permitidas.`,
        targetType: 'workspace', targetId: q.workspace_id, metadata: { workspaceId: q.workspace_id, userId: q.user_id, planTier: q.plan_tier, companiesCount: count, maxCompanies: max }
      });
    }
  }
  return candidates;
}

export function runAdminHealthScanRepo(actorEmail: string, actorUserId: string | null): { scannedAtIso: string; alertsCreated: number; openAlertsCount: number } {
  const nowMs = Date.now();
  const scannedAtIso = new Date(nowMs).toISOString();
  const candidates = collectHealthCandidates(nowMs);
  return db.transaction(() => {
    const activeRows = db.query("SELECT id, code, category FROM platform_alerts WHERE status IN ('open', 'acknowledged')").all() as Array<{ id: string; code: string; category: string }>;
    const activeByCode = new Map(activeRows.map((r) => [r.code, r]));
    const candidateCodes = new Set(candidates.map((c) => c.code));
    let alertsCreated = 0;

    for (const c of candidates) {
      const existing = activeByCode.get(c.code);
      if (existing) {
        db.prepare('UPDATE platform_alerts SET severity = ?, title = ?, message = ?, target_type = ?, target_id = ?, metadata_json = ? WHERE id = ?')
          .run(c.severity, c.title, c.message, c.targetType, c.targetId, JSON.stringify(c.metadata), existing.id);
      } else {
        db.prepare('INSERT INTO platform_alerts (id, code, severity, category, title, message, target_type, target_id, status, metadata_json, detected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(crypto.randomUUID(), c.code, c.severity, c.category, c.title, c.message, c.targetType, c.targetId, 'open', JSON.stringify(c.metadata), scannedAtIso);
        alertsCreated += 1;
      }
    }
    for (const row of activeRows) {
      if (!candidateCodes.has(row.code) && (row.category === 'fiel_expiry' || row.category === 'sat_error_spike' || row.category === 'quota_limit')) {
        db.prepare("UPDATE platform_alerts SET status = 'resolved', resolved_at = ?, resolved_by = ? WHERE id = ?").run(scannedAtIso, 'system:health_scan', row.id);
      }
    }
    const openAlertsCount = Number((db.query("SELECT COUNT(*) as c FROM platform_alerts WHERE status = 'open'").get() as { c: number } | null)?.c ?? 0);
    recordAdminAuditLogRepo({ actorUserId, actorEmail, action: 'RUN_HEALTH_SCAN', targetType: 'platform_alert', targetId: null, metadata: { alertsCreated, openAlertsCount } });
    return { scannedAtIso, alertsCreated, openAlertsCount };
  })();
}

export function updateAdminPlatformAlertStatusRepo(alertId: string, status: PlatformAlertStatus, actorEmail: string, actorUserId: string | null): AdminPlatformAlert {
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
