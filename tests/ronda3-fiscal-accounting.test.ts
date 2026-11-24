import { describe, expect, test } from 'bun:test';
import { getSeedAccountsForPreset } from '../src/shared/catalogs/base-accounts.seed';
import { buildAutoPolizaPlan } from '../src/shared/engine/auto-poliza.engine';
import { buildAnnualMonthlyBalancesFromMovements, computeAnnualFixedAssetFiscalDeduction } from '../src/shared/engine/annual-tax-balances.helper';
import { computeAnnualTaxSummary, type AnnualTaxMonthlyBalance } from '../src/shared/engine/annual-tax.engine';
import { buildYearCloseMovements } from '../src/shared/engine/bank-and-closing.engine';
import { buildCostOfSalesPolizaPlan } from '../src/shared/engine/cost-of-sales.engine';
import { computeExtendedFinancialStatements } from '../src/shared/engine/extended-statements.engine';
import { computeFinancialStatementsData, rollUpTrialBalanceAccounts } from '../src/shared/engine/financial-reports.engine';
import {
  AccountingInvariantError,
  toCents,
  validateAccountHierarchy,
  validateDoubleEntryMovements
} from '../src/shared/engine/invariants-and-math';
import type { Account, AccountWithBalance, CfdiDocument, Company, FixedAssetRecord } from '../src/shared/types';

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'comp_r3',
    name: 'Auditoría Fiscal Ronda 3 S.A. de C.V.',
    rfc: 'AFR220101AB1',
    regimenFiscal: '601 - General de Ley Personas Morales',
    codigoPostal: '06000',
    maskFormat: 'XXX-XX-XXX',
    currentYear: 2026,
    currentPeriod: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function makeSeedCatalog(companyId = 'comp_r3'): AccountWithBalance[] {
  return getSeedAccountsForPreset('SAT_STANDARD').map((a) => ({
    ...a,
    id: `acc_${a.code}`,
    companyId,
    initialBalance: 0,
    initialBalanceComputed: 0,
    periodCharges: 0,
    periodCredits: 0,
    finalBalance: 0
  }));
}

function makeAcc(
  code: string,
  name: string,
  type: AccountWithBalance['type'],
  nature: AccountWithBalance['nature'],
  finalBalance: number,
  satGroupCode?: string,
  initialBalanceComputed = 0
): AccountWithBalance {
  return {
    id: `acc_${code}`,
    companyId: 'comp_r3',
    code,
    name,
    parentCode: null,
    type,
    nature,
    level: 3,
    isAffectable: true,
    satGroupCode: satGroupCode ?? code.slice(0, 3),
    currency: 'MXN',
    initialBalance: 0,
    initialBalanceComputed,
    periodCharges: 0,
    periodCredits: 0,
    finalBalance
  };
}

function makeBaseCfdi(overrides: Partial<CfdiDocument> = {}): CfdiDocument {
  return {
    id: 'cfdi_r3',
    companyId: 'comp_r3',
    uuid: '11112222-3333-4444-8555-666677778888',
    fecha: '2026-10-15',
    tipoComprobante: 'I',
    direction: 'RECIBIDO',
    serie: 'R3',
    folio: '100',
    emisorRfc: 'PRO900101AA1',
    emisorNombre: 'PROVEEDOR PRUEBA SA DE CV',
    receptorRfc: 'AFR220101AB1',
    receptorNombre: 'AUDITORIA FISCAL RONDA 3 SA DE CV',
    conceptoPrincipal: 'Operación de prueba Ronda 3',
    claveProdServ: '84111500',
    moneda: 'MXN',
    tipoCambio: 1,
    subtotal: 100,
    descuento: 0,
    ivaTrasladado: 16,
    isrRetenido: 0,
    ivaRetenido: 0,
    total: 116,
    metodoPago: 'PUE',
    formaPago: '03',
    usoCfdi: 'G03',
    statusSat: 'VIGENTE',
    polizaId: null,
    xmlRaw: '<cfdi:Comprobante/>',
    ...overrides
  };
}

