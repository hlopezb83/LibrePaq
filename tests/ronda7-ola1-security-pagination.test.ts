import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import type { PostgrestResponse, SupabaseClient } from '@supabase/supabase-js';
import {
  encryptPrivateKeyIfConfigured,
  decryptPrivateKeyIfNeeded
} from '../supabase/functions/sat-soap-sync/crypto-helpers';
import { fetchAllRows } from '../src/lib/supabase/supabase-pagination';
import { runAutoPolizaFromCfdiWithClient, type AutoPolizaBatchContext } from '../src/lib/supabase/supabase-cfdi-poliza';
import { savePayrollPeriodSettings } from '../src/lib/supabase/supabase-payroll-settings';
import { setClientReadOnlyMode } from '../src/lib/support-impersonation';
import {
  propagateOpenAccountNameToMovements,
  resolveActiveOrganizationId
} from '../src/lib/supabase/supabase-accounts-helpers';
import type { AccountWithBalance } from '../src/shared/types';

const ROOT = path.resolve(import.meta.dir, '..');

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

describe('Ronda 7 — Ola 1: Seguridad Multi-Tenant, RBAC Despacho, Edge Functions & Paginación', () => {
  const originalFielKey = process.env.FIEL_ENCRYPTION_KEY;

  afterEach(() => {
    setClientReadOnlyMode(false);
    if (originalFielKey === undefined) {
      delete process.env.FIEL_ENCRYPTION_KEY;
    } else {
      process.env.FIEL_ENCRYPTION_KEY = originalFielKey;
    }
  });

  test('1. Migración SQL Ronda 7 contiene RLS RESTRICTIVE, is_user_suspended, REVOKE anon, columnas fiscales y triggers', () => {
    const sql = readRepoFile('supabase/migrations/20261126000001_ronda7_security_rls_and_fiscal_integrity.sql');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.is_user_suspended()');
    expect(sql).toContain("= 'SUSPENDIDO'");
    expect(sql).toContain('AS RESTRICTIVE FOR ALL TO authenticated');
    expect(sql).toContain('NOT public.is_user_suspended()');

    // Elimina regla 3d cross-tenant y exige companies.organization_id = wm.workspace_id
    expect(sql).not.toContain('creator_wm');
    expect(sql).toContain('wm.workspace_id = v_company_org_id');

    // Drop de políticas legacy permisivas / demo
    expect(sql).toContain('DROP POLICY IF EXISTS "rls_companies_select" ON public.companies');
    expect(sql).toContain('DROP POLICY IF EXISTS accounting_rules_tenant_isolation ON public.accounting_rules');
    expect(sql).toContain('DROP POLICY IF EXISTS annual_tax_snapshots_owner_isolation ON public.annual_tax_snapshots');

    // Adiciones de esquema y tablas nuevas
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS id_fiscal text');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS pais text');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS jurisdiccion_fiscal text');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS fecha_pago text');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS ptu_pagada_ejercicio numeric(14,2) DEFAULT 0');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.bank_reconciliation_closures');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.despacho_deliverable_branding');
    expect(sql).toContain("'ORDEN'");

    // Revocación explícita de anon
    expect(sql).toContain('REVOKE ALL ON TABLE public.accounting_rules FROM anon');
    expect(sql).toContain('REVOKE ALL ON TABLE public.bank_statement_matches FROM anon');
    expect(sql).toContain('REVOKE ALL ON TABLE public.bank_reconciliation_closures FROM anon');
    expect(sql).toContain('REVOKE ALL ON TABLE public.despacho_deliverable_branding FROM anon');

    // Extensión de enforce_period_lock
    expect(sql).toContain("current_setting('app.bypass_period_lock', true)");
    expect(sql).toContain("TG_TABLE_NAME IN ('tax_parameters', 'payroll_period_settings')");
    expect(sql).toContain("TG_TABLE_NAME = 'annual_tax_snapshots'");
    expect(sql).toContain('trg_enforce_period_lock_tax_parameters');
    expect(sql).toContain('trg_enforce_period_lock_payroll_period_settings');
    expect(sql).toContain('trg_enforce_period_lock_annual_tax_snapshots');
  });

  test('2. admin-edge-auth resolveEffectiveCompanyRole alinea organization_id sin fuga cross-tenant', async () => {
    const edgeAuthMod = (await import(path.join(ROOT, 'supabase/functions/_shared/admin-edge-auth.ts'))) as {
      resolveEffectiveCompanyRole: (
        sb: SupabaseClient,
        companyId: string,
        userId: string,
        userEmail: string
      ) => Promise<{ role: string | null; canWrite: boolean; isReadOnlyClient: boolean }>;
    };
    const { resolveEffectiveCompanyRole } = edgeAuthMod;
    const companiesTable = [
      { id: 'comp_firm', user_id: 'usr_contador', organization_id: 'ws_owner123' },
      { id: 'comp_private', user_id: 'usr_contador', organization_id: null },
      { id: 'comp_demo', user_id: 'demo', organization_id: null }
    ];
    const membersTable = [
      {
        id: 'mem_contador',
        workspace_id: 'ws_owner123',
        user_id: 'usr_contador',
        email: 'cont@despacho.mx',
        role: 'CONTADOR',
        status: 'ACTIVO'
      },
      {
        id: 'mem_aux',
        workspace_id: 'ws_owner123',
        user_id: 'usr_aux',
        email: 'aux@despacho.mx',
        role: 'AUXILIAR',
        status: 'ACTIVO'
      }
    ];

    const mockSb = {
      from(table: string) {
        const filters: Array<[string, unknown]> = [];
        const builder = {
          select: () => builder,
          eq: (col: string, val: unknown) => {
            filters.push([col, val]);
            return builder;
          },
          in: (col: string, vals: unknown[]) => {
            filters.push([`${col}:in`, vals]);
            return builder;
          },
          maybeSingle: async () => {
            if (table === 'companies') {
              const idFilter = filters.find(([c]) => c === 'id')?.[1];
              return { data: companiesTable.find((c) => c.id === idFilter) ?? null, error: null };
            }
            return { data: null, error: null };
          },
          then: (resolve: (val: { data: unknown[]; error: null }) => void) => {
            if (table === 'workspace_members') {
              const rows = membersTable.filter((m) =>
                filters.every(([c, v]) => (m as Record<string, unknown>)[c] === v)
              );
              resolve({ data: rows, error: null });
              return;
            }
            if (table === 'company_member_access') {
              resolve({ data: [], error: null });
              return;
            }
            resolve({ data: [], error: null });
          }
        };
        return builder;
      }
    } as unknown as SupabaseClient;

    // Dueño del workspace ws_owner123 (usr_owner123 -> ws_owner123) ve empresa con organization_id creada por team member
    const ownerOnFirmComp = await resolveEffectiveCompanyRole(
      mockSb,
      'comp_firm',
      'owner123456',
      'socio@despacho.mx'
    );
    expect(ownerOnFirmComp.role).toBe('OWNER');
    expect(ownerOnFirmComp.canWrite).toBe(true);

    // Miembro AUXILIAR sin restricción ve empresa con organization_id = ws_owner123
    const auxOnFirmComp = await resolveEffectiveCompanyRole(
      mockSb,
      'comp_firm',
      'usr_aux',
      'aux@despacho.mx'
    );
    expect(auxOnFirmComp.role).toBe('AUXILIAR');
    expect(auxOnFirmComp.canWrite).toBe(true);

    // Dueño NO debe tener acceso a empresa privada (organization_id = null) del contador
    const ownerOnPrivateComp = await resolveEffectiveCompanyRole(
      mockSb,
      'comp_private',
      'owner123456',
      'socio@despacho.mx'
    );
    expect(ownerOnPrivateComp.role).toBeNull();
    expect(ownerOnPrivateComp.canWrite).toBe(false);

    // Empresa demo no expuesta a usuarios autenticados
    const demoAccess = await resolveEffectiveCompanyRole(
      mockSb,
      'comp_demo',
      'owner123456',
      'socio@despacho.mx'
    );
    expect(demoAccess.role).toBeNull();
  });

  test('3. Guardas Edge Functions: sat-status-verify SUPERADMIN only & workspace-invites RBAC', async () => {
    const invitesHelpersMod = (await import(path.join(ROOT, 'supabase/functions/workspace-invites/helpers.ts'))) as {
      isWorkspaceMember: (sb: SupabaseClient, wsId: string, ctx: Record<string, unknown>) => Promise<boolean>;
      assertCompaniesBelongToWorkspace: (
        sb: SupabaseClient,
        wsId: string,
        companyIds: string[],
        ctx: Record<string, unknown>
      ) => Promise<string | null>;
    };
    const { isWorkspaceMember, assertCompaniesBelongToWorkspace } = invitesHelpersMod;
    const satVerifySrc = readRepoFile('supabase/functions/sat-status-verify/index.ts');
    expect(satVerifySrc).toContain("if (action === 'UPSERT_69B_BATCH')");
    expect(satVerifySrc).toContain("if (auth.platformRole !== 'SUPERADMIN')");
    expect(satVerifySrc).not.toContain("se requiere rol SUPERADMIN o SOCIO");

    const invitesSrc = readRepoFile('supabase/functions/workspace-invites/index.ts');
    expect(invitesSrc).toContain("role === 'CLIENTE_LECTURA' && cids.length === 0");
    expect(invitesSrc).toContain("String(member.role || '').toUpperCase() === 'CLIENTE_LECTURA' && cids.length === 0");

    const equipoUiSrc = readRepoFile('src/views/ajustes/AjustesEquipoTab.tsx');
    expect(equipoUiSrc).toContain("inviteRole === 'CLIENTE_LECTURA' && inviteCompanyIds.length === 0");

    const mockMembers = [
      { id: 'm1', user_id: 'usr_lector', email: 'cliente@x.mx', role: 'CLIENTE_LECTURA', status: 'ACTIVO', workspace_id: 'ws_firm' },
      { id: 'm2', user_id: 'usr_aux', email: 'aux@x.mx', role: 'AUXILIAR', status: 'ACTIVO', workspace_id: 'ws_firm' }
    ];
    const mockComps = [
      { id: 'c_org', user_id: 'usr_aux', organization_id: 'ws_firm' },
      { id: 'c_priv', user_id: 'usr_socio_ext', organization_id: null }
    ];
    const mockSb = {
      from(table: string) {
        const filters: Array<[string, unknown]> = [];
        const b = {
          select: () => b,
          eq: (c: string, v: unknown) => {
            filters.push([c, v]);
            return b;
          },
          in: (c: string, v: unknown[]) => {
            filters.push([`${c}:in`, v]);
            return b;
          },
          then: (resolve: (r: { data: unknown[]; error: null }) => void) => {
            if (table === 'workspace_members') {
              const roleF = filters.find(([c]) => c === 'role')?.[1];
              const rows = mockMembers.filter((m) => (!roleF || m.role === roleF));
              resolve({ data: rows, error: null });
              return;
            }
            if (table === 'companies') {
              const inIds = (filters.find(([c]) => c === 'id:in')?.[1] as string[]) || [];
              resolve({ data: mockComps.filter((c) => inIds.includes(c.id)), error: null });
              return;
            }
            resolve({ data: [], error: null });
          }
        };
        return b;
      }
    } as unknown as SupabaseClient;

    const lectorCtx = {
      userId: 'usr_lector',
      email: 'cliente@x.mx',
      suspended: false,
      isSuper: false,
      isSupport: false,
      profileWorkspaceId: null,
      defaultWsId: 'ws_usr_lect'
    };
    const auxCtx = { ...lectorCtx, userId: 'usr_aux', email: 'aux@x.mx', defaultWsId: 'ws_usr_aux_' };
    const socioCtx = { ...lectorCtx, userId: 'firm123456', email: 'socio@x.mx', defaultWsId: 'ws_firm' };

    expect(await isWorkspaceMember(mockSb, 'ws_firm', lectorCtx)).toBe(false);
    expect(await isWorkspaceMember(mockSb, 'ws_firm', auxCtx)).toBe(true);

    expect(await assertCompaniesBelongToWorkspace(mockSb, 'ws_firm', ['c_org'], socioCtx)).toBeNull();
    expect(await assertCompaniesBelongToWorkspace(mockSb, 'ws_firm', ['c_priv'], socioCtx)).toContain('No tienes autorización');
  });

  test('4. crypto-helpers fail-closed sin FIEL_ENCRYPTION_KEY y cifrado SHA-256 AES-GCM UTF-8', async () => {
    delete process.env.FIEL_ENCRYPTION_KEY;
    await expect(encryptPrivateKeyIfConfigured('-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----')).rejects.toThrow(
      /FIEL_ENCRYPTION_KEY/i
    );

    process.env.FIEL_ENCRYPTION_KEY = '   ';
    await expect(encryptPrivateKeyIfConfigured('-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----')).rejects.toThrow(
      /FIEL_ENCRYPTION_KEY/i
    );

    process.env.FIEL_ENCRYPTION_KEY = 'LlaveFiel_México_2026_🔐!';
    const pem = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQE=\n-----END PRIVATE KEY-----';
    const enc = await encryptPrivateKeyIfConfigured(pem);
    expect(enc.startsWith('ENC:v1:')).toBe(true);
    expect(enc).not.toContain('BEGIN PRIVATE KEY');

    const dec = await decryptPrivateKeyIfNeeded(enc);
    expect(dec).toBe(pem);

    delete process.env.FIEL_ENCRYPTION_KEY;
    await expect(decryptPrivateKeyIfNeeded(enc)).rejects.toThrow(/FIEL_ENCRYPTION_KEY/i);

    const handlersSrc = readRepoFile('supabase/functions/sat-soap-sync/handlers.ts');
    expect(handlersSrc).toContain("if (modoEjecucion === 'SAT_LIVE' && (!creds.privateKeyPem || !creds.cerBase64))");
    expect(handlersSrc).toContain(".upsert(batch, { onConflict: 'company_id,uuid', ignoreDuplicates: true })");
    expect(handlersSrc).toContain('codigo_estado_sat: codigoEstadoSol');
    expect(handlersSrc).toContain("nuevoEstado = 'PARCIAL'");

    const soapClientSrc = readRepoFile('src/lib/supabase/supabase-soap-download.ts');
    expect(soapClientSrc).toContain('Token de sesión inválido o expirado ante el SAT');
    expect(soapClientSrc).toContain('codigo_estado_sat: resolvedSatCode');
  });

  test('5. Paginación >1,000 filas con fetchAllRows y orden determinista en catálogos/annual-tax', async () => {
    const totalRows = 2350;
    const allItems = Array.from({ length: totalRows }, (_, i) => ({ id: `row_${i + 1}`, idx: i }));
    const calls: Array<[number, number]> = [];

    const fetched = await fetchAllRows(async (from, to) => {
      calls.push([from, to]);
      return {
        data: allItems.slice(from, to + 1),
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      } as unknown as PostgrestResponse<{ id: string; idx: number }>;
    });

    expect(fetched).toHaveLength(2350);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999]
    ]);

    const annualTaxSrc = readRepoFile('src/lib/supabase/supabase-annual-tax.ts');
    expect(annualTaxSrc).toContain('CFDI_ANNUAL_PROJECTION');
    expect(annualTaxSrc).not.toContain("from('cfdi_documents').select('*')");
    expect(annualTaxSrc).toContain(".order('fecha', { ascending: false })\n          .order('id', { ascending: true })");

    const mappersSrc = readRepoFile('src/lib/supabase/supabase-mappers.ts');
    expect(mappersSrc).toContain('fetchAllRows');
    const fiscalAssetsSrc = readRepoFile('src/lib/supabase/supabase-fiscal-assets.ts');
    expect(fiscalAssetsSrc).toContain('fetchAllRows');
    const rulesSrc = readRepoFile('src/lib/supabase/supabase-accounting-rules.ts');
    expect(rulesSrc).toContain('fetchAllRows');
    const polizasMappersSrc = readRepoFile('src/lib/supabase/supabase-polizas-mappers.ts');
    expect(polizasMappersSrc).toContain('fetchAllRows');
  });

  test('6. supabase-cfdi-poliza valida partida doble, reintenta 23505, usa guarda atómica y contexto batch', async () => {
    const accounts: AccountWithBalance[] = [
      {
        id: 'acc_gasto',
        companyId: 'comp_1',
        code: '601-01-001',
        name: 'Gastos Generales',
        parentCode: '601-01',
        type: 'GASTOS',
        nature: 'DEUDORA',
        level: 3,
        isAffectable: true,
        satGroupCode: '601.01',
        currency: 'MXN',
        initialBalance: 0,
        initialBalanceComputed: 0,
        periodCharges: 0,
        periodCredits: 0,
        finalBalance: 0
      },
      {
        id: 'acc_iva',
        companyId: 'comp_1',
        code: '118-01-001',
        name: 'IVA Acreditable Pagado',
        parentCode: '118-01',
        type: 'ACTIVO',
        nature: 'DEUDORA',
        level: 3,
        isAffectable: true,
        satGroupCode: '118.01',
        currency: 'MXN',
        initialBalance: 0,
        initialBalanceComputed: 0,
        periodCharges: 0,
        periodCredits: 0,
        finalBalance: 0
      },
      {
        id: 'acc_prov',
        companyId: 'comp_1',
        code: '201-01-001',
        name: 'Proveedores Nacionales',
        parentCode: '201-01',
        type: 'PASIVO',
        nature: 'ACREEDORA',
        level: 3,
        isAffectable: true,
        satGroupCode: '201.01',
        currency: 'MXN',
        initialBalance: 0,
        initialBalanceComputed: 0,
        periodCharges: 0,
        periodCredits: 0,
        finalBalance: 0
      }
    ];

    const batchContext: AutoPolizaBatchContext = {
      accounts,
      rules: [],
      thirdParties: new Map(),
      periodLocks: new Map([['2026-10', false]])
    };

    const baseCfdiRow = {
      id: 'cfdi_test_1',
      company_id: 'comp_1',
      uuid: '11111111-2222-3333-4444-555555555555',
      fecha: '2026-10-15',
      tipo_comprobante: 'I',
      direction: 'RECIBIDO',
      serie: 'A',
      folio: '10',
      emisor_rfc: 'PRO010101AAA',
      emisor_nombre: 'Proveedor SA',
      receptor_rfc: 'EMP010101BBB',
      receptor_nombre: 'Empresa SA',
      concepto_principal: 'Honorarios',
      clave_prod_serv: '84111506',
      moneda: 'MXN',
      tipo_cambio: 1,
      subtotal: 1000,
      descuento: 0,
      iva_trasladado: 160,
      isr_retenido: 0,
      iva_retenido: 0,
      total: 1160,
      metodo_pago: 'PUE',
      forma_pago: '03',
      uso_cfdi: 'G03',
      status_sat: 'VIGENTE',
      poliza_id: null
    };

    let polizaInsertAttempts = 0;
    let claimedZeroRows = false;
    let deletedPolizaIds: string[] = [];
    let queriedThirdParties = false;

    const makeMockClient = (opts: { simulateConflictOnce?: boolean; simulateConcurrentClaim?: boolean }) =>
      ({
        from(table: string) {
          let isNullCol: string | null = null;
          let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
          let insertPayload: Record<string, unknown> | null = null;
          const b = {
            select: () => b,
            eq: () => b,
            in: () => b,
            is: (col: string, val: unknown) => {
              if (val === null) isNullCol = col;
              return b;
            },
            order: () => b,
            limit: () => b,
            insert: (payload: Record<string, unknown>) => {
              op = 'insert';
              insertPayload = payload;
              return b;
            },
            update: () => {
              op = 'update';
              return b;
            },
            delete: () => {
              op = 'delete';
              return b;
            },
            single: async () => {
              if (table === 'cfdi_documents') {
                return { data: baseCfdiRow, error: null };
              }
              return { data: null, error: null };
            },
            maybeSingle: async () => {
              if (table === 'third_parties') queriedThirdParties = true;
              return { data: null, error: null };
            },
            then: (resolve: (res: { data: unknown; error: { code?: string; message: string } | null }) => void) => {
              if (table === 'third_parties') queriedThirdParties = true;
              if (table === 'polizas' && op === 'select') {
                resolve({ data: [{ folio: 5 }], error: null });
                return;
              }
              if (table === 'polizas' && op === 'insert') {
                polizaInsertAttempts += 1;
                if (opts.simulateConflictOnce && polizaInsertAttempts === 1) {
                  resolve({ data: null, error: { code: '23505', message: 'duplicate key uq_polizas_company_folio' } });
                  return;
                }
                resolve({ data: [insertPayload], error: null });
                return;
              }
              if (table === 'polizas' && op === 'delete') {
                deletedPolizaIds.push('deleted');
                resolve({ data: [], error: null });
                return;
              }
              if (table === 'poliza_movements' && op === 'insert') {
                resolve({ data: [], error: null });
                return;
              }
              if (table === 'cfdi_documents' && op === 'update') {
                expect(isNullCol).toBe('poliza_id');
                if (opts.simulateConcurrentClaim) {
                  claimedZeroRows = true;
                  resolve({ data: [], error: null });
                  return;
                }
                resolve({ data: [{ id: baseCfdiRow.id }], error: null });
                return;
              }
              resolve({ data: [], error: null });
            }
          };
          return b;
        }
      }) as unknown as SupabaseClient;

    // Caso 1: Reintento 23505 + uso de contexto precargado (no consulta third_parties)
    const pol = await runAutoPolizaFromCfdiWithClient(
      makeMockClient({ simulateConflictOnce: true }),
      'cfdi_test_1',
      undefined,
      batchContext
    );
    expect(polizaInsertAttempts).toBe(2);
    expect(pol.folio).toBe(7);
    expect(pol.isBalanced).toBe(true);
    expect(queriedThirdParties).toBe(false);

    // Caso 2: Guarda atómica .is('poliza_id', null) detecta carrera concurrente y revierte póliza
    await expect(
      runAutoPolizaFromCfdiWithClient(
        makeMockClient({ simulateConcurrentClaim: true }),
        'cfdi_test_1',
        undefined,
        batchContext
      )
    ).rejects.toThrow(/contabilizado concurrentemente/i);
    expect(claimedZeroRows).toBe(true);
    expect(deletedPolizaIds.length).toBeGreaterThan(0);

    // Caso 3: Rechaza movimientos descuadrados sin insertar
    const polizaSource = readRepoFile('src/lib/supabase/supabase-cfdi-poliza.ts');
    expect(polizaSource).toContain('if (!plan.isBalanced)');
    expect(polizaSource).toContain('validateDoubleEntryMovements(plan.movements, accMap)');
  });

  test('7. Guardas de solo lectura en payroll-settings y helpers de cuentas abiertas/organización', async () => {
    setClientReadOnlyMode(true);
    await expect(
      savePayrollPeriodSettings({
        companyId: 'comp_1',
        ejercicio: 2026,
        periodo: 10,
        stateCode: 'CMX',
        isnRate: 4.0,
        imssPatronal: 1000,
        rcv: 200,
        infonavit: 500
      })
    ).rejects.toThrow(/solo lectura/i);
    setClientReadOnlyMode(false);

    // resolveActiveOrganizationId prioriza membresía activa SOCIO/CONTADOR
    const orgSb = {
      from(table: string) {
        const b = {
          select: () => b,
          eq: () => b,
          in: () => b,
          order: () => b,
          limit: () => b,
          maybeSingle: async () => {
            if (table === 'workspace_members') return { data: { workspace_id: 'ws_despacho_real' }, error: null };
            return { data: { workspace_id: 'ws_personal' }, error: null };
          }
        };
        return b;
      }
    } as unknown as SupabaseClient;
    expect(await resolveActiveOrganizationId(orgSb, 'usr_12345678')).toBe('ws_despacho_real');

    // propagateOpenAccountNameToMovements omite pólizas de periodos cerrados
    const updatedPolizaChunks: string[][] = [];
    const accSb = {
      from(table: string) {
        let op = 'select';
        const b = {
          select: () => b,
          eq: () => b,
          in: (col: string, vals: string[]) => {
            if (op === 'update' && col === 'poliza_id') updatedPolizaChunks.push(vals);
            return b;
          },
          order: () => b,
          range: () => b,
          update: () => {
            op = 'update';
            return b;
          },
          then: (resolve: (r: { data: unknown[]; error: null }) => void) => {
            if (table === 'period_locks') {
              resolve({ data: [{ ejercicio: 2026, periodo: 9, is_locked: true }], error: null });
              return;
            }
            if (table === 'poliza_movements' && op === 'select') {
              resolve({
                data: [
                  { poliza_id: 'pol_closed', polizas: { ejercicio: 2026, periodo: 9 } },
                  { poliza_id: 'pol_open', polizas: { ejercicio: 2026, periodo: 10 } }
                ],
                error: null
              });
              return;
            }
            resolve({ data: [], error: null });
          }
        };
        return b;
      }
    } as unknown as SupabaseClient;

    await propagateOpenAccountNameToMovements(accSb, 'comp_1', 'acc_1', 'Nuevo Nombre');
    expect(updatedPolizaChunks).toEqual([['pol_open']]);
  });

  test('8. Invariante CI: todos los archivos src/ modificados en Ola 1 son <= 350 líneas y sin `: any` en vistas', () => {
    const ola1SrcFiles = [
      'src/lib/supabase/supabase-accounts-helpers.ts',
      'src/lib/supabase/supabase-companies-accounts.ts',
      'src/lib/supabase/supabase-mappers.ts',
      'src/lib/supabase/supabase-fiscal-assets.ts',
      'src/lib/supabase/supabase-accounting-rules.ts',
      'src/lib/supabase/supabase-polizas-mappers.ts',
      'src/lib/supabase/supabase-annual-tax.ts',
      'src/lib/supabase/supabase-payroll-settings.ts',
      'src/lib/supabase/supabase-cfdi-poliza.ts',
      'src/lib/supabase/supabase-cfdi-poliza-batch.ts',
      'src/lib/supabase/supabase-cfdi.ts',
      'src/lib/supabase/supabase-soap-download.ts',
      'src/lib/supabase/supabase-soap-mappers.ts',
      'src/views/ajustes/AjustesEquipoTab.tsx',
      'src/views/cfdi/sat-soap/SatRequestsHistoryCard.tsx'
    ];
    for (const rel of ola1SrcFiles) {
      const content = readRepoFile(rel);
      const lineCount = content.split(/\r?\n/).length;
      expect(lineCount).toBeLessThanOrEqual(350);
    }

    for (const viewRel of [
      'src/views/ajustes/AjustesEquipoTab.tsx',
      'src/views/cfdi/sat-soap/SatRequestsHistoryCard.tsx'
    ]) {
      expect(readRepoFile(viewRel)).not.toMatch(/:\s*any\b/);
    }
  });
});
