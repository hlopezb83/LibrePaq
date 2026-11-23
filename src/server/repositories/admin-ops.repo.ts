import { db } from '../connection';
import { isSuperAdminEmail, normalizePlatformRole } from '../../shared/superadmin';
import type { AdminAuditLogEntry, AdminBroadcastMessage } from '../../shared/admin-types';
import { parseMetadataJson, tableColumns } from './admin-enterprise.helpers';
import { getAdminUsersRepo } from './admin.repo';

interface BroadcastDbRow {
  id: string; title: string; message: string; type: string; active: number;
  starts_at: string | null; expires_at: string | null; created_by: string | null;
  created_at: string; updated_at: string;
}

interface AuditLogDbRow {
  id: string; actor_user_id: string | null; actor_email: string; action: string;
  target_type: string; target_id: string | null; metadata_json: string; created_at: string;
}

export interface SaveBroadcastInput {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success';
  startsAt?: string | null;
  expiresAt?: string | null;
}

export interface RecordAuditLogInput {
  actorUserId?: string | null;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

function mapBroadcastRow(row: BroadcastDbRow): AdminBroadcastMessage {
  const type: AdminBroadcastMessage['type'] =
    row.type === 'warning' || row.type === 'success' ? row.type : 'info';
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type,
    active: Boolean(row.active),
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function recordAdminAuditLogRepo(input: RecordAuditLogInput): AdminAuditLogEntry {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const metadata = input.metadata ?? {};
  const actorUserId = input.actorUserId ?? null;
  const targetId = input.targetId ?? null;

  db.prepare(
    'INSERT INTO admin_audit_logs (id, actor_user_id, actor_email, action, target_type, target_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, actorUserId, input.actorEmail, input.action, input.targetType, targetId, JSON.stringify(metadata), createdAt);

  return { id, actorUserId, actorEmail: input.actorEmail, action: input.action, targetType: input.targetType, targetId, metadata, createdAt };
}

export function getAdminAuditLogsRepo(limit = 100): AdminAuditLogEntry[] {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit || 100)));
  const rows = db
    .query('SELECT id, actor_user_id, actor_email, action, target_type, target_id, metadata_json, created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT ?')
    .all(safeLimit) as AuditLogDbRow[];

  return rows.map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: parseMetadataJson(row.metadata_json),
    createdAt: row.created_at
  }));
}

export function getActiveBroadcastRepo(): AdminBroadcastMessage | null {
  const rows = db
    .query('SELECT * FROM platform_broadcasts WHERE active = 1 ORDER BY created_at DESC LIMIT 20')
    .all() as BroadcastDbRow[];

  const nowMs = Date.now();
  for (const row of rows) {
    if (row.starts_at) {
      const startMs = new Date(row.starts_at).getTime();
      if (Number.isNaN(startMs) || startMs > nowMs) continue;
    }
    if (row.expires_at) {
      const expMs = new Date(row.expires_at).getTime();
      if (Number.isNaN(expMs) || expMs <= nowMs) continue;
    }
    return mapBroadcastRow(row);
  }
  return null;
}

export function saveBroadcastRepo(
  input: SaveBroadcastInput,
  actorEmail: string,
  actorUserId?: string | null
): AdminBroadcastMessage {
  return db.transaction(() => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const type = input.type ?? 'info';
    const startsAt = input.startsAt ?? null;
    const expiresAt = input.expiresAt ?? null;

    db.prepare('UPDATE platform_broadcasts SET active = 0, updated_at = ? WHERE active = 1').run(now);
    db.prepare(
      'INSERT INTO platform_broadcasts (id, title, message, type, active, starts_at, expires_at, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)'
    ).run(id, input.title.trim(), input.message.trim(), type, startsAt, expiresAt, actorEmail, now, now);

    recordAdminAuditLogRepo({
      actorUserId,
      actorEmail,
      action: 'PUBLISH_BROADCAST',
      targetType: 'broadcast',
      targetId: id,
      metadata: { title: input.title.trim(), type, expiresAt }
    });

    const created = db.query('SELECT * FROM platform_broadcasts WHERE id = ?').get(id) as BroadcastDbRow;
    return mapBroadcastRow(created);
  })();
}

export function clearBroadcastRepo(
  actorEmail: string,
  actorUserId?: string | null
): { cleared: boolean; clearedCount: number } {
  return db.transaction(() => {
    const now = new Date().toISOString();
    const result = db.prepare('UPDATE platform_broadcasts SET active = 0, updated_at = ? WHERE active = 1').run(now);
    recordAdminAuditLogRepo({
      actorUserId,
      actorEmail,
      action: 'CLEAR_BROADCAST',
      targetType: 'broadcast',
      targetId: null,
      metadata: { clearedCount: result.changes }
    });
    return { cleared: result.changes > 0, clearedCount: result.changes };
  })();
}

