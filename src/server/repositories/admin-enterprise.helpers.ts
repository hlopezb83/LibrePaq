import { db } from '../connection';
import { isSuperAdminEmail, normalizePlatformRole } from '../../shared/superadmin';
import type {
  AdminCompanySummary,
  AdminPaginatedResponse,
  AdminPlatformAlert,
  PlatformAlertCategory,
  PlatformAlertSeverity,
  PlatformAlertStatus,
  PlatformRole,
  WorkspacePlanTier,
  WorkspaceQuota
} from '../../shared/admin-types';

export type AdminCompanySortBy = 'createdAt' | 'polizasCount' | 'cfdisCount';
export type AdminCompanySortDir = 'asc' | 'desc';

export interface QuotaDbRow {
  workspace_id: string;
  user_id: string | null;
  plan_tier: string;
  max_companies: number;
  max_cfdis_per_month: number;
  max_storage_mb: number;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface AlertDbRow {
  id: string;
  code: string;
  severity: string;
  category: string;
  title: string;
  message: string;
  target_type: string;
  target_id: string | null;
  status: string;
  metadata_json: string;
  detected_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

const VALID_PLAN_TIERS: ReadonlySet<WorkspacePlanTier> = new Set(['FREE', 'PRO', 'DESPACHO', 'ENTERPRISE']);

export function parseMetadataJson(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function paginateItems<T>(items: T[], page?: number, pageSize?: number): AdminPaginatedResponse<T> {
  const safePageSize = Math.max(1, Math.min(100, Math.floor(Number(pageSize) || 20)));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(Number(page) || 1)), totalPages);
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages
  };
}

export function tableExists(name: string): boolean {
  return Boolean(db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

export function tableColumns(name: string): Set<string> {
  if (!tableExists(name)) return new Set();
  const rows = db.query(`PRAGMA table_info(${name})`).all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

/**
 * Escapa comodines LIKE (\, %, _) para consultas SQLite con ESCAPE '\'.
 */
export function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Ordena empresas globalmente antes de aplicar paginación.
 */
export function sortAdminCompanies<T extends AdminCompanySummary>(
  items: T[],
  sortBy: AdminCompanySortBy = 'createdAt',
  sortDir: AdminCompanySortDir = 'desc'
): T[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    if (sortBy === 'polizasCount') {
      const diff = (a.polizasCount ?? 0) - (b.polizasCount ?? 0);
      if (diff !== 0) return diff * dir;
    } else if (sortBy === 'cfdisCount') {
      const diff = (a.cfdisCount ?? 0) - (b.cfdisCount ?? 0);
      if (diff !== 0) return diff * dir;
    } else {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (diff !== 0) return diff * dir;
    }
    return a.id.localeCompare(b.id) * dir;
  });
}

/**
 * Resuelve el PlatformRole efectivo de un invocador usando correo, user_profiles y admin_user_overrides.
 */
export function resolveCallerPlatformRoleRepo(userId: string, userEmail: string): PlatformRole {
  const email = userEmail.trim().toLowerCase();
  const uid = userId.trim();
  if (isSuperAdminEmail(email) || uid === 'usr_owner_hlopez') return 'SUPERADMIN';

  let profRole: string | null = null;
  let profSuper = false;
  let profEmail: string | null = email || null;
  let profStatus: string | null = null;

  const profileCols = tableColumns('user_profiles');
  if (profileCols.size > 0 && (uid || email)) {
    const selectCols = ['id'];
    if (profileCols.has('platform_role')) selectCols.push('platform_role');
    if (profileCols.has('is_superadmin')) selectCols.push('is_superadmin');
    if (profileCols.has('email')) selectCols.push('email');
    if (profileCols.has('status')) selectCols.push('status');

    let profRow: Record<string, unknown> | null = null;
    if (uid) {
      profRow = db.query(`SELECT ${selectCols.join(', ')} FROM user_profiles WHERE id = ?`).get(uid) as Record<string, unknown> | null;
    }
    if (!profRow && email && profileCols.has('email')) {
      profRow = db.query(`SELECT ${selectCols.join(', ')} FROM user_profiles WHERE lower(email) = ?`).get(email) as Record<string, unknown> | null;
    }
    if (profRow) {
      profRole = profRow.platform_role ? String(profRow.platform_role) : null;
      profSuper = Boolean(profRow.is_superadmin);
      if (profRow.email) profEmail = String(profRow.email);
      if (profRow.status) profStatus = String(profRow.status);
    }
  }

  let overrideRole: string | null = null;
  let overrideStatus: string | null = null;
  if (uid || email) {
    const ovRow = (uid
      ? db.query('SELECT platform_role, status FROM admin_user_overrides WHERE user_id = ?').get(uid)
      : db.query('SELECT platform_role, status FROM admin_user_overrides WHERE lower(user_id) = ?').get(email)) as {
      platform_role: string | null;
      status: string | null;
    } | null;
    overrideRole = ovRow?.platform_role ?? null;
    overrideStatus = ovRow?.status ?? null;
  }

  const effectiveStatus = String(overrideStatus || profStatus || '').toUpperCase();
  if (effectiveStatus === 'SUSPENDIDO' && !isSuperAdminEmail(profEmail)) {
    return 'NONE';
  }

  return normalizePlatformRole(profRole ?? overrideRole, profSuper, profEmail);
}

export function mapQuotaRow(row: QuotaDbRow): WorkspaceQuota {
  const planTier = VALID_PLAN_TIERS.has(row.plan_tier as WorkspacePlanTier) ? (row.plan_tier as WorkspacePlanTier) : 'FREE';
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id ?? null,
    planTier,
    maxCompanies: Number(row.max_companies),
    maxCfdisPerMonth: Number(row.max_cfdis_per_month),
    maxStorageMb: Number(row.max_storage_mb),
    notes: row.notes ?? null,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? null
  };
}

