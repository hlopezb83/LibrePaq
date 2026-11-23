import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { accountingRulesClient } from '../src/lib/accounting-rules-client';
import { annualTaxClient } from '../src/lib/annual-tax-client';
import { apiClient } from '../src/lib/api-client';
import { bankN1Client } from '../src/lib/bank-n1-client';
import { inventoryClient } from '../src/lib/inventory-client';
import {
  endSupportSession,
  isReadOnlyClientMode,
  isReadOnlySupportMode,
  isReadOnlyWriteBlocked,
  setClientReadOnlyMode,
  subscribeClientReadOnlyMode
} from '../src/lib/support-impersonation';
import { workspaceRbacClient } from '../src/lib/workspace-rbac-client';
import {
  batchGenerateAutoPolizasFromCfdiIds,
  createCompanyRecord,
  createPolizaTransaction,
  db,
  deleteCompanyRecord,
  deletePolizaTransaction,
  generateAutoPolizaFromCfdiId,
  getAccounts,
  initDatabase,
  insertParsedCfdiRecord,
  updatePolizaTransaction
} from '../src/server/db';
import {
  deleteAccountingRuleRepo,
  ensureAccountingRulesTable,
  upsertAccountingRuleRepo
} from '../src/server/repositories/accounting-rules.repo';
import {
  addBankStatementLinesTransaction,
  getBankReconciliation,
  unmatchBankLineTransaction
} from '../src/server/repositories/bank.repo';
import {
  applyManyToOneMatchesRepo,
  ensureBankN1MatchesTable,
  listBankN1MatchesRepo
} from '../src/server/repositories/bank-n1.repo';
import { cfdiRoutes } from '../src/server/routes/cfdi.routes';
import { buildCfdi40Xml, parseCfdiXmlString } from '../src/shared/cfdi-xml';

