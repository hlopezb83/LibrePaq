import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { db, initDatabase } from '../db';
import { ensureBaseTables } from '../db-ddl';
import { adminRoutes } from '../routes/admin.routes';
import type {
  AdminAuditLogEntry,
  AdminCompanySummary,
  AdminPaginatedResponse,
  AdminPlatformAlert,
  AdminUserSummary,
  WorkspaceQuota
} from '../../shared/admin-types';

const SUFFIX = crypto.randomUUID().slice(0, 8);
const TEST_USER_ID = `usr_p5_${SUFFIX}`;
const TEST_WS_ID = `ws_p5_${SUFFIX}`;
const TEST_COMP_FIEL = `comp_p5_fiel_${SUFFIX}`;
const TEST_COMP_NOFIEL = `comp_p5_nofiel_${SUFFIX}`;
const TEST_SAT_IDS = [`sat_p5_1_${SUFFIX}`, `sat_p5_2_${SUFFIX}`, `sat_p5_3_${SUFFIX}`];
const SUPER_HEADERS = { 'X-User-Email': 'hlopezb@gmail.com', 'X-User-Id': 'usr_owner_hlopez' };
const JSON_HEADERS = { ...SUPER_HEADERS, 'Content-Type': 'application/json' };

async function reqJson<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await adminRoutes.request(path, init);
  return { status: res.status, body: (await res.json()) as T };
}

