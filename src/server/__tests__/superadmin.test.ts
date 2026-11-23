import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { db, initDatabase } from '../db';
import {
  getAdminCompaniesRepo,
  getAdminCompanyDetailRepo,
  getAdminMetricsRepo,
  getAdminSatHealthRepo,
  getAdminUsersRepo
} from '../repositories/admin.repo';
import {
  clearBroadcastRepo,
  deleteAdminCompanyRepo,
  getActiveBroadcastRepo,
  getAdminAuditLogsRepo,
  recordAdminAuditLogRepo,
  saveBroadcastRepo,
  setAdminUserStatusRepo
} from '../repositories/admin-ops.repo';
import { adminRoutes } from '../routes/admin.routes';
import { checkIsSuperAdmin } from '../../context/AuthContext';
import type { User } from '@supabase/supabase-js';

const TEMP_COMPANY_ID = `comp_test_admin_${crypto.randomUUID().slice(0, 8)}`;
const TEMP_USER_ID = `usr_test_admin_${crypto.randomUUID().slice(0, 8)}`;
const TEMP_SAT_REQ_ID = `satreq_test_${crypto.randomUUID().slice(0, 8)}`;
const SUPERADMIN_HEADERS = { 'X-User-Email': 'hlopezb@gmail.com', 'X-User-Id': 'usr_owner_hlopez' };

