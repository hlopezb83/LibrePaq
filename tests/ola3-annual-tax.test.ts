import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import {
  createCompanyRecord,
  createPolizaTransaction,
  db,
  deleteCompanyRecord,
  getAccounts,
  initDatabase,
  saveTaxParameters
} from '../src/server/db';
import {
  ensureAnnualAndInventoryTables,
  getAnnualTaxInputsRepo,
  getAnnualTaxSummaryRepo,
  saveAnnualTaxInputsRepo
} from '../src/server/repositories/annual-tax.repo';
import { annualTaxRoutes } from '../src/server/routes/annual-tax.routes';
import { calculateArt106PfIsr } from '../src/shared/engine/art106-tax.engine';
import {
  computeAnnualTaxSummary,
  type AnnualTaxMonthlyBalance
} from '../src/shared/engine/annual-tax.engine';
import { getOfficialInpc } from '../src/shared/sat-inpc-catalog';
import type { AnnualTaxSummaryResponse } from '../src/shared/types/annual-tax.types';
import type { AccountWithBalance, Company } from '../src/shared/types/core.types';

function makeAcc(
  code: string,
  name: string,
  type: AccountWithBalance['type'],
  nature: AccountWithBalance['nature'],
  finalBalance: number,
  satGroupCode?: string
): AccountWithBalance {
  return {
    id: `acc_${code}`,
    companyId: 'comp_test_3a',
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
    initialBalanceComputed: 0,
    periodCharges: 0,
    periodCredits: 0,
    finalBalance
  };
}

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'comp_test_3a',
    name: 'Tecnologías Fiscales S.A. de C.V.',
    rfc: 'TFI200101AB1',
    regimenFiscal: '601 - General de Ley Personas Morales',
    codigoPostal: '06000',
    maskFormat: 'XXX-XX-XXX',
    currentYear: 2025,
    currentPeriod: 12,
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides
  };
}

function makeUniformMonthlyBalances(
  bancos: number,
  clientes: number,
  proveedores: number,
  acreedores: number
): AnnualTaxMonthlyBalance[] {
  return Array.from({ length: 12 }, (_, idx) => ({
    periodo: idx + 1,
    accounts: [
      makeAcc('102-01-001', 'Bancos', 'ACTIVO', 'DEUDORA', bancos, '102.01'),
      makeAcc('105-01-001', 'Clientes', 'ACTIVO', 'DEUDORA', clientes, '105.01'),
      makeAcc('201-01-001', 'Proveedores', 'PASIVO', 'ACREEDORA', proveedores, '201.01'),
      makeAcc('205-01-001', 'Acreedores', 'PASIVO', 'ACREEDORA', acreedores, '205.01')
    ]
  }));
}

