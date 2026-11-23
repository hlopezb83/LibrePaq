import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { db, initDatabase } from '../db';
import { adminRoutes } from '../routes/admin.routes';
import { getAdminCompaniesRepo, getAdminSatHealthRepo } from '../repositories/admin.repo';
import { setAdminUserStatusRepo, recordAdminAuditLogRepo } from '../repositories/admin-ops.repo';
import { isReadOnlyBlockedMethod } from '../../lib/support-impersonation';
import { adminApi } from '../../lib/api/admin.api';
import type {
  AdminAuditLogEntry,
  AdminCompanySummary,
  AdminPaginatedResponse,
  AdminPlatformAlert
} from '../../shared/admin-types';

const SUFFIX = crypto.randomUUID().slice(0, 8);
const SUPPORT_ID = `usr_sup_${SUFFIX}`;
const BILLING_ID = `usr_bil_${SUFFIX}`;
const PROMOTED_SUPER_ID = `usr_psup_${SUFFIX}`;
const REGULAR_ID = `usr_reg_${SUFFIX}`;
const WS_ID = `ws_bug_${SUFFIX}`;
const COMP_LOW = `comp_low_${SUFFIX}`;
const COMP_HIGH = `comp_high_${SUFFIX}`;
const COMP_DEMO = `comp_demo_${SUFFIX}`;
const COMP_DEL = `comp_del_${SUFFIX}`;
const SAT_IDS = [`sat_b1_${SUFFIX}`, `sat_b2_${SUFFIX}`, `sat_b3_${SUFFIX}`];

const SUPER_HEADERS = { 'X-User-Email': 'hlopezb@gmail.com', 'X-User-Id': 'usr_owner_hlopez' };
const jsonReq = (headers: Record<string, string>, method: string, body?: unknown): RequestInit => ({
  method,
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: body !== undefined ? JSON.stringify(body) : undefined
});

async function reqJson<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await adminRoutes.request(path, init);
  return { status: res.status, body: (await res.json()) as T };
}