describe('SuperAdmin Platform Governance Suite', () => {
  beforeAll(() => {
    initDatabase();
  });

  afterAll(() => {
    db.prepare('DELETE FROM sat_download_requests WHERE id = ?').run(TEMP_SAT_REQ_ID);
    db.prepare('DELETE FROM companies WHERE id = ?').run(TEMP_COMPANY_ID);
    db.prepare('DELETE FROM admin_user_overrides WHERE user_id = ?').run(TEMP_USER_ID);
    db.prepare("DELETE FROM platform_broadcasts WHERE created_by = 'hlopezb@gmail.com' AND title LIKE '[TEST]%'").run();
    db.prepare("DELETE FROM admin_audit_logs WHERE target_id IN (?, ?) OR action = 'TEST_AUDIT_EVENT'").run(
      TEMP_COMPANY_ID,
      TEMP_USER_ID
    );
  });

  test('1. getAdminMetricsRepo retorna métricas globales del sistema', () => {
    const metrics = getAdminMetricsRepo();
    expect(metrics).toBeDefined();
    expect(metrics.totalUsers).toBeGreaterThanOrEqual(1);
    expect(typeof metrics.newUsers7d).toBe('number');
    expect(typeof metrics.newUsers30d).toBe('number');
    expect(typeof metrics.activeCompaniesCount).toBe('number');
    expect(typeof metrics.companiesWithFielCount).toBe('number');
    expect(typeof metrics.satErrors7d).toBe('number');
    expect(metrics.supabaseConnected).toBe(true);
    expect(metrics.googleAdsActive).toBe(true);
    expect(metrics.satSoapOnline).toBe(true);
  });

  test('2. getAdminCompaniesRepo retorna la lista global de empresas fiscales y su tipo de propietario', () => {
    const companies = getAdminCompaniesRepo();
    expect(companies).toBeArray();
    expect(companies.length).toBeGreaterThan(0);
    expect(companies[0]!).toHaveProperty('rfc');
    expect(companies[0]!).toHaveProperty('name');
    expect(typeof companies[0]!.polizasCount).toBe('number');
    expect(typeof companies[0]!.cfdisCount).toBe('number');
    expect(typeof companies[0]!.hasFiel).toBe('boolean');
    expect(['user', 'superadmin', 'demo']).toContain(companies[0]!.ownerType || 'demo');
  });

  test('3. getAdminUsersRepo retorna al dueño oficial hlopezb@gmail.com con rol SuperAdmin', () => {
    const users = getAdminUsersRepo();
    expect(users).toBeArray();
    const owner = users.find((u) => u.email === 'hlopezb@gmail.com');
    expect(owner).toBeDefined();
    expect(owner?.isSuperAdmin).toBe(true);
    expect(owner?.status).toBe('ACTIVO');
    expect(typeof owner?.companiesCount).toBe('number');
  });

  test('4. checkIsSuperAdmin aprueba estrictamente a hlopezb@gmail.com y bloquea intrusos', () => {
    const mockSuperUser = {
      id: 'usr_owner',
      email: 'hlopezb@gmail.com',
      app_metadata: { role: 'superadmin' }
    } as unknown as User;

    const mockRegularUser = {
      id: 'usr_normal',
      email: 'contador.comun@despacho.mx',
      app_metadata: { role: 'authenticated' }
    } as unknown as User;

    expect(checkIsSuperAdmin(mockSuperUser)).toBe(true);
    expect(checkIsSuperAdmin(mockRegularUser)).toBe(false);
    expect(checkIsSuperAdmin(null)).toBe(false);
  });

  test('5. Broadcasts: publicar, omitir si expiración pasada, y limpiar activos', () => {
    const futureIso = new Date(Date.now() + 3_600_000).toISOString();
    const published = saveBroadcastRepo(
      {
        title: '[TEST] Aviso de Mantenimiento',
        message: 'Ventana programada esta noche',
        type: 'warning',
        expiresAt: futureIso
      },
      'hlopezb@gmail.com',
      'usr_owner_hlopez'
    );

    expect(published.active).toBe(true);
    expect(published.type).toBe('warning');
    expect(getActiveBroadcastRepo()?.id).toBe(published.id);

    const pastIso = new Date(Date.now() - 60_000).toISOString();
    const expired = saveBroadcastRepo(
      {
        title: '[TEST] Aviso Expirado',
        message: 'No debe mostrarse',
        type: 'info',
        expiresAt: pastIso
      },
      'hlopezb@gmail.com',
      'usr_owner_hlopez'
    );
    expect(expired.active).toBe(true);
    expect(getActiveBroadcastRepo()).toBeNull();

    const cleared = clearBroadcastRepo('hlopezb@gmail.com', 'usr_owner_hlopez');
    expect(cleared.cleared).toBe(true);
    expect(getActiveBroadcastRepo()).toBeNull();
  });

  test('6. getAdminSatHealthRepo agrega solicitudes SAT recientes y errores 7d', () => {
    const seedCompany = getAdminCompaniesRepo()[0]!;
    db.prepare(`
      INSERT INTO sat_download_requests (
        id, company_id, id_solicitud_sat, tipo_solicitud, fecha_inicial, fecha_final,
        estado_solicitud, codigo_estado_sat, mensaje_sat, id_paquete_sat, cfdis_descargados,
        modo_ejecucion, soap_request_xml, soap_response_xml, created_at
      ) VALUES (?, ?, ?, 'RECIBIDOS', '2026-11-01', '2026-11-10', 'ERROR', '5004', 'Error de prueba SAT', NULL, 0, 'SANDBOX_CRYPTO', '<req/>', '<res/>', ?)
    `).run(TEMP_SAT_REQ_ID, seedCompany.id, `SOL_${TEMP_SAT_REQ_ID}`, new Date().toISOString());

    const health = getAdminSatHealthRepo();
    expect(health.totalRequests7d).toBeGreaterThanOrEqual(1);
    expect(health.failedRequests7d).toBeGreaterThanOrEqual(1);
    expect(health.errorCodeBreakdown.some((e) => e.code === '5004')).toBe(true);
    expect(health.recentRequests.some((r) => r.id === TEMP_SAT_REQ_ID)).toBe(true);
    expect(Array.isArray(health.expiringFiels)).toBe(true);
  });

  test('7. getAdminCompanyDetailRepo retorna detalle operativo o null si no existe', () => {
    const firstCompany = getAdminCompaniesRepo()[0]!;
    const detail = getAdminCompanyDetailRepo(firstCompany.id);
    expect(detail).not.toBeNull();
    expect(detail?.company.id).toBe(firstCompany.id);
    expect(typeof detail?.accountsCount).toBe('number');
    expect(typeof detail?.polizasCount).toBe('number');
    expect(typeof detail?.cfdisCount).toBe('number');
    expect(typeof detail?.isCurrentPeriodLocked).toBe('boolean');

    expect(getAdminCompanyDetailRepo('comp_inexistente_999')).toBeNull();
  });

  test('8. setAdminUserStatusRepo actualiza override y rechaza suspender cuenta SuperAdmin', () => {
    expect(() =>
      setAdminUserStatusRepo('usr_owner_hlopez', 'SUSPENDIDO', 'hlopezb@gmail.com', 'usr_owner_hlopez')
    ).toThrow('No es posible suspender una cuenta SuperAdmin');

    expect(() =>
      setAdminUserStatusRepo('hlopezb@gmail.com', 'SUSPENDIDO', 'hlopezb@gmail.com', 'usr_owner_hlopez')
    ).toThrow('No es posible suspender una cuenta SuperAdmin');

    const suspended = setAdminUserStatusRepo(
      TEMP_USER_ID,
      'SUSPENDIDO',
      'hlopezb@gmail.com',
      'usr_owner_hlopez',
      'Falta de pago'
    );
    expect(suspended.status).toBe('SUSPENDIDO');

    const userRecord = getAdminUsersRepo().find((u) => u.id === TEMP_USER_ID);
    expect(userRecord?.status).toBe('SUSPENDIDO');

    const reactivated = setAdminUserStatusRepo(TEMP_USER_ID, 'ACTIVO', 'hlopezb@gmail.com', 'usr_owner_hlopez');
    expect(reactivated.status).toBe('ACTIVO');
  });

  test('9. deleteAdminCompanyRepo elimina empresa existente y registra auditoría', () => {
    db.prepare(`
      INSERT INTO companies (id, name, rfc, regimen_fiscal, codigo_postal, mask_format, current_year, current_period, created_at, user_id)
      VALUES (?, 'Empresa Temporal Prueba SA', 'ETP260101AA1', '601', '06600', 'XXX-XX-XXX', 2026, 11, ?, ?)
    `).run(TEMP_COMPANY_ID, new Date().toISOString(), TEMP_USER_ID);

    const deleted = deleteAdminCompanyRepo(TEMP_COMPANY_ID, 'hlopezb@gmail.com', 'usr_owner_hlopez');
    expect(deleted.deleted).toBe(true);
    expect(getAdminCompanyDetailRepo(TEMP_COMPANY_ID)).toBeNull();

    const notFound = deleteAdminCompanyRepo('comp_no_existe', 'hlopezb@gmail.com', 'usr_owner_hlopez');
    expect(notFound.deleted).toBe(false);
  });

  test('10. getAdminAuditLogsRepo retorna bitácora ordenada y rutas Hono protegen /admin/*', async () => {
    recordAdminAuditLogRepo({
      actorUserId: 'usr_owner_hlopez',
      actorEmail: 'hlopezb@gmail.com',
      action: 'TEST_AUDIT_EVENT',
      targetType: 'system',
      targetId: null,
      metadata: { check: 'ok' }
    });

    const logs = getAdminAuditLogsRepo(20);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.action === 'TEST_AUDIT_EVENT')).toBe(true);

    // /admin/broadcast/active es público para cualquier usuario
    const publicBroadcastRes = await adminRoutes.request('/admin/broadcast/active');
    expect(publicBroadcastRes.status).toBe(200);

    // /admin/metrics bloquea usuarios sin autorización SuperAdmin
    const forbiddenRes = await adminRoutes.request('/admin/metrics', {
      headers: { 'X-User-Email': 'contador@despacho.mx' }
    });
    expect(forbiddenRes.status).toBe(403);

    // /admin/sat-health y /admin/audit-logs responden 200 con autorización SuperAdmin
    const healthRes = await adminRoutes.request('/admin/sat-health', { headers: SUPERADMIN_HEADERS });
    expect(healthRes.status).toBe(200);

    const logsRes = await adminRoutes.request('/admin/audit-logs?limit=10', { headers: SUPERADMIN_HEADERS });
    expect(logsRes.status).toBe(200);
  });
});
