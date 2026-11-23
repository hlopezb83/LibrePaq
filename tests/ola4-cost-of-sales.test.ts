import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import {
  createCompanyRecord,
  createPolizaTransaction,
  deleteCompanyRecord,
  getAccounts,
  initDatabase,
  setPeriodLock
} from '../src/server/db';
import {
  computePurchasesFromTrialBalance,
  getInventoryPeriodRepo,
  saveInventoryPeriodRepo
} from '../src/server/repositories/inventory.repo';
import { inventoryRoutes } from '../src/server/routes/inventory.routes';
import {
  buildCostOfSalesPolizaPlan,
  computeCostOfSales
} from '../src/shared/engine/cost-of-sales.engine';
import { toCents, validateDoubleEntryMovements } from '../src/shared/engine/invariants-and-math';
import type { Account } from '../src/shared/types/core.types';
import type { InventoryPeriodRecord } from '../src/shared/types/cost-of-sales.types';

function makeAccount(
  id: string,
  code: string,
  name: string,
  type: Account['type'],
  nature: Account['nature'],
  satGroupCode: string
): Account {
  return {
    id,
    companyId: 'comp_test_4a',
    code,
    name,
    parentCode: null,
    type,
    nature,
    level: 3,
    isAffectable: true,
    satGroupCode,
    currency: 'MXN',
    initialBalance: 0
  };
}