function isTargetSuperAdmin(userId: string): boolean {
  const trimmed = userId.trim();
  if (trimmed === 'usr_owner_hlopez' || isSuperAdminEmail(trimmed)) return true;

  const ovRow = db
    .query('SELECT platform_role FROM admin_user_overrides WHERE user_id = ?')
    .get(trimmed) as { platform_role: string | null } | null;
  if (normalizePlatformRole(ovRow?.platform_role, false, null) === 'SUPERADMIN') return true;

  const profileCols = tableColumns('user_profiles');
  if (profileCols.size > 0) {
    const selectCols = ['id'];
    if (profileCols.has('platform_role')) selectCols.push('platform_role');
    if (profileCols.has('is_superadmin')) selectCols.push('is_superadmin');
    if (profileCols.has('email')) selectCols.push('email');
    const prof = db.query(`SELECT ${selectCols.join(', ')} FROM user_profiles WHERE id = ?`).get(trimmed) as Record<
      string,
      unknown
    > | null;
    if (prof) {
      const role = normalizePlatformRole(
        prof.platform_role ? String(prof.platform_role) : null,
        Boolean(prof.is_superadmin),
        prof.email ? String(prof.email) : null
      );
      if (role === 'SUPERADMIN') return true;
    }
  }

  const repoUser = getAdminUsersRepo().find((u) => u.id === trimmed);
  if (repoUser && (repoUser.isSuperAdmin || normalizePlatformRole(repoUser.platformRole, repoUser.isSuperAdmin, repoUser.email) === 'SUPERADMIN')) {
    return true;
  }
  return false;
}

export function adminUserExistsRepo(userId: string): boolean {
  const trimmed = userId.trim();
  if (!trimmed) return false;
  if (getAdminUsersRepo().some((u) => u.id === trimmed)) return true;
  if (db.query('SELECT 1 FROM admin_user_overrides WHERE user_id = ?').get(trimmed)) return true;
  if (tableColumns('user_profiles').size > 0 && db.query('SELECT 1 FROM user_profiles WHERE id = ?').get(trimmed)) {
    return true;
  }
  return false;
}

export function setAdminUserStatusRepo(
  userId: string,
  status: 'ACTIVO' | 'SUSPENDIDO',
  actorEmail: string,
  actorUserId?: string | null,
  reason?: string
): { userId: string; status: 'ACTIVO' | 'SUSPENDIDO'; updatedAt: string } {
  if (status === 'SUSPENDIDO' && isTargetSuperAdmin(userId)) {
    throw new Error('No es posible suspender una cuenta SuperAdmin');
  }

  return db.transaction(() => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO admin_user_overrides (user_id, status, updated_at, updated_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at, updated_by = excluded.updated_by
    `).run(userId, status, now, actorEmail);

    recordAdminAuditLogRepo({
      actorUserId,
      actorEmail,
      action: 'SET_USER_STATUS',
      targetType: 'user',
      targetId: userId,
      metadata: { status, reason: reason?.trim() || '' }
    });

    return { userId, status, updatedAt: now };
  })();
}

export function deleteAdminCompanyRepo(
  companyId: string,
  actorEmail: string,
  actorUserId?: string | null
): { deleted: boolean; companyId: string; companyName?: string } {
  const existing = db.query('SELECT id, name, rfc FROM companies WHERE id = ?').get(companyId) as {
    id: string; name: string; rfc: string;
  } | null;
  if (!existing) return { deleted: false, companyId };

  return db.transaction(() => {
    const res = db.prepare('DELETE FROM companies WHERE id = ?').run(companyId);
    if (res.changes > 0) {
      db.prepare(
        "UPDATE platform_alerts SET status = 'resolved', resolved_at = ?, resolved_by = 'system_company_deleted' WHERE target_type = 'company' AND target_id = ? AND status IN ('open', 'acknowledged')"
      ).run(new Date().toISOString(), companyId);
      recordAdminAuditLogRepo({
        actorUserId,
        actorEmail,
        action: 'DELETE_COMPANY',
        targetType: 'company',
        targetId: companyId,
        metadata: { companyName: existing.name, rfc: existing.rfc }
      });
    }
    return { deleted: res.changes > 0, companyId, companyName: existing.name };
  })();
}
