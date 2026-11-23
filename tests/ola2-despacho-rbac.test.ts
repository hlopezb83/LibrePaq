import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { db, initDatabase } from '../src/server/db';
import { createCompanyRecord, deleteCompanyRecord } from '../src/server/repositories/companies.repo';
import {
  acceptPendingInvitesRepo,
  assignCompanyAccessRepo,
  ensureDespachoRbacTables,
  getEffectiveCompanyRoleRepo,
  inviteWorkspaceMemberRepo,
  listCompanyAuditLogsRepo,
  listWorkspaceMembersRepo,
  recordCompanyAuditLogRepo,
  revokeWorkspaceMemberRepo,
  updateWorkspaceMemberRoleRepo
} from '../src/server/repositories/workspace-members.repo';
import { workspaceMembersRoutes } from '../src/server/routes/workspace-members.routes';
import { canRoleWrite, hasMinDespachoRole } from '../src/shared/types/despacho-rbac.types';
import { workspaceMembersApi } from '../src/lib/api/workspace-members.api';
import { supabaseWorkspaceMembers } from '../src/lib/supabase/supabase-workspace-members';

describe('Ola 2A — Multiusuario por Despacho (RBAC por Empresa + Bitácora Contable)', () => {
  const testApp = new Hono().basePath('/api');
  testApp.route('/', workspaceMembersRoutes);

  const createdCompanyIds: string[] = [];
  const ownerA = 'owner_alpha_2a';
  const wsA = `ws_${ownerA.slice(0, 8)}`;
  const ownerB = 'owner_bravo_2a';
  const wsB = `ws_${ownerB.slice(0, 8)}`;

  beforeAll(() => {
    initDatabase();
    ensureDespachoRbacTables(db);
  });

  afterAll(() => {
    db.prepare('DELETE FROM company_audit_logs WHERE company_id IN (?, ?)').run(
      createdCompanyIds[0] ?? '',
      createdCompanyIds[1] ?? ''
    );
    db.prepare('DELETE FROM workspace_members WHERE workspace_id IN (?, ?)').run(wsA, wsB);
    for (const id of createdCompanyIds) {
      deleteCompanyRecord(id, ownerA);
      deleteCompanyRecord(id, ownerB);
      deleteCompanyRecord(id);
    }
  });

  test('1. Helpers puros de jerarquía y escritura RBAC (CLIENTE_LECTURA bloqueado)', () => {
    expect(canRoleWrite('SOCIO')).toBe(true);
    expect(canRoleWrite('CONTADOR')).toBe(true);
    expect(canRoleWrite('AUXILIAR')).toBe(true);
    expect(canRoleWrite('CLIENTE_LECTURA')).toBe(false);

    expect(hasMinDespachoRole('CLIENTE_LECTURA', 'CLIENTE_LECTURA')).toBe(true);
    expect(hasMinDespachoRole('CLIENTE_LECTURA', 'AUXILIAR')).toBe(false);
    expect(hasMinDespachoRole('AUXILIAR', 'AUXILIAR')).toBe(true);
    expect(hasMinDespachoRole('CONTADOR', 'AUXILIAR')).toBe(true);
    expect(hasMinDespachoRole('SOCIO', 'CONTADOR')).toBe(true);
    expect(hasMinDespachoRole(null, 'CLIENTE_LECTURA')).toBe(false);
  });

  test('2. Ciclo completo de invitación, aceptación, cambio de rol, restricción por empresa y revocación', () => {
    const compA1 = createCompanyRecord({
      name: 'Despacho Alpha Uno SA de CV',
      rfc: 'DAU210101AA1',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      userId: ownerA
    });
    const compA2 = createCompanyRecord({
      name: 'Despacho Alpha Dos SA de CV',
      rfc: 'DAD210101AA2',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      userId: ownerA
    });
    const compB1 = createCompanyRecord({
      name: 'Despacho Bravo SA de CV',
      rfc: 'DBR210101BB1',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '64000',
      userId: ownerB
    });
    createdCompanyIds.push(compA1.id, compA2.id, compB1.id);

    // Invitación inicial con rol AUXILIAR restringida a compA1
    const invited = inviteWorkspaceMemberRepo({
      workspaceId: wsA,
      email: 'auxiliar@alpha.mx',
      role: 'AUXILIAR',
      invitedBy: 'socio@alpha.mx',
      companyIds: [compA1.id]
    });
    expect(invited.status).toBe('INVITADO');
    expect(invited.role).toBe('AUXILIAR');
    expect(invited.companyAccess?.map((a) => a.companyId)).toEqual([compA1.id]);

    // Duplicado activo debe rechazarse
    expect(() =>
      inviteWorkspaceMemberRepo({
        workspaceId: wsA,
        email: 'AUXILIAR@alpha.mx',
        role: 'CONTADOR'
      })
    ).toThrow();

    // Aceptar invitación cuando el usuario inicia sesión
    const accepted = acceptPendingInvitesRepo('usr_aux_1', 'auxiliar@alpha.mx');
    expect(accepted.acceptedCount).toBe(1);

    const listed = listWorkspaceMembersRepo(wsA);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.status).toBe('ACTIVO');
    expect(listed[0]?.userId).toBe('usr_aux_1');

    // Rol efectivo: tiene AUXILIAR en compA1, pero NO en compA2 ni en compB1 (tenant ajeno)
    const effA1 = getEffectiveCompanyRoleRepo(compA1.id, 'usr_aux_1', 'auxiliar@alpha.mx');
    expect(effA1.role).toBe('AUXILIAR');
    expect(effA1.canWrite).toBe(true);
    expect(effA1.isReadOnlyClient).toBe(false);

    const effA2 = getEffectiveCompanyRoleRepo(compA2.id, 'usr_aux_1', 'auxiliar@alpha.mx');
    expect(effA2.role).toBeNull();
    expect(effA2.canWrite).toBe(false);

    const effB1 = getEffectiveCompanyRoleRepo(compB1.id, 'usr_aux_1', 'auxiliar@alpha.mx');
    expect(effB1.role).toBeNull();

    // Cambiar rol a CLIENTE_LECTURA -> canWrite === false, isReadOnlyClient === true
    const updated = updateWorkspaceMemberRoleRepo(wsA, invited.id, 'CLIENTE_LECTURA');
    expect(updated.role).toBe('CLIENTE_LECTURA');
    const effReadOnly = getEffectiveCompanyRoleRepo(compA1.id, 'usr_aux_1', 'auxiliar@alpha.mx');
    expect(effReadOnly.role).toBe('CLIENTE_LECTURA');
    expect(effReadOnly.canWrite).toBe(false);
    expect(effReadOnly.isReadOnlyClient).toBe(true);

    // Ampliar acceso a compA2 también con roleOverride CONTADOR
    const reassigned = assignCompanyAccessRepo({
      workspaceId: wsA,
      memberId: invited.id,
      companyIds: [compA1.id, compA2.id],
      roleOverride: 'CONTADOR'
    });
    expect(reassigned).toHaveLength(2);
    expect(getEffectiveCompanyRoleRepo(compA2.id, 'usr_aux_1').role).toBe('CONTADOR');

    // Revocar miembro -> pierde todo acceso inmediato
    const revoked = revokeWorkspaceMemberRepo(wsA, invited.id);
    expect(revoked.status).toBe('REVOCADO');
    expect(getEffectiveCompanyRoleRepo(compA1.id, 'usr_aux_1').role).toBeNull();
    expect(getEffectiveCompanyRoleRepo(compA2.id, 'usr_aux_1').canWrite).toBe(false);
  });

  test('3. Bitácora contable (company_audit_logs) + aislamiento multi-tenant en rutas Hono', async () => {
    const compA1 = createdCompanyIds[0]!;
    const compB1 = createdCompanyIds[2]!;

    // Invitar cliente de solo lectura en wsA
    const clientRes = await testApp.request(`/api/workspaces/${wsA}/members/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': ownerA, 'X-User-Email': 'socio@alpha.mx' },
      body: JSON.stringify({ email: 'cliente@alpha.mx', role: 'CLIENTE_LECTURA', companyIds: [compA1] })
    });
    expect(clientRes.status).toBe(201);
    acceptPendingInvitesRepo('usr_cliente_1', 'cliente@alpha.mx');

    // Dueño de B no puede invitar en wsA (403)
    const crossTenantInvite = await testApp.request(`/api/workspaces/${wsA}/members/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': ownerB },
      body: JSON.stringify({ email: 'intruso@bravo.mx', role: 'SOCIO' })
    });
    expect(crossTenantInvite.status).toBe(403);

    // Dueño de A registra evento en bitácora de compA1
    const writeOwnerRes = await testApp.request(`/api/companies/${compA1}/audit-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': ownerA, 'X-User-Email': 'socio@alpha.mx' },
      body: JSON.stringify({
        action: 'CREATE_POLIZA',
        entityType: 'poliza',
        entityId: 'pol_001',
        metadata: { folio: 1, total: 1160 }
      })
    });
    expect(writeOwnerRes.status).toBe(201);

    // CLIENTE_LECTURA puede leer bitácora de compA1 (200) y consultar su rol efectivo
    const readClientRes = await testApp.request(`/api/companies/${compA1}/audit-logs`, {
      headers: { 'X-User-Id': 'usr_cliente_1', 'X-User-Email': 'cliente@alpha.mx' }
    });
    expect(readClientRes.status).toBe(200);
    const logs = (await readClientRes.json()) as Array<{ action: string; actorEmail: string }>;
    expect(logs.some((l) => l.action === 'CREATE_POLIZA' && l.actorEmail === 'socio@alpha.mx')).toBe(true);

    const effClientRoute = await testApp.request(`/api/companies/${compA1}/effective-role`, {
      headers: { 'X-User-Id': 'usr_cliente_1', 'X-User-Email': 'cliente@alpha.mx' }
    });
    expect(effClientRoute.status).toBe(200);
    expect(await effClientRoute.json()).toMatchObject({
      companyId: compA1,
      role: 'CLIENTE_LECTURA',
      canWrite: false,
      isReadOnlyClient: true
    });

    // CLIENTE_LECTURA NO puede escribir en bitácora (403)
    const writeBlockedRes = await testApp.request(`/api/companies/${compA1}/audit-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': 'usr_cliente_1', 'X-User-Email': 'cliente@alpha.mx' },
      body: JSON.stringify({ action: 'DELETE_POLIZA', entityType: 'poliza', entityId: 'pol_001' })
    });
    expect(writeBlockedRes.status).toBe(403);

    // CLIENTE_LECTURA de A tampoco puede leer bitácora de compB1 (403 aislamiento multi-tenant)
    const crossAuditRead = await testApp.request(`/api/companies/${compB1}/audit-logs`, {
      headers: { 'X-User-Id': 'usr_cliente_1', 'X-User-Email': 'cliente@alpha.mx' }
    });
    expect(crossAuditRead.status).toBe(403);

    // Bitácora directa en repo también aislada por companyId
    recordCompanyAuditLogRepo({
      companyId: compB1,
      action: 'UPLOAD_CFDI',
      entityType: 'cfdi',
      entityId: 'uuid-b1',
      actorUserId: ownerB,
      actorEmail: 'owner@bravo.mx'
    });
    expect(listCompanyAuditLogsRepo(compA1).every((l) => l.companyId === compA1)).toBe(true);
    expect(listCompanyAuditLogsRepo(compB1).some((l) => l.action === 'UPLOAD_CFDI')).toBe(true);
  });

  test('4. Paridad estricta de interfaz entre workspaceMembersApi y supabaseWorkspaceMembers', () => {
    expect(Object.keys(workspaceMembersApi).sort()).toEqual(
      Object.keys(supabaseWorkspaceMembers).sort()
    );
  });
});