describe('Ola 4A — Costo de Ventas e Inventarios Básicos (PyME Comercial)', () => {
  const createdCompanyIds: string[] = [];

  beforeAll(() => {
    initDatabase();
  });

  afterAll(() => {
    for (const id of createdCompanyIds) {
      deleteCompanyRecord(id, 'owner_4a');
      deleteCompanyRecord(id);
    }
  });

  test('1. Fórmula exacta Inv Inicial + Compras - Inv Final en centavos y piso en 0', () => {
    const res = computeCostOfSales({
      initialInventory: 10000.1,
      purchasesPeriod: 25000.2,
      finalInventory: 8000.05
    });
    expect(res.availableMerchandise).toBe(35000.3);
    expect(res.costOfSales).toBe(27000.25);

    const floorRes = computeCostOfSales({
      initialInventory: 5000,
      purchasesPeriod: 1000,
      finalInventory: 9000
    });
    expect(floorRes.costOfSales).toBe(0);
  });

  test('2. Póliza de Diario cuadrada al centavo (501-01-001 vs 115-01-001 y fallback 501)', () => {
    const accCost = makeAccount('acc_501', '501-01-001', 'Costo de Ventas', 'COSTOS', 'DEUDORA', '501.01');
    const accInv = makeAccount('acc_115', '115-01-001', 'Inventarios / Almacén', 'ACTIVO', 'DEUDORA', '115.01');

    const planWithInv = buildCostOfSalesPolizaPlan({
      companyId: 'comp_test_4a',
      year: 2026,
      period: 10,
      fecha: '2026-10-31',
      costOfSales: 43210.67,
      accounts: [accCost, accInv]
    });

    expect(planWithInv.tipo).toBe('DIARIO');
    expect(planWithInv.fecha).toBe('2026-10-31');
    expect(planWithInv.movements).toHaveLength(2);
    expect(planWithInv.movements[0]?.accountCode).toBe('501-01-001');
    expect(planWithInv.movements[0]?.cargo).toBe(43210.67);
    expect(planWithInv.movements[1]?.accountCode).toBe('115-01-001');
    expect(planWithInv.movements[1]?.abono).toBe(43210.67);
    expect(toCents(planWithInv.totalCargo)).toBe(toCents(planWithInv.totalAbono));

    const accById = new Map([accCost, accInv].map((a) => [a.id, a]));
    const validated = validateDoubleEntryMovements(planWithInv.movements, accById);
    expect(validated.totalCargo).toBe(43210.67);
    expect(validated.totalAbono).toBe(43210.67);

    // Fallback cuando no existe 115-01-001 en el catálogo pero existe otra cuenta 501 de compras
    const accPurchases501 = makeAccount('acc_501_comp', '501-02-001', 'Compras Netas', 'COSTOS', 'DEUDORA', '501.02');
    const planFallback = buildCostOfSalesPolizaPlan({
      companyId: 'comp_test_4a',
      year: 2026,
      period: 10,
      costOfSales: 12500.33,
      accounts: [accCost, accPurchases501]
    });
    expect(planFallback.fecha).toBe('2026-10-31');
    expect(planFallback.movements[0]?.accountCode).toBe('501-01-001');
    expect(planFallback.movements[1]?.accountCode).toBe('501-02-001');
    expect(planFallback.totalCargo).toBe(12500.33);
    expect(planFallback.totalAbono).toBe(12500.33);

    // Sin cuenta de Inventarios ni Compras distinta a Costo de Ventas debe lanzar error (BUG-29)
    expect(() =>
      buildCostOfSalesPolizaPlan({
        companyId: 'comp_test_4a',
        year: 2026,
        period: 10,
        costOfSales: 12500.33,
        accounts: [accCost]
      })
    ).toThrow(/INVENTORY_ACCOUNT_NOT_FOUND|Inventarios/);

    expect(() =>
      buildCostOfSalesPolizaPlan({
        companyId: 'comp_test_4a',
        year: 2026,
        period: 10,
        costOfSales: 0,
        accounts: [accCost, accInv]
      })
    ).toThrow();
  });

  test('3. SQLite CRUD, cálculo automático de compras desde balanza y rutas Hono con aislamiento', async () => {
    const company = createCompanyRecord({
      name: 'Comercializadora PyME 4A S.A.',
      rfc: 'CPY230101AB2',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      currentYear: 2026,
      currentPeriod: 10,
      userId: 'owner_4a'
    });
    createdCompanyIds.push(company.id);

    const accounts = getAccounts(company.id);
    const invAcc = accounts.find((a) => a.code === '115-01-001')!;
    const accCosto = accounts.find((a) => a.code === '501-01-001')!;
    const accBanco = accounts.find((a) => a.code === '102-01-001')!;

    // Compras $45,000.50 y devolución $5,000.25 => compras netas = $40,000.25
    createPolizaTransaction({
      companyId: company.id,
      tipo: 'EGRESO',
      fecha: '2026-10-08',
      ejercicio: 2026,
      periodo: 10,
      concepto: 'Compra de mercancía',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: accCosto.id, referencia: 'COMP-1', concepto: 'Compra', cargo: 45000.5, abono: 0 },
        { accountId: accBanco.id, referencia: 'COMP-1', concepto: 'Pago', cargo: 0, abono: 45000.5 }
      ]
    });

    createPolizaTransaction({
      companyId: company.id,
      tipo: 'INGRESO',
      fecha: '2026-10-12',
      ejercicio: 2026,
      periodo: 10,
      concepto: 'Devolución sobre compra',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: accBanco.id, referencia: 'DEV-1', concepto: 'Reembolso', cargo: 5000.25, abono: 0 },
        { accountId: accCosto.id, referencia: 'DEV-1', concepto: 'Devolución', cargo: 0, abono: 5000.25 }
      ]
    });

    expect(computePurchasesFromTrialBalance(company.id, 2026, 10)).toBe(40000.25);

    const initialGet = getInventoryPeriodRepo(company.id, 2026, 10, 'owner_4a');
    expect(initialGet.purchasesFromBalance).toBe(40000.25);
    expect(initialGet.costOfSales).toBe(40000.25);

    const saved = saveInventoryPeriodRepo(
      company.id,
      {
        ejercicio: 2026,
        periodo: 10,
        initialInventory: 15000.75,
        purchasesOverride: null,
        finalInventory: 12000.5,
        method: 'ANALITICO'
      },
      'owner_4a'
    );
    // 15000.75 + 40000.25 - 12000.50 = 43000.50
    expect(saved.costOfSales).toBe(43000.5);
    expect(saved.method).toBe('ANALITICO');

    // Periodo siguiente hereda Inventario Final como Inventario Inicial
    const nextPeriod = getInventoryPeriodRepo(company.id, 2026, 11, 'owner_4a');
    expect(nextPeriod.initialInventory).toBe(12000.5);

    // Registrar póliza real de costo de ventas usando el motor + createPolizaTransaction
    const polizaPlan = buildCostOfSalesPolizaPlan({
      companyId: company.id,
      year: 2026,
      period: 10,
      costOfSales: saved.costOfSales,
      accounts
    });
    expect(polizaPlan.movements[1]?.accountId).toBe(invAcc.id);
    const createdPoliza = createPolizaTransaction({
      companyId: polizaPlan.companyId,
      tipo: polizaPlan.tipo,
      fecha: polizaPlan.fecha,
      ejercicio: 2026,
      periodo: 10,
      concepto: polizaPlan.concepto,
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: polizaPlan.movements
    });
    expect(createdPoliza.isBalanced).toBe(true);
    expect(createdPoliza.totalCargos).toBe(43000.5);

    // Rutas Hono
    const testApi = new Hono().basePath('/api');
    testApi.route('/', inventoryRoutes);

    const denied = await testApi.request(`/api/companies/${company.id}/inventory-cost?year=2026&period=10`, {
      headers: { 'X-User-Id': 'intruder' }
    });
    expect(denied.status).toBe(403);

    const getRes = await testApi.request(`/api/companies/${company.id}/inventory-cost?year=2026&period=10`, {
      headers: { 'X-User-Id': 'owner_4a' }
    });
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as InventoryPeriodRecord;
    expect(getBody.initialInventory).toBe(15000.75);

    const postRes = await testApi.request(`/api/companies/${company.id}/inventory-cost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': 'owner_4a' },
      body: JSON.stringify({
        ejercicio: 2026,
        periodo: 10,
        initialInventory: 20000,
        purchasesOverride: 30000,
        finalInventory: 10000,
        method: 'PERPETUO',
        polizaId: createdPoliza.id
      })
    });
    expect(postRes.status).toBe(200);
    const postBody = (await postRes.json()) as InventoryPeriodRecord;
    expect(postBody.costOfSales).toBe(40000);
    expect(postBody.method).toBe('PERPETUO');
    expect(postBody.polizaId).toBe(createdPoliza.id);

    // Candado fiscal bloquea escritura
    setPeriodLock(company.id, 2026, 10, true, 'Cierre');
    const lockedRes = await testApi.request(`/api/companies/${company.id}/inventory-cost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': 'owner_4a' },
      body: JSON.stringify({
        ejercicio: 2026,
        periodo: 10,
        initialInventory: 100,
        finalInventory: 50,
        method: 'ANALITICO'
      })
    });
    expect(lockedRes.status).toBe(409);
  });
});
