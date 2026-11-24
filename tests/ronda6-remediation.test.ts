import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { api } from '../src/server/api';
import { initDatabase } from '../src/server/schema';
import { createCompanyRecord, deleteCompanyRecord } from '../src/server/repositories/companies.repo';
import { getAccounts } from '../src/server/repositories/accounts.repo';
import {
  createPolizaTransaction,
  getPolizas,
  updatePolizaTransaction
} from '../src/server/repositories/polizas.repo';
import { closeYearPolizaTransaction } from '../src/server/repositories/polizas-closing.repo';
import { generateAutoPolizaFromCfdiId, insertParsedCfdiRecord } from '../src/server/repositories/cfdi.repo';
import { setPeriodLock } from '../src/server/repositories/period-locks.repo';
import { formatPolizaAsientoText } from '../src/shared/poliza-format';
import { getSeedAccountsForPreset } from '../src/shared/catalogs/base-accounts.seed';
import {
  buildYearCloseMovements,
  resolveFiscalAccount,
  validateAccountHierarchy
} from '../src/shared/accounting-engine';
import { supabase } from '../src/lib/supabase';
import { supabaseClosingAndVerification } from '../src/lib/supabase/supabase-closing-verification';
import { supabasePolizas } from '../src/lib/supabase/supabase-polizas';
import type { AccountWithBalance, Company } from '../src/shared/types';

