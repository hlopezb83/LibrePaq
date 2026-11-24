import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { initDatabase } from '../src/server/schema';
import { createCompanyRecord, deleteCompanyRecord } from '../src/server/repositories/companies.repo';
import { getAccounts } from '../src/server/repositories/accounts.repo';
import { insertParsedCfdiRecord, getCfdiDocuments } from '../src/server/repositories/cfdi.repo';
import { createPolizaTransaction, getPolizaById, updatePolizaTransaction } from '../src/server/repositories/polizas.repo';
import { getAccountLedger } from '../src/server/repositories/account-ledger.repo';
import { getSeedAccountsForPreset, BASE_COMPANY_ACCOUNTS } from '../src/shared/catalogs/base-accounts.seed';
import {
  FISCAL_ACCOUNT_ROLES,
  REGIMENES_FISCALES_SAT,
  SAT_GROUP_CODES
} from '../src/shared/sat-constants';
import {
  buildAutoPolizaPlan,
  resolveMatchingAccountingRule
} from '../src/shared/engine/auto-poliza.engine';
import { computeAnnualTaxSummary } from '../src/shared/engine/annual-tax.engine';
import { rollUpTrialBalanceAccounts } from '../src/shared/engine/financial-reports.engine';
import { resolveDefaultAccountsForCfdi } from '../src/views/cfdi/cfdiXmlUploadHelpers';
import { parseCatalogoCsvText } from '../src/views/catalogo/catalogoCsvIo';
import { buildAuxiliarAccountBlocks } from '../src/views/reportes/auxiliaresDiarioExport';
import type { AccountWithBalance, CfdiDocument, Company } from '../src/shared/types';
import type { AccountingRuleRecord } from '../src/shared/types/accounting-rules.types';

function makeBalanceAccounts(): AccountWithBalance[] {
  return getSeedAccountsForPreset('SAT_STANDARD').map((a, idx) => ({
    ...a,
    id: `acc_${idx}_${a.code}`,
    companyId: 'comp_test',
    initialBalanceComputed: a.initialBalance,
    periodCharges: 0,
    periodCredits: 0,
    finalBalance: a.initialBalance
  }));
}

