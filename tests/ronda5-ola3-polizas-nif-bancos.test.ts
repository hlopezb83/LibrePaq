import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { initDatabase } from '../src/server/schema';
import { createCompanyRecord, deleteCompanyRecord } from '../src/server/repositories/companies.repo';
import {
  batchImportAccountsCatalog,
  createAccountRecord,
  deleteAccountRecord,
  getAccounts
} from '../src/server/repositories/accounts.repo';
import {
  createPolizaTransaction,
  getPolizas,
  updatePolizaTransaction
} from '../src/server/repositories/polizas.repo';
import { closeYearPolizaTransaction } from '../src/server/repositories/polizas-closing.repo';
import { parseCatalogoCsvText } from '../src/views/catalogo/catalogoCsvIo';
import { suggestNextCodeForParent } from '../src/views/catalogo/catalogoHierarchy';
import {
  buildFinancialStatementsFromTrialBalance,
  rollUpTrialBalanceAccounts
} from '../src/shared/engine/financial-reports.engine';
import { computeExtendedFinancialStatements } from '../src/shared/engine/extended-statements.engine';
import { escapeHtml } from '../src/views/reportes/auxiliaresDiarioExport';
import { buildCostOfSalesPolizaPlan } from '../src/shared/engine/cost-of-sales.engine';
import { parseBankCsvDate, parseBankStatementCsv } from '../src/shared/csv-bank-parser';
import {
  normalizeBankDate,
  normalizeNonNegativeAmount
} from '../supabase/functions/extract-bank-statement/handler';
import { computePayrollPeriodSummary } from '../src/shared/engine/payroll-summary.engine';
import { computeFixedAssetWithDepreciation } from '../src/shared/engine/fixed-assets.engine';
import { computeCxcCxpAging } from '../src/shared/engine/cxc-cxp.engine';
import type { AccountWithBalance, CfdiDocument, Company, FixedAssetRecord } from '../src/shared/types';

function makeAcc(
  id: string,
  code: string,
  name: string,
  type: AccountWithBalance['type'],
  nature: AccountWithBalance['nature'],
  satGroupCode: string,
  level: number,
  isAffectable: boolean,
  initialBalance = 0,
  periodCharges = 0,
  periodCredits = 0,
  parentCode: string | null = null
): AccountWithBalance {
  const signedDelta = nature === 'DEUDORA' ? periodCharges - periodCredits : periodCredits - periodCharges;
  return {
    id,
    companyId: 'c1',
    code,
    name,
    parentCode,
    type,
    nature,
    level,
    isAffectable,
    satGroupCode,
    currency: 'MXN',
    initialBalance,
    initialBalanceComputed: initialBalance,
    periodCharges,
    periodCredits,
    finalBalance: Number((initialBalance + signedDelta).toFixed(2))
  };
}

const mockCompany: Company = {
  id: 'c1',
  rfc: 'OLA3R50101AAA',
  name: 'Empresa Demo SA',
  regimenFiscal: '601',
  codigoPostal: '06600',
  maskFormat: '3-2-3',
  currentYear: 2026,
  currentPeriod: 12,
  createdAt: '2026-01-01T00:00:00Z'
};

