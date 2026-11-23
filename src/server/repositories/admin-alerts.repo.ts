import { db } from '../connection';
import type { AdminPlatformAlert, PlatformAlertStatus } from '../../shared/admin-types';
import { recordAdminAuditLogRepo } from './admin-ops.repo';
import {
  alertDedupKey,
  collectHealthCandidates,
  mapAlertRow,
  type AlertDbRow
} from './admin-enterprise.helpers';

/**
 * Obtiene las alertas de plataforma filtradas opcionalmente por estatus.
 */
export function getAdminPlatformAlertsRepo(statusFilter?: 'ALL' | PlatformAlertStatus): AdminPlatformAlert[] {
  const rows =
    statusFilter && statusFilter !== 'ALL'
      ? (db.query('SELECT * FROM platform_alerts WHERE status = ? ORDER BY detected_at DESC').all(statusFilter) as AlertDbRow[])
      : (db.query('SELECT * FROM platform_alerts ORDER BY detected_at DESC').all() as AlertDbRow[]);
  return rows.map(mapAlertRow);
}

/**
 * Ejecuta el escaneo de salud de plataforma, deduplicando alertas activas y autoresolviendo las subsanadas.
 */
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

/**
 * Actualiza el estatus de una alerta de plataforma y registra el cambio en auditoría.
 */
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
