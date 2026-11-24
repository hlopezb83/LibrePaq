import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import {
  buildAutoPolizaPlan,
  resolveMatchingAccountingRule
} from '../src/shared/engine/auto-poliza.engine';
import { validateDoubleEntryMovements } from '../src/shared/engine/invariants-and-math';
import { createMockCatalog } from '../src/shared/__tests__/test-helpers';
import type { Account, CfdiDocument } from '../src/shared/types';
import type { AccountingRuleRecord } from '../src/shared/types/accounting-rules.types';
import {
  createCompanyRecord,
  db,
  deleteCompanyRecord,
  initDatabase
} from '../src/server/db';
import {
  deleteAccountingRuleRepo,
  ensureAccountingRulesTable,
  listAccountingRulesRepo,
  upsertAccountingRuleRepo
} from '../src/server/repositories/accounting-rules.repo';
import { accountingRulesRoutes } from '../src/server/routes/accounting-rules.routes';

function makeRule(overrides: Partial<AccountingRuleRecord>): AccountingRuleRecord {
  return {
    id: overrides.id ?? 'rule-1',
    companyId: overrides.companyId ?? 'comp-test',
    name: overrides.name ?? 'Regla Test',
    matchRfc: overrides.matchRfc ?? null,
    matchClaveProdServ: overrides.matchClaveProdServ ?? null,
    matchUsoCfdi: overrides.matchUsoCfdi ?? null,
    direction: overrides.direction ?? 'RECIBIDO',
    operationAccountCode: overrides.operationAccountCode ?? '601-01-003',
    counterAccountCode: overrides.counterAccountCode ?? null,
    deductiblePct: overrides.deductiblePct ?? 100,
    priority: overrides.priority ?? 10,
    autoLearned: overrides.autoLearned ?? false,
    createdAt: overrides.createdAt ?? '2026-10-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-10-01T00:00:00.000Z'
  };
}

function makeRecibidoCfdi(overrides: Partial<CfdiDocument> = {}): CfdiDocument {
  return {
    id: 'cfdi-rule-1',
    companyId: 'comp-test',
    uuid: 'AA111111-1111-4111-8111-111111111111',
    fecha: '2026-10-15',
    tipoComprobante: 'I',
    direction: 'RECIBIDO',
    serie: 'F',
    folio: '100',
    emisorRfc: 'PRO180214A99',
    emisorNombre: 'RESTAURANTE CORPORATIVO SA',
    receptorRfc: 'TNN2105148K2',
    receptorNombre: 'TECNOLOGIAS NUBE DEL NORTE',
    conceptoPrincipal: 'Consumo de alimentos',
    claveProdServ: '90101501',
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
    statusSat: 'VIGENTE',
    polizaId: null,
    xmlRaw: '<cfdi:Comprobante/>',
    ...overrides
  };
}