describe('Ronda 5 Ola 3 — Pólizas P13/Multi-CFDI, Catálogo SAT, NIF/Dossier/Auxiliares y Tesorería', () => {
  const createdCompanyIds: string[] = [];

  beforeAll(() => {
    initDatabase();
  });

  afterAll(() => {
    for (const id of createdCompanyIds) {
      deleteCompanyRecord(id);
    }
  });

  test('1. Cierre Anual (P13) preserva pólizas manuales de ajuste en Mes 13 y calcula sobre finalBalance + Multi-CFDI hereda primaryUuid', () => {
    const comp = createCompanyRecord({
      rfc: 'OLA3R50101AAA',
      name: 'Ola 3 P13 S.A. de C.V.',
      regimenFiscal: '601',
      codigoPostal: '06600',
      catalogPreset: 'SAT_STANDARD'
    });
    createdCompanyIds.push(comp.id);

    const accounts = getAccounts(comp.id);
    const bankAcc = accounts.find((a) => (a.code === '102-01-001' || a.satGroupCode === '102.01') && a.isAffectable)!;
    const salesAcc = accounts.find((a) => a.satGroupCode.startsWith('401') && a.isAffectable)!;
    const adjExpenseAcc = accounts.find((a) => a.satGroupCode.startsWith('601') && a.isAffectable)!;

    // Ingreso ordinario en Periodo 12: $10,000
    createPolizaTransaction({
      companyId: comp.id,
      tipo: 'INGRESO',
      fecha: '2026-12-15',
      periodo: 12,
      ejercicio: 2026,
      concepto: 'Venta diciembre',
      cfdiUuid: '11111111-1111-4111-8111-111111111111',
      origin: 'MANUAL',
      movements: [
        { accountId: bankAcc.id, cargo: 10000, abono: 0 },
        { accountId: salesAcc.id, cargo: 0, abono: 10000, cfdiUuid: null }
      ]
    });

    // Multi-CFDI: partida con cfdiUuid = null hereda primaryUuid de cabecera
    const polP12 = getPolizas(comp.id, 2026, 12)[0]!;
    expect(polP12.movements.every((m) => m.cfdiUuid === '11111111-1111-4111-8111-111111111111')).toBe(true);

    // Póliza manual de ajuste en Periodo 13: gasto auditoría $2,500
    const manualP13 = createPolizaTransaction({
      companyId: comp.id,
      tipo: 'DIARIO',
      fecha: '2026-12-31',
      periodo: 13,
      ejercicio: 2026,
      concepto: 'Ajuste manual auditoria P13',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: adjExpenseAcc.id, cargo: 2500, abono: 0 },
        { accountId: bankAcc.id, cargo: 0, abono: 2500 }
      ]
    });
    expect(manualP13.periodo).toBe(13);

    // Ejecutar Cierre Anual 2 veces (idempotente) — debe conservar manualP13 y cerrar utilidad neta $7,500
    closeYearPolizaTransaction(comp.id, 2026);
    const closingRes = closeYearPolizaTransaction(comp.id, 2026);
    expect(closingRes.closed).toBe(true);
    expect(closingRes.utilidadTraspasada).toBe(7500);

    const p13List = getPolizas(comp.id, 2026, 13);
    expect(p13List.some((p) => p.id === manualP13.id && p.origin === 'MANUAL')).toBe(true);
    expect(p13List.filter((p) => (p.origin as string) === 'CIERRE_ANUAL').length).toBe(1);

    const closingPol = p13List.find((p) => p.id === closingRes.polizaId)!;
    expect(closingPol.movements.some((m) => m.abono === 7500)).toBe(true);

    // Update poliza manteniendo herencia de primaryUuid cuando se pasa cfdiUuid null
    const updatedFlag = updatePolizaTransaction(polP12.id, {
      concepto: 'Venta diciembre actualizada',
      cfdiUuid: '22222222-2222-4222-8222-222222222222',
      movements: [
        { accountId: bankAcc.id, cargo: 10000, abono: 0, cfdiUuid: null },
        { accountId: salesAcc.id, cargo: 0, abono: 10000, cfdiUuid: '33333333-3333-4333-8333-333333333333' }
      ]
    });
    expect(updatedFlag).toBe(true);
    const updatedPol = getPolizas(comp.id, 2026, 12).find((p) => p.id === polP12.id)!;
    expect(updatedPol.movements[0]?.cfdiUuid).toBe('22222222-2222-4222-8222-222222222222');
    expect(updatedPol.movements[1]?.cfdiUuid).toBe('33333333-3333-4333-8333-333333333333');
  });

  test('2. Catálogo SAT: bloquea subcuenta bajo afectable con movimientos, protege saldo inicial al borrar, soporta 4-3-4 y sugiere siguiente código', () => {
    const comp = createCompanyRecord({
      rfc: 'OLA3R50202BBB',
      name: 'Ola 3 Catálogo S.A.',
      regimenFiscal: '601',
      codigoPostal: '06600',
      catalogPreset: 'SAT_STANDARD'
    });
    createdCompanyIds.push(comp.id);

    const accounts = getAccounts(comp.id);
    const bankAcc = accounts.find((a) => (a.code === '102-01-001' || a.satGroupCode === '102.01') && a.isAffectable)!;
    const salesAcc = accounts.find((a) => a.satGroupCode.startsWith('401') && a.isAffectable)!;

    createPolizaTransaction({
      companyId: comp.id,
      tipo: 'INGRESO',
      fecha: '2026-10-05',
      periodo: 10,
      ejercicio: 2026,
      concepto: 'Cobro con movimiento en afectable',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: bankAcc.id, cargo: 500, abono: 0 },
        { accountId: salesAcc.id, cargo: 0, abono: 500 }
      ]
    });

    // Intentar crear subcuenta debajo de bankAcc (afectable con movimientos) -> debe rechazar (evita 2x)
    expect(() =>
      createAccountRecord({
        companyId: comp.id,
        code: `${bankAcc.code}-0001`,
        name: 'Subcuenta Prohibida',
        parentCode: bankAcc.code,
        type: 'ACTIVO',
        nature: 'DEUDORA',
        level: 4,
        isAffectable: true,
        satGroupCode: '102.01',
        initialBalance: 0
      })
    ).toThrow(/movimientos o saldo inicial/i);

    // Cuenta nueva con saldo inicial distinto de cero no puede eliminarse
    const withBal = createAccountRecord({
      companyId: comp.id,
      code: '1200-010-0001',
      name: 'Activo 4-3-4 con apertura',
      parentCode: null,
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 4,
      isAffectable: true,
      satGroupCode: '120.01',
      initialBalance: 1500
    });
    const delRes = deleteAccountRecord(withBal.id);
    expect(delRes.deleted).toBe(false);
    expect(delRes.hasInitialBalance).toBe(true);

    // Importación CSV CONTPAQi limpiando $ y comas, preservando nivel 4-3-4
    const csvRows = parseCatalogoCsvText(
      'codigo,nombre,tipo,naturaleza,nivel,afectable,agrupador_sat,saldo_inicial\n1020-001-0002,"Bancos Dólares, S.A.",ACTIVO,DEUDORA,4,1,102.02,"$12,345.67"'
    );
    expect(csvRows.length).toBe(1);
    expect(csvRows[0]?.initialBalance).toBe(12345.67);
    expect(csvRows[0]?.level).toBe(4);

    const imported = batchImportAccountsCatalog(comp.id, csvRows);
    expect(imported.importedCount).toBe(1);
    const saved = getAccounts(comp.id).find((a) => a.code === '1020-001-0002');
    expect(saved?.level).toBe(4);
    expect(saved?.initialBalance).toBe(12345.67);

    // suggestNextCodeForParent en 4-3-4 evita colisiones
    const mockParent = makeAcc('p1', '1020-001-0000', 'Bancos L2', 'ACTIVO', 'DEUDORA', '102', 3, false);
    const mockChild = makeAcc('c1', '1020-001-0001', 'BBVA', 'ACTIVO', 'DEUDORA', '102.01', 4, true, 0, 0, 0, '1020-001-0000');
    const suggested = suggestNextCodeForParent('1020-001-0000', [mockParent, mockChild]);
    expect(suggested).toBe('1020-001-0002');
  });

  test('3. Reportes NIF B-2/B-3/B-4 & Auxiliares: evita doble conteo 611, firma contra-cuentas 402, normaliza post-cierre P13 y escapa XSS', () => {
    const accounts: AccountWithBalance[] = [
      makeAcc('l1_1', '100-00-000', 'Activo', 'ACTIVO', 'DEUDORA', '100', 1, false, 0, 0, 0, null),
      makeAcc('l2_1', '102-00-000', 'Bancos', 'ACTIVO', 'DEUDORA', '102', 2, false, 0, 0, 0, '100-00-000'),
      makeAcc('a1', '102-01-001', 'BBVA', 'ACTIVO', 'DEUDORA', '102.01', 3, true, 10000, 0, 0, '102-00-000'),
      makeAcc('l1_3', '300-00-000', 'Capital', 'CAPITAL', 'ACREEDORA', '300', 1, false, 0, 0, 0, null),
      makeAcc('a2', '301-01-001', 'Capital Social', 'CAPITAL', 'ACREEDORA', '301.01', 3, true, 10000, 0, 0, '300-00-000'),
      makeAcc('l1_4', '400-00-000', 'Ingresos', 'INGRESOS', 'ACREEDORA', '400', 1, false, 0, 0, 0, null),
      makeAcc('a3', '401-01-001', 'Ventas', 'INGRESOS', 'ACREEDORA', '401.01', 3, true, 0, 0, 0, '400-00-000'),
      makeAcc('a4', '402-01-001', 'Devoluciones s/Ventas', 'INGRESOS', 'DEUDORA', '402.01', 3, true, 0, 0, 0, '400-00-000'),
      makeAcc('l1_5', '500-00-000', 'Costos', 'COSTOS', 'DEUDORA', '500', 1, false, 0, 0, 0, null),
      makeAcc('a5', '501-01-001', 'Costo Ventas', 'COSTOS', 'DEUDORA', '501.01', 3, true, 0, 0, 0, '500-00-000'),
      makeAcc('l1_6', '600-00-000', 'Gastos', 'GASTOS', 'DEUDORA', '600', 1, false, 0, 0, 0, null),
      makeAcc('a6', '601-01-001', 'Gastos Admin', 'GASTOS', 'DEUDORA', '601.01', 3, true, 0, 0, 0, '600-00-000'),
      makeAcc('a7', '611-01-001', 'ISR del Ejercicio', 'GASTOS', 'DEUDORA', '611.01', 3, true, 0, 0, 0, '600-00-000')
    ];

    const rolled = rollUpTrialBalanceAccounts(
      accounts,
      new Map(),
      new Map(),
      new Map([['a1', 1500000], ['a4', 200000], ['a5', 500000], ['a6', 300000], ['a7', 150000]]),
      new Map([['a1', 300000], ['a3', 2000000]])
    );

    const st = buildFinancialStatementsFromTrialBalance(mockCompany, rolled, 2026, 10);
    // Ingresos netos = 20000 - 2000 = 18000; Costos = 5000; Gastos Operacion (sin 611) = 3000; ISR (611) = 1500
    expect(st.incomeStatement.totalIngresos).toBe(18000);
    expect(st.incomeStatement.totalCostos).toBe(5000);
    expect(st.incomeStatement.totalGastos).toBe(3000);
    expect(st.incomeStatement.totalIsr).toBe(1500);
    expect(st.incomeStatement.utilidadNeta).toBe(8500);

    // Post-cierre P13 cuadrado (L2 + L3: 401/601 cerradas en P13 contra 305-01-001 por $12,000)
    const p13Accounts: AccountWithBalance[] = [
      makeAcc('l2_1', '102-00-000', 'Bancos L2', 'ACTIVO', 'DEUDORA', '102', 2, false, 10000, 15000, 3000),
      makeAcc('a1', '102-01-001', 'Bancos', 'ACTIVO', 'DEUDORA', '102.01', 3, true, 10000, 15000, 3000, '102-00-000'),
      makeAcc('l2_3', '301-00-000', 'Capital L2', 'CAPITAL', 'ACREEDORA', '301', 2, false, 10000, 0, 0),
      makeAcc('a2', '301-01-001', 'Capital Social', 'CAPITAL', 'ACREEDORA', '301.01', 3, true, 10000, 0, 0, '301-00-000'),
      makeAcc('l2_305', '305-00-000', 'Resultado L2', 'CAPITAL', 'ACREEDORA', '305', 2, false, 0, 0, 12000),
      makeAcc('a8', '305-01-001', 'Resultado del Ejercicio', 'CAPITAL', 'ACREEDORA', '305.01', 3, true, 0, 0, 12000, '305-00-000'),
      makeAcc('l2_401', '401-00-000', 'Ventas L2', 'INGRESOS', 'ACREEDORA', '401', 2, false, 20000, 20000, 0),
      makeAcc('a3', '401-01-001', 'Ventas', 'INGRESOS', 'ACREEDORA', '401.01', 3, true, 20000, 20000, 0, '401-00-000'),
      makeAcc('l2_601', '601-00-000', 'Gastos L2', 'GASTOS', 'DEUDORA', '601', 2, false, 8000, 0, 8000),
      makeAcc('a6', '601-01-001', 'Gastos', 'GASTOS', 'DEUDORA', '601.01', 3, true, 8000, 0, 8000, '601-00-000')
    ];
    const prevYearAccounts: AccountWithBalance[] = [
      makeAcc('pa1', '102-01-001', 'Bancos', 'ACTIVO', 'DEUDORA', '102.01', 3, true, 0, 10000, 0),
      makeAcc('pa2', '301-01-001', 'Capital Social', 'CAPITAL', 'ACREEDORA', '301.01', 3, true, 0, 0, 10000)
    ];
    const ext = computeExtendedFinancialStatements({
      company: mockCompany,
      currentTrialBalance: p13Accounts,
      previousTrialBalance: prevYearAccounts,
      ejercicio: 2026,
      periodo: 13
    });
    expect(ext.hasPreviousComparative).toBe(true);
    expect(ext.cashFlow.efectivoFinal).toBe(22000);
    expect(ext.cashFlow.isReconciled).toBe(true);

    // XSS escapeHtml cubre comillas simples, dobles y etiquetas
    const escaped = escapeHtml(`<script>alert('xss' & "bad")</script>`);
    expect(escaped).toBe('&lt;script&gt;alert(&#39;xss&#39; &amp; &quot;bad&quot;)&lt;/script&gt;');
  });

  test('4. Tesorería: Costo Analítico $0, Parser CSV Bancario, Edge Handler, Nómina EMITIDO, Activos Art. 36 y CxC TC/Equivalencia', () => {
    // 4a. Costo de Ventas Analítico con costOfSales === 0 (Compras $5,000 + InvFinal $5,000)
    const invAcc = makeAcc('i1', '115-01-001', 'Inventarios', 'ACTIVO', 'DEUDORA', '115.01', 3, true);
    const compAcc = makeAcc('c1', '501-01-001', 'Costo / Compras', 'COSTOS', 'DEUDORA', '501.01', 3, true);
    const cvPlan = buildCostOfSalesPolizaPlan({
      companyId: 'comp1',
      year: 2026,
      period: 10,
      costOfSales: 0,
      method: 'ANALITICO',
      initialInventory: 0,
      purchasesPeriod: 5000,
      finalInventory: 5000,
      accounts: [invAcc, compAcc]
    });
    expect(cvPlan.totalCargo).toBe(5000);
    expect(cvPlan.totalAbono).toBe(5000);

    // 4b. CSV Parser: encabezado mexicano 5 cols con Saldo, ;, paréntesis negativos y DD/MM/YY
    expect(parseBankCsvDate('15/10/26', '2026-10-01')).toBe('2026-10-15');
    const mexicanCsv = [
      'Fecha;Concepto;Cargo;Abono;Saldo',
      '15/10/26;PAGO PROVEEDOR;(1,250.50);0;8,749.50',
      '16/10/26;DEPOSITO CLIENTE;;"$3,400.00";12,149.50'
    ].join('\n');
    const parsedCsv = parseBankStatementCsv(mexicanCsv, '2026-10-01');
    expect(parsedCsv.length).toBe(2);
    expect(parsedCsv[0]?.fecha).toBe('2026-10-15');
    expect(parsedCsv[0]?.cargoBanco).toBe(1250.5);
    expect(parsedCsv[0]?.abonoBanco).toBe(0);
    expect(parsedCsv[1]?.abonoBanco).toBe(3400);

    // 4c. Edge handler: Math.abs() y fechas reales de calendario (rechaza 2026-02-30)
    expect(normalizeNonNegativeAmount(-850.25)).toBe(850.25);
    expect(normalizeNonNegativeAmount('($1,200.50)')).toBe(1200.5);
    expect(normalizeBankDate('2026-02-30')).toBe('');
    expect(normalizeBankDate('31/04/2026')).toBe('');
    expect(normalizeBankDate('29/02/2024')).toBe('2024-02-29');

    // 4d. Nómina/ISN: filtra direction === 'EMITIDO' solamente
    const nominaEmitida: CfdiDocument = {
      id: 'n1',
      companyId: 'c1',
      uuid: 'AAAA1111-1111-4111-8111-111111111111',
      serie: 'NOM',
      folio: '1',
      fecha: '2026-10-15',
      direction: 'EMITIDO',
      tipoComprobante: 'N',
      emisorRfc: 'EMP010101AAA',
      emisorNombre: 'Empresa SA',
      receptorRfc: 'TRA010101BBB',
      receptorNombre: 'Empleado Uno',
      subtotal: 10000,
      descuento: 0,
      ivaTrasladado: 0,
      isrRetenido: 1200,
      ivaRetenido: 0,
      total: 8800,
      moneda: 'MXN',
      tipoCambio: 1,
      metodoPago: 'PUE',
      formaPago: '99',
      usoCfdi: 'CN01',
      conceptoPrincipal: 'Nómina quincenal',
      claveProdServ: '84111505',
      statusSat: 'VIGENTE',
      polizaId: null,
      polizaFolio: null,
      xmlRaw: ''
    };
    const nominaRecibida = { ...nominaEmitida, id: 'n2', uuid: 'BBBB', direction: 'RECIBIDO' as const };
    const paySummary = computePayrollPeriodSummary({
      cfdis: [nominaEmitida, nominaRecibida],
      trialBalance: [],
      ejercicio: 2026,
      periodo: 10
    });
    expect(paySummary.nominaCount).toBe(1);
    expect(paySummary.totalPercepciones).toBe(10000);

    // 4e. Activos Fijos: sin doble conteo cuando alreadyDepreciatedThisPeriod=true + sin residuo Art. 36 en último mes
    const autoArt36: FixedAssetRecord = {
      id: 'fa1',
      companyId: 'c1',
      codigo: 'VEH-01',
      nombre: 'Automóvil Ejecutivo',
      categoria: 'TRANSPORTE_25',
      fechaAdquisicion: '2022-01-10',
      cfdiUuid: null,
      montoOriginalInversion: 300000,
      tasaAnualPct: 25,
      mesesDepreciadosPrevios: 1,
      inpcAdquisicion: 120,
      inpcMedioPeriodo: 120,
      estatus: 'ACTIVO',
      cuentaActivoCode: '154-01-001',
      cuentaDepAcumCode: '171-04-001',
      cuentaGastoDepCode: '601-01-006',
      createdAt: '2022-01-10T00:00:00Z'
    };
    const calcPosted = computeFixedAssetWithDepreciation(autoArt36, {
      ejercicio: 2026,
      periodo: 10,
      alreadyDepreciatedThisPeriod: true
    });
    expect(calcPosted.depreciacionMensualContable).toBe(6250);
    expect(calcPosted.depreciacionAcumuladaTotal).toBe(6250);

    // Último mes (mes 48): base fiscal total $175,000 sin residuo
    const month47Calc = computeFixedAssetWithDepreciation(
      { ...autoArt36, mesesDepreciadosPrevios: 47 },
      { ejercicio: 2026, periodo: 10 }
    );
    expect(month47Calc.depreciacionMensualContable).toBe(6250);
    expect(month47Calc.valorNetoEnLibros).toBe(0);
    // Art. 31 LISR: base $3,645.83 * factor INPC Jun 2026 (145.131 / 120 = 1.2094) = 4,409.27
    expect(month47Calc.depreciacionMensualFiscalActualizada).toBe(4409.27);

    // 4f. CxC/CxP: ordena pagos ASC para tomar TC más reciente, EquivalenciaDR y tolerancia $0.01
    const usdInv: CfdiDocument = {
      id: 'inv1',
      companyId: 'c1',
      uuid: 'CCCC1111-1111-4111-8111-111111111111',
      serie: 'FA',
      folio: '10',
      fecha: '2026-09-01',
      direction: 'EMITIDO',
      tipoComprobante: 'I',
      emisorRfc: 'EMP010101AAA',
      emisorNombre: 'Empresa SA',
      receptorRfc: 'CLI010101CCC',
      receptorNombre: 'Cliente USD',
      subtotal: 100,
      descuento: 0,
      ivaTrasladado: 0,
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 100,
      moneda: 'USD',
      tipoCambio: 18,
      metodoPago: 'PPD',
      formaPago: '99',
      usoCfdi: 'G03',
      conceptoPrincipal: 'Servicios profesionales',
      claveProdServ: '80101500',
      statusSat: 'VIGENTE',
      polizaId: null,
      polizaFolio: null,
      xmlRaw: ''
    };
    const p2Recent: CfdiDocument = {
      ...usdInv,
      id: 'p2',
      uuid: 'DDDD2222',
      fecha: '2026-10-20',
      tipoComprobante: 'P',
      moneda: 'MXN',
      tipoCambio: 1,
      total: 0,
      relatedDocs: [
        {
          idDocumento: usdInv.uuid,
          numParcialidad: 2,
          impSaldoAnt: 50,
          impPagado: 20,
          impSaldoInsoluto: 30,
          monedaDr: 'USD',
          equivalenciaDr: 1,
          pagoMoneda: 'USD',
          pagoTipoCambio: 20.5
        }
      ]
    };
    const p1Older: CfdiDocument = {
      ...usdInv,
      id: 'p1',
      uuid: 'DDDD1111',
      fecha: '2026-10-05',
      tipoComprobante: 'P',
      moneda: 'MXN',
      tipoCambio: 1,
      total: 0,
      relatedDocs: [
        {
          idDocumento: usdInv.uuid,
          numParcialidad: 1,
          impSaldoAnt: 100,
          impPagado: 50,
          impSaldoInsoluto: 50,
          monedaDr: 'USD',
          equivalenciaDr: 1,
          pagoMoneda: 'USD',
          pagoTipoCambio: 19.0
        }
      ]
    };
    const aging = computeCxcCxpAging({
      companyId: 'c1',
      cfdis: [usdInv, p2Recent, p1Older],
      asOfIso: '2026-10-25'
    });
    expect(aging.cxcItems.length).toBe(1);
    expect(aging.cxcItems[0]?.saldoInsolutoMxn).toBe(615);

    // Tolerancia $0.01 en MXN no debe quedar como factura pendiente
    const mxnInv: CfdiDocument = { ...usdInv, id: 'inv2', uuid: 'EEEE1111', moneda: 'MXN', tipoCambio: 1, total: 100 };
    const mxnPay: CfdiDocument = {
      ...mxnInv,
      id: 'p3',
      uuid: 'FFFF1111',
      tipoComprobante: 'P',
      total: 99.99,
      relatedDocs: [
        {
          idDocumento: mxnInv.uuid,
          numParcialidad: 1,
          impSaldoAnt: 100,
          impPagado: 99.99,
          impSaldoInsoluto: 0.01,
          monedaDr: 'MXN'
        }
      ]
    };
    const agingCentTolerance = computeCxcCxpAging({
      companyId: 'c1',
      cfdis: [mxnInv, mxnPay],
      asOfIso: '2026-10-25'
    });
    expect(agingCentTolerance.cxcItems.length).toBe(0);
  });
});