describe('Ronda 6 — Remediation & Architectural Integrity Suite', () => {
  const createdCompanyIds: string[] = [];

  beforeAll(() => {
    initDatabase();
  });

  afterAll(() => {
    for (const id of createdCompanyIds) {
      deleteCompanyRecord(id);
    }
  });

  test('1. getSeedAccountsForPreset generates distinct, valid, fiscally complete catalogs', () => {
    const sat = getSeedAccountsForPreset('SAT_STANDARD');
    const resico = getSeedAccountsForPreset('RESICO_SIMPLIFIED');
    const custom = getSeedAccountsForPreset('CUSTOM');

    expect(sat.length).toBeGreaterThan(resico.length - 1);
    expect(resico.some((a) => a.code === '401-01-003')).toBe(true);
    expect(sat.some((a) => a.code === '401-01-003')).toBe(false);
    expect(custom.some((a) => a.code === '102-01-002')).toBe(false);

    for (const preset of ['SAT_STANDARD', 'RESICO_SIMPLIFIED', 'CUSTOM'] as const) {
      const seed = getSeedAccountsForPreset(preset).map((a, idx) => ({
        ...a,
        id: `acc_${preset}_${idx}`,
        companyId: 'test'
      }));
      const codes = new Set(seed.map((a) => a.code));
      expect(codes.size).toBe(seed.length);

      expect(resolveFiscalAccount(seed, 'IVA_ACREDITABLE_PAGADO').code).toBe('118-01-001');
      expect(resolveFiscalAccount(seed, 'IVA_TRASLADADO_COBRADO').code).toBe('208-01-001');
      expect(resolveFiscalAccount(seed, 'RESULTADO_DEL_EJERCICIO').code).toBe('305-01-001');
      expect(resolveFiscalAccount(seed, 'GASTO_IMPUESTO_UTILIDAD').code).toBe('801-01-001');

      for (const acc of seed) {
        const { level } = validateAccountHierarchy(seed, acc.parentCode, acc.code);
        expect(level).toBe(acc.level);
      }
    }

    const companyResico = createCompanyRecord({
      name: 'RESICO PRESET TEST SA DE CV',
      rfc: 'RPT200101AA1',
      regimenFiscal: '626',
      codigoPostal: '64000',
      currentYear: 2026,
      currentPeriod: 3,
      catalogPreset: 'RESICO_SIMPLIFIED'
    });
    createdCompanyIds.push(companyResico.id);

    const persisted = getAccounts(companyResico.id);
    expect(persisted.some((a) => a.code === '401-01-003')).toBe(true);
    const revenue = persisted.find((a) => a.code === '401-01-001');
    expect(revenue?.name).toContain('RESICO');
  });

  test('2. UTC-6 Safe Dates: updatePolizaTransaction, POST /api/polizas & CFDI Auto-Poliza preserve exact calendar month', async () => {
    const company = createCompanyRecord({
      name: 'CALENDAR UTC6 TEST SA DE CV',
      rfc: 'CUT200101BB2',
      regimenFiscal: '601',
      codigoPostal: '06000',
      currentYear: 2026,
      currentPeriod: 2
    });
    createdCompanyIds.push(company.id);

    const accounts = getAccounts(company.id);
    const bank = accounts.find((a) => a.code === '102-01-001')!;
    const sales = accounts.find((a) => a.code === '401-01-001')!;

    const created = createPolizaTransaction({
      companyId: company.id,
      ejercicio: 2026,
      periodo: 2,
      tipo: 'INGRESO',
      fecha: '2026-02-15',
      concepto: 'Ingreso prueba Febrero',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: bank.id, cargo: 1000, abono: 0 },
        { accountId: sales.id, cargo: 0, abono: 1000 }
      ]
    });

    const updated = updatePolizaTransaction(created.id, {
      fecha: '2026-04-01',
      concepto: 'Reclasificada a Abril dia 1',
      movements: [
        { accountId: bank.id, cargo: 1000, abono: 0 },
        { accountId: sales.id, cargo: 0, abono: 1000 }
      ]
    });
    expect(updated).toBe(true);

    const aprilPolizas = getPolizas(company.id, 2026, 4);
    expect(aprilPolizas.some((p) => p.id === created.id && p.periodo === 4 && p.ejercicio === 2026)).toBe(true);

    const cfdi = insertParsedCfdiRecord(company, {
      uuid: '11111111-2222-3333-4444-555555555555',
      serie: 'F',
      folio: '501',
      fecha: '2026-05-01',
      tipoComprobante: 'I',
      emisorRfc: 'PRO010203CC3',
      emisorNombre: 'PROVEEDOR MAYO SA',
      receptorRfc: company.rfc,
      receptorNombre: company.name,
      conceptoPrincipal: 'Honorarios día primero de mayo',
      claveProdServ: '80111600',
      moneda: 'MXN',
      tipoCambio: 1,
      subtotal: 2000,
      descuento: 0,
      ivaTrasladado: 320,
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 2320,
      metodoPago: 'PUE',
      formaPago: '03',
      usoCfdi: 'G03',
      uuidRelacionado: null,
      xmlRaw: '<cfdi:Comprobante/>'
    });

    const autoPol = generateAutoPolizaFromCfdiId(cfdi.id);
    expect(autoPol.ejercicio).toBe(2026);
    expect(autoPol.periodo).toBe(5);

    const resUnbalanced = await api.request('http://localhost/api/polizas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: company.id,
        tipo: 'DIARIO',
        fecha: '2026-03-01',
        concepto: 'Descuadrada',
        movements: [
          { accountId: bank.id, cargo: 500, abono: 0 },
          { accountId: sales.id, cargo: 0, abono: 400 }
        ]
      })
    });
    expect(resUnbalanced.status).toBe(400);

    const resMarch = await api.request('http://localhost/api/polizas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: company.id,
        tipo: 'DIARIO',
        fecha: '2026-03-01',
        concepto: 'Registro Marzo dia 1',
        movements: [
          { accountId: bank.id, cargo: 500, abono: 0 },
          { accountId: sales.id, cargo: 0, abono: 500 }
        ]
      })
    });
    expect(resMarch.status).toBe(201);
    const marchCreated = (await resMarch.json()) as { ejercicio: number; periodo: number };
    expect(marchCreated.ejercicio).toBe(2026);
    expect(marchCreated.periodo).toBe(3);
  });

  test('3. formatPolizaAsientoText renders human-readable tabular journal entry', () => {
    const text = formatPolizaAsientoText({
      id: 'pol_fmt_1',
      companyId: 'comp_1',
      tipo: 'EGRESO',
      folio: 12,
      fecha: '2026-06-15',
      ejercicio: 2026,
      periodo: 6,
      concepto: 'Pago renta oficina',
      cfdiUuid: null,
      origin: 'MANUAL',
      createdAt: '2026-06-15T12:00:00Z',
      totalCargos: 11600,
      totalAbonos: 11600,
      isBalanced: true,
      movements: [
        {
          id: 'm1',
          polizaId: 'pol_fmt_1',
          accountId: 'a1',
          accountCode: '601-01-002',
          accountName: 'Arrendamiento de Inmuebles',
          referencia: 'E-12',
          concepto: 'Renta junio',
          cargo: 10000,
          abono: 0,
          cfdiUuid: null
        },
        {
          id: 'm2',
          polizaId: 'pol_fmt_1',
          accountId: 'a2',
          accountCode: '118-01-001',
          accountName: 'IVA Acreditable Pagado',
          referencia: '',
          concepto: 'IVA',
          cargo: 1600,
          abono: 0,
          cfdiUuid: null
        },
        {
          id: 'm3',
          polizaId: 'pol_fmt_1',
          accountId: 'a3',
          accountCode: '102-01-001',
          accountName: 'Bancos Nacionales',
          referencia: 'SPEI',
          concepto: 'Transferencia',
          cargo: 0,
          abono: 11600,
          cfdiUuid: null
        }
      ]
    });

    expect(text).toContain('PÓLIZA DE EGRESO #12 | 2026-06-15 | 2026-P06');
    expect(text).toContain('Concepto: Pago renta oficina');
    expect(text).toContain('601-01-002 Arrendamiento de Inmuebles [Ref: E-12]');
    expect(text).toContain('Totales | Cargos: $');
  });

  test('4. Year-end closing supports idempotent re-close, initialBalanceComputed & enforces Period 13 lock', () => {
    const company = createCompanyRecord({
      name: 'CIERRE ANUAL TEST SA DE CV',
      rfc: 'CAT200101DD4',
      regimenFiscal: '601',
      codigoPostal: '64000',
      currentYear: 2026,
      currentPeriod: 12
    });
    createdCompanyIds.push(company.id);

    const accounts = getAccounts(company.id);
    const bank = accounts.find((a) => a.code === '102-01-001')!;
    const sales = accounts.find((a) => a.code === '401-01-001')!;
    const expense = accounts.find((a) => a.code === '601-01-002')!;

    createPolizaTransaction({
      companyId: company.id,
      ejercicio: 2026,
      periodo: 11,
      tipo: 'INGRESO',
      fecha: '2026-11-10',
      concepto: 'Venta noviembre',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: bank.id, cargo: 10000, abono: 0 },
        { accountId: sales.id, cargo: 0, abono: 10000 }
      ]
    });

    const firstClose = closeYearPolizaTransaction(company.id, 2026, false);
    expect(firstClose.closed).toBe(true);
    expect(firstClose.utilidadTraspasada).toBe(10000);
    expect(getPolizas(company.id, 2026, 13)).toHaveLength(1);

    createPolizaTransaction({
      companyId: company.id,
      ejercicio: 2026,
      periodo: 12,
      tipo: 'EGRESO',
      fecha: '2026-12-05',
      concepto: 'Gasto diciembre',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: expense.id, cargo: 2500, abono: 0 },
        { accountId: bank.id, cargo: 0, abono: 2500 }
      ]
    });

    const secondClose = closeYearPolizaTransaction(company.id, 2026, false);
    expect(secondClose.closed).toBe(true);
    expect(secondClose.utilidadTraspasada).toBe(7500);
    const p13 = getPolizas(company.id, 2026, 13);
    expect(p13).toHaveLength(1);
    expect(p13[0]?.id).toBe(secondClose.polizaId);

    setPeriodLock(company.id, 2026, 13, true, 'Cierre auditado');
    expect(() => closeYearPolizaTransaction(company.id, 2026, false)).toThrow('CERRADO');

    const equity = resolveFiscalAccount(accounts, 'RESULTADO_DEL_EJERCICIO');
    const mockTb: AccountWithBalance[] = [
      { ...sales, periodCharges: 0, periodCredits: 0, finalBalance: 0, initialBalanceComputed: 5000 },
      { ...expense, periodCharges: 0, periodCredits: 0, finalBalance: 0, initialBalanceComputed: 1200 },
      { ...equity, periodCharges: 0, periodCredits: 0, finalBalance: 0, initialBalanceComputed: 0 }
    ];
    const computedClose = buildYearCloseMovements(mockTb, 2026, 'initialBalanceComputed');
    expect(computedClose.utilidadTraspasada).toBe(3800);
    const sumCargos = computedClose.movements.reduce((s, m) => s + m.cargo, 0);
    const sumAbonos = computedClose.movements.reduce((s, m) => s + m.abono, 0);
    expect(sumCargos).toBe(sumAbonos);
  });

  test('5. Hono Security Routes: POST /companies/restore (400 & 403), GET /admin/metrics (403 & Bearer 200), and Supabase null guards', async () => {
    const badRestore = await api.request('http://localhost/api/companies/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': 'owner-a' },
      body: JSON.stringify({ broken: true })
    });
    expect(badRestore.status).toBe(400);

    const owned = createCompanyRecord({
      name: 'OWNER A EMPRESA SA DE CV',
      rfc: 'OAE200101EE5',
      regimenFiscal: '601',
      codigoPostal: '06000',
      userId: 'owner-user-a'
    }) as Company;
    createdCompanyIds.push(owned.id);

    const crossTenant = await api.request('http://localhost/api/companies/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': 'attacker-user-b' },
      body: JSON.stringify({
        company: {
          id: owned.id,
          name: 'HIJACKED NAME',
          rfc: owned.rfc,
          regimenFiscal: '601',
          codigoPostal: '06000'
        },
        accounts: [],
        polizas: [],
        cfdis: []
      })
    });
    expect(crossTenant.status).toBe(403);

    const validRestore = await api.request('http://localhost/api/companies/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': 'owner-user-a' },
      body: JSON.stringify({
        company: {
          id: owned.id,
          name: 'OWNER A RESTORED SA DE CV',
          rfc: owned.rfc,
          regimenFiscal: '601',
          codigoPostal: '06000'
        },
        accounts: [],
        polizas: [],
        cfdis: []
      })
    });
    expect(validRestore.status).toBe(201);

    const prevSecret = process.env.ADMIN_SECRET;
    process.env.ADMIN_SECRET = 'r6-unit-admin-secret';
    try {
      const denied = await api.request('http://localhost/api/admin/metrics');
      expect(denied.status).toBe(403);

      const allowed = await api.request('http://localhost/api/admin/metrics', {
        headers: { Authorization: 'Bearer r6-unit-admin-secret' }
      });
      expect(allowed.status).toBe(200);
    } finally {
      if (prevSecret === undefined) delete process.env.ADMIN_SECRET;
      else process.env.ADMIN_SECRET = prevSecret;
    }

    if (!supabase) {
      await expect(
        supabasePolizas.updatePoliza('pol_missing', {
          tipo: 'DIARIO',
          fecha: '2026-01-15',
          concepto: 'x',
          movements: []
        })
      ).rejects.toThrow('Supabase no disponible');
      await expect(supabaseClosingAndVerification.closeYearPoliza('comp_missing')).rejects.toThrow(
        'Supabase no disponible'
      );
    } else {
      const makeEmptyQuery = () => {
        const result = { data: [] as unknown[], error: null };
        const q: Record<string, unknown> = {
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
          then: (resolve: (val: typeof result) => unknown) => Promise.resolve(result).then(resolve)
        };
        const proxy: unknown = new Proxy(q, {
          get(target, prop) {
            if (prop in target) return target[prop as keyof typeof target];
            return () => proxy;
          }
        });
        return proxy;
      };
      const fromSpy = spyOn(supabase, 'from').mockImplementation((() => makeEmptyQuery()) as unknown as typeof supabase.from);
      const authSpy = spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: null },
        error: null
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);
      try {
        await expect(
          supabasePolizas.updatePoliza('pol_missing', {
            tipo: 'DIARIO',
            fecha: '2026-01-15',
            concepto: 'x',
            movements: []
          })
        ).rejects.toThrow(/Póliza no encontrada/);
        await expect(supabaseClosingAndVerification.closeYearPoliza('comp_missing')).rejects.toThrow(
          /Empresa no encontrada|Supabase no disponible/
        );
      } finally {
        fromSpy.mockRestore();
        authSpy.mockRestore();
      }
    }
  });
});
