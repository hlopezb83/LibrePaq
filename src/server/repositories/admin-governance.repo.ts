import { db } from '../connection';
import { isSuperAdminEmail } from '../../shared/superadmin';
import type { PlatformRole, WorkspaceQuota, WorkspaceQuotaPayload } from '../../shared/admin-types';
import { getAdminUsersRepo } from './admin.repo';
import { recordAdminAuditLogRepo } from './admin-ops.repo';
import { mapQuotaRow, tableColumns, type QuotaDbRow } from './admin-enterprise.helpers';

/**
 * Actualiza el rol de plataforma de un usuario protegiendo cuentas SuperAdmin contra auto-degradación.
 */
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
      if (platformRole !== 'SUPERADMIN' && profileCols.has('email')) {
        const targetProf = db.query('SELECT email FROM user_profiles WHERE id = ?').get(userId) as { email?: string | null } | null;
        if (targetProf?.email && isSuperAdminEmail(targetProf.email)) {
          throw new Error('No puedes degradar una cuenta SuperAdmin principal');
        }
      }
      const res = profileCols.has('is_superadmin')
        ? db.prepare('UPDATE user_profiles SET platform_role = ?, is_superadmin = ? WHERE id = ?').run(platformRole, platformRole === 'SUPERADMIN' ? 1 : 0, userId)
        : db.prepare('UPDATE user_profiles SET platform_role = ? WHERE id = ?').run(platformRole, userId);
      updatedProfile = res.changes > 0;
    }
    if (!updatedProfile) {
      const repoUser = getAdminUsersRepo().find((u) => u.id === userId);
      if (!repoUser) throw new Error('Usuario no encontrado.');
      if (platformRole !== 'SUPERADMIN' && isSuperAdminEmail(repoUser.email)) {
        throw new Error('No puedes degradar una cuenta SuperAdmin principal');
      }
      db.prepare(`
        INSERT INTO admin_user_overrides (user_id, status, platform_role, updated_at, updated_by) VALUES (?, 'ACTIVO', ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET platform_role = excluded.platform_role, updated_at = excluded.updated_at, updated_by = excluded.updated_by
      `).run(userId, platformRole, new Date().toISOString(), actorEmail);
    }
    recordAdminAuditLogRepo({ actorUserId, actorEmail, action: 'SET_USER_ROLE', targetType: 'user', targetId: userId, metadata: { platformRole } });
    return { userId, platformRole };
  })();
}

/**
 * Obtiene la cuota configurada de un workspace o sus límites FREE por defecto.
 */
export function getWorkspaceQuotaRepo(workspaceId: string): WorkspaceQuota {
  const row = db
    .query('SELECT workspace_id, user_id, plan_tier, max_companies, max_cfdis_per_month, max_storage_mb, notes, updated_at, updated_by FROM workspace_quotas WHERE workspace_id = ?')
    .get(workspaceId) as QuotaDbRow | null;
  return row ? mapQuotaRow(row) : { workspaceId, userId: null, planTier: 'FREE', maxCompanies: 3, maxCfdisPerMonth: 500, maxStorageMb: 250, notes: null, updatedAt: new Date().toISOString(), updatedBy: null };
}

/**
 * Crea o actualiza la cuota de un workspace y registra el evento en la bitácora de auditoría.
 */
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