function makeCfdi(overrides: Partial<CfdiDocument> = {}): CfdiDocument {
  return {
    id: 'cfdi_1',
    companyId: 'comp_test',
    uuid: '11111111-1111-1111-1111-111111111111',
    fecha: '2026-10-15',
    tipoComprobante: 'I',
    direction: 'EMITIDO',
    serie: 'F',
    folio: '100',
    emisorRfc: 'EMP200101AA1',
    emisorNombre: 'Mi Empresa SA',
    receptorRfc: 'CLI200101BB2',
    receptorNombre: 'Cliente SA',
    conceptoPrincipal: 'Servicio de consultoría',
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

describe('Ola 3 — PyME Parity, Multi-CFDI, Rules, REP Divisas, Catalog & Reports', () => {
  const createdCompanies: string[] = [];

  beforeAll(() => {
    initDatabase();
  });

  afterAll(() => {
    for (const id of createdCompanies) {
      deleteCompanyRecord(id);
    }
  });

  test('P0-7: resolveDefaultAccountsForCfdi never inverts accounts or picks IVA/retentions', () => {
    const accounts = makeBalanceAccounts();

    const emPue = resolveDefaultAccountsForCfdi(
      makeCfdi({ direction: 'EMITIDO', tipoComprobante: 'I', metodoPago: 'PUE' }),
      accounts
    );
    expect(emPue.operationAccountCode.startsWith('401-')).toBe(true);
    expect(emPue.counterAccountCode.startsWith('102-')).toBe(true);

    const emPpd = resolveDefaultAccountsForCfdi(
      makeCfdi({ direction: 'EMITIDO', tipoComprobante: 'I', metodoPago: 'PPD' }),
      accounts
    );
    expect(emPpd.operationAccountCode.startsWith('401-')).toBe(true);
    expect(emPpd.counterAccountCode.startsWith('105-')).toBe(true);

    const recPpd = resolveDefaultAccountsForCfdi(
      makeCfdi({ direction: 'RECIBIDO', tipoComprobante: 'I', metodoPago: 'PPD' }),
      accounts
    );
    expect(recPpd.operationAccountCode.startsWith('601-')).toBe(true);
    expect(recPpd.counterAccountCode.startsWith('201-')).toBe(true);

    const ncEm = resolveDefaultAccountsForCfdi(
      makeCfdi({ direction: 'EMITIDO', tipoComprobante: 'E', metodoPago: 'PPD' }),
      accounts
    );
    expect(ncEm.operationAccountCode).toBe('402-01-001');
    expect(ncEm.counterAccountCode.startsWith('105-')).toBe(true);

    const repRec = resolveDefaultAccountsForCfdi(
      makeCfdi({ direction: 'RECIBIDO', tipoComprobante: 'P', metodoPago: 'PUE', ivaTrasladado: 160 }),
      accounts
    );
    expect(repRec.operationAccountCode.startsWith('201-')).toBe(true);
    expect(repRec.counterAccountCode.startsWith('102-')).toBe(true);

    const nomina = resolveDefaultAccountsForCfdi(
      makeCfdi({ direction: 'RECIBIDO', tipoComprobante: 'N', metodoPago: 'PUE', ivaTrasladado: 0, isrRetenido: 100, total: 900 }),
      accounts
    );
    expect(nomina.operationAccountCode).toBe('601-01-001');
    expect(nomina.counterAccountCode.startsWith('102-')).toBe(true);
  });

  test('P0-8: accounting rules respect PUE/PPD, ignore P, use priority ASC, IEPS liability & 402 NC', () => {
    const accounts = makeBalanceAccounts();
    const rules: AccountingRuleRecord[] = [
      {
        id: 'r-pue',
        companyId: 'comp_test',
        name: 'Regla PUE',
        matchRfc: 'PRO180214A99',
        matchClaveProdServ: null,
        matchUsoCfdi: null,
        direction: 'RECIBIDO',
        operationAccountCode: '601-01-004',
        counterAccountCode: '102-01-001',
        deductiblePct: 100,
        priority: 20,
        autoLearned: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      },
      {
        id: 'r-high-prio',
        companyId: 'comp_test',
        name: 'Regla Prioridad 5',
        matchRfc: 'PRO180214A99',
        matchClaveProdServ: null,
        matchUsoCfdi: null,
        direction: 'RECIBIDO',
        operationAccountCode: '601-01-003',
        counterAccountCode: '102-01-001',
        deductiblePct: 100,
        priority: 5,
        autoLearned: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      }
    ];

    // Menor número = mayor prioridad
    const matched = resolveMatchingAccountingRule(
      makeCfdi({ direction: 'RECIBIDO', emisorRfc: 'PRO180214A99', metodoPago: 'PPD' }),
      rules
    );
    expect(matched?.id).toBe('r-high-prio');
    // Regla aprendida con banco 102* para PUE no pisa Proveedores 201* en PPD
    expect(matched?.counterAccountCode).toBeNull();

    const planPpd = buildAutoPolizaPlan(
      makeCfdi({ direction: 'RECIBIDO', emisorRfc: 'PRO180214A99', metodoPago: 'PPD' }),
      accounts,
      { rules }
    );
    expect(planPpd.movements.some((m) => m.accountCode.startsWith('201-'))).toBe(true);
    expect(planPpd.movements.some((m) => m.accountCode.startsWith('102-'))).toBe(false);

    // I/E nunca aplica a REP 2.0 (P) ni thirdParty.cuentaOperacionCode
    expect(
      resolveMatchingAccountingRule(
        makeCfdi({ direction: 'RECIBIDO', tipoComprobante: 'P', emisorRfc: 'PRO180214A99' }),
        rules
      )
    ).toBeNull();
    const repPlan = buildAutoPolizaPlan(
      makeCfdi({ direction: 'RECIBIDO', tipoComprobante: 'P', emisorRfc: 'PRO180214A99', subtotal: 1000, ivaTrasladado: 160, total: 1160 }),
      accounts,
      {
        rules,
        thirdParty: { cuentaOperacionCode: '601-01-003', cuentaContrapartidaCode: '201-01-001' }
      }
    );
    expect(repPlan.movements.some((m) => m.accountCode === '601-01-003')).toBe(false);
    expect(repPlan.movements.some((m) => m.accountCode === '201-01-001')).toBe(true);

    // Factura Emitida con IEPS abona a pasivo IEPS (208-02-001) en vez de inflar 401
    const iepsPlan = buildAutoPolizaPlan(
      makeCfdi({
        direction: 'EMITIDO',
        tipoComprobante: 'I',
        metodoPago: 'PUE',
        subtotal: 1000,
        ivaTrasladado: 160,
        total: 1240,
        taxBreakdown: { base16: 1000, iva16: 160, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 80 }
      }),
      accounts
    );
    expect(iepsPlan.isBalanced).toBe(true);
    expect(iepsPlan.movements.find((m) => m.accountCode === '401-01-001')?.abono).toBe(1000);
    expect(iepsPlan.movements.find((m) => m.accountCode === '208-02-001')?.abono).toBe(80);
  });

  test('P1 REP Divisas: buildPaymentRepMovements registra utilidad (702) y pérdida (701) cambiaria', () => {
    const accounts = makeBalanceAccounts();
    // Cobro EMITIDO USD: TC pago 20.00 vs TC doc 19.00 -> Utilidad cambiaria $1000 MXN
    const repGain = buildAutoPolizaPlan(
      makeCfdi({
        direction: 'EMITIDO',
        tipoComprobante: 'P',
        moneda: 'USD',
        tipoCambio: 20,
        subtotal: 1000,
        ivaTrasladado: 0,
        total: 1000,
        relatedDocs: [
          {
            idDocumento: 'UUID-INV-USD',
            numParcialidad: 1,
            impSaldoAnt: 1000,
            impPagado: 1000,
            impSaldoInsoluto: 0,
            monedaDr: 'USD',
            equivalenciaDr: 1,
            pagoMoneda: 'USD',
            pagoTipoCambio: 19
          }
        ]
      }),
      accounts
    );
    expect(repGain.isBalanced).toBe(true);
    expect(repGain.movements.find((m) => m.accountCode === '702-01-001')?.abono).toBe(1000);

    // Pago RECIBIDO USD: TC pago 20.50 vs TC doc 19.50 -> Pérdida cambiaria $1000 MXN
    const repLoss = buildAutoPolizaPlan(
      makeCfdi({
        direction: 'RECIBIDO',
        tipoComprobante: 'P',
        moneda: 'USD',
        tipoCambio: 20.5,
        subtotal: 1000,
        ivaTrasladado: 0,
        total: 1000,
        relatedDocs: [
          {
            idDocumento: 'UUID-PROV-USD',
            numParcialidad: 1,
            impSaldoAnt: 1000,
            impPagado: 1000,
            impSaldoInsoluto: 0,
            monedaDr: 'USD',
            equivalenciaDr: 1,
            pagoMoneda: 'USD',
            pagoTipoCambio: 19.5
          }
        ]
      }),
      accounts
    );
    expect(repLoss.isBalanced).toBe(true);
    expect(repLoss.movements.find((m) => m.accountCode === '701-01-001')?.cargo).toBe(1000);
  });

  test('P0-14 & P0-15: Multi-CFDI en polizas, Periodo 13 manual, Auxiliar multi-mes y fixes de reportes/anual', () => {
    const comp = createCompanyRecord({
      name: 'PyME Multi CFDI SA',
      rfc: 'PMC240101AA1',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '64000',
      currentYear: 2026,
      currentPeriod: 13
    });
    createdCompanies.push(comp.id);

    const accounts = getAccounts(comp.id);
    const bank = accounts.find((a) => a.code === '102-01-001')!;
    const sales = accounts.find((a) => a.code === '401-01-001')!;

    const u1 = 'AAAAAAAA-1111-1111-1111-111111111111';
    const u2 = 'BBBBBBBB-2222-2222-2222-222222222222';
    insertParsedCfdiRecord(comp, {
      uuid: u1, fecha: '2026-01-10', tipoComprobante: 'I', serie: 'F', folio: '1',
      emisorRfc: comp.rfc, emisorNombre: comp.name, receptorRfc: 'CLI200101AA1', receptorNombre: 'Cliente 1',
      conceptoPrincipal: 'Servicio 1', claveProdServ: '81112501', moneda: 'MXN', tipoCambio: 1,
      subtotal: 500, descuento: 0, ivaTrasladado: 0, isrRetenido: 0, ivaRetenido: 0, total: 500,
      metodoPago: 'PUE', formaPago: '03', usoCfdi: 'G03', uuidRelacionado: null, xmlRaw: '<x/>'
    });
    insertParsedCfdiRecord(comp, {
      uuid: u2, fecha: '2026-02-10', tipoComprobante: 'I', serie: 'F', folio: '2',
      emisorRfc: comp.rfc, emisorNombre: comp.name, receptorRfc: 'CLI200101AA1', receptorNombre: 'Cliente 1',
      conceptoPrincipal: 'Servicio 2', claveProdServ: '81112501', moneda: 'MXN', tipoCambio: 1,
      subtotal: 700, descuento: 0, ivaTrasladado: 0, isrRetenido: 0, ivaRetenido: 0, total: 700,
      metodoPago: 'PUE', formaPago: '03', usoCfdi: 'G03', uuidRelacionado: null, xmlRaw: '<x/>'
    });

    const pol = createPolizaTransaction({
      companyId: comp.id,
      ejercicio: 2026,
      periodo: 13,
      tipo: 'DIARIO',
      fecha: '2026-12-31',
      concepto: 'Póliza Periodo 13 Multi-CFDI',
      cfdiUuid: u1,
      cfdiUuids: [u1, u2],
      origin: 'MANUAL',
      movements: [
        { accountId: bank.id, cargo: 1200, abono: 0, cfdiUuid: u1 },
        { accountId: sales.id, cargo: 0, abono: 1200, cfdiUuid: u2 }
      ]
    });
    expect(pol.periodo).toBe(13);
    expect(pol.cfdiUuids).toEqual([u1, u2]);

    const cfdisAfterCreate = getCfdiDocuments(comp.id);
    expect(cfdisAfterCreate.find((c) => c.uuid === u1)?.polizaId).toBe(pol.id);
    expect(cfdisAfterCreate.find((c) => c.uuid === u2)?.polizaId).toBe(pol.id);

    // Actualizar quitando u2
    updatePolizaTransaction(pol.id, {
      tipo: 'DIARIO',
      fecha: '2026-12-31',
      periodo: 13,
      concepto: 'Póliza Editada 1 CFDI',
      cfdiUuid: u1,
      cfdiUuids: [u1],
      movements: [
        { accountId: bank.id, cargo: 1200, abono: 0, cfdiUuid: u1 },
        { accountId: sales.id, cargo: 0, abono: 1200, cfdiUuid: u1 }
      ]
    });
    const reloaded = getPolizaById(pol.id);
    expect(reloaded?.cfdiUuids).toEqual([u1]);
    expect(getCfdiDocuments(comp.id).find((c) => c.uuid === u2)?.polizaId).toBeNull();

    // Auxiliar multi-mes (periodos 1..13)
    const ledger = getAccountLedger(comp.id, sales.id, 2026, 1, 13);
    expect(ledger?.entries.length).toBe(1);
    expect(ledger?.totalCredits).toBe(1200);

    const blocks = buildAuxiliarAccountBlocks({
      accountsStart: makeBalanceAccounts(),
      polizas: [pol],
      codeFrom: '401-01-001',
      codeTo: '401-01-001',
      onlyWithActivity: true
    });
    expect(blocks[0]?.entries.length).toBe(1);
  });

  test('P0-17 & P0-6 & P1 Fixes: Catálogo limpio, CSV 4 niveles, truncate4 CU, UFIN negativa e initialBalance solo Balance', () => {
    // No fictional demo names in seed catalog
    const allNames = BASE_COMPANY_ACCOUNTS.map((a) => a.name).join(' | ');
    expect(allNames).not.toContain('Banorte PyME');
    expect(allNames).not.toContain('Corporativo Alfa');
    expect(allNames).not.toContain('Amazon Web Services');
    expect(allNames).not.toContain('Inmobiliaria Reforma');

    expect(FISCAL_ACCOUNT_ROLES.SUELDOS_POR_PAGAR.code).toBe('210-01-001');
    expect(FISCAL_ACCOUNT_ROLES.DEVOLUCIONES_DESCUENTOS.code).toBe('402-01-001');
    expect(SAT_GROUP_CODES.length).toBeGreaterThanOrEqual(100);
    expect(REGIMENES_FISCALES_SAT.some((r) => r.startsWith('605'))).toBe(true);
    expect(REGIMENES_FISCALES_SAT.some((r) => r.startsWith('606'))).toBe(true);

    // CSV 4-level mask preserving parentCode, level, isAffectable
    const csv = [
      'Código Cuenta,Nombre de la Cuenta,Código Agrupador SAT,Rubro,Naturaleza,Nivel,Afectable,Saldo Inicial Acumulado,Cargos,Abonos,Saldo Final,Cuenta Padre',
      '6010-001-0000,Gastos Operación N2,601,GASTOS,DEUDORA,2,No,0,0,0,0,6000-000-0000',
      '6010-001-0001,Combustible Flotilla,601.48,GASTOS,DEUDORA,3,Sí,0,0,0,0,6010-001-0000'
    ].join('\n');
    const parsed = parseCatalogoCsvText(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.level).toBe(2);
    expect(parsed[0]?.isAffectable).toBe(false);
    expect(parsed[1]?.parentCode).toBe('6010-001-0000');
    expect(parsed[1]?.isAffectable).toBe(true);

    // rollUpTrialBalanceAccounts con zeroResultInitialBalances (ejercicios posteriores) ignora initialBalance en Resultados
    const accountsWithBadInit = makeBalanceAccounts().map((a) =>
      a.code === '401-01-001' ? { ...a, initialBalance: 99999 } : a
    );
    const rolled = rollUpTrialBalanceAccounts(
      accountsWithBadInit,
      new Map(),
      new Map(),
      new Map(),
      new Map(),
      { zeroResultInitialBalances: true }
    );
    expect(rolled.find((a) => a.code === '401-01-001')?.initialBalanceComputed).toBe(0);

    // Annual tax: truncate4 (0.361465 -> 0.3614) & negative UFIN
    const company: Company = {
      id: 'comp_an',
      name: 'Anual Test SA',
      rfc: 'ANT200101AA1',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      maskFormat: 'XXX-XX-XXX',
      currentYear: 2025,
      currentPeriod: 12,
      createdAt: '2025-01-01'
    };
    const tb: AccountWithBalance[] = [
      {
        ...makeBalanceAccounts().find((a) => a.code === '401-01-001')!,
        finalBalance: 2_000_000
      },
      {
        ...makeBalanceAccounts().find((a) => a.code === '501-01-001')!,
        finalBalance: 1_877_070
      }
    ];
    // Utilidad Fiscal = (2,000,000 - 1,877,070) + 600,000 = 722,930; CU = 722,930 / 2,000,000 = 0.361465 -> truncate4 = 0.3614
    const annual = computeAnnualTaxSummary({
      company,
      ejercicio: 2025,
      trialBalance: tb,
      monthlyBalancesByPeriod: [],
      fixedAssetsFiscalDeduction: 0,
      paymentsProvisioned: 0,
      inputs: { noDeduciblesManual: 600_000 }
    });
    expect(annual.determination.nuevoCoeficienteUtilidad).toBe(0.3614);
    expect(annual.determination.ufinDelEjercicio).toBeLessThan(0);
  });
});