describe('Ola 3A — Declaración Anual, Ajuste Inflación INPC, CUCA, CUFIN y PTU', () => {
  const createdCompanyIds: string[] = [];

  beforeAll(() => {
    initDatabase();
  });

  afterAll(() => {
    for (const id of createdCompanyIds) {
      deleteCompanyRecord(id, 'owner_3a');
      deleteCompanyRecord(id);
    }
  });

  test('1. Ajuste Anual por Inflación acumulable vs deducible usando INPC oficial', () => {
    const inpc2024Dic = getOfficialInpc(2024, 12)!; // 139.380
    const inpc2025Dic = getOfficialInpc(2025, 12)!; // 145.400
    expect(inpc2024Dic).toBe(139.38);
    expect(inpc2025Dic).toBe(145.4);
    const expectedFactor = Math.floor((inpc2025Dic / inpc2024Dic - 1) * 10000) / 10000; // 0.0431

    const trialBalance: AccountWithBalance[] = [
      makeAcc('401-01-001', 'Ventas', 'INGRESOS', 'ACREEDORA', 1_000_000, '401.01')
    ];

    // Caso A: Deudas ($500k) > Créditos ($200k) => Ajuste Acumulable
    const resAcum = computeAnnualTaxSummary({
      company: makeCompany(),
      ejercicio: 2025,
      trialBalance,
      monthlyBalancesByPeriod: makeUniformMonthlyBalances(100_000, 100_000, 300_000, 200_000),
      fixedAssetsFiscalDeduction: 0,
      paymentsProvisioned: 0,
      inputs: {}
    });

    expect(resAcum.inflation.inpcCierreAnterior).toBe(139.38);
    expect(resAcum.inflation.inpcCierreActual).toBe(145.4);
    expect(resAcum.inflation.factorAjuste).toBe(expectedFactor);
    expect(resAcum.inflation.promedioCreditos).toBe(200_000);
    expect(resAcum.inflation.promedioDeudas).toBe(500_000);
    expect(resAcum.inflation.diferenciaPromedios).toBe(300_000);
    expect(resAcum.inflation.tipo).toBe('ACUMULABLE');
    expect(resAcum.inflation.ajusteAcumulable).toBe(12_930); // 300,000 * 0.0431
    expect(resAcum.inflation.ajusteDeducible).toBe(0);

    // Caso B: Créditos ($600k) > Deudas ($200k) => Ajuste Deducible
    const resDed = computeAnnualTaxSummary({
      company: makeCompany(),
      ejercicio: 2025,
      trialBalance,
      monthlyBalancesByPeriod: makeUniformMonthlyBalances(400_000, 200_000, 150_000, 50_000),
      fixedAssetsFiscalDeduction: 0,
      paymentsProvisioned: 0,
      inputs: {}
    });

    expect(resDed.inflation.tipo).toBe('DEDUCIBLE');
    expect(resDed.inflation.ajusteAcumulable).toBe(0);
    expect(resDed.inflation.ajusteDeducible).toBe(17_240); // 400,000 * 0.0431
  });

  test('2. Conciliación Contable-Fiscal, Nuevo CU a 4 decimales, PTU 10%, Pérdidas, CUCA y CUFIN', () => {
    const trialBalance: AccountWithBalance[] = [
      makeAcc('401-01-001', 'Ventas', 'INGRESOS', 'ACREEDORA', 2_000_000, '401.01'),
      makeAcc('501-01-001', 'Costo Ventas', 'COSTOS', 'DEUDORA', 800_000, '501.01'),
      makeAcc('601-01-001', 'Sueldos', 'GASTOS', 'DEUDORA', 400_000, '601.01'),
      makeAcc('601-01-006', 'Depreciación Contable', 'GASTOS', 'DEUDORA', 50_000, '601.84'),
      makeAcc('801-01-001', 'Provisión ISR', 'GASTOS', 'DEUDORA', 150_000, '611.01')
    ];

    // Utilidad Contable = 2,000,000 - 800,000 - 450,000 - 150,000 = 600,000
    // Ajuste Inflación Acumulable = 300,000 * 0.0431 = 12,930
    // Deducciones Contables No Fiscales = 150,000 (801/611) + 50,000 (601-01-006) + 20,000 (manual) = 220,000
    // Deducciones Fiscales No Contables = 80,000 (inv fiscal) + 0 (infl ded) = 80,000
    // Utilidad Fiscal antes PTU = 600,000 + 12,930 + 220,000 - 80,000 = 752,930
    // PTU 10% = 75,293
    // PTU pagada anterior = 30,000 => Utilidad Fiscal = 722,930
    // Nuevo CU = 722,930 / 2,000,000 = 0.361465 => 0.3615
    // Factor actualización INPC = floor(145.40 / 139.38 * 10000)/10000 = 1.0431
    // Pérdidas pendientes = 100,000 => actualizadas = 104,310
    // Resultado Fiscal = 722,930 - 104,310 = 618,620
    // ISR 30% = 185,586; menos pagos provisionales 120,000 = 65,586 a cargo
    const res = computeAnnualTaxSummary({
      company: makeCompany(),
      ejercicio: 2025,
      trialBalance,
      monthlyBalancesByPeriod: makeUniformMonthlyBalances(100_000, 100_000, 300_000, 200_000),
      fixedAssetsFiscalDeduction: 80_000,
      paymentsProvisioned: 120_000,
      perdidasFiscalesPendientes: 100_000,
      inputs: {
        cucaInicial: 500_000,
        aportacionesCapital: 100_000,
        reduccionesCapital: 25_000,
        cufinInicial: 200_000,
        dividendosPagados: 50_000,
        ptuPagadaAnterior: 30_000,
        noDeduciblesManual: 20_000
      }
    });

    expect(res.reconciliation.utilidadContable).toBe(600_000);
    expect(res.reconciliation.ingresosFiscalesNoContables).toBe(12_930);
    expect(res.reconciliation.deduccionesContablesNoFiscales).toBe(220_000);
    expect(res.reconciliation.deduccionesFiscalesNoContables).toBe(80_000);
    expect(res.reconciliation.utilidadFiscalAntesPtu).toBe(752_930);
    expect(res.reconciliation.utilidadFiscal).toBe(722_930);
    expect(res.reconciliation.perdidasFiscalesActualizadas).toBe(104_310);
    expect(res.reconciliation.resultadoFiscal).toBe(618_620);

    expect(res.determination.nuevoCoeficienteUtilidad).toBe(0.3615);
    expect(res.determination.ptuPorPagar10Pct).toBe(75_293);
    expect(res.determination.isrAnualCausado).toBe(185_586);
    expect(res.determination.isrACargo).toBe(65_586);
    expect(res.determination.isrAFavor).toBe(0);

    // CUCA = 500,000 * 1.0431 + 100,000 - 25,000 = 521,550 + 75,000 = 596,550
    expect(res.determination.cucaActualizada).toBe(521_550);
    expect(res.determination.cucaFinal).toBe(596_550);

    // CUFIN = 200,000 * 1.0431 + (618,620 - 185,586 - 20,000) - 50,000 = 208,620 + 413,034 - 50,000 = 571,654
    expect(res.determination.cufinActualizada).toBe(208_620);
    expect(res.determination.ufinDelEjercicio).toBe(413_034);
    expect(res.determination.cufinFinal).toBe(571_654);
  });

  test('3. Regímenes PF Art. 152, RESICO PF (1%-2.5% anual) y RESICO PM (30% flujo)', () => {
    const trialBalance: AccountWithBalance[] = [
      makeAcc('401-01-001', 'Servicios', 'INGRESOS', 'ACREEDORA', 900_000, '401.01'),
      makeAcc('601-01-001', 'Gastos', 'GASTOS', 'DEUDORA', 300_000, '601.01')
    ];

    // PF Art. 152 (RFC 13 caracteres, régimen 612)
    const pfArt152 = computeAnnualTaxSummary({
      company: makeCompany({
        rfc: 'GAPA850101AB1',
        regimenFiscal: '612 - Personas Físicas con Actividades Empresariales'
      }),
      ejercicio: 2025,
      trialBalance,
      monthlyBalancesByPeriod: [],
      fixedAssetsFiscalDeduction: 0,
      paymentsProvisioned: 20_000,
      inputs: {}
    });
    const expectedPf = calculateArt106PfIsr(60_000_000, 12, 2025);
    expect(pfArt152.determination.tipoRegimenAnual).toBe('PF_ART152');
    expect(pfArt152.determination.isrAnualCausado).toBe(expectedPf.isrCents / 100);

    // RESICO PF (RFC 13 caracteres, régimen 626) -> $900,000 anual cae en tramo <= 1,000,000 (1.5%)
    const resicoPf = computeAnnualTaxSummary({
      company: makeCompany({
        rfc: 'GAPA850101AB1',
        regimenFiscal: '626 - Régimen Simplificado de Confianza (RESICO)'
      }),
      ejercicio: 2025,
      trialBalance,
      monthlyBalancesByPeriod: [],
      fixedAssetsFiscalDeduction: 0,
      paymentsProvisioned: 10_000,
      inputs: {}
    });
    expect(resicoPf.determination.tipoRegimenAnual).toBe('PF_RESICO');
    expect(resicoPf.determination.tasaAplicablePct).toBe(1.5);
    expect(resicoPf.determination.isrAnualCausado).toBe(13_500);
    expect(resicoPf.determination.isrACargo).toBe(3_500);

    // RESICO PM (RFC 12 caracteres, régimen 626)
    const resicoPm = computeAnnualTaxSummary({
      company: makeCompany({
        rfc: 'RPM200101AB1',
        regimenFiscal: '626 - Régimen Simplificado de Confianza (RESICO)'
      }),
      ejercicio: 2025,
      trialBalance,
      monthlyBalancesByPeriod: [],
      fixedAssetsFiscalDeduction: 0,
      paymentsProvisioned: 200_000,
      inputs: {}
    });
    expect(resicoPm.determination.tipoRegimenAnual).toBe('PM_RESICO');
    expect(resicoPm.determination.isrAnualCausado).toBe(180_000);
    expect(resicoPm.determination.isrAFavor).toBe(20_000);
  });

  test('4. Persistencia SQLite idempotente y rutas Hono GET/POST /companies/:companyId/annual-tax', async () => {
    ensureAnnualAndInventoryTables(db);
    ensureAnnualAndInventoryTables(db);

    const tables = db
      .query(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('annual_tax_snapshots', 'inventory_periods')`
      )
      .all() as Array<{ name: string }>;
    expect(tables.map((t) => t.name).sort()).toEqual([
      'annual_tax_snapshots',
      'inventory_periods'
    ]);

    const company = createCompanyRecord({
      name: 'Comercializadora Anual 3A S.A.',
      rfc: 'CAA220101XY9',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      currentYear: 2025,
      currentPeriod: 12,
      userId: 'owner_3a'
    });
    createdCompanyIds.push(company.id);

    const accounts = getAccounts(company.id);
    const accIng = accounts.find((a) => a.code === '401-01-001')!;
    const accBanco = accounts.find((a) => a.code === '102-01-001')!;
    const accProv = accounts.find((a) => a.code === '201-01-001')!;

    createPolizaTransaction({
      companyId: company.id,
      tipo: 'INGRESO',
      fecha: '2025-01-15',
      ejercicio: 2025,
      periodo: 1,
      concepto: 'Ingreso anual semilla',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: accBanco.id, referencia: 'F1', concepto: 'Cobro', cargo: 500_000, abono: 0 },
        { accountId: accIng.id, referencia: 'F1', concepto: 'Venta', cargo: 0, abono: 500_000 }
      ]
    });

    createPolizaTransaction({
      companyId: company.id,
      tipo: 'DIARIO',
      fecha: '2025-01-20',
      ejercicio: 2025,
      periodo: 1,
      concepto: 'Pasivo proveedores',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: accBanco.id, referencia: 'P1', concepto: 'Préstamo', cargo: 100_000, abono: 0 },
        { accountId: accProv.id, referencia: 'P1', concepto: 'Proveedor', cargo: 0, abono: 100_000 }
      ]
    });

    saveTaxParameters(company.id, 2025, {
      pagosProvisionalesAnteriores: 50_000,
      perdidasFiscalesPendientes: 10_000
    });

    const savedInputs = saveAnnualTaxInputsRepo(
      company.id,
      2025,
      {
        cucaInicial: 100_000,
        aportacionesCapital: 25_000,
        cufinInicial: 50_000,
        dividendosPagados: 10_000,
        ptuPagadaAnterior: 5_000,
        noDeduciblesManual: 2_000
      },
      'owner_3a'
    );
    expect(savedInputs.cucaInicial).toBe(100_000);
    expect(getAnnualTaxInputsRepo(company.id, 2025).cufinInicial).toBe(50_000);

    const summary = getAnnualTaxSummaryRepo(company.id, 2025, 'owner_3a');
    expect(summary.determination.ingresosNominales).toBe(500_000);
    expect(summary.reconciliation.noDeduciblesManual).toBe(2_000);

    // Rutas Hono
    const testApi = new Hono().basePath('/api');
    testApi.route('/', annualTaxRoutes);

    const denied = await testApi.request(`/api/companies/${company.id}/annual-tax?year=2025`, {
      headers: { 'X-User-Id': 'intruder' }
    });
    expect(denied.status).toBe(403);

    const getRes = await testApi.request(`/api/companies/${company.id}/annual-tax?year=2025`, {
      headers: { 'X-User-Id': 'owner_3a' }
    });
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as AnnualTaxSummaryResponse;
    expect(getBody.inputs.cucaInicial).toBe(100_000);

    const postRes = await testApi.request(`/api/companies/${company.id}/annual-tax`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': 'owner_3a' },
      body: JSON.stringify({
        ejercicio: 2025,
        cucaInicial: 250_000,
        aportacionesCapital: 50_000,
        reduccionesCapital: 0,
        cufinInicial: 80_000,
        dividendosPagados: 20_000,
        ptuPagadaAnterior: 10_000,
        noDeduciblesManual: 5_000
      })
    });
    expect(postRes.status).toBe(200);
    const postBody = (await postRes.json()) as AnnualTaxSummaryResponse;
    expect(postBody.inputs.cucaInicial).toBe(250_000);
    expect(postBody.reconciliation.noDeduciblesManual).toBe(5_000);
    expect(postBody.determination.cucaFinal).toBeGreaterThan(250_000);
  });
});
