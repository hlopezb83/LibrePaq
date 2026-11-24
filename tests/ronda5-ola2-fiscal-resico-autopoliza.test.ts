import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import {
  createCompanyRecord,
  createPolizaTransaction,
  deleteCompanyRecord,
  getAccounts,
  initDatabase,
  insertParsedCfdiRecord
} from '../src/server/db';
import { generateAutoPolizaFromCfdiId } from '../src/server/repositories/cfdi.repo';
import {
  listAccountingRulesRepo,
  upsertAccountingRuleRepo
} from '../src/server/repositories/accounting-rules.repo';
import { getAnnualTaxSummaryRepo } from '../src/server/repositories/annual-tax.repo';
import {
  generateExchangeFluctuationPoliza,
  generateTaxProvisionPoliza
} from '../src/server/repositories/tax-provision.repo';
import { fiscalRoutes } from '../src/server/routes/fiscal.routes';
import { getSeedAccountsForPreset } from '../src/shared/catalogs/base-accounts.seed';
import {
  buildAnnualMonthlyBalancesFromMovements,
  computeAnnualFixedAssetFiscalDeduction
} from '../src/shared/engine/annual-tax-balances.helper';
import { computeAnnualTaxSummary } from '../src/shared/engine/annual-tax.engine';
import {
  buildAutoPolizaPlan,
  resolveFiscalAccount,
  resolveMatchingAccountingRule,
  resolveNonDeductibleAccount
} from '../src/shared/engine/auto-poliza.engine';
import { computeFiscalWorkpaperFromTrialBalance } from '../src/shared/engine/fiscal-trial-balance.engine';
import { toCents, validateDoubleEntryMovements } from '../src/shared/engine/invariants-and-math';
import { formatSatDypWorkpaperText } from '../src/shared/engine/sat-dyp-formatter';
import { buildTaxProvisionMovements } from '../src/shared/engine/tax-provision.engine';
import { FISCAL_ACCOUNT_ROLES } from '../src/shared/sat-constants';
import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  FixedAssetRecord,
  TaxParametersRecord
} from '../src/shared/types';
import type { AccountingRuleRecord } from '../src/shared/types/accounting-rules.types';

function makeSeedCatalog(companyId = 'comp_r5_o2'): AccountWithBalance[] {
  return getSeedAccountsForPreset('SAT_STANDARD').map((a, idx) => ({
    ...a,
    id: `acc_${idx}_${a.code}`,
    companyId,
    initialBalance: 0,
    initialBalanceComputed: 0,
    periodCharges: 0,
    periodCredits: 0,
    finalBalance: 0
  }));
}

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'comp_r5_o2',
    name: 'Empresa Ronda 5 Ola 2 S.A. de C.V.',
    rfc: 'ERO240101AB1',
    regimenFiscal: '601 - General de Ley Personas Morales',
    codigoPostal: '06000',
    maskFormat: 'XXX-XX-XXX',
    currentYear: 2026,
    currentPeriod: 6,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function makeCfdi(overrides: Partial<CfdiDocument> = {}): CfdiDocument {
  return {
    id: 'cfdi_r5',
    companyId: 'comp_r5_o2',
    uuid: 'AAAA1111-1111-4111-8111-111111111111',
    fecha: '2026-06-15',
    tipoComprobante: 'I',
    direction: 'EMITIDO',
    serie: 'F',
    folio: '100',
    emisorRfc: 'ERO240101AB1',
    emisorNombre: 'Empresa Ronda 5 Ola 2',
    receptorRfc: 'CLI200101AA1',
    receptorNombre: 'Cliente Uno',
    conceptoPrincipal: 'Servicio consultoría',
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
    statusSat: 'VIGENTE',
    polizaId: null,
    xmlRaw: '',
    ...overrides
  };
}

const defaultParams: TaxParametersRecord = {
  companyId: 'comp_r5_o2',
  ejercicio: 2026,
  periodo: 6,
  coeficienteUtilidad: 0.25,
  perdidasFiscalesPendientes: 0,
  pagosProvisionalesAnteriores: 0,
  saldoFavorIvaAnterior: 0,
  tipoCambioDofCierre: 20
};