describe('Ronda 3 — Paridad Cloud-Local & Seguridad Cliente (BUG-12, BUG-20, BUG-21)', () => {
  const createdCompanyIds: string[] = [];

  beforeAll(() => {
    initDatabase();
    ensureAccountingRulesTable(db);
    ensureBankN1MatchesTable(db);
  });

  afterEach(() => {
    setClientReadOnlyMode(false);
    endSupportSession();
  });

  afterAll(() => {
    for (const id of createdCompanyIds) {
      deleteCompanyRecord(id);
    }
  });

  test('BUG-12: setClientReadOnlyMode bloquea escrituras en apiClient, accountingRulesClient, workspaceRbacClient y clientes especializados', async () => {
    let changes = 0;
    const unsub = subscribeClientReadOnlyMode(() => {
      changes += 1;
    });

    expect(isReadOnlyClientMode()).toBe(false);
    expect(isReadOnlySupportMode()).toBe(false);
    expect(isReadOnlyWriteBlocked()).toBe(false);

    setClientReadOnlyMode(true);
    expect(isReadOnlyClientMode()).toBe(true);
    expect(isReadOnlySupportMode()).toBe(false);
    expect(isReadOnlyWriteBlocked()).toBe(true);
    expect(changes).toBe(1);

    expect(() =>
      apiClient.createPoliza({
        companyId: 'comp_1',
        tipo: 'DIARIO',
        fecha: '2026-10-15',
        concepto: 'Prueba bloqueo',
        movements: []
      })
    ).toThrow(/solo lectura/i);

    expect(() => apiClient.deletePoliza('pol_1')).toThrow(/solo lectura/i);
    expect(() => apiClient.unmatchBankLine('bsl_1')).toThrow(/solo lectura/i);

    expect(() =>
      accountingRulesClient.upsertAccountingRule({
        companyId: 'comp_1',
        matchRfc: 'AAA010101AAA',
        direction: 'RECIBIDO',
        operationAccountCode: '601-01-001'
      })
    ).toThrow(/solo lectura/i);
    expect(() => accountingRulesClient.deleteAccountingRule('comp_1', 'rule_1')).toThrow(
      /solo lectura/i
    );

    expect(() =>
      workspaceRbacClient.inviteWorkspaceMember({
        workspaceId: 'ws_1',
        email: 'nuevo@despacho.mx',
        role: 'AUXILIAR'
      })
    ).toThrow(/solo lectura/i);
    expect(() =>
      workspaceRbacClient.updateWorkspaceMemberRole('ws_1', 'mem_1', 'CONTADOR')
    ).toThrow(/solo lectura/i);
    expect(() => workspaceRbacClient.revokeWorkspaceMember('ws_1', 'mem_1')).toThrow(
      /solo lectura/i
    );
    expect(() =>
      workspaceRbacClient.assignCompanyAccess({
        workspaceId: 'ws_1',
        memberId: 'mem_1',
        companyIds: ['comp_1']
      })
    ).toThrow(/solo lectura/i);
    expect(() =>
      workspaceRbacClient.recordCompanyAuditLog({
        companyId: 'comp_1',
        action: 'TEST',
        entityType: 'POLIZA'
      })
    ).toThrow(/solo lectura/i);

    expect(() =>
      annualTaxClient.saveAnnualTaxInputs('comp_1', {
        companyId: 'comp_1',
        ejercicio: 2026,
        inpcCierreAnterior: 130,
        inpcCierreActual: 135,
        cucaInicial: 0,
        aportacionesCapital: 0,
        reduccionesCapital: 0,
        cufinInicial: 0,
        dividendosPagados: 0,
        ptuPagadaAnterior: 0,
        noDeduciblesManual: 0
      })
    ).toThrow(/solo lectura/i);
    expect(() => bankN1Client.applyBankN1Matches('comp_1', 'acc_1', [])).toThrow(/solo lectura/i);
    expect(() =>
      inventoryClient.saveInventoryPeriod('comp_1', {
        ejercicio: 2026,
        periodo: 10,
        initialInventory: 0,
        finalInventory: 0,
        method: 'ANALITICO'
      })
    ).toThrow(/solo lectura/i);

    // Lecturas y acceptPendingInvites NO deben ser bloqueadas por el guard síncrono
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })) as unknown as typeof fetch;

    try {
      const rules = await accountingRulesClient.listAccountingRules('comp_1');
      expect(rules).toEqual([]);
      const polizas = await apiClient.getPolizas('comp_1');
      expect(polizas).toEqual([]);
      const members = await workspaceRbacClient.listWorkspaceMembers('ws_1');
      expect(members).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }

    setClientReadOnlyMode(false);
    expect(isReadOnlyWriteBlocked()).toBe(false);
    expect(changes).toBe(2);
    unsub();
  });

  test('BUG-20: generateAutoPolizaFromCfdiId y batchAutoPoliza aplican accounting_rules y deductiblePct: 50 hacia 801', async () => {
    const company = createCompanyRecord({
      name: 'Empresa Reglas AutoPoliza S.A.',
      rfc: 'ERA2105148K2',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      currentYear: 2026,
      currentPeriod: 10
    });
    createdCompanyIds.push(company.id);

    const accounts = getAccounts(company.id);
    const expenseAcc =
      accounts.find((a) => a.isAffectable && a.code.startsWith('601-01')) ||
      accounts.find((a) => a.isAffectable && a.code.startsWith('601'));
    expect(expenseAcc).toBeDefined();

    const rule = upsertAccountingRuleRepo({
      companyId: company.id,
      name: 'Proveedor Alimentos 50% Deducible',
      matchRfc: 'PRO180214A99',
      direction: 'RECIBIDO',
      operationAccountCode: expenseAcc!.code,
      deductiblePct: 50,
      priority: 50
    });

    const xml1 = buildCfdi40Xml({
      uuid: '11111111-1111-4111-8111-111111111111',
      fecha: '2026-10-12',
      tipoComprobante: 'I',
      serie: 'A',
      folio: '101',
      emisorRfc: 'PRO180214A99',
      emisorNombre: 'PROVEEDOR ALIMENTOS SA',
      receptorRfc: company.rfc,
      receptorNombre: company.name,
      conceptoPrincipal: 'Consumo corporativo 1',
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
      usoCfdi: 'G03'
    });
    const cfdi1 = insertParsedCfdiRecord(company, parseCfdiXmlString(xml1));

    const poliza1 = generateAutoPolizaFromCfdiId(cfdi1.id);
    expect(poliza1.isBalanced).toBe(true);
    expect(poliza1.totalCargos).toBe(1160);
    expect(poliza1.totalAbonos).toBe(1160);

    const cargoGasto1 = poliza1.movements
      .filter((m) => m.accountCode === expenseAcc!.code)
      .reduce((s, m) => s + m.cargo, 0);
    const cargo801_1 = poliza1.movements
      .filter((m) => m.accountCode.startsWith('801'))
      .reduce((s, m) => s + m.cargo, 0);
    expect(cargoGasto1).toBe(500);
    expect(cargo801_1).toBe(580);

    // Ahora probamos batchAutoPoliza vía repo y vía ruta Hono pasando deductiblePct: 50 explícito sin regla activa
    deleteAccountingRuleRepo(company.id, rule.id);

    const xml2 = buildCfdi40Xml({
      uuid: '22222222-2222-4222-8222-222222222222',
      fecha: '2026-10-14',
      tipoComprobante: 'I',
      serie: 'A',
      folio: '102',
      emisorRfc: 'OTR190101BBB',
      emisorNombre: 'OTRO PROVEEDOR SA',
      receptorRfc: company.rfc,
      receptorNombre: company.name,
      conceptoPrincipal: 'Consumo corporativo 2',
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
      usoCfdi: 'G03'
    });
    const cfdi2 = insertParsedCfdiRecord(company, parseCfdiXmlString(xml2));

    const testApp = new Hono().basePath('/api');
    testApp.route('/', cfdiRoutes);

    const batchRes = await testApp.request('/api/cfdis/batch-auto-poliza', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cfdiIds: [cfdi2.id],
        operationAccountCode: expenseAcc!.code,
        deductiblePct: 50
      })
    });
    expect(batchRes.status).toBe(201);
    const batchBody = (await batchRes.json()) as { createdPolizas: typeof poliza1[]; count: number };
    expect(batchBody.count).toBe(1);
    const poliza2 = batchBody.createdPolizas[0]!;
    expect(poliza2.isBalanced).toBe(true);
    const cargo801_2 = poliza2.movements
      .filter((m) => m.accountCode.startsWith('801'))
      .reduce((s, m) => s + m.cargo, 0);
    expect(cargo801_2).toBe(580);

    // También verificamos batchGenerateAutoPolizasFromCfdiIds con deductiblePct directo
    const xml3 = buildCfdi40Xml({
      uuid: '33333333-3333-4333-8333-333333333333',
      fecha: '2026-10-15',
      tipoComprobante: 'I',
      serie: 'A',
      folio: '103',
      emisorRfc: 'OTR190101BBB',
      emisorNombre: 'OTRO PROVEEDOR SA',
      receptorRfc: company.rfc,
      receptorNombre: company.name,
      conceptoPrincipal: 'Consumo corporativo 3',
      claveProdServ: '90101501',
      moneda: 'MXN',
      tipoCambio: 1,
      subtotal: 200,
      descuento: 0,
      ivaTrasladado: 32,
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 232,
      metodoPago: 'PUE',
      formaPago: '03',
      usoCfdi: 'G03'
    });
    const cfdi3 = insertParsedCfdiRecord(company, parseCfdiXmlString(xml3));
    const directBatch = batchGenerateAutoPolizasFromCfdiIds([cfdi3.id], {
      operationAccountCode: expenseAcc!.code,
      deductiblePct: 50
    });
    expect(directBatch.count).toBe(1);
    const cargo801_3 = directBatch.createdPolizas[0]!.movements
      .filter((m) => m.accountCode.startsWith('801'))
      .reduce((s, m) => s + m.cargo, 0);
    expect(cargo801_3).toBe(116);
  });

  test('BUG-21: unmatchBankLine, updatePoliza y deletePoliza limpian bank_statement_matches en SQLite', () => {
    const company = createCompanyRecord({
      name: 'Empresa Limpieza N1 S.A.',
      rfc: 'ELN2105148K2',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      currentYear: 2026,
      currentPeriod: 10
    });
    createdCompanyIds.push(company.id);

    const accounts = getAccounts(company.id);
    const bankAcc = accounts.find((a) => a.isAffectable && a.code.startsWith('102'))!;
    const clientAcc = accounts.find((a) => a.isAffectable && a.code.startsWith('105'))!;

    const p1 = createPolizaTransaction({
      companyId: company.id,
      ejercicio: 2026,
      periodo: 10,
      tipo: 'INGRESO',
      fecha: '2026-10-05',
      concepto: 'Cobro 1',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: bankAcc.id, cargo: 400, abono: 0 },
        { accountId: clientAcc.id, cargo: 0, abono: 400 }
      ]
    });
    const p2 = createPolizaTransaction({
      companyId: company.id,
      ejercicio: 2026,
      periodo: 10,
      tipo: 'INGRESO',
      fecha: '2026-10-06',
      concepto: 'Cobro 2',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: bankAcc.id, cargo: 600, abono: 0 },
        { accountId: clientAcc.id, cargo: 0, abono: 600 }
      ]
    });

    const reconBefore = addBankStatementLinesTransaction(company, bankAcc.id, [
      {
        fecha: '2026-10-10',
        referencia: 'LOTE-CLEAN',
        descripcion: 'DEPOSITO CONCENTRADO',
        cargoBanco: 0,
        abonoBanco: 1000
      }
    ])!;
    const lineId = reconBefore.statementLines[0]!.id;
    const movIds = [
      p1.movements.find((m) => m.accountId === bankAcc.id)!.id,
      p2.movements.find((m) => m.accountId === bankAcc.id)!.id
    ];

    // 1) Aplicar match N-a-1 y luego desconciliar con unmatchBankLineTransaction
    const applied1 = applyManyToOneMatchesRepo(
      company.id,
      bankAcc.id,
      [{ bankLineId: lineId, movementIds: movIds }],
      2026,
      10
    )!;
    expect(applied1.appliedCount).toBe(1);
    expect(listBankN1MatchesRepo(company.id)).toHaveLength(2);

    const unmatched = unmatchBankLineTransaction(lineId);
    expect(unmatched.found).toBe(true);
    expect(listBankN1MatchesRepo(company.id)).toHaveLength(0);
    expect(
      getBankReconciliation(company.id, bankAcc.id, 2026, 10)!.statementLines[0]!.matchedMovementId
    ).toBeNull();

    // 2) Re-aplicar match N-a-1 y editar p1 con updatePolizaTransaction -> debe limpiar matches
    const applied2 = applyManyToOneMatchesRepo(
      company.id,
      bankAcc.id,
      [{ bankLineId: lineId, movementIds: movIds }],
      2026,
      10
    )!;
    expect(applied2.appliedCount).toBe(1);
    expect(listBankN1MatchesRepo(company.id)).toHaveLength(2);

    const updated = updatePolizaTransaction(p1.id, {
      tipo: 'INGRESO',
      fecha: '2026-10-05',
      concepto: 'Cobro 1 Editado',
      movements: [
        { accountId: bankAcc.id, cargo: 400, abono: 0 },
        { accountId: clientAcc.id, cargo: 0, abono: 400 }
      ]
    });
    expect(updated).toBe(true);
    expect(listBankN1MatchesRepo(company.id)).toHaveLength(0);
    expect(
      getBankReconciliation(company.id, bankAcc.id, 2026, 10)!.statementLines[0]!.matchedMovementId
    ).toBeNull();

    // 3) Re-aplicar match N-a-1 con los nuevos movementIds y eliminar p2 -> debe limpiar matches
    const reconAfterUpdate = getBankReconciliation(company.id, bankAcc.id, 2026, 10)!;
    const currentMovIds = reconAfterUpdate.bookMovements.map((m) => m.movementId);
    const applied3 = applyManyToOneMatchesRepo(
      company.id,
      bankAcc.id,
      [{ bankLineId: lineId, movementIds: currentMovIds }],
      2026,
      10
    )!;
    expect(applied3.appliedCount).toBe(1);
    expect(listBankN1MatchesRepo(company.id)).toHaveLength(2);

    const deleted = deletePolizaTransaction(p2.id);
    expect(deleted).toBe(true);
    expect(listBankN1MatchesRepo(company.id)).toHaveLength(0);
    expect(
      getBankReconciliation(company.id, bankAcc.id, 2026, 10)!.statementLines[0]!.matchedMovementId
    ).toBeNull();
  });
});