describe('Admin Audit Bugs Regression Suite', () => {
  beforeAll(() => {
    initDatabase();
    const now = new Date().toISOString();
    const earlier = new Date(Date.now() - 60_000).toISOString();

    db.prepare(`
      INSERT INTO admin_user_overrides (user_id, status, platform_role, updated_at, updated_by)
      VALUES (?, 'ACTIVO', 'SUPPORT_READONLY', ?, 'test'),
             (?, 'ACTIVO', 'BILLING_OPS', ?, 'test'),
             (?, 'ACTIVO', 'SUPERADMIN', ?, 'test'),
             (?, 'ACTIVO', 'NONE', ?, 'test')
    `).run(SUPPORT_ID, now, BILLING_ID, now, PROMOTED_SUPER_ID, now, REGULAR_ID, now);

    const insComp = db.prepare(`
      INSERT INTO companies (id, name, rfc, regimen_fiscal, codigo_postal, mask_format, current_year, current_period, created_at, user_id)
      VALUES (?, ?, ?, '601', '64000', 'XXX-XX-XXX', 2026, 11, ?, ?)
    `);
    insComp.run(COMP_LOW, `BugSort Low ${SUFFIX}`, `BSL${SUFFIX.slice(0, 3).toUpperCase()}0101AA1`, now, REGULAR_ID);
    insComp.run(COMP_HIGH, `BugSort High ${SUFFIX}`, `BSH${SUFFIX.slice(0, 3).toUpperCase()}0101BB2`, earlier, REGULAR_ID);
    insComp.run(COMP_DEMO, `[DEMO] Empresa Demo ${SUFFIX}`, 'CEJ2106158A0', now, REGULAR_ID);
    insComp.run(COMP_DEL, `BugSort Del ${SUFFIX}`, `BSD${SUFFIX.slice(0, 3).toUpperCase()}0101CC3`, earlier, REGULAR_ID);

    const insPol = db.prepare(`
      INSERT INTO polizas (id, company_id, tipo, folio, fecha, ejercicio, periodo, concepto, origin, created_at)
      VALUES (?, ?, 'DIARIO', ?, '2026-11-10', 2026, 11, 'Test', 'MANUAL', ?)
    `);
    insPol.run(`pol_1_${SUFFIX}`, COMP_HIGH, 1, now);
    insPol.run(`pol_2_${SUFFIX}`, COMP_HIGH, 2, now);
    insPol.run(`pol_3_${SUFFIX}`, COMP_LOW, 1, now);
  });

  afterAll(() => {
    db.prepare('DELETE FROM polizas WHERE company_id IN (?, ?, ?, ?)').run(COMP_LOW, COMP_HIGH, COMP_DEMO, COMP_DEL);
    for (const sid of SAT_IDS) db.prepare('DELETE FROM sat_download_requests WHERE id = ?').run(sid);
    db.prepare('DELETE FROM companies WHERE id IN (?, ?, ?, ?)').run(COMP_LOW, COMP_HIGH, COMP_DEMO, COMP_DEL);
    db.prepare('DELETE FROM workspace_quotas WHERE workspace_id = ?').run(WS_ID);
    db.prepare('DELETE FROM platform_alerts WHERE target_id IN (?, ?)').run(WS_ID, 'sat_soap');
    db.prepare('DELETE FROM admin_user_overrides WHERE user_id IN (?, ?, ?, ?)').run(
      SUPPORT_ID, BILLING_ID, PROMOTED_SUPER_ID, REGULAR_ID
    );
    db.prepare('DELETE FROM admin_audit_logs WHERE target_id IN (?, ?, ?, ?) OR action LIKE ?').run(
      WS_ID, REGULAR_ID, COMP_DEL, `WILDCARD_${SUFFIX}`, `%${SUFFIX}%`
    );
  });

  test('1. isReadOnlyBlockedMethod bloquea verifyCfdiSatStatus y verifyPendingSatRequests', () => {
    expect(isReadOnlyBlockedMethod('verifyCfdiSatStatus')).toBe(true);
    expect(isReadOnlyBlockedMethod('verifyPendingSatRequests')).toBe(true);
  });

  test('2. Rutas adminApi coinciden con adminRoutes (/admin/alerts/scan y /admin/alerts/:id/status)', async () => {
    const calledPaths: string[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      calledPaths.push(url);
      const routePath = url.replace(/^\/api/, '');
      return adminRoutes.request(routePath, {
        ...init,
        headers: { ...(init?.headers as Record<string, string>), ...SUPER_HEADERS }
      });
    }) as typeof fetch;

    try {
      const scan = await adminApi.runAdminHealthScan();
      expect(typeof scan.openAlertsCount).toBe('number');
      expect(calledPaths).toContain('/api/admin/alerts/scan');

      const alertId = `al_route_${SUFFIX}`;
      db.prepare(`
        INSERT INTO platform_alerts (id, code, severity, category, title, message, target_type, target_id, status, metadata_json, detected_at)
        VALUES (?, 'SYSTEM_TEST', 'info', 'system', 'Test', 'Msg', 'platform', NULL, 'open', '{}', ?)
      `).run(alertId, new Date().toISOString());

      const updated = await adminApi.updateAdminPlatformAlertStatus(alertId, 'acknowledged');
      expect(updated.status).toBe('acknowledged');
      expect(calledPaths).toContain(`/api/admin/alerts/${alertId}/status`);
      db.prepare('DELETE FROM platform_alerts WHERE id = ?').run(alertId);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('3. Matriz RBAC Hono en /admin/* (NONE, SUPPORT_READONLY, BILLING_OPS, SUPERADMIN)', async () => {
    const noneH = { 'X-User-Id': REGULAR_ID };
    const supH = { 'X-User-Id': SUPPORT_ID };
    const bilH = { 'X-User-Id': BILLING_ID };

    expect((await reqJson('/admin/metrics', { headers: noneH })).status).toBe(403);
    expect((await reqJson('/admin/metrics', { headers: supH })).status).toBe(200);
    expect((await reqJson('/admin/metrics', { headers: bilH })).status).toBe(200);

    expect((await reqJson('/admin/audit-logs', jsonReq(supH, 'POST', { action: 'VIEW_TEST', targetType: 'system' }))).status).toBe(201);
    expect((await reqJson('/admin/alerts/scan', jsonReq(supH, 'POST'))).status).toBe(200);

    expect((await reqJson(`/admin/users/${REGULAR_ID}/status`, jsonReq(supH, 'PATCH', { status: 'SUSPENDIDO' }))).status).toBe(403);
    expect((await reqJson(`/admin/workspaces/${WS_ID}/quota`, jsonReq(supH, 'PUT', {
      planTier: 'PRO', maxCompanies: 5, maxCfdisPerMonth: 1000, maxStorageMb: 500
    }))).status).toBe(403);
    expect((await reqJson(`/admin/companies/${COMP_DEL}`, jsonReq(supH, 'DELETE'))).status).toBe(403);
    expect((await reqJson('/admin/broadcast', jsonReq(supH, 'POST', { title: 'T', message: 'M' }))).status).toBe(403);
    expect((await reqJson(`/admin/users/${REGULAR_ID}/role`, jsonReq(supH, 'PATCH', { platformRole: 'BILLING_OPS' }))).status).toBe(403);

    expect((await reqJson(`/admin/users/${REGULAR_ID}/status`, jsonReq(bilH, 'PATCH', { status: 'SUSPENDIDO' }))).status).toBe(200);
    expect((await reqJson(`/admin/users/${REGULAR_ID}/status`, jsonReq(bilH, 'PATCH', { status: 'ACTIVO' }))).status).toBe(200);
    expect((await reqJson(`/admin/workspaces/${WS_ID}/quota`, jsonReq(bilH, 'PUT', {
      userId: REGULAR_ID, planTier: 'PRO', maxCompanies: 2, maxCfdisPerMonth: 1000, maxStorageMb: 500
    }))).status).toBe(200);

    expect((await reqJson(`/admin/companies/${COMP_DEL}`, jsonReq(bilH, 'DELETE'))).status).toBe(403);
    expect((await reqJson('/admin/broadcast', jsonReq(bilH, 'POST', { title: 'T', message: 'M' }))).status).toBe(403);
    expect((await reqJson('/admin/broadcast', jsonReq(bilH, 'DELETE'))).status).toBe(403);
    expect((await reqJson(`/admin/users/${REGULAR_ID}/role`, jsonReq(bilH, 'PATCH', { platformRole: 'NONE' }))).status).toBe(403);

    expect((await reqJson(`/admin/companies/${COMP_DEL}`, jsonReq(SUPER_HEADERS, 'DELETE'))).status).toBe(200);
  });

  test('4. BILLING_OPS no puede suspender a un usuario promovido a SUPERADMIN', async () => {
    expect(() =>
      setAdminUserStatusRepo(PROMOTED_SUPER_ID, 'SUSPENDIDO', 'billing@despacho.mx', BILLING_ID)
    ).toThrow('No es posible suspender una cuenta SuperAdmin');

    const res = await reqJson<{ error: string }>(
      `/admin/users/${PROMOTED_SUPER_ID}/status`,
      jsonReq({ 'X-User-Id': BILLING_ID }, 'PATCH', { status: 'SUSPENDIDO' })
    );
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('No es posible suspender una cuenta SuperAdmin');
  });

  test('5. PUT /admin/workspaces/:id/quota rechaza maxStorageMb < 10 y audita targetType=workspace', async () => {
    const bad = await reqJson<{ error: string }>(`/admin/workspaces/${WS_ID}/quota`, jsonReq(SUPER_HEADERS, 'PUT', {
      planTier: 'FREE', maxCompanies: 3, maxCfdisPerMonth: 500, maxStorageMb: 9
    }));
    expect(bad.status).toBe(400);

    const ok = await reqJson(`/admin/workspaces/${WS_ID}/quota`, jsonReq(SUPER_HEADERS, 'PUT', {
      userId: REGULAR_ID, planTier: 'PRO', maxCompanies: 3, maxCfdisPerMonth: 1000, maxStorageMb: 100
    }));
    expect(ok.status).toBe(200);

    const logs = await reqJson<AdminPaginatedResponse<AdminAuditLogEntry>>(
      `/admin/audit-logs/paginated?action=UPSERT_WORKSPACE_QUOTA&search=${encodeURIComponent(WS_ID)}`,
      { headers: SUPER_HEADERS }
    );
    expect(logs.status).toBe(200);
    expect(logs.body.items[0]?.targetType).toBe('workspace');
  });

  test('6. POST /admin/broadcast rechaza expiresAt en el pasado', async () => {
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    const res = await reqJson<{ error: string }>('/admin/broadcast', jsonReq(SUPER_HEADERS, 'POST', {
      title: 'Aviso pasado', message: 'Expirado', type: 'info', expiresAt: pastIso
    }));
    expect(res.status).toBe(400);
  });

  test('7. Ordenamiento global sortBy/sortDir en /admin/companies/paginated y exclusión demo en cuotas', async () => {
    const demoComp = getAdminCompaniesRepo().find((c) => c.id === COMP_DEMO);
    expect(demoComp?.ownerType).toBe('demo');

    const p1 = await reqJson<AdminPaginatedResponse<AdminCompanySummary>>(
      `/admin/companies/paginated?search=${encodeURIComponent(SUFFIX)}&ownerType=user&sortBy=polizasCount&sortDir=desc&page=1&pageSize=1`,
      { headers: SUPER_HEADERS }
    );
    const p2 = await reqJson<AdminPaginatedResponse<AdminCompanySummary>>(
      `/admin/companies/paginated?search=${encodeURIComponent(SUFFIX)}&ownerType=user&sortBy=polizasCount&sortDir=desc&page=2&pageSize=1`,
      { headers: SUPER_HEADERS }
    );
    expect(p1.status).toBe(200);
    expect(p1.body.items[0]?.id).toBe(COMP_HIGH);
    expect(p2.body.items[0]?.id).toBe(COMP_LOW);

    // REGULAR_ID tiene 2 empresas reales (COMP_LOW, COMP_HIGH) + 1 demo (COMP_DEMO).
    // Con maxCompanies = 3, la demo NO debe contar para disparar WORKSPACE_QUOTA_REACHED.
    await reqJson('/admin/alerts/scan', jsonReq(SUPER_HEADERS, 'POST'));
    const alerts = await reqJson<AdminPlatformAlert[]>('/admin/alerts?status=open', { headers: SUPER_HEADERS });
    expect(alerts.body.some((a) => a.code === 'WORKSPACE_QUOTA_REACHED' && a.targetId === WS_ID)).toBe(false);
  });

  test('8. GET /admin/audit-logs/paginated escapa comodines % y _ en search', async () => {
    recordAdminAuditLogRepo({
      actorEmail: `pct_${SUFFIX}@test.mx`,
      action: `WILDCARD_${SUFFIX}`,
      targetType: 'system',
      targetId: `100%_literal_${SUFFIX}`
    });
    recordAdminAuditLogRepo({
      actorEmail: `plain_${SUFFIX}@test.mx`,
      action: `PLAIN_${SUFFIX}`,
      targetType: 'system',
      targetId: `plain_target_${SUFFIX}`
    });

    const pctRes = await reqJson<AdminPaginatedResponse<AdminAuditLogEntry>>(
      `/admin/audit-logs/paginated?search=${encodeURIComponent(`100%_literal_${SUFFIX}`)}`,
      { headers: SUPER_HEADERS }
    );
    expect(pctRes.status).toBe(200);
    expect(pctRes.body.total).toBe(1);
    expect(pctRes.body.items[0]?.action).toBe(`WILDCARD_${SUFFIX}`);

    const onlyPct = await reqJson<AdminPaginatedResponse<AdminAuditLogEntry>>(
      `/admin/audit-logs/paginated?action=${encodeURIComponent(`PLAIN_${SUFFIX}`)}&search=${encodeURIComponent('%')}`,
      { headers: SUPER_HEADERS }
    );
    expect(onlyPct.status).toBe(200);
    expect(onlyPct.body.total).toBe(0);
  });

  test('9. getAdminSatHealthRepo usa buckets mutuamente excluyentes (TERMINADA + 5004 no se duplica)', () => {
    const nowIso = new Date().toISOString();
    const insSat = db.prepare(`
      INSERT INTO sat_download_requests (
        id, company_id, id_solicitud_sat, tipo_solicitud, fecha_inicial, fecha_final,
        estado_solicitud, codigo_estado_sat, mensaje_sat, id_paquete_sat, cfdis_descargados,
        modo_ejecucion, soap_request_xml, soap_response_xml, created_at
      ) VALUES (?, ?, ?, 'RECIBIDOS', '2026-11-01', '2026-11-10', ?, ?, 'Bug18', NULL, 0, 'SANDBOX_CRYPTO', '<r/>', '<s/>', ?)
    `);
    insSat.run(SAT_IDS[0]!, COMP_LOW, `S1_${SUFFIX}`, 'TERMINADA', '5004', nowIso);
    insSat.run(SAT_IDS[1]!, COMP_LOW, `S2_${SUFFIX}`, 'SOLICITADA', '5000', nowIso);
    insSat.run(SAT_IDS[2]!, COMP_LOW, `S3_${SUFFIX}`, 'RECHAZADA', '5002', nowIso);

    const health = getAdminSatHealthRepo();
    expect(health.completedRequests7d + health.pendingRequests7d + health.failedRequests7d).toBe(health.totalRequests7d);
  });
});