describe('Ola 2B — Reglas Contables Aprendidas y No Deducibles (801)', () => {
  const { accounts: baseMockAccounts, byId: baseById } = createMockCatalog();
  const accNoDed: Account = {
    id: 'acc-801',
    companyId: 'comp-test',
    code: '801-01-001',
    name: 'Gastos No Deducibles (Art. 28 LISR)',
    parentCode: '801-01-000',
    type: 'GASTOS',
    nature: 'DEUDORA',
    level: 3,
    isAffectable: true,
    satGroupCode: '611.01',
    currency: 'MXN',
    initialBalance: 0
  };
  const accComisiones: Account = {
    id: 'acc-601-005',
    companyId: 'comp-test',
    code: '601-01-005',
    name: 'Comisiones y Consumos',
    parentCode: '601-00-000',
    type: 'GASTOS',
    nature: 'DEUDORA',
    level: 3,
    isAffectable: true,
    satGroupCode: '701.10',
    currency: 'MXN',
    initialBalance: 0
  };
  const accounts = [...baseMockAccounts, accNoDed, accComisiones];
  const byId = new Map(baseById);
  byId.set(accNoDed.id, accNoDed);
  byId.set(accComisiones.id, accComisiones);

  const createdCompanyIds: string[] = [];

  beforeAll(() => {
    initDatabase();
  });

  afterAll(() => {
    for (const id of createdCompanyIds) {
      deleteCompanyRecord(id, 'owner_2b');
      deleteCompanyRecord(id);
    }
  });

  test('1. Prioridad de coincidencia: matchRfc > matchClaveProdServ > matchUsoCfdi y priority DESC', () => {
    const cfdi = makeRecibidoCfdi();
    const ruleUso = makeRule({
      id: 'r-uso',
      matchUsoCfdi: 'G03',
      operationAccountCode: '601-01-001',
      priority: 100
    });
    const ruleClave = makeRule({
      id: 'r-clave',
      matchClaveProdServ: '90101501',
      operationAccountCode: '501-01-001',
      priority: 80
    });
    const ruleRfcLowPrio = makeRule({
      id: 'r-rfc-low',
      matchRfc: 'PRO180214A99',
      operationAccountCode: '601-01-005',
      priority: 10
    });
    const ruleRfcHighPrio = makeRule({
      id: 'r-rfc-high',
      matchRfc: 'PRO180214A99',
      operationAccountCode: '601-01-003',
      priority: 30
    });
    const ruleEmitido = makeRule({
      id: 'r-emitido',
      direction: 'EMITIDO',
      matchRfc: 'PRO180214A99',
      matchClaveProdServ: '90101501',
      operationAccountCode: '401-01-001',
      priority: 999
    });

    // RFC beats ClaveProdServ & UsoCFDI regardless of numeric priority; within RFC, menor número = mayor prioridad (ASC)
    const matched = resolveMatchingAccountingRule(cfdi, [
      ruleUso,
      ruleClave,
      ruleRfcLowPrio,
      ruleRfcHighPrio,
      ruleEmitido
    ]);
    expect(matched?.id).toBe('r-rfc-low');

    // Without RFC rule, ClaveProdServ beats UsoCFDI
    const matchedNoRfc = resolveMatchingAccountingRule(cfdi, [ruleUso, ruleClave]);
    expect(matchedNoRfc?.id).toBe('r-clave');

    // Manual override beats matched rule operationAccountCode
    const planWithManual = buildAutoPolizaPlan(cfdi, accounts, {
      rules: [ruleRfcHighPrio],
      operationAccountCode: '501-01-001'
    });
    expect(planWithManual.movements.some((m) => m.accountCode === '501-01-001')).toBe(true);
  });

  test('2. División exacta al centavo de gasto deducible vs no deducible 801 + IVA proporcional (Debe = Haber)', () => {
    const cfdi = makeRecibidoCfdi({
      subtotal: 1000,
      ivaTrasladado: 160,
      total: 1160
    });
    const rule50 = makeRule({
      id: 'r-50',
      matchRfc: 'PRO180214A99',
      operationAccountCode: '601-01-005',
      deductiblePct: 50
    });

    const plan50 = buildAutoPolizaPlan(cfdi, accounts, { rules: [rule50] });
    expect(plan50.isBalanced).toBe(true);
    expect(plan50.totalCargo).toBe(1160);
    expect(plan50.totalAbono).toBe(1160);

    const validation50 = validateDoubleEntryMovements(plan50.movements, byId);
    expect(validation50.totalCargo).toBe(1160);
    expect(validation50.totalAbono).toBe(1160);

    const gastoCargo = plan50.movements
      .filter((m) => m.accountCode === '601-01-005')
      .reduce((s, m) => s + m.cargo, 0);
    const ivaAcredCargo = plan50.movements
      .filter((m) => m.accountCode === '118-01-001')
      .reduce((s, m) => s + m.cargo, 0);
    const noDedCargo = plan50.movements
      .filter((m) => m.accountCode === '801-01-001')
      .reduce((s, m) => s + m.cargo, 0);

    expect(gastoCargo).toBe(500);
    expect(ivaAcredCargo).toBe(80);
    expect(noDedCargo).toBe(580); // 500 base no deducible + 80 IVA no acreditable

    // 0% deducible (100% no deducible)
    const plan0 = buildAutoPolizaPlan(cfdi, accounts, {
      rules: [{ ...rule50, deductiblePct: 0 }]
    });
    expect(plan0.isBalanced).toBe(true);
    expect(plan0.totalCargo).toBe(1160);
    expect(plan0.movements.some((m) => m.accountCode === '601-01-005')).toBe(false);
    expect(plan0.movements.some((m) => m.accountCode === '118-01-001')).toBe(false);
    const total801 = plan0.movements
      .filter((m) => m.accountCode === '801-01-001')
      .reduce((s, m) => s + m.cargo, 0);
    expect(total801).toBe(1160);

    // Centavos impares (33% de 100.01 + 16.00 IVA = 116.01) sin desviación de centavos
    const oddCfdi = makeRecibidoCfdi({
      subtotal: 100.01,
      ivaTrasladado: 16.0,
      total: 116.01
    });
    const plan33 = buildAutoPolizaPlan(oddCfdi, accounts, {
      rules: [{ ...rule50, deductiblePct: 33 }]
    });
    expect(plan33.isBalanced).toBe(true);
    expect(plan33.totalCargo).toBe(116.01);
    expect(plan33.totalAbono).toBe(116.01);
    validateDoubleEntryMovements(plan33.movements, byId);

    // Fallback a cuenta '801' cuando no existe '801-01-001'
    const fallbackAccounts = accounts.map((a) =>
      a.code === '801-01-001' ? { ...a, code: '801' } : a
    );
    const planFallback = buildAutoPolizaPlan(cfdi, fallbackAccounts, {
      rules: [rule50]
    });
    expect(planFallback.isBalanced).toBe(true);
    expect(
      planFallback.movements.filter((m) => m.accountCode === '801').reduce((s, m) => s + m.cargo, 0)
    ).toBe(580);
  });

  test('3. CRUD SQLite en accounting-rules.repo.ts y rutas Hono con aislamiento multi-tenant', async () => {
    ensureAccountingRulesTable(db);
    ensureAccountingRulesTable(db); // Idempotente

    const publicComp = createCompanyRecord({
      name: 'Empresa Reglas 2B S.A.',
      rfc: 'ERB2105148K2',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000'
    });
    createdCompanyIds.push(publicComp.id);

    const privateComp = createCompanyRecord({
      name: 'Empresa Privada 2B S.A.',
      rfc: 'EPB2105148K9',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      userId: 'owner_2b'
    });
    createdCompanyIds.push(privateComp.id);

    const created = upsertAccountingRuleRepo({
      companyId: publicComp.id,
      name: 'Consumos Restaurante 8.5%',
      matchRfc: 'pro180214a99',
      direction: 'RECIBIDO',
      operationAccountCode: '601-01-005',
      deductiblePct: 8.5,
      priority: 25,
      autoLearned: true
    });

    expect(created.matchRfc).toBe('PRO180214A99');
    expect(created.deductiblePct).toBe(8.5);
    expect(created.autoLearned).toBe(true);

    // Upsert por mismo criterio actualiza la regla existente sin duplicar
    const updated = upsertAccountingRuleRepo({
      companyId: publicComp.id,
      matchRfc: 'PRO180214A99',
      direction: 'RECIBIDO',
      operationAccountCode: '601-01-003',
      deductiblePct: 50,
      priority: 40,
      autoLearned: true
    });
    expect(updated.id).toBe(created.id);
    expect(updated.operationAccountCode).toBe('601-01-003');
    expect(updated.deductiblePct).toBe(50);

    const list = listAccountingRulesRepo(publicComp.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.priority).toBe(40);

    // Rutas Hono montadas en app temporal con basePath '/api'
    const testApi = new Hono().basePath('/api');
    testApi.route('/', accountingRulesRoutes);

    const deniedGet = await testApi.request(
      `/api/companies/${privateComp.id}/accounting-rules`,
      { headers: { 'X-User-Id': 'intruder' } }
    );
    expect(deniedGet.status).toBe(403);

    const postRes = await testApi.request(
      `/api/companies/${privateComp.id}/accounting-rules`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'owner_2b' },
        body: JSON.stringify({
          matchClaveProdServ: '81112501',
          direction: 'RECIBIDO',
          operationAccountCode: '601-01-004',
          deductiblePct: 100,
          priority: 15
        })
      }
    );
    expect(postRes.status).toBe(201);
    const createdViaRoute = (await postRes.json()) as AccountingRuleRecord;
    expect(createdViaRoute.matchClaveProdServ).toBe('81112501');

    const delRes = await testApi.request(
      `/api/companies/${privateComp.id}/accounting-rules/${createdViaRoute.id}`,
      {
        method: 'DELETE',
        headers: { 'X-User-Id': 'owner_2b' }
      }
    );
    expect(delRes.status).toBe(200);

    const deleted = deleteAccountingRuleRepo(publicComp.id, created.id);
    expect(deleted.deleted).toBe(true);
    expect(deleteAccountingRuleRepo(publicComp.id, created.id).deleted).toBe(false);
    expect(listAccountingRulesRepo(publicComp.id)).toHaveLength(0);
  });
});
