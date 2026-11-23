import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import crypto from 'node:crypto';
import { api } from '../src/server/api';
import {
  createCompanyRecord,
  createFixedAssetRecord,
  deleteCompanyRecord,
  exportCompanyBackupBundle,
  getAccounts,
  getCompanies,
  getCompanyById,
  initDatabase,
  insertParsedCfdiRecord,
  restoreCompanyBackupBundle
} from '../src/server/db';
import { db } from '../src/server/connection';
import {
  acceptPendingInvitesRepo,
  ensureDespachoRbacTables,
  inviteWorkspaceMemberRepo
} from '../src/server/repositories/workspace-members.repo';
import { fetchWithTimeout, setApiAuthUser } from '../src/lib/api/api-helpers';

function signHs256Jwt(payload: Record<string, unknown>, secret: string): string {
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sigB64 = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

describe('Ronda 3 — Seguridad Multi-Tenant, JWT Verification, RBAC & Auth Headers', () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const ownerId = `usr_r3_owner_${suffix}`;
  const attackerId = `usr_r3_atk_${suffix}`;
  const contadorId = `usr_r3_cont_${suffix}`;
  const lectorId = `usr_r3_lect_${suffix}`;
  const contadorEmail = `contador_${suffix}@ronda3.mx`;
  const lectorEmail = `lector_${suffix}@ronda3.mx`;
  const wsId = `ws_${ownerId.slice(0, 8)}`;

  let victimCompId = '';
  let cfdiId = '';
  let assetId = '';
  let bankLineId = '';

  beforeAll(() => {
    initDatabase();
    ensureDespachoRbacTables(db);

    const comp = createCompanyRecord({
      name: `Victim Corp ${suffix}`,
      rfc: 'VIC260101AA1',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      userId: ownerId
    });
    victimCompId = comp.id;

    const cfdi = insertParsedCfdiRecord(comp, {
      uuid: crypto.randomUUID().toUpperCase(),
      fecha: '2026-10-10',
      tipoComprobante: 'I',
      serie: 'F',
      folio: '100',
      emisorRfc: 'PRO180214A99',
      emisorNombre: 'Proveedor Test SA',
      receptorRfc: comp.rfc,
      receptorNombre: comp.name,
      conceptoPrincipal: 'Servicio cloud',
      claveProdServ: '81112501',
      moneda: 'MXN',
      tipoCambio: 1,
      subtotal: 1000,
      descuento: 0,
      ivaTrasladado: 160,
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 1160,
      metodoPago: 'PUE',
      formaPago: '03',
      usoCfdi: 'G03',
      uuidRelacionado: null,
      xmlRaw: '<cfdi:Comprobante/>'
    });
    cfdiId = cfdi.id;

    const assetResp = createFixedAssetRecord(victimCompId, {
      codigo: `AF-${suffix}`,
      nombre: 'Servidor Dell R750',
      categoria: 'COMPUTO_30',
      fechaAdquisicion: '2026-01-15',
      cfdiUuid: null,
      montoOriginalInversion: 50000,
      tasaAnualPct: 30,
      mesesDepreciadosPrevios: 0,
      inpcAdquisicion: 132.54,
      inpcMedioPeriodo: 136.82,
      cuentaActivoCode: '156-01-001',
      cuentaDepAcumCode: '171-01-001',
      cuentaGastoDepCode: '601-01-006'
    });
    assetId = assetResp.assets[0]?.id ?? '';

    bankLineId = `bsl_${suffix}`;
    db.prepare(`
      INSERT INTO bank_statement_lines (
        id, company_id, account_id, fecha, ejercicio, periodo, referencia, descripcion,
        cargo_banco, abono_banco, matched_movement_id
      ) VALUES (?, ?, ?, '2026-10-12', 2026, 10, 'REF-R3', 'Cargo test', 500, 0, 'mov_dummy_1')
    `).run(bankLineId, victimCompId, `${victimCompId}_102-01-001`);

    inviteWorkspaceMemberRepo({
      workspaceId: wsId,
      email: contadorEmail,
      role: 'CONTADOR',
      invitedBy: 'owner@ronda3.mx',
      companyIds: [victimCompId]
    });
    acceptPendingInvitesRepo(contadorId, contadorEmail);

    inviteWorkspaceMemberRepo({
      workspaceId: wsId,
      email: lectorEmail,
      role: 'CLIENTE_LECTURA',
      invitedBy: 'owner@ronda3.mx',
      companyIds: [victimCompId]
    });
    acceptPendingInvitesRepo(lectorId, lectorEmail);
  });

  afterAll(() => {
    db.prepare('DELETE FROM workspace_members WHERE workspace_id = ?').run(wsId);
    if (victimCompId) {
      deleteCompanyRecord(victimCompId, ownerId);
    }
  });

  test('BUG-02: En NODE_ENV=production rechaza X-User-Id crudo, fallback admin y JWT inválidos; valida HS256', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevJwtSecret = process.env.SUPABASE_JWT_SECRET;
    const prevAdminSecret = process.env.ADMIN_SECRET;
    const jwtSecret = 'test-hs256-secret-ronda3-32bytes!';

    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_JWT_SECRET = jwtSecret;
    delete process.env.ADMIN_SECRET;

    try {
      // 1. Raw X-User-Id sin JWT en producción -> 401
      const noJwt = await api.request(`/api/companies/${victimCompId}`, {
        headers: { 'X-User-Id': ownerId }
      });
      expect(noJwt.status).toBe(401);

      // 2. JWT firmado con secreto incorrecto -> 401
      const badSigJwt = signHs256Jwt(
        { sub: ownerId, email: 'owner@ronda3.mx', exp: Math.floor(Date.now() / 1000) + 3600 },
        'wrong-secret'
      );
      const badJwtRes = await api.request(`/api/cfdis?companyId=${victimCompId}`, {
        headers: { Authorization: `Bearer ${badSigJwt}`, 'X-User-Id': ownerId }
      });
      expect(badJwtRes.status).toBe(401);

      // 3. JWT expirado -> 401
      const expiredJwt = signHs256Jwt(
        { sub: ownerId, email: 'owner@ronda3.mx', exp: Math.floor(Date.now() / 1000) - 60 },
        jwtSecret
      );
      const expiredRes = await api.request(`/api/cfdis?companyId=${victimCompId}`, {
        headers: { Authorization: `Bearer ${expiredJwt}` }
      });
      expect(expiredRes.status).toBe(401);

      // 4. JWT válido de owner + intento de spoofing en X-User-Id: usa sub del JWT
      const validOwnerJwt = signHs256Jwt(
        { sub: ownerId, email: 'owner@ronda3.mx', exp: Math.floor(Date.now() / 1000) + 3600 },
        jwtSecret
      );
      const okRes = await api.request(`/api/companies/${victimCompId}`, {
        headers: { Authorization: `Bearer ${validOwnerJwt}`, 'X-User-Id': attackerId }
      });
      expect(okRes.status).toBe(200);

      // 5. JWT válido de atacante intentando leer victimComp -> 403
      const validAttackerJwt = signHs256Jwt(
        { sub: attackerId, email: 'atk@ronda3.mx', exp: Math.floor(Date.now() / 1000) + 3600 },
        jwtSecret
      );
      const atkRes = await api.request(`/api/cfdis?companyId=${victimCompId}`, {
        headers: { Authorization: `Bearer ${validAttackerJwt}`, 'X-User-Id': ownerId }
      });
      expect(atkRes.status).toBe(403);

      // 6. Admin en producción rechaza 'librepaq-dev-secret' y X-User-Email crudo; aprueba JWT SuperAdmin
      const devSecretAdminRes = await api.request('/api/admin/metrics', {
        headers: { Authorization: 'Bearer librepaq-dev-secret' }
      });
      expect(devSecretAdminRes.status).toBe(401);

      const spoofAdminRes = await api.request('/api/admin/metrics', {
        headers: { 'X-User-Email': 'hlopezb@gmail.com', 'X-User-Id': 'usr_owner_hlopez' }
      });
      expect(spoofAdminRes.status).toBe(401);

      const superAdminJwt = signHs256Jwt(
        { sub: 'usr_super_jwt', email: 'hlopezb@gmail.com', exp: Math.floor(Date.now() / 1000) + 3600 },
        jwtSecret
      );
      const okAdminRes = await api.request('/api/admin/metrics', {
        headers: { Authorization: `Bearer ${superAdminJwt}` }
      });
      expect(okAdminRes.status).toBe(200);
    } finally {
      if (prevEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnv;
      if (prevJwtSecret === undefined) delete process.env.SUPABASE_JWT_SECRET;
      else process.env.SUPABASE_JWT_SECRET = prevJwtSecret;
      if (prevAdminSecret === undefined) delete process.env.ADMIN_SECRET;
      else process.env.ADMIN_SECRET = prevAdminSecret;
    }
  });

  test('BUG-03: Bloquea IDOR en DELETE /cfdis/:id, batch-auto-poliza, bank unmatch y DELETE /fixed-assets/:id', async () => {
    const atkHeaders = { 'Content-Type': 'application/json', 'X-User-Id': attackerId };

    const delCfdi = await api.request(`/api/cfdis/${cfdiId}`, {
      method: 'DELETE',
      headers: atkHeaders
    });
    expect(delCfdi.status).toBe(403);
    expect(db.query('SELECT id FROM cfdi_documents WHERE id = ?').get(cfdiId)).not.toBeNull();

    const batchPoliza = await api.request('/api/cfdis/batch-auto-poliza', {
      method: 'POST',
      headers: atkHeaders,
      body: JSON.stringify({ cfdiIds: [cfdiId] })
    });
    expect(batchPoliza.status).toBe(403);

    const unmatchRes = await api.request(`/api/bank-reconciliation/${bankLineId}/unmatch`, {
      method: 'POST',
      headers: atkHeaders
    });
    expect(unmatchRes.status).toBe(403);
    const lineRow = db
      .query('SELECT matched_movement_id FROM bank_statement_lines WHERE id = ?')
      .get(bankLineId) as { matched_movement_id: string | null } | null;
    expect(lineRow?.matched_movement_id).toBe('mov_dummy_1');

    const delAsset = await api.request(`/api/fixed-assets/${assetId}`, {
      method: 'DELETE',
      headers: atkHeaders
    });
    expect(delAsset.status).toBe(403);
    expect(db.query('SELECT id FROM fixed_assets WHERE id = ?').get(assetId)).not.toBeNull();
  });

  test('BUG-05: RBAC despacho — CLIENTE_LECTURA lee pero recibe 403 al escribir; CONTADOR escribe; demo write protegido', async () => {
    // Visibilidad en repo para miembros invitados
    const lectorCompanies = getCompanies(lectorId, lectorEmail);
    expect(lectorCompanies.some((c) => c.id === victimCompId)).toBe(true);
    expect(getCompanyById(victimCompId, lectorId, lectorEmail)?.id).toBe(victimCompId);

    const lectorHeaders = {
      'Content-Type': 'application/json',
      'X-User-Id': lectorId,
      'X-User-Email': lectorEmail
    };
    const contadorHeaders = {
      'Content-Type': 'application/json',
      'X-User-Id': contadorId,
      'X-User-Email': contadorEmail
    };

    // CLIENTE_LECTURA puede leer empresa y catálogo
    const readComp = await api.request(`/api/companies/${victimCompId}`, { headers: lectorHeaders });
    expect(readComp.status).toBe(200);
    const readAccounts = await api.request(`/api/accounts?companyId=${victimCompId}`, {
      headers: lectorHeaders
    });
    expect(readAccounts.status).toBe(200);

    const accounts = getAccounts(victimCompId);
    const bankAcc = accounts.find((a) => a.code === '102-01-001')!;
    const salesAcc = accounts.find((a) => a.code === '401-01-001')!;
    const polizaPayload = {
      companyId: victimCompId,
      tipo: 'DIARIO',
      fecha: '2026-10-15',
      concepto: 'Test RBAC escritura',
      movements: [
        { accountId: bankAcc.id, cargo: 100, abono: 0 },
        { accountId: salesAcc.id, cargo: 0, abono: 100 }
      ]
    };

    // CLIENTE_LECTURA bloqueado con 403 en mutaciones
    const lectorPoliza = await api.request('/api/polizas', {
      method: 'POST',
      headers: lectorHeaders,
      body: JSON.stringify(polizaPayload)
    });
    expect(lectorPoliza.status).toBe(403);

    const lectorBatch = await api.request('/api/cfdis/batch-auto-poliza', {
      method: 'POST',
      headers: lectorHeaders,
      body: JSON.stringify({ cfdiIds: [cfdiId] })
    });
    expect(lectorBatch.status).toBe(403);

    const lectorRule = await api.request(`/api/companies/${victimCompId}/accounting-rules`, {
      method: 'POST',
      headers: lectorHeaders,
      body: JSON.stringify({ direction: 'RECIBIDO', operationAccountCode: '601-01-003' })
    });
    expect(lectorRule.status).toBe(403);

    const lectorUpdateComp = await api.request(`/api/companies/${victimCompId}`, {
      method: 'PUT',
      headers: lectorHeaders,
      body: JSON.stringify({
        name: 'Intento Lector',
        rfc: 'VIC260101AA1',
        regimenFiscal: '601 - General de Ley Personas Morales',
        codigoPostal: '06000'
      })
    });
    expect(lectorUpdateComp.status).toBe(403);

    // CONTADOR sí puede escribir pólizas y actualizar datos
    const contadorPoliza = await api.request('/api/polizas', {
      method: 'POST',
      headers: contadorHeaders,
      body: JSON.stringify(polizaPayload)
    });
    expect(contadorPoliza.status).toBe(201);

    // CONTADOR no puede eliminar la empresa (minRole: SOCIO)
    const contadorDeleteComp = await api.request(`/api/companies/${victimCompId}`, {
      method: 'DELETE',
      headers: contadorHeaders
    });
    expect(contadorDeleteComp.status).toBe(403);

    // Demo write protection en rutas de empresa
    const demoPut = await api.request('/api/companies/comp_tnn_01', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hijack Demo',
        rfc: 'TNN2105148K2',
        regimenFiscal: '601',
        codigoPostal: '64000'
      })
    });
    expect(demoPut.status).toBe(403);

    // restoreCompanyBackupBundle directo rechaza atacante sobre empresa privada
    const bundle = exportCompanyBackupBundle(victimCompId, ownerId);
    expect(() => restoreCompanyBackupBundle(bundle, attackerId)).toThrow('autorización');
  });

  test('BUG-23: fetchWithTimeout propaga getAuthHeaders() combinándolo con init.headers', async () => {
    const origFetch = globalThis.fetch;
    let capturedHeaders: Record<string, string> | undefined;

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      capturedHeaders = init?.headers as Record<string, string> | undefined;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    setApiAuthUser(
      { id: 'usr_r3_client', email: 'client@r3.mx', user_metadata: { full_name: 'Cliente R3' } },
      'jwt_token_r3'
    );

    try {
      await fetchWithTimeout('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(capturedHeaders).toBeDefined();
      expect(capturedHeaders?.['X-User-Id']).toBe('usr_r3_client');
      expect(capturedHeaders?.['X-User-Email']).toBe('client@r3.mx');
      expect(capturedHeaders?.['Authorization']).toBe('Bearer jwt_token_r3');
      expect(capturedHeaders?.['content-type'] || capturedHeaders?.['Content-Type']).toBe(
        'application/json'
      );
    } finally {
      setApiAuthUser(null);
      globalThis.fetch = origFetch;
    }
  });
});