describe('Phase 5 SuperAdmin Enterprise Suite', () => {
  beforeAll(() => {
    initDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO companies (id, name, rfc, regimen_fiscal, codigo_postal, mask_format, current_year, current_period, created_at, user_id)
      VALUES (?, ?, ?, '601', '64000', 'XXX-XX-XXX', 2026, 11, ?, ?)
    `).run(TEST_COMP_FIEL, `P5 Empresa FIEL ${SUFFIX}`, `P5F${SUFFIX.slice(0, 3).toUpperCase()}0101AA1`, now, TEST_USER_ID);
    db.prepare(`
      INSERT INTO companies (id, name, rfc, regimen_fiscal, codigo_postal, mask_format, current_year, current_period, created_at, user_id)
      VALUES (?, ?, ?, '601', '64000', 'XXX-XX-XXX', 2026, 11, ?, ?)
    `).run(TEST_COMP_NOFIEL, `P5 Empresa SinFIEL ${SUFFIX}`, `P5N${SUFFIX.slice(0, 3).toUpperCase()}0101BB2`, now, TEST_USER_ID);
  });

  afterAll(() => {
    db.prepare('DELETE FROM fiel_credentials WHERE company_id IN (?, ?)').run(TEST_COMP_FIEL, TEST_COMP_NOFIEL);
    for (const sid of TEST_SAT_IDS) db.prepare('DELETE FROM sat_download_requests WHERE id = ?').run(sid);
    db.prepare('DELETE FROM companies WHERE id IN (?, ?)').run(TEST_COMP_FIEL, TEST_COMP_NOFIEL);
    db.prepare('DELETE FROM workspace_quotas WHERE workspace_id = ?').run(TEST_WS_ID);
    db.prepare('DELETE FROM platform_alerts WHERE target_id IN (?, ?, ?) OR code = ?').run(TEST_COMP_FIEL, TEST_COMP_NOFIEL, TEST_WS_ID, 'SAT_ERROR_SPIKE');
    db.prepare('DELETE FROM admin_user_overrides WHERE user_id = ?').run(TEST_USER_ID);
    db.prepare("DELETE FROM admin_audit_logs WHERE target_id IN (?, ?, ?) OR action IN ('RUN_HEALTH_SCAN', 'RESOLVE_PLATFORM_ALERT')").run(
      TEST_USER_ID, TEST_WS_ID, TEST_COMP_FIEL
    );
  });

  test('1. DDL idempotente crea tablas enterprise y migra user_profiles.platform_role', () => {
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('workspace_quotas', 'platform_alerts')").all() as Array<{ name: string }>;
    expect(tables.length).toBe(2);

    const mem = new Database(':memory:');
    mem.exec('CREATE TABLE user_profiles (id TEXT PRIMARY KEY, email TEXT, is_superadmin INTEGER DEFAULT 0);');
    mem.exec("INSERT INTO user_profiles (id, email, is_superadmin) VALUES ('u1', 'hlopezb@gmail.com', 0), ('u2', 'otro@despacho.mx', 1), ('u3', 'normal@despacho.mx', 0);");
    ensureBaseTables(mem);
    ensureBaseTables(mem);

    const cols = mem.query('PRAGMA table_info(user_profiles)').all() as Array<{ name: string }>;
    expect(cols.some((c) => c.name === 'platform_role')).toBe(true);
    const rows = mem.query('SELECT id, platform_role FROM user_profiles ORDER BY id').all() as Array<{ id: string; platform_role: string }>;
    expect(rows).toEqual([
      { id: 'u1', platform_role: 'SUPERADMIN' },
      { id: 'u2', platform_role: 'SUPERADMIN' },
      { id: 'u3', platform_role: 'NONE' }
    ]);
    mem.close();
  });

  test('2. GET /admin/companies/paginated pagina y filtra por search, ownerType y fielFilter', async () => {
    const expIso = new Date(Date.now() + 10 * 86_400_000).toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO fiel_credentials (company_id, rfc_titular, nombre_titular, numero_serie, valid_from, valid_to, sha1_fingerprint, cer_base64, key_base64, private_key_pem, updated_at)
      VALUES (?, 'P5F010101AA1', 'Titular P5', '00001000000501', '2025-01-01T00:00:00Z', ?, 'abc', 'cer', 'key', 'pem', ?)
    `).run(TEST_COMP_FIEL, expIso, new Date().toISOString());

    const withFiel = await reqJson<AdminPaginatedResponse<AdminCompanySummary>>(
      `/admin/companies/paginated?search=${encodeURIComponent(SUFFIX)}&ownerType=user&fielFilter=WITH_FIEL&page=1&pageSize=1`,
      { headers: SUPER_HEADERS }
    );
    expect(withFiel.status).toBe(200);
    expect(withFiel.body.total).toBe(1);
    expect(withFiel.body.items[0]?.id).toBe(TEST_COMP_FIEL);

    const withoutFiel = await reqJson<AdminPaginatedResponse<AdminCompanySummary>>(
      `/admin/companies/paginated?search=${encodeURIComponent(SUFFIX)}&fielFilter=WITHOUT_FIEL&page=1&pageSize=5`,
      { headers: SUPER_HEADERS }
    );
    expect(withoutFiel.status).toBe(200);
    expect(withoutFiel.body.items.some((c) => c.id === TEST_COMP_NOFIEL)).toBe(true);

    const invalid = await reqJson<{ error: string }>('/admin/companies/paginated?fielFilter=BAD', { headers: SUPER_HEADERS });
    expect(invalid.status).toBe(400);
  });

  test('3. GET /admin/users/paginated y PATCH /admin/users/:id/role gestionan roles y bloquean auto-degradación', async () => {
    const selfDemote = await reqJson<{ error: string }>('/admin/users/usr_owner_hlopez/role', {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ platformRole: 'NONE' })
    });
    expect(selfDemote.status).toBe(403);
    expect(selfDemote.body.error).toContain('No puedes degradar tu propio rol SuperAdmin');

    const notFound = await reqJson<{ error: string }>('/admin/users/usr_inexistente_999/role', {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ platformRole: 'BILLING_OPS' })
    });
    expect(notFound.status).toBe(404);

    const updated = await reqJson<{ userId: string; platformRole: string }>(`/admin/users/${TEST_USER_ID}/role`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ platformRole: 'BILLING_OPS' })
    });
    expect(updated.status).toBe(200);
    expect(updated.body.platformRole).toBe('BILLING_OPS');

    const usersRes = await reqJson<AdminPaginatedResponse<AdminUserSummary>>(
      `/admin/users/paginated?search=${encodeURIComponent(TEST_USER_ID)}&role=BILLING_OPS&status=ACTIVO`,
      { headers: SUPER_HEADERS }
    );
    expect(usersRes.status).toBe(200);
    expect(usersRes.body.total).toBe(1);
    expect(usersRes.body.items[0]?.platformRole).toBe('BILLING_OPS');

    const ownerRes = await reqJson<AdminPaginatedResponse<AdminUserSummary>>(
      '/admin/users/paginated?search=hlopezb&role=SUPERADMIN',
      { headers: SUPER_HEADERS }
    );
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.items[0]?.platformRole).toBe('SUPERADMIN');
  });

  test('4. GET /admin/audit-logs/paginated filtra por action, targetType y search', async () => {
    const logsRes = await reqJson<AdminPaginatedResponse<AdminAuditLogEntry>>(
      `/admin/audit-logs/paginated?action=SET_USER_ROLE&targetType=user&search=${encodeURIComponent(TEST_USER_ID)}&page=1&pageSize=10`,
      { headers: SUPER_HEADERS }
    );
    expect(logsRes.status).toBe(200);
    expect(logsRes.body.total).toBeGreaterThanOrEqual(1);
    expect(logsRes.body.items[0]?.action).toBe('SET_USER_ROLE');
    expect(logsRes.body.items[0]?.targetId).toBe(TEST_USER_ID);
  });

  test('5. GET/PUT /admin/workspaces/:workspaceId/quota retorna defaults, persiste cambios y audita', async () => {
    const defRes = await reqJson<WorkspaceQuota>(`/admin/workspaces/${TEST_WS_ID}/quota`, { headers: SUPER_HEADERS });
    expect(defRes.status).toBe(200);
    expect(defRes.body.planTier).toBe('FREE');
    expect(defRes.body.maxCompanies).toBe(3);

    const badPut = await reqJson<{ error: string }>(`/admin/workspaces/${TEST_WS_ID}/quota`, {
      method: 'PUT', headers: JSON_HEADERS,
      body: JSON.stringify({ planTier: 'PRO', maxCompanies: 0, maxCfdisPerMonth: 1000, maxStorageMb: 500 })
    });
    expect(badPut.status).toBe(400);

    const putRes = await reqJson<WorkspaceQuota>(`/admin/workspaces/${TEST_WS_ID}/quota`, {
      method: 'PUT', headers: JSON_HEADERS,
      body: JSON.stringify({ userId: TEST_USER_ID, planTier: 'DESPACHO', maxCompanies: 2, maxCfdisPerMonth: 5000, maxStorageMb: 2048, notes: 'Plan P5' })
    });
    expect(putRes.status).toBe(200);
    expect(putRes.body.planTier).toBe('DESPACHO');
    expect(putRes.body.maxCompanies).toBe(2);
    expect(putRes.body.userId).toBe(TEST_USER_ID);

    const afterGet = await reqJson<WorkspaceQuota>(`/admin/workspaces/${TEST_WS_ID}/quota`, { headers: SUPER_HEADERS });
    expect(afterGet.status).toBe(200);
    expect(afterGet.body.maxCfdisPerMonth).toBe(5000);
  });

  test('6. POST /admin/alerts/scan, GET /admin/alerts y PATCH /admin/alerts/:id/status detectan, deduplican y autoresuelven', async () => {
    const nowIso = new Date().toISOString();
    const insSat = db.prepare(`
      INSERT INTO sat_download_requests (
        id, company_id, id_solicitud_sat, tipo_solicitud, fecha_inicial, fecha_final,
        estado_solicitud, codigo_estado_sat, mensaje_sat, id_paquete_sat, cfdis_descargados,
        modo_ejecucion, soap_request_xml, soap_response_xml, created_at
      ) VALUES (?, ?, ?, 'RECIBIDOS', '2026-11-01', '2026-11-10', ?, ?, 'Test P5', NULL, 0, 'SANDBOX_CRYPTO', '<r/>', '<s/>', ?)
    `);
    insSat.run(TEST_SAT_IDS[0]!, TEST_COMP_FIEL, `S1_${SUFFIX}`, 'ERROR', '5004', nowIso);
    insSat.run(TEST_SAT_IDS[1]!, TEST_COMP_FIEL, `S2_${SUFFIX}`, 'ERROR', '5004', nowIso);
    insSat.run(TEST_SAT_IDS[2]!, TEST_COMP_FIEL, `S3_${SUFFIX}`, 'TERMINADA', '5000', nowIso);

    const scan1 = await reqJson<{ scannedAtIso: string; alertsCreated: number; openAlertsCount: number }>('/admin/alerts/scan', {
      method: 'POST', headers: SUPER_HEADERS
    });
    expect(scan1.status).toBe(200);
    expect(scan1.body.alertsCreated).toBeGreaterThanOrEqual(3);
    expect(scan1.body.openAlertsCount).toBeGreaterThanOrEqual(3);

    const scan2 = await reqJson<{ alertsCreated: number }>('/admin/alerts/scan', { method: 'POST', headers: SUPER_HEADERS });
    expect(scan2.status).toBe(200);
    expect(scan2.body.alertsCreated).toBe(0);

    const openAlerts = await reqJson<AdminPlatformAlert[]>('/admin/alerts?status=open', { headers: SUPER_HEADERS });
    expect(openAlerts.status).toBe(200);
    const fielAlert = openAlerts.body.find((a) => a.code === `FIEL_EXPIRING:${TEST_COMP_FIEL}`);
    const quotaAlert = openAlerts.body.find((a) => a.code === `QUOTA_LIMIT:${TEST_WS_ID}`);
    const satAlert = openAlerts.body.find((a) => a.code === 'SAT_ERROR_SPIKE');
    expect(fielAlert?.severity).toBe('warning');
    expect(quotaAlert?.severity).toBe('warning');
    expect(satAlert?.severity).toBe('critical');

    const ackRes = await reqJson<AdminPlatformAlert>(`/admin/alerts/${fielAlert!.id}/status`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ status: 'acknowledged' })
    });
    expect(ackRes.status).toBe(200);
    expect(ackRes.body.status).toBe('acknowledged');

    const resRes = await reqJson<AdminPlatformAlert>(`/admin/alerts/${fielAlert!.id}/status`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ status: 'resolved' })
    });
    expect(resRes.status).toBe(200);
    expect(resRes.body.status).toBe('resolved');
    expect(resRes.body.resolvedBy).toBe('hlopezb@gmail.com');

    // Limpiar condiciones de prueba y verificar autoresolución
    db.prepare('DELETE FROM fiel_credentials WHERE company_id = ?').run(TEST_COMP_FIEL);
    for (const sid of TEST_SAT_IDS) db.prepare('DELETE FROM sat_download_requests WHERE id = ?').run(sid);
    db.prepare('UPDATE workspace_quotas SET max_companies = 10 WHERE workspace_id = ?').run(TEST_WS_ID);

    await reqJson('/admin/alerts/scan', { method: 'POST', headers: SUPER_HEADERS });
    const resolvedList = await reqJson<AdminPlatformAlert[]>('/admin/alerts?status=resolved', { headers: SUPER_HEADERS });
    expect(resolvedList.body.some((a) => a.code === `QUOTA_LIMIT:${TEST_WS_ID}` && a.status === 'resolved')).toBe(true);
    expect(resolvedList.body.some((a) => a.code === 'SAT_ERROR_SPIKE' && a.status === 'resolved')).toBe(true);
  });
});