describe('Ronda 5 Ola 2 — Día 17 PyME/RESICO, Anual en Flujo, Auto-Póliza FX/Locales y Reglas', () => {
  const createdCompanyIds: string[] = [];

  beforeAll(() => {
    initDatabase();
  });

  afterAll(() => {
    for (const id of createdCompanyIds) {
      deleteCompanyRecord(id);
    }
  });

  test('1. Día 17: signo por naturaleza (402 resta), Tipo N EMITIDO + IMSS/ISN/Depreciación en RESICO PM / PF 612, y sat-dyp Art. 106', () => {
    const tbPm = makeSeedCatalog().map((a) => {
      if (a.code === '401-01-001') return { ...a, periodCredits: 100_000, finalBalance: 100_000 };
      if (a.code === '402-01-001') return { ...a, periodCharges: 15_000, finalBalance: 15_000 }; // Deudora: debe restar!
      if (a.code === '601-01-001') return { ...a, periodCharges: 30_000, finalBalance: 30_000 };
      return a;
    });
    const wpPm601 = computeFiscalWorkpaperFromTrialBalance({
      company: makeCompany(),
      ejercicio: 2026,
      periodo: 6,
      parameters: defaultParams,
      trialBalance: tbPm,
      cfdis: []
    });
    expect(wpPm601.isrProvisional.ingresosPeriodo).toBe(85_000);
    expect(wpPm601.isrProvisional.ingresosAcumuladosEjercicio).toBe(85_000);

    // RESICO PM (626) flujo: PUE venta $200k + PUE compra $40k + PPD compra NO pagada $50k + Tipo N EMITIDO $30k + Tipo N RECIBIDO $99k (ignorado) + IMSS 601-01-007 $5k + Dep. Fiscal 613 $4k
    const tbResicoPm = makeSeedCatalog().map((a) => {
      if (a.code === '601-01-007') return { ...a, periodCharges: 5_000, finalBalance: 10_000 };
      if (a.code === '601-01-008') return { ...a, periodCharges: 2_000, finalBalance: 4_000 };
      if (a.code === '601-01-003') return { ...a, periodCharges: 40_000, finalBalance: 90_000 }; // ya cubierto por CFDIs, no debe duplicarse
      if (a.code === '601-01-006') return { ...a, periodCharges: 3_000, finalBalance: 6_000 }; // dep contable excluida
      return a;
    });
    tbResicoPm.push({
      id: 'acc_613_dep',
      companyId: 'comp_r5_o2',
      code: '613-01-001',
      name: 'Depreciación Fiscal Autorizada Art. 31',
      parentCode: '600-00-000',
      type: 'GASTOS',
      nature: 'DEUDORA',
      level: 3,
      isAffectable: true,
      satGroupCode: '613.05',
      currency: 'MXN',
      initialBalance: 0,
      initialBalanceComputed: 0,
      periodCharges: 4_000,
      periodCredits: 0,
      finalBalance: 8_000
    });
    const cfdisResicoPm: CfdiDocument[] = [
      makeCfdi({ id: 'c1', uuid: 'U1', direction: 'EMITIDO', tipoComprobante: 'I', metodoPago: 'PUE', subtotal: 200_000, ivaTrasladado: 32_000, total: 232_000 }),
      makeCfdi({ id: 'c2', uuid: 'U2', direction: 'RECIBIDO', tipoComprobante: 'I', metodoPago: 'PUE', subtotal: 40_000, ivaTrasladado: 6_400, total: 46_400 }),
      makeCfdi({ id: 'c3', uuid: 'U3', direction: 'RECIBIDO', tipoComprobante: 'I', metodoPago: 'PPD', subtotal: 50_000, ivaTrasladado: 8_000, total: 58_000 }),
      makeCfdi({ id: 'c4', uuid: 'U4', direction: 'EMITIDO', tipoComprobante: 'N', metodoPago: 'PUE', subtotal: 30_000, ivaTrasladado: 0, total: 27_000 }),
      makeCfdi({ id: 'c5', uuid: 'U5', direction: 'RECIBIDO', tipoComprobante: 'N', metodoPago: 'PUE', subtotal: 99_000, ivaTrasladado: 0, total: 90_000 })
    ];
    const wpResicoPm = computeFiscalWorkpaperFromTrialBalance({
      company: makeCompany({ rfc: 'RPM240101AB1', regimenFiscal: '626 - RESICO' }),
      ejercicio: 2026,
      periodo: 6,
      parameters: defaultParams,
      trialBalance: tbResicoPm,
      cfdis: cfdisResicoPm
    });
    // Deducciones periodo: 40k (PUE I) + 30k (Nomina N EMITIDO) + 5k (601-01-007) + 2k (601-01-008) + 4k (613.05) = 81k
    expect(wpResicoPm.isrProvisional.deduccionesAutorizadasPeriodo).toBe(81_000);
    // Deducciones acumuladas: 40k + 30k + 10k + 4k + 8k = 92k
    expect(wpResicoPm.isrProvisional.deduccionesAcumuladasEjercicio).toBe(92_000);
    expect(wpResicoPm.isrProvisional.utilidadFiscalEstimada).toBe(108_000);

    // PF 612 DyP formatter muestra Art. 106 LISR
    const wpPf612 = computeFiscalWorkpaperFromTrialBalance({
      company: makeCompany({ rfc: 'GAPA850101AB1', regimenFiscal: '612 - Personas Físicas Actividades Empresariales' }),
      ejercicio: 2026,
      periodo: 6,
      parameters: { ...defaultParams, coeficienteUtilidad: 0 },
      trialBalance: tbResicoPm,
      cfdis: cfdisResicoPm
    });
    const dypText = formatSatDypWorkpaperText(wpPf612, 2026, 6);
    expect(dypText).toContain('Art. 106 LISR');
    expect(dypText).not.toContain('Art. 14 C.U. 0.0000');
  });

  test('2. Tax Provision: IVA no acreditable a gasto deducible (118 en 0), acredita 113-02-001, guardia anti-duplicidad y rutas con period', async () => {
    const accounts = makeSeedCatalog();
    const wp = computeFiscalWorkpaperFromTrialBalance({
      company: makeCompany({ rfc: 'GAPA850101AB1', regimenFiscal: '626 - RESICO' }),
      ejercicio: 2026,
      periodo: 6,
      parameters: defaultParams,
      trialBalance: accounts,
      cfdis: [
        makeCfdi({
          id: 'e_grav',
          uuid: 'E-GRAV',
          direction: 'EMITIDO',
          subtotal: 80_000,
          ivaTrasladado: 12_800,
          isrRetenido: 1_000,
          total: 91_800,
          taxBreakdown: { base16: 80_000, iva16: 12_800, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 0 }
        }),
        makeCfdi({
          id: 'e_ex',
          uuid: 'E-EX',
          direction: 'EMITIDO',
          subtotal: 20_000,
          ivaTrasladado: 0,
          isrRetenido: 250,
          total: 19_750,
          conceptoPrincipal: 'Servicio exento',
          taxBreakdown: { base16: 0, iva16: 0, base8: 0, iva8: 0, base0: 0, baseExento: 20_000, ieps: 0 }
        }),
        makeCfdi({
          id: 'r_1',
          uuid: 'R-1',
          direction: 'RECIBIDO',
          subtotal: 50_000,
          ivaTrasladado: 8_000,
          total: 58_000,
          taxBreakdown: { base16: 50_000, iva16: 8_000, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 0 }
        })
      ]
    });

    // Factor prorrateo 0.80 => IVA sin prorrateo $8,000, acreditable $6,400, NO acreditable $1,600
    expect(wp.ivaBreakdown?.prorationFactor).toBe(0.8);
    const movs = buildTaxProvisionMovements(wp, accounts, 6, 2026);
    const val = validateDoubleEntryMovements(movs, new Map(accounts.map((a) => [a.id, a])));
    expect(val.totalCargo).toBe(val.totalAbono);

    // 118-01-001 acreditado completo ($6,400 + $1,600 = $8,000) y $1,600 enviado a gasto 601-01-012 (IVA No Acreditable)
    const abonos118 = movs.filter((m) => m.accountCode === '118-01-001').reduce((s, m) => s + m.abono, 0);
    const cargosGastoIva = movs.filter((m) => m.accountCode === '601-01-012').reduce((s, m) => s + m.cargo, 0);
    expect(abonos118).toBe(8_000);
    expect(cargosGastoIva).toBe(1_600);

    // 113-02-001 ($1,250) acreditado contra ISR
    const abonos113 = movs.filter((m) => m.accountCode === '113-02-001').reduce((s, m) => s + m.abono, 0);
    expect(abonos113).toBe(1_250);

    // SQLite guardia anti-duplicidad + rutas con period
    const comp = createCompanyRecord({
      name: 'Provision Guard S.A.',
      rfc: 'PGS240101AA1',
      regimenFiscal: '601 - General',
      codigoPostal: '06000',
      currentYear: 2026,
      currentPeriod: 6
    });
    createdCompanyIds.push(comp.id);

    const testApi = new Hono().basePath('/api');
    testApi.route('/', fiscalRoutes);

    const putRes = await testApi.request('/api/fiscal-workpaper/parameters', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: comp.id,
        ejercicio: 2026,
        periodo: 3,
        coeficienteUtilidad: 0.3,
        tipoCambioDofCierre: 21.5
      })
    });
    expect(putRes.status).toBe(200);
    const getRes = await testApi.request(`/api/fiscal-workpaper/parameters?companyId=${comp.id}&year=2026&period=3`);
    const getParams = (await getRes.json()) as TaxParametersRecord;
    expect(getParams.periodo).toBe(3);
    expect(getParams.coeficienteUtilidad).toBe(0.3);

    const compAccs = getAccounts(comp.id);
    const bank = compAccs.find((a) => a.code === '102-01-001')!;
    const sales = compAccs.find((a) => a.code === '401-01-001')!;
    createPolizaTransaction({
      companyId: comp.id,
      tipo: 'INGRESO',
      fecha: '2026-03-10',
      ejercicio: 2026,
      periodo: 3,
      concepto: 'Venta Marzo',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: bank.id, cargo: 100_000, abono: 0 },
        { accountId: sales.id, cargo: 0, abono: 100_000 }
      ]
    });
    const provPol = generateTaxProvisionPoliza(comp.id, 2026, 3);
    expect(provPol.periodo).toBe(3);
    expect(() => generateTaxProvisionPoliza(comp.id, 2026, 3)).toThrow();

    // Exchange fluctuation guard
    insertParsedCfdiRecord(comp, {
      uuid: 'USD-PPD-R5',
      fecha: '2026-03-05',
      tipoComprobante: 'I',
      serie: 'U',
      folio: '1',
      emisorRfc: comp.rfc,
      emisorNombre: comp.name,
      receptorRfc: 'EXT010101AA1',
      receptorNombre: 'Foreign Client',
      conceptoPrincipal: 'Export',
      claveProdServ: '81112501',
      moneda: 'USD',
      tipoCambio: 19.5,
      subtotal: 1000,
      descuento: 0,
      ivaTrasladado: 0,
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 1000,
      metodoPago: 'PPD',
      formaPago: '99',
      usoCfdi: 'G03',
      uuidRelacionado: null,
      xmlRaw: '<x/>'
    });
    const fxPol = generateExchangeFluctuationPoliza(comp.id, 2026, 3);
    expect(fxPol.periodo).toBe(3);
    expect(() => generateExchangeFluctuationPoliza(comp.id, 2026, 3)).toThrow();
  });

  test('3. Declaración Anual: flujo RESICO/PF, pagos 12 meses incl. P12, 801-01-002 separado, UFIN/CUFIN negativa, Art. 44-46 y TOTALMENTE_DEPRECIADO', () => {
    // A) 801-01-002 separado de 801-01-001, UFIN y CUFIN negativas, y prefijos Art. 44-46 (excluye 107-01-001)
    const tbPm: AccountWithBalance[] = [
      ...makeSeedCatalog().map((a) => {
        if (a.code === '401-01-001') return { ...a, finalBalance: 1_000_000 };
        if (a.code === '501-01-001') return { ...a, finalBalance: 700_000 };
        if (a.code === '801-01-001') return { ...a, finalBalance: 50_000 }; // ISR contable
        if (a.code === '801-01-002') return { ...a, finalBalance: 250_000 }; // Gasto no deducible Art. 28
        return a;
      })
    ];
    const monthlyBalances = Array.from({ length: 12 }, (_, i) => ({
      periodo: i + 1,
      accounts: [
        ...makeSeedCatalog().map((a) => {
          if (a.code === '102-01-001') return { ...a, finalBalance: 100_000 }; // Crédito
          if (a.code === '107-01-001') return { ...a, finalBalance: 500_000 }; // Empleados Art. 45 III -> EXCLUIDO!
          if (a.code === '113-01-001') return { ...a, finalBalance: 50_000 }; // Crédito incluido (113)
          if (a.code === '210-01-001') return { ...a, finalBalance: 100_000 }; // Deuda incluida (210)
          if (a.code === '216-01-001') return { ...a, finalBalance: 200_000 }; // Deuda incluida (216)
          return a;
        })
      ]
    }));

    const annualPm = computeAnnualTaxSummary({
      company: makeCompany(),
      ejercicio: 2025,
      trialBalance: tbPm,
      monthlyBalancesByPeriod: monthlyBalances,
      fixedAssetsFiscalDeduction: 0,
      paymentsProvisioned: 0,
      inputs: { cufinInicial: 10_000, dividendosPagados: 5_000, noDeduciblesManual: 100_000 }
    });
    // Créditos: 100k (102) + 50k (113) = 150k (NO incluye 500k de 107-01-001)
    expect(annualPm.inflation.promedioCreditos).toBe(150_000);
    // Deudas: 200k (216); 210 provisiones excluidas por Art. 46 LISR
    expect(annualPm.inflation.promedioDeudas).toBe(200_000);
    expect(annualPm.reconciliation.isrContableProvisionado).toBe(50_000);
    // Ded. contables no fiscales: 50k (801-01-001) + 250k (801-01-002) + 100k (manual) = 400k
    expect(annualPm.reconciliation.deduccionesContablesNoFiscales).toBe(400_000);
    // Resultado fiscal = 306,465; ISR 30% = 91,939.50; UFIN = 306,465 - 91,939.50 - 350,000 = -135,474.50 (NEGATIVA)
    expect(annualPm.determination.ufinDelEjercicio).toBeLessThan(0);
    // CUFIN final preserva valor negativo sin Math.max(0, ...)
    expect(annualPm.determination.cufinFinal).toBeLessThan(0);

    // B) TOTALMENTE_DEPRECIADO terminado dentro de targetYear
    const assetFinished2026: FixedAssetRecord = {
      id: 'fa_tot_2026',
      companyId: 'comp_r5_o2',
      codigo: 'AF-TOT',
      nombre: 'Laptop 2024',
      categoria: 'COMPUTO_30',
      fechaAdquisicion: '2024-07-01', // 50% => 24 meses: 6 (2024) + 12 (2025) + 6 (2026)
      cfdiUuid: null,
      montoOriginalInversion: 120_000,
      tasaAnualPct: 50,
      mesesDepreciadosPrevios: 24,
      inpcAdquisicion: 130,
      inpcMedioPeriodo: 130,
      cuentaActivoCode: '156-01-001',
      cuentaDepAcumCode: '171-01-001',
      cuentaGastoDepCode: '601-01-006',
      estatus: 'TOTALMENTE_DEPRECIADO',
      createdAt: '2024-07-01'
    };
    // Art. 31 LISR: 6 meses en 2026 ($30,000) * factor INPC Jun 2026 (145.131 / 130 = 1.1163) = 33,489
    expect(computeAnnualFixedAssetFiscalDeduction([assetFinished2026], 2026)).toBe(33_489);
    expect(computeAnnualFixedAssetFiscalDeduction([assetFinished2026], 2027)).toBe(0);

    // C) buildAnnualMonthlyBalancesFromMovements con movimientos previos usa zeroResultInitialBalances
    const initCatalog = makeSeedCatalog().map((a) =>
      a.code === '401-01-001' ? { ...a, initialBalance: 99_999 } : a
    );
    const { trialBalance: rolled2026 } = buildAnnualMonthlyBalancesFromMovements(
      initCatalog,
      [
        {
          account_id: initCatalog.find((a) => a.code === '401-01-001')!.id,
          cargo: 0,
          abono: 50_000,
          polizas: { company_id: 'comp_r5_o2', ejercicio: 2025, periodo: 12 }
        }
      ],
      2026
    );
    expect(rolled2026.find((a) => a.code === '401-01-001')?.initialBalanceComputed).toBe(0);

    // D) SQLite repo: RESICO PF base flujo + pagos reales de 12 meses incluyendo P12
    const compResicoPf = createCompanyRecord({
      name: 'Persona Fisica RESICO Anual',
      rfc: 'GAPA850101AB1',
      regimenFiscal: '626 - RESICO',
      codigoPostal: '06000',
      currentYear: 2025,
      currentPeriod: 12
    });
    createdCompanyIds.push(compResicoPf.id);
    // PUE $500k + PPD no cobrada $400k (no entra en flujo!)
    insertParsedCfdiRecord(compResicoPf, {
      uuid: 'PF-PUE-1', fecha: '2025-03-10', tipoComprobante: 'I', serie: 'A', folio: '1',
      emisorRfc: compResicoPf.rfc, emisorNombre: compResicoPf.name, receptorRfc: 'CLI010101AA1', receptorNombre: 'Cliente',
      conceptoPrincipal: 'Servicio', claveProdServ: '81112501', moneda: 'MXN', tipoCambio: 1,
      subtotal: 500_000, descuento: 0, ivaTrasladado: 80_000, isrRetenido: 6_250, ivaRetenido: 0, total: 573_750,
      metodoPago: 'PUE', formaPago: '03', usoCfdi: 'G03', uuidRelacionado: null, xmlRaw: '<x/>'
    });
    insertParsedCfdiRecord(compResicoPf, {
      uuid: 'PF-PPD-UNPAID', fecha: '2025-04-10', tipoComprobante: 'I', serie: 'A', folio: '2',
      emisorRfc: compResicoPf.rfc, emisorNombre: compResicoPf.name, receptorRfc: 'CLI010101AA1', receptorNombre: 'Cliente',
      conceptoPrincipal: 'Servicio PPD', claveProdServ: '81112501', moneda: 'MXN', tipoCambio: 1,
      subtotal: 400_000, descuento: 0, ivaTrasladado: 64_000, isrRetenido: 0, ivaRetenido: 0, total: 464_000,
      metodoPago: 'PPD', formaPago: '99', usoCfdi: 'G03', uuidRelacionado: null, xmlRaw: '<x/>'
    });
    const pfAccs = getAccounts(compResicoPf.id);
    const accGastoIsr = pfAccs.find((a) => a.code === '801-01-001')!;
    const accProvIsr = pfAccs.find((a) => a.code === '213-01-002')!;
    // Provisión P03 + P12 en 213-01-002
    createPolizaTransaction({
      companyId: compResicoPf.id, tipo: 'DIARIO', fecha: '2025-03-31', ejercicio: 2025, periodo: 3,
      concepto: 'Provision Marzo', cfdiUuid: null, origin: 'MANUAL',
      movements: [
        { accountId: accGastoIsr.id, cargo: 1_500, abono: 0 },
        { accountId: accProvIsr.id, cargo: 0, abono: 1_500 }
      ]
    });
    createPolizaTransaction({
      companyId: compResicoPf.id, tipo: 'DIARIO', fecha: '2025-12-31', ejercicio: 2025, periodo: 12,
      concepto: 'Provision Diciembre P12', cfdiUuid: null, origin: 'MANUAL',
      movements: [
        { accountId: accGastoIsr.id, cargo: 2_000, abono: 0 },
        { accountId: accProvIsr.id, cargo: 0, abono: 2_000 }
      ]
    });
    const summaryPf = getAnnualTaxSummaryRepo(compResicoPf.id, 2025);
    expect(summaryPf.determination.ingresosNominales).toBe(500_000); // PPD no cobrado excluido!
    expect(summaryPf.determination.pagosProvisionalesEfectuados).toBe(3_500); // P03 + P12
    expect(summaryPf.determination.isrRetenidoAcreditable).toBe(6_250);
  });

  test('4. Auto-Póliza FX USD/EUR, 209->208 sin saldos rojos, EquivalenciaDR, Retenciones Locales 213-*, Catálogo 305/801-01-002 y Reglas', () => {
    // A) Catálogo 305-01-001 y 801-01-002
    const seed = makeSeedCatalog();
    expect(FISCAL_ACCOUNT_ROLES.RESULTADO_DEL_EJERCICIO.code).toBe('305-01-001');
    expect(FISCAL_ACCOUNT_ROLES.RESULTADO_DEL_EJERCICIO.aliases).not.toContain('301-01-001');
    expect(resolveFiscalAccount(seed, 'RESULTADO_DEL_EJERCICIO').code).toBe('305-01-001');
    expect(FISCAL_ACCOUNT_ROLES.GASTO_NO_DEDUCIBLE.code).toBe('801-01-002');
    expect(resolveNonDeductibleAccount(seed).code).toBe('801-01-002');

    // B) REP USD con IVA 16% en SQLite: consulta tipoCambio original por UUID, elimina 16% de distorsión y saldos rojos en 209
    const compFx = createCompanyRecord({
      name: 'Exportadora FX S.A.',
      rfc: 'EFX240101AA1',
      regimenFiscal: '601 - General',
      codigoPostal: '06000',
      currentYear: 2026,
      currentPeriod: 6
    });
    createdCompanyIds.push(compFx.id);
    const inv1 = insertParsedCfdiRecord(compFx, {
      uuid: 'USD-INV-TC19', fecha: '2026-06-01', tipoComprobante: 'I', serie: 'F', folio: '1',
      emisorRfc: compFx.rfc, emisorNombre: compFx.name, receptorRfc: 'CLI010101AA1', receptorNombre: 'Cliente FX',
      conceptoPrincipal: 'Consultoria USD', claveProdServ: '81112501', moneda: 'USD', tipoCambio: 19,
      subtotal: 1000, descuento: 0, ivaTrasladado: 160, isrRetenido: 0, ivaRetenido: 0, total: 1160,
      metodoPago: 'PPD', formaPago: '99', usoCfdi: 'G03', uuidRelacionado: null, xmlRaw: '<x/>'
    });
    const rep1 = insertParsedCfdiRecord(compFx, {
      uuid: 'USD-REP-TC20', fecha: '2026-06-20', tipoComprobante: 'P', serie: 'P', folio: '1',
      emisorRfc: compFx.rfc, emisorNombre: compFx.name, receptorRfc: 'CLI010101AA1', receptorNombre: 'Cliente FX',
      conceptoPrincipal: 'Complemento Pago', claveProdServ: '84111506', moneda: 'USD', tipoCambio: 20,
      subtotal: 1000, descuento: 0, ivaTrasladado: 160, isrRetenido: 0, ivaRetenido: 0, total: 1160,
      metodoPago: 'PUE', formaPago: '03', usoCfdi: 'CP01', uuidRelacionado: inv1.uuid,
      relatedDocs: [{
        idDocumento: inv1.uuid, numParcialidad: 1, impSaldoAnt: 1160, impPagado: 1160, impSaldoInsoluto: 0,
        monedaDr: 'USD', equivalenciaDr: 1, pagoMoneda: 'USD', pagoTipoCambio: 20
      }],
      xmlRaw: '<x/>'
    });
    const invPol = generateAutoPolizaFromCfdiId(inv1.id);
    const repPol = generateAutoPolizaFromCfdiId(rep1.id);
    expect(repPol.isBalanced).toBe(true);
    // 209: Abono original 3040, Cargo en REP 3040 => saldo 0 (NO -160 rojo!)
    const abono209 = invPol.movements.find((m) => m.accountCode === '209-01-001')?.abono ?? 0;
    const cargo209 = repPol.movements.find((m) => m.accountCode === '209-01-001')?.cargo ?? 0;
    expect(abono209).toBe(3040);
    expect(cargo209).toBe(3040);
    // 208 IVA cobrado a TC pago: 160 * 20 = 3200
    expect(repPol.movements.find((m) => m.accountCode === '208-01-001')?.abono).toBe(3200);
    // 702 Utilidad cambiaria estrictamente sobre principal: 1000 * (20 - 19) = 1000 (sin 16% de distorsión)
    expect(repPol.movements.find((m) => m.accountCode === '702-01-001')?.abono).toBe(1000);

    // C) EquivalenciaDR impPagado / equivalenciaDr (MonedaP=USD TC=20, MonedaDR=EUR, EquivalenciaDR=1.10 -> 110 / 1.10 * 20 = 2000 MXN)
    const repCrossEur = buildAutoPolizaPlan(
      makeCfdi({
        tipoComprobante: 'P',
        direction: 'EMITIDO',
        moneda: 'USD',
        tipoCambio: 20,
        subtotal: 100,
        ivaTrasladado: 0,
        total: 100, // $2,000 MXN cobrados
        relatedDocs: [{
          idDocumento: 'EUR-DOC', numParcialidad: 1, impSaldoAnt: 110, impPagado: 110, impSaldoInsoluto: 0,
          monedaDr: 'EUR', equivalenciaDr: 1.1, pagoMoneda: 'USD', pagoTipoCambio: 20
        }]
      }),
      seed
    );
    expect(repCrossEur.isBalanced).toBe(true);
    expect(repCrossEur.movements.find((m) => m.accountCode === '105-01-099')?.abono).toBe(2000);

    // D) Impuestos Locales (localTrasladado / localRetenido) a 213-*, nunca 401, Cargos === Abonos
    const cfdiLocalEmit = makeCfdi({
      direction: 'EMITIDO',
      metodoPago: 'PUE',
      subtotal: 1000,
      ivaTrasladado: 160,
      total: 1140, // +30 localTrasladado - 50 localRetenido
      taxBreakdown: {
        base16: 1000, iva16: 160, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 0,
        localTrasladado: 30, localRetenido: 50
      } as CfdiDocument['taxBreakdown']
    });
    const planLocalEmit = buildAutoPolizaPlan(cfdiLocalEmit, seed);
    expect(planLocalEmit.isBalanced).toBe(true);
    expect(planLocalEmit.movements.find((m) => m.accountCode === '401-01-001')?.abono).toBe(1000);
    expect(planLocalEmit.movements.some((m) => m.accountCode.startsWith('213-') && m.abono === 30)).toBe(true);

    const cfdiLocalRec = makeCfdi({
      direction: 'RECIBIDO',
      metodoPago: 'PUE',
      subtotal: 1000,
      ivaTrasladado: 160,
      total: 1110, // -50 localRetenido
      taxBreakdown: {
        base16: 1000, iva16: 160, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 0,
        localRetenido: 50
      } as CfdiDocument['taxBreakdown']
    });
    const planLocalRec = buildAutoPolizaPlan(cfdiLocalRec, seed);
    expect(planLocalRec.isBalanced).toBe(true);
    expect(planLocalRec.movements.some((m) => m.accountCode.startsWith('213-') && m.abono === 50)).toBe(true);

    // E) Clasificación retenciones ISR recibidas: 216-01-003 Arrendamiento, 216-01-004 Honorarios, 216-01-005 RESICO 1.25%
    const planArrend = buildAutoPolizaPlan(
      makeCfdi({
        direction: 'RECIBIDO',
        conceptoPrincipal: 'Renta de oficina mensual',
        claveProdServ: '80131502',
        subtotal: 10_000,
        ivaTrasladado: 1_600,
        isrRetenido: 1_000,
        ivaRetenido: 1_066.67,
        total: 9_533.33
      }),
      seed
    );
    expect(planArrend.movements.some((m) => m.accountCode === '216-01-003' && m.abono === 1000)).toBe(true);

    const planHon = buildAutoPolizaPlan(
      makeCfdi({
        direction: 'RECIBIDO',
        conceptoPrincipal: 'Servicios profesionales de asesoría',
        claveProdServ: '84111506',
        subtotal: 10_000,
        ivaTrasladado: 1_600,
        isrRetenido: 1_000,
        ivaRetenido: 1_066.67,
        total: 9_533.33
      }),
      seed
    );
    expect(planHon.movements.some((m) => m.accountCode === '216-01-004' && m.abono === 1000)).toBe(true);

    const planResicoRet = buildAutoPolizaPlan(
      makeCfdi({
        direction: 'RECIBIDO',
        conceptoPrincipal: 'Servicio técnico',
        claveProdServ: '81112501',
        subtotal: 10_000,
        ivaTrasladado: 1_600,
        isrRetenido: 125, // 1.25%
        ivaRetenido: 0,
        total: 11_475
      }),
      seed
    );
    expect(planResicoRet.movements.some((m) => m.accountCode === '216-01-005' && m.abono === 125)).toBe(true);

    // F) Reglas: excluye N y E emitido (401), rechaza N RECIBIDO, NC PUE usa 102-* y PPD 105-*/201-*, bloquea 205/107 en PUE, ORDER BY priority ASC
    const ruleEmit401: AccountingRuleRecord = {
      id: 'r-em', companyId: 'comp_r5_o2', name: 'Ingreso Cliente', matchRfc: 'CLI200101AA1',
      matchClaveProdServ: null, matchUsoCfdi: null, direction: 'EMITIDO',
      operationAccountCode: '401-01-001', counterAccountCode: '105-01-001',
      deductiblePct: 100, priority: 1, autoLearned: false, createdAt: '2026-01-01', updatedAt: '2026-01-01'
    };
    const ruleRec205: AccountingRuleRecord = {
      id: 'r-pue-205', companyId: 'comp_r5_o2', name: 'Acreedor', matchRfc: 'PRO200101AA1',
      matchClaveProdServ: null, matchUsoCfdi: null, direction: 'RECIBIDO',
      operationAccountCode: '601-01-003', counterAccountCode: '205-01-001',
      deductiblePct: 100, priority: 1, autoLearned: false, createdAt: '2026-01-01', updatedAt: '2026-01-01'
    };
    expect(resolveMatchingAccountingRule(makeCfdi({ tipoComprobante: 'N', direction: 'EMITIDO', receptorRfc: 'CLI200101AA1' }), [ruleEmit401])).toBeNull();
    expect(resolveMatchingAccountingRule(makeCfdi({ tipoComprobante: 'E', direction: 'EMITIDO', receptorRfc: 'CLI200101AA1' }), [ruleEmit401])).toBeNull();
    expect(resolveMatchingAccountingRule(makeCfdi({ tipoComprobante: 'I', direction: 'RECIBIDO', emisorRfc: 'PRO200101AA1', metodoPago: 'PUE' }), [ruleRec205])?.counterAccountCode).toBeNull();
    expect(() => buildAutoPolizaPlan(makeCfdi({ tipoComprobante: 'N', direction: 'RECIBIDO' }), seed)).toThrow();

    const ncPue = buildAutoPolizaPlan(makeCfdi({ tipoComprobante: 'E', direction: 'EMITIDO', metodoPago: 'PUE' }), seed);
    expect(ncPue.movements.some((m) => m.accountCode.startsWith('102-'))).toBe(true);
    const ncPpd = buildAutoPolizaPlan(makeCfdi({ tipoComprobante: 'E', direction: 'RECIBIDO', metodoPago: 'PPD' }), seed);
    expect(ncPpd.movements.some((m) => m.accountCode.startsWith('201-'))).toBe(true);

    // ORDER BY priority ASC en accounting-rules.repo.ts
    upsertAccountingRuleRepo({ companyId: compFx.id, matchRfc: 'AAA010101AAA', direction: 'RECIBIDO', operationAccountCode: '601-01-003', priority: 30 });
    upsertAccountingRuleRepo({ companyId: compFx.id, matchRfc: 'BBB010101BBB', direction: 'RECIBIDO', operationAccountCode: '601-01-004', priority: 5 });
    const ordered = listAccountingRulesRepo(compFx.id);
    expect(toCents(ordered[0]!.priority)).toBeLessThanOrEqual(toCents(ordered[1]!.priority));
    expect(ordered[0]!.priority).toBe(5);
  });
});