describe('Ronda 3 — Corrección de Bugs Contables y Fiscales (BUG-08, 24, 28, 29, 30, 48, 49)', () => {
  test('BUG-08: buildAnnualMonthlyBalancesFromMovements excluye Periodo 13 de Cierre Anual preservando ingresos/costos/gastos', () => {
    const company = makeCompany();
    const catalog = makeSeedCatalog(company.id);
    const movs = [
      { account_id: 'acc_102-01-001', cargo: 500_000, abono: 0, polizas: { company_id: company.id, ejercicio: 2025, periodo: 6 } },
      { account_id: 'acc_401-01-001', cargo: 0, abono: 500_000, polizas: { company_id: company.id, ejercicio: 2025, periodo: 6 } },
      { account_id: 'acc_601-01-001', cargo: 200_000, abono: 0, polizas: { company_id: company.id, ejercicio: 2025, periodo: 8 } },
      { account_id: 'acc_102-01-001', cargo: 0, abono: 200_000, polizas: { company_id: company.id, ejercicio: 2025, periodo: 8 } }
    ];

    const preClose = computeFinancialStatementsData(company, catalog, movs, 2025, 13);
    const close = buildYearCloseMovements(preClose.trialBalance, 2025, 'initialBalanceComputed');
    expect(close.utilidadTraspasada).toBe(300_000);

    const movsWithClosing = [
      ...movs,
      ...close.movements.map((m) => ({
        account_id: m.accountId,
        cargo: m.cargo,
        abono: m.abono,
        polizas: { company_id: company.id, ejercicio: 2025, periodo: 13 }
      }))
    ];

    const { trialBalance, monthlyBalancesByPeriod } = buildAnnualMonthlyBalancesFromMovements(
      catalog,
      movsWithClosing,
      2025
    );

    expect(monthlyBalancesByPeriod).toHaveLength(12);
    expect(trialBalance.find((a) => a.code === '401-01-001')?.finalBalance).toBe(500_000);
    expect(trialBalance.find((a) => a.code === '601-01-001')?.finalBalance).toBe(200_000);
    expect(trialBalance.find((a) => a.code === '102-01-001')?.finalBalance).toBe(300_000);

    const annual = computeAnnualTaxSummary({
      company,
      ejercicio: 2025,
      trialBalance,
      monthlyBalancesByPeriod,
      fixedAssetsFiscalDeduction: 0,
      paymentsProvisioned: 0,
      inputs: {}
    });
    expect(annual.determination.ingresosNominales).toBe(500_000);
    expect(annual.reconciliation.utilidadContable).toBe(300_000);
  });

  test('BUG-24: computeAnnualFixedAssetFiscalDeduction acumula meses depreciados dentro del año y no excede 100% del MOI', () => {
    const assetExhausting: FixedAssetRecord = {
      id: 'fa_1',
      companyId: 'comp_r3',
      codigo: 'EQ-01',
      nombre: 'Servidor con 2 meses restantes',
      categoria: 'COMPUTO_30',
      fechaAdquisicion: '2024-03-01',
      cfdiUuid: null,
      montoOriginalInversion: 120_000,
      tasaAnualPct: 50, // 24 meses de vida útil => $5,000/mes
      mesesDepreciadosPrevios: 22, // Sólo restan 2 meses ($10,000)
      inpcAdquisicion: 130,
      inpcMedioPeriodo: 130,
      cuentaActivoCode: '156-01-001',
      cuentaDepAcumCode: '171-01-001',
      cuentaGastoDepCode: '601-01-006',
      estatus: 'ACTIVO',
      createdAt: '2024-03-01'
    };

    // Art. 31 LISR: compra mar-2024 => 9 meses 2024 + 12 meses 2025 = 21 previos => restan 3 meses en 2026 ($15,000 * INPC Jun 2026 / 130)
    const ded = computeAnnualFixedAssetFiscalDeduction([assetExhausting], 2026);
    expect(ded).toBe(16_744.5);

    // Activo adquirido en oct-2026 deprecia meses completos nov y dic (2 meses = $10,000 * factor INPC Nov/130)
    const assetMidYear: FixedAssetRecord = {
      ...assetExhausting,
      id: 'fa_2',
      fechaAdquisicion: '2026-10-10',
      inpcAdquisicion: 147.026, // Oct 2026
      inpcMedioPeriodo: 147.026,
      mesesDepreciadosPrevios: 0
    };
    const midDed = computeAnnualFixedAssetFiscalDeduction([assetMidYear], 2026);
    expect(midDed).toBeGreaterThanOrEqual(10_000);
    expect(midDed).toBeLessThanOrEqual(10_200);
  });

  test('BUG-48: Ajuste Anual por Inflación (Arts. 44-46 LISR) aplica sólo a PM_GENERAL y es $0 en PF_ART152, PF_RESICO y PM_RESICO', () => {
    const trialBalance: AccountWithBalance[] = [
      makeAcc('401-01-001', 'Ventas', 'INGRESOS', 'ACREEDORA', 1_000_000, '401.01'),
      makeAcc('601-01-001', 'Gastos', 'GASTOS', 'DEUDORA', 400_000, '601.01')
    ];
    const monthlyBalances: AnnualTaxMonthlyBalance[] = Array.from({ length: 12 }, (_, idx) => ({
      periodo: idx + 1,
      accounts: [
        makeAcc('102-01-001', 'Bancos', 'ACTIVO', 'DEUDORA', 100_000, '102.01'),
        makeAcc('105-01-001', 'Clientes', 'ACTIVO', 'DEUDORA', 100_000, '105.01'),
        makeAcc('201-01-001', 'Proveedores', 'PASIVO', 'ACREEDORA', 500_000, '201.01')
      ]
    }));

    const pmGeneral = computeAnnualTaxSummary({
      company: makeCompany({ rfc: 'AFR220101AB1', regimenFiscal: '601 - General de Ley Personas Morales' }),
      ejercicio: 2025,
      trialBalance,
      monthlyBalancesByPeriod: monthlyBalances,
      fixedAssetsFiscalDeduction: 0,
      paymentsProvisioned: 0,
      inputs: {}
    });
    expect(pmGeneral.determination.tipoRegimenAnual).toBe('PM_GENERAL');
    expect(pmGeneral.inflation.ajusteAcumulable).toBeGreaterThan(0);
    expect(pmGeneral.reconciliation.utilidadFiscal).toBeGreaterThan(600_000);

    for (const cfg of [
      { rfc: 'GAPA850101AB1', regimenFiscal: '612 - Personas Físicas con Actividades Empresariales', expected: 'PF_ART152' as const },
      { rfc: 'GAPA850101AB1', regimenFiscal: '626 - RESICO', expected: 'PF_RESICO' as const },
      { rfc: 'RPM200101AB1', regimenFiscal: '626 - RESICO', expected: 'PM_RESICO' as const }
    ]) {
      const res = computeAnnualTaxSummary({
        company: makeCompany({ rfc: cfg.rfc, regimenFiscal: cfg.regimenFiscal }),
        ejercicio: 2025,
        trialBalance,
        monthlyBalancesByPeriod: monthlyBalances,
        fixedAssetsFiscalDeduction: 0,
        paymentsProvisioned: 0,
        inputs: {}
      });
      expect(res.determination.tipoRegimenAnual).toBe(cfg.expected);
      expect(res.inflation.tipo).toBe('NEUTRO');
      expect(res.inflation.ajusteAcumulable).toBe(0);
      expect(res.inflation.ajusteDeducible).toBe(0);
      expect(res.reconciliation.ingresosFiscalesNoContables).toBe(0);
      expect(res.reconciliation.deduccionesFiscalesNoContables).toBe(0);
      expect(res.reconciliation.utilidadFiscal).toBe(600_000);
      expect(res.reconciliation.resultadoFiscal).toBe(600_000);
    }
  });

  test('BUG-28: IEPS elevado (>50% del total) e impuestos locales cuadran al centavo tanto en Tipo I como en Notas de Crédito Tipo E', () => {
    const catalog = makeSeedCatalog();
    const byId = new Map(catalog.map((a) => [a.id, a]));

    // Caso A: Factura Tipo I con IEPS 160% (supera 50% del total)
    const cfdiHighIeps = makeBaseCfdi({
      tipoComprobante: 'I',
      direction: 'RECIBIDO',
      subtotal: 100,
      ivaTrasladado: 41.6, // 16% sobre (100 + 160)
      total: 301.6,
      taxBreakdown: { base16: 260, iva16: 41.6, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 160 }
    });
    const planI = buildAutoPolizaPlan(cfdiHighIeps, catalog);
    expect(planI.isBalanced).toBe(true);
    expect(validateDoubleEntryMovements(planI.movements, byId).totalCargo).toBe(301.6);

    // Caso B: Nota de Crédito Tipo E RECIBIDA con IEPS explícito
    const cfdiNcRecibida = makeBaseCfdi({
      id: 'cfdi_nc_rec',
      tipoComprobante: 'E',
      direction: 'RECIBIDO',
      subtotal: 100,
      ivaTrasladado: 41.6,
      total: 301.6,
      taxBreakdown: { base16: 260, iva16: 41.6, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 160 }
    });
    const planNcRec = buildAutoPolizaPlan(cfdiNcRecibida, catalog);
    expect(planNcRec.isBalanced).toBe(true);
    expect(validateDoubleEntryMovements(planNcRec.movements, byId).totalCargo).toBe(301.6);

    // Caso C: Nota de Crédito Tipo E EMITIDA con IEPS + impuesto local (ISH)
    const cfdiNcEmitida = makeBaseCfdi({
      id: 'cfdi_nc_emi',
      tipoComprobante: 'E',
      direction: 'EMITIDO',
      subtotal: 1000,
      ivaTrasladado: 160,
      total: 1190, // + $30 ISH local
      taxBreakdown: { base16: 1000, iva16: 160, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 0 }
    });
    const planNcEmi = buildAutoPolizaPlan(cfdiNcEmitida, catalog);
    expect(planNcEmi.isBalanced).toBe(true);
    expect(validateDoubleEntryMovements(planNcEmi.movements, byId).totalCargo).toBe(1190);
  });

  test('BUG-49: Nómina con deducciones mayores a percepciones no genera abonos negativos y cuadra vía cuenta 107 / fallback Bancos', () => {
    const baseCatalog = makeSeedCatalog();
    const cfdiNominaNeg = makeBaseCfdi({
      id: 'cfdi_nom_neg',
      tipoComprobante: 'N',
      direction: 'EMITIDO',
      conceptoPrincipal: 'Nómina con ajuste por exceso de retenciones',
      subtotal: 1000,
      isrRetenido: 800,
      descuento: 500, // IMSS / descuentos => 1,300 > 1,000 => excedente 300
      ivaTrasladado: 0,
      total: 0
    });

    // Con cuenta 107 en el catálogo
    const acc107: Account = {
      id: 'acc_107-01-001',
      companyId: 'comp_r3',
      code: '107-01-001',
      name: 'Deudores Diversos / Funcionarios y Empleados',
      parentCode: '100-00-000',
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 3,
      isAffectable: true,
      satGroupCode: '107.01',
      currency: 'MXN',
      initialBalance: 0
    };
    const catWith107 = [...baseCatalog, acc107];
    const planWith107 = buildAutoPolizaPlan(cfdiNominaNeg, catWith107);
    expect(planWith107.isBalanced).toBe(true);
    for (const m of planWith107.movements) {
      expect(m.cargo).toBeGreaterThanOrEqual(0);
      expect(m.abono).toBeGreaterThanOrEqual(0);
    }
    const deudorLine = planWith107.movements.find((m) => m.accountCode === '107-01-001');
    expect(deudorLine?.cargo).toBe(300);
    expect(deudorLine?.abono).toBe(0);
    expect(
      validateDoubleEntryMovements(planWith107.movements, new Map(catWith107.map((a) => [a.id, a]))).totalCargo
    ).toBe(1300);

    // Sin cuenta 107 -> fallback a Bancos con cargo positivo (sin abono negativo)
    const planFallback = buildAutoPolizaPlan(cfdiNominaNeg, baseCatalog);
    expect(planFallback.isBalanced).toBe(true);
    expect(
      validateDoubleEntryMovements(planFallback.movements, new Map(baseCatalog.map((a) => [a.id, a]))).totalCargo
    ).toBe(1300);
  });

  test('BUG-29: Semilla incluye 115-00-000/115-01-001 válidos y resolveInventoryOrPurchasesAccount rechaza auto-anulación con 501', () => {
    const seed = getSeedAccountsForPreset('SAT_STANDARD');
    const rub = seed.find((a) => a.code === '115-00-000');
    const inv = seed.find((a) => a.code === '115-01-001');
    expect(rub).toMatchObject({ level: 2, isAffectable: false, nature: 'DEUDORA', type: 'ACTIVO' });
    expect(inv).toMatchObject({
      level: 3,
      isAffectable: true,
      nature: 'DEUDORA',
      type: 'ACTIVO',
      satGroupCode: '115.01'
    });
    const seedCatalog = makeSeedCatalog();
    expect(validateAccountHierarchy(seedCatalog, inv!.parentCode, inv!.code).level).toBe(3);

    const accCostOnly = makeAcc('501-01-001', 'Costo de Ventas', 'COSTOS', 'DEUDORA', 0, '501.01');
    expect(() =>
      buildCostOfSalesPolizaPlan({
        companyId: 'comp_r3',
        year: 2026,
        period: 10,
        fecha: '2026-10-31',
        costOfSales: 5000,
        accounts: [accCostOnly]
      })
    ).toThrow(AccountingInvariantError);

    try {
      buildCostOfSalesPolizaPlan({
        companyId: 'comp_r3',
        year: 2026,
        period: 10,
        fecha: '2026-10-31',
        costOfSales: 5000,
        accounts: [accCostOnly]
      });
    } catch (err) {
      expect(err).toBeInstanceOf(AccountingInvariantError);
      expect((err as AccountingInvariantError).code).toBe('INVENTORY_ACCOUNT_NOT_FOUND');
    }

    // Conserva fallback a otra cuenta 501 distinta de costAcc
    const accOther501 = makeAcc('501-02-001', 'Compras / Costo Alterno', 'COSTOS', 'DEUDORA', 0, '501.02');
    const planOther = buildCostOfSalesPolizaPlan({
      companyId: 'comp_r3',
      year: 2026,
      period: 10,
      fecha: '2026-10-31',
      costOfSales: 5000,
      accounts: [accCostOnly, accOther501]
    });
    expect(planOther.movements[0]?.accountCode).toBe('501-01-001');
    expect(planOther.movements[1]?.accountCode).toBe('501-02-001');
  });

  test('BUG-30: computeNetIncomeFromInitialCents respeta naturalezas contrarias (402 Deudora, 503 Acreedora) y cuentas 8xx', () => {
    const company = makeCompany();
    // Saldo inicial P&L (ej. previo al cierre):
    // Ingresos 401 (Acreedora) = +100,000; Devoluciones 402 (Deudora) = 10,000 => Ingresos netos = 90,000
    // Costos 501 (Deudora) = +30,000; Devolución s/compra 503 (Acreedora) = 5,000 => Costos netos = 25,000
    // Gastos 601 (Deudora) = +15,000; Cuenta 802 (Deudora, 8xx) = +8,000
    // Utilidad inicial neta esperada = 90,000 - 25,000 - 15,000 - 8,000 = 42,000
    const accounts: AccountWithBalance[] = [
      ...makeSeedCatalog(company.id).filter((a) =>
        ['100-00-000', '102-00-000', '102-01-001', '300-00-000', '301-00-000', '301-01-001', '400-00-000', '401-00-000', '401-01-001', '500-00-000', '501-00-000', '501-01-001', '600-00-000', '601-00-000', '601-01-001'].includes(a.code)
      ),
      { ...makeAcc('402-01-001', 'Devoluciones sobre Ventas', 'INGRESOS', 'DEUDORA', 0, '402.01'), parentCode: '401-00-000' },
      { ...makeAcc('503-01-001', 'Devoluciones sobre Compras', 'COSTOS', 'ACREEDORA', 0, '503.01'), parentCode: '501-00-000' },
      { ...makeAcc('800-00-000', 'ISR / Otros 8xx', 'GASTOS', 'DEUDORA', 0, '800'), level: 1, isAffectable: false },
      { ...makeAcc('802-01-001', 'Otros Impuestos / PTU 8xx', 'GASTOS', 'DEUDORA', 0, '802.01'), level: 2, parentCode: '800-00-000' }
    ].map((a) => {
      const initByCode: Record<string, number> = {
        '102-01-001': 142_000,
        '301-01-001': 100_000,
        '401-01-001': 100_000,
        '402-01-001': 10_000,
        '501-01-001': 30_000,
        '503-01-001': 5_000,
        '601-01-001': 15_000,
        '802-01-001': 8_000
      };
      return { ...a, initialBalance: initByCode[a.code] ?? 0 };
    });

    const periodChg = new Map<string, number>([
      ['acc_102-01-001', toCents(58_000)],
      ['acc_501-01-001', toCents(10_000)],
      ['acc_601-01-001', toCents(5_000)],
      ['acc_802-01-001', toCents(7_000)]
    ]);
    const periodCred = new Map<string, number>([
      ['acc_401-01-001', toCents(80_000)]
    ]);
    const tb = rollUpTrialBalanceAccounts(accounts, new Map(), new Map(), periodChg, periodCred);

    const ext = computeExtendedFinancialStatements({
      company,
      ejercicio: 2026,
      periodo: 10,
      currentTrialBalance: tb
    });

    const openingRow = ext.equityChanges.rows[0]!;
    expect(openingRow.resultadoEjercicio).toBe(42_000);
    // Utilidad final: (180k - 10k) - (40k - 5k) - 20k - 15k = 170k - 35k - 20k - 15k = 100k
    // Flujo del periodo = 100k - 42k = 58k === incremento en Bancos (200k - 142k)
    expect(ext.cashFlow.utilidadNeta).toBe(58_000);
    expect(ext.cashFlow.isReconciled).toBe(true);
    expect(ext.equityChanges.isBalanced).toBe(true);
  });
});