export function mapAlertRow(row: AlertDbRow): AdminPlatformAlert {
  const severity: PlatformAlertSeverity = row.severity === 'critical' || row.severity === 'warning' ? row.severity : 'info';
  const category: PlatformAlertCategory =
    row.category === 'fiel_expiry' || row.category === 'sat_error_spike' || row.category === 'quota_limit' ? row.category : 'system';
  const status: PlatformAlertStatus = row.status === 'acknowledged' || row.status === 'resolved' ? row.status : 'open';
  return {
    id: row.id,
    code: row.code,
    severity,
    category,
    title: row.title,
    message: row.message,
    targetType: row.target_type,
    targetId: row.target_id,
    status,
    metadata: parseMetadataJson(row.metadata_json),
    detectedAt: row.detected_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by
  };
}

export interface AlertCandidate {
  code: string;
  severity: PlatformAlertSeverity;
  category: PlatformAlertCategory;
  title: string;
  message: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
}

export const alertDedupKey = (code: string, targetType: string, targetId: string | null): string =>
  `${code}::${targetType}::${targetId ?? ''}`;

/**
 * Recolecta candidatos de alertas automáticas (FIEL, errores SAT 24h y cuotas de workspace).
 */
export function collectHealthCandidates(nowMs: number): AlertCandidate[] {
  const candidates: AlertCandidate[] = [];
  const fielRows = db
    .query('SELECT f.company_id, c.name as company_name, c.rfc as company_rfc, f.valid_to FROM fiel_credentials f INNER JOIN companies c ON c.id = f.company_id')
    .all() as Array<{ company_id: string; company_name: string; company_rfc: string; valid_to: string }>;
  for (const r of fielRows) {
    const days = Math.ceil((new Date(r.valid_to).getTime() - nowMs) / 86_400_000);
    if (Number.isFinite(days) && days <= 30) {
      candidates.push({
        code: days <= 0 ? 'FIEL_EXPIRED' : 'FIEL_EXPIRY_SOON',
        severity: days <= 0 ? 'critical' : 'warning',
        category: 'fiel_expiry',
        title: days < 0 ? 'e.firma vencida' : 'e.firma próxima a vencer',
        message:
          days <= 0
            ? `La e.firma de ${r.company_name} (${r.company_rfc}) venció hace ${Math.abs(days)} días.`
            : `La e.firma de ${r.company_name} (${r.company_rfc}) vence en ${days} días.`,
        targetType: 'company',
        targetId: r.company_id,
        metadata: { companyId: r.company_id, companyName: r.company_name, rfc: r.company_rfc, validTo: r.valid_to, daysRemaining: days }
      });
    }
  }

  const since24hIso = new Date(nowMs - 24 * 3_600_000).toISOString();
  const satAgg = db
    .query("SELECT COUNT(*) as total, SUM(CASE WHEN estado_solicitud = 'ERROR' OR COALESCE(codigo_estado_sat, '') NOT IN ('', '5000', '3') THEN 1 ELSE 0 END) as failed FROM sat_download_requests WHERE created_at >= ?")
    .get(since24hIso) as { total: number; failed: number | null } | null;
  const satTotal = Number(satAgg?.total ?? 0);
  const satFailed = Number(satAgg?.failed ?? 0);
  if (satTotal >= 3 && satFailed / satTotal > 0.2) {
    const pct = Math.round((satFailed / satTotal) * 100);
    candidates.push({
      code: 'SAT_ERROR_SPIKE_24H',
      severity: 'critical',
      category: 'sat_error_spike',
      title: 'Pico de errores en descargas SAT (24h)',
      message: `${satFailed} de ${satTotal} solicitudes SAT en las últimas 24h fallaron (${pct}%).`,
      targetType: 'platform',
      targetId: 'sat_soap',
      metadata: { total24h: satTotal, failed24h: satFailed, errorRatePct: pct }
    });
  }

  const hasProfileWs = tableColumns('user_profiles').has('workspace_id');
  const wsFilter = hasProfileWs
    ? '((wq.user_id IS NOT NULL AND c.user_id = wq.user_id) OR c.user_id IN (SELECT up.id FROM user_profiles up WHERE up.workspace_id = wq.workspace_id))'
    : "(wq.user_id IS NOT NULL AND wq.user_id != '' AND c.user_id = wq.user_id)";
  const quotaRows = db
    .query(
      `SELECT wq.workspace_id, wq.user_id, wq.plan_tier, wq.max_companies,
        (SELECT COUNT(*) FROM companies c WHERE upper(c.rfc) != 'CEJ2106158A0' AND upper(c.name) NOT LIKE '[DEMO]%' AND ${wsFilter}) as companies_count
       FROM workspace_quotas wq WHERE wq.max_companies > 0`
    )
    .all() as Array<{ workspace_id: string; user_id: string | null; plan_tier: string; max_companies: number; companies_count: number }>;
  for (const q of quotaRows) {
    const count = Number(q.companies_count);
    const max = Number(q.max_companies);
    if (count >= max) {
      candidates.push({
        code: 'WORKSPACE_QUOTA_REACHED',
        severity: count > max ? 'critical' : 'warning',
        category: 'quota_limit',
        title: `Límite de empresas alcanzado en workspace ${q.workspace_id}`,
        message: `El workspace ${q.workspace_id} (${q.plan_tier}) alcanzó ${count}/${max} empresas permitidas.`,
        targetType: 'workspace',
        targetId: q.workspace_id,
        metadata: { workspaceId: q.workspace_id, userId: q.user_id, planTier: q.plan_tier, companiesCount: count, maxCompanies: max }
      });
    }
  }
  return candidates;
}
