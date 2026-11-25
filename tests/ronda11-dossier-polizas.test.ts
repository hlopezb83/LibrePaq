import { afterAll, describe, expect, test } from 'bun:test';
import { buildDeliverablesSheets } from '../src/lib/excel-export';
import {
  buildAgingCxcCxpCsvRows,
  buildConciliacionBancariaCsvRows,
  buildTopCounterpartyAging,
  computeDossierBankReconSummary
} from '../src/lib/excel-bancarios-cxc-sheets';
import { getAccounts } from '../src/server/repositories/accounts.repo';
import { createCompanyRecord, deleteCompanyRecord } from '../src/server/repositories/companies.repo';
import { getPolizas } from '../src/server/repositories/polizas.repo';
import { createPolizaTransaction } from '../src/server/repositories/polizas-write.repo';
import {
  createBusinessSegmentRepo,
  createPolizaTemplateRepo,
  deleteBusinessSegmentRepo,
  deletePolizaTemplateRepo,
  getSegmentFinancialStatementsRepo,
  listBusinessSegmentsRepo,
  listPolizaTemplatesRepo,
  updatePolizaTemplateRepo
} from '../src/server/repositories/ronda11.repo';
import { getSeedAccountsForPreset } from '../src/shared/catalogs/base-accounts.seed';
import { analyzeAsambleaTraspaso } from '../src/shared/engine/asamblea-traspaso.engine';
import { buildDashboardKpisFromTrialBalance } from '../src/shared/engine/dashboard.engine';
import { computeFinancialStatementsData } from '../src/shared/engine/financial-reports.engine';
import type {
  AccountWithBalance,
  BankReconciliationResponse,
  Company,
  CxcCxpAgingResponse,
  Poliza
} from '../src/shared/types';
import { buildPolizaImportPreview } from '../src/views/polizas/polizaImportParser';

const COMPANY: Company = {
  id: 'comp_r11_test',
  name: 'COMERCIALIZADORA RONDA 11 S.A. DE C.V.',
  rfc: 'CRN210101AA1',
  regimenFiscal: '601 - General de Ley Personas Morales',
  codigoPostal: '06600',
  maskFormat: 'XXX-XX-XXX',
  currentYear: 2026,
  currentPeriod: 10,
  createdAt: '2026-01-01T00:00:00.000Z'
};

function makeSeedCatalog(companyId = COMPANY.id): AccountWithBalance[] {
  return getSeedAccountsForPreset('SAT_STANDARD').map((a) => ({
    ...a,
    id: `${companyId}_${a.code}`,
    companyId,
    initialBalance: 0,
    initialBalanceComputed: 0,
    periodCharges: 0,
    periodCredits: 0,
    finalBalance: 0
  }));
}

describe('Ronda 11 — Dossier Completo, Segmentos, Plantillas, Importador, Anexo 24 Bancario y Asamblea', () => {
  const createdCompanyIds: string[] = [];

  afterAll(() => {
    for (const cid of createdCompanyIds) {
      try {
        deleteCompanyRecord(cid);
      } catch {
        // ignore cleanup error
      }
    }
  });

  test('1. Asamblea Traspaso (Enero): genera borrador 305-01-001 -> 301-02-001 y bloquea doble conteo si hay póliza manual previa', () => {
    const accounts = makeSeedCatalog().map((a) =>
      a.code === '305-01-001' ? { ...a, finalBalance: 150000 } : a
    );

    const okAnalysis = analyzeAsambleaTraspaso({
      companyId: COMPANY.id,
      ejercicio: 2026,
      periodo: 1,
      accounts,
      polizasInYear: []
    });
    expect(okAnalysis.isJanuary).toBe(true);
    expect(okAnalysis.direction).toBe('UTILIDAD');
    expect(okAnalysis.saldo305).toBe(150000);
    expect(okAnalysis.hasExistingManualPoliza).toBe(false);
    expect(okAnalysis.canGenerate).toBe(true);
    expect(okAnalysis.suggestedDraft?.movements).toHaveLength(2);
    expect(okAnalysis.suggestedDraft?.movements[0]?.accountCode).toBe('305-01-001');
    expect(okAnalysis.suggestedDraft?.movements[0]?.cargo).toBe(150000);
    expect(okAnalysis.suggestedDraft?.movements[1]?.accountCode).toBe('301-02-001');
    expect(okAnalysis.suggestedDraft?.movements[1]?.abono).toBe(150000);

    const acc305 = accounts.find((a) => a.code === '305-01-001')!;
    const acc301 = accounts.find((a) => a.code === '301-02-001')!;
    const existingManual: Poliza = {
      id: 'pol_manual_traspaso',
      companyId: COMPANY.id,
      ejercicio: 2026,
      periodo: 1,
      tipo: 'DIARIO',
      folio: 4,
      fecha: '2026-01-20',
      concepto: 'Traspaso Asamblea Ordinaria Manual',
      origin: 'MANUAL',
      cfdiUuid: null,
      totalCargos: 150000,
      totalAbonos: 150000,
      isBalanced: true,
      createdAt: '2026-01-20T00:00:00.000Z',
      movements: [
        {
          id: 'm1',
          polizaId: 'pol_manual_traspaso',
          accountId: acc305.id,
          accountCode: acc305.code,
          accountName: acc305.name,
          referencia: 'ASAMBLEA',
          concepto: 'Traspaso manual',
          cargo: 150000,
          abono: 0,
          cfdiUuid: null
        },
        {
          id: 'm2',
          polizaId: 'pol_manual_traspaso',
          accountId: acc301.id,
          accountCode: acc301.code,
          accountName: acc301.name,
          referencia: 'ASAMBLEA',
          concepto: 'Traspaso manual',
          cargo: 0,
          abono: 150000,
          cfdiUuid: null
        }
      ]
    };

    const dupAnalysis = analyzeAsambleaTraspaso({
      companyId: COMPANY.id,
      ejercicio: 2026,
      periodo: 1,
      accounts,
      polizasInYear: [existingManual]
    });
    expect(dupAnalysis.hasExistingManualPoliza).toBe(true);
    expect(dupAnalysis.matchingPolizas).toHaveLength(1);
    expect(dupAnalysis.canGenerate).toBe(false);
    expect(dupAnalysis.blockReason).toContain('doble traspaso');

    const marchAnalysis = analyzeAsambleaTraspaso({
      companyId: COMPANY.id,
      ejercicio: 2026,
      periodo: 3,
      accounts,
      polizasInYear: []
    });
    expect(marchAnalysis.isJanuary).toBe(false);
    expect(marchAnalysis.canGenerate).toBe(false);
  });

  test('2. Importador CSV y CONTPAQi TXT valida partida doble, cuentas afectables y bloqueos SAT', () => {
    const affectableAccounts = makeSeedCatalog().filter((a) => a.isAffectable);

    const csvText = [
      'fecha,tipo,concepto,cuenta,referencia,concepto_mov,cargo,abono,uuid',
      '2026-10-05,EGRESO,Pago renta oficina,601-01-003,FAC-10,Renta octubre,10000,0,',
      '2026-10-05,EGRESO,Pago renta oficina,102-01-001,FAC-10,Transferencia BBVA,0,10000,',
      '2026-09-12,DIARIO,Periodo bloqueado,601-01-003,REF-2,Gasto cerrado,500,0,',
      '2026-09-12,DIARIO,Periodo bloqueado,102-01-001,REF-2,Banco,0,500,',
      '2026-10-15,DIARIO,Descuadrada,601-01-003,REF-3,Descuadre,100,0,',
      '2026-10-15,DIARIO,Descuadrada,999-99-999,REF-3,No existe,0,50,'
    ].join('\n');

    const preview = buildPolizaImportPreview({
      fileName: 'polizas.csv',
      textContent: csvText,
      affectableAccounts,
      lockedPeriods: new Set(['2026:9'])
    });
    expect(preview.polizas).toHaveLength(3);
    expect(preview.validCount).toBe(1);
    expect(preview.lockedCount).toBe(1);
    expect(preview.unbalancedCount).toBe(1);
    expect(preview.accountErrorCount).toBe(1);
    expect(preview.polizas[0]?.canImport).toBe(true);
    expect(preview.polizas[1]?.isPeriodLocked).toBe(true);
    expect(preview.polizas[2]?.canImport).toBe(false);

    const contpaqiTxt = [
      'P\t20261018\tDIARIO\t0005\tProvisión nómina quincena',
      'M\t601-01-001\tNOM-18\tC\t25000.00\tSueldos y salarios',
      'M\t205-01-001\tNOM-18\tA\t25000.00\tAcreedores nómina'
    ].join('\n');

    const txtPreview = buildPolizaImportPreview({
      fileName: 'CONTPAQ.TXT',
      textContent: contpaqiTxt,
      affectableAccounts,
      lockedPeriods: new Set()
    });
    expect(txtPreview.polizas).toHaveLength(1);
    expect(txtPreview.validCount).toBe(1);
    expect(txtPreview.polizas[0]?.totalCargos).toBe(25000);
    expect(txtPreview.polizas[0]?.totalAbonos).toBe(25000);
    expect(txtPreview.polizas[0]?.movements).toHaveLength(2);
  });

  test('3. Dashboard incluye Caja 101 + Bancos 102 + RIF 701/702 y Estados Financieros filtran por Segmento de Negocio', () => {
    const accounts = makeSeedCatalog();
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    const caja = byCode.get('101-01-001')!;
    const banco = byCode.get('102-01-001')!;
    const ventas = byCode.get('401-01-001')!;
    const gastos = byCode.get('601-01-003')!;
    const gastosFin = byCode.get('701-01-001')!;
    const prodFin = byCode.get('702-01-001')!;

    const movs = [
      {
        account_id: caja.id,
        cargo: 5000,
        abono: 0,
        business_segment_id: 'seg_norte',
        polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10, origin: 'MANUAL' }
      },
      {
        account_id: banco.id,
        cargo: 95000,
        abono: 0,
        business_segment_id: 'seg_norte',
        polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10, origin: 'MANUAL' }
      },
      {
        account_id: ventas.id,
        cargo: 0,
        abono: 80000,
        business_segment_id: 'seg_norte',
        polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10, origin: 'MANUAL' }
      },
      {
        account_id: gastos.id,
        cargo: 15000,
        abono: 0,
        business_segment_id: 'seg_norte',
        polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10, origin: 'MANUAL' }
      },
      {
        account_id: gastosFin.id,
        cargo: 3000,
        abono: 0,
        business_segment_id: 'seg_norte',
        polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10, origin: 'MANUAL' }
      },
      {
        account_id: prodFin.id,
        cargo: 0,
        abono: 1000,
        business_segment_id: 'seg_norte',
        polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10, origin: 'MANUAL' }
      },
      // Movimientos de otro segmento (Centro)
      {
        account_id: ventas.id,
        cargo: 0,
        abono: 20000,
        business_segment_id: 'seg_centro',
        polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10, origin: 'MANUAL' }
      },
      {
        account_id: gastos.id,
        cargo: 4000,
        abono: 0,
        business_segment_id: 'seg_centro',
        polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10, origin: 'MANUAL' }
      }
    ];

    const globalStmts = computeFinancialStatementsData(COMPANY, accounts, movs, 2026, 10);
    const { kpis } = buildDashboardKpisFromTrialBalance({
      trialBalance: globalStmts.trialBalance,
      polizas: [],
      cfdis: [],
      year: 2026,
      period: 10
    });
    expect(kpis.efectivoBancos).toBe(100000); // Caja 5,000 + Bancos 95,000
    expect(kpis.ingresosPeriodo).toBe(101000); // 100,000 Ventas + 1,000 Productos Fin (702)
    expect(kpis.egresosPeriodo).toBe(22000); // 19,000 Gastos + 3,000 Gastos Fin (701)
    expect(kpis.utilidadNeta).toBe(79000);

    const segNorte = computeFinancialStatementsData(COMPANY, accounts, movs, 2026, 10, {
      businessSegmentId: 'seg_norte'
    });
    expect(segNorte.incomeStatement.totalIngresos).toBe(80000);
    expect(segNorte.incomeStatement.totalGastos).toBe(15000);
    expect(segNorte.incomeStatement.utilidadNeta).toBe(63000); // 80k - 15k + (1k - 3k RIF)
  });

  test('4. Dossier Excel + CSV integra Conciliación Bancaria bilateral, Antigüedad CxC/CxP y MoM en Estado de Resultados', () => {
    const accounts = makeSeedCatalog();
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    const ventasId = byCode.get('401-01-001')!.id;
    const movs = [
      {
        account_id: ventasId,
        cargo: 0,
        abono: 100000,
        polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 9, origin: 'MANUAL' }
      },
      {
        account_id: ventasId,
        cargo: 0,
        abono: 125000,
        polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10, origin: 'MANUAL' }
      }
    ];

    const sepData = computeFinancialStatementsData(COMPANY, accounts, movs, 2026, 9);
    const octData = computeFinancialStatementsData(COMPANY, accounts, movs, 2026, 10);

    const bankAccountObj = byCode.get('102-01-001')!;
    const recon: BankReconciliationResponse = {
      account: bankAccountObj,
      ejercicio: 2026,
      periodo: 10,
      summary: {
        saldoInicialLibros: 50000,
        saldoFinalLibros: 80000,
        totalDepositosBanco: 35000,
        totalRetirosBanco: 2500,
        saldoBancoCierre: 82500,
        movimientosConciliados: 4,
        movimientosPendientesLibros: 1,
        movimientosPendientesBanco: 1
      },
      statementLines: [
        {
          id: 'bl_1',
          companyId: COMPANY.id,
          accountId: bankAccountObj.id,
          ejercicio: 2026,
          periodo: 10,
          fecha: '2026-10-29',
          referencia: 'COM-1',
          descripcion: 'Comisión bancaria no registrada',
          cargoBanco: 500,
          abonoBanco: 0,
          matchedMovementId: null,
          matchedPolizaFolio: null
        }
      ],
      bookMovements: [
        {
          movementId: 'bm_1',
          polizaId: 'p1',
          fecha: '2026-10-31',
          polizaFolio: 'E-12',
          concepto: 'Cheque en tránsito proveedor',
          referencia: 'CHQ-101',
          cargoContable: 0,
          abonoContable: 3000,
          isMatched: false
        }
      ]
    };

    const reconSummary = computeDossierBankReconSummary(recon);
    expect(reconSummary.saldoConciliadoBanco).toBe(79500); // 82,500 + 0 - 3,000
    expect(reconSummary.saldoConciliadoLibros).toBe(79500); // 80,000 + 0 - 500
    expect(reconSummary.diferenciaCuadre).toBe(0);
    expect(reconSummary.isCuadrada).toBe(true);

    const aging: CxcCxpAgingResponse = {
      companyId: COMPANY.id,
      asOfDate: '2026-10-31',
      cxcTotal: 45000,
      cxpTotal: 18000,
      cxcBuckets: { '0_30': 20000, '31_60': 25000, '61_90': 0, '90_PLUS': 0 },
      cxpBuckets: { '0_30': 18000, '31_60': 0, '61_90': 0, '90_PLUS': 0 },
      cxcItems: [
        {
          cfdiId: 'c1',
          uuid: 'U1',
          serieFolio: 'F-100',
          fecha: '2026-09-01',
          rfc: 'CLI010101AA1',
          nombre: 'Cliente Moroso SA',
          direction: 'EMITIDO',
          totalOriginalMxn: 45000,
          totalPagadoMxn: 0,
          saldoInsolutoMxn: 45000,
          daysPast: 60,
          bucket: '31_60',
          moneda: 'MXN',
          tipoCambio: 1,
          parcialidades: []
        }
      ],
      cxpItems: []
    };

    const topCxc = buildTopCounterpartyAging(aging.cxcItems, 10);
    expect(topCxc).toHaveLength(1);
    expect(topCxc[0]?.vencidoMas30Mxn).toBe(45000);

    const sheets = buildDeliverablesSheets({
      reportsData: octData,
      prevMonthIncomeStatement: sepData.incomeStatement,
      fiscalData: null,
      company: COMPANY,
      year: 2026,
      period: 10,
      formatVerticalPct: (v, b) => `${((v / b) * 100).toFixed(1)}%`,
      bankReconciliations: [recon],
      agingData: aging,
      mesNombre: 'Octubre'
    });
    const names = sheets.map((s) => s.sheet);
    expect(names).toContain('Conciliación Bancaria');
    expect(names).toContain('Antigüedad CxC-CxP');

    const erSheet = sheets.find((s) => s.sheet === 'Estado de Resultados')!;
    const headerRow = erSheet.data[4]!.map((c) => String((c as { value?: unknown })?.value ?? ''));
    expect(headerRow).toContain('% Vert. Mes');
    expect(headerRow).toContain('Mes Ant. MXN');
    expect(headerRow).toContain('Var. MoM %');

    expect(buildConciliacionBancariaCsvRows([recon]).length).toBeGreaterThanOrEqual(10);
    expect(buildAgingCxcCxpCsvRows(aging).length).toBe(3);
  });

  test('5. SQLite Round-trip: Poliza Templates CRUD, Segmentos CRUD, Reporte por Segmento y Campos Bancarios Anexo 24 en 102-*', () => {
    const co = createCompanyRecord({
      name: 'Ronda 11 SQLite Test SA',
      rfc: `R11${Date.now().toString().slice(-6)}AA1`,
      regimenFiscal: '601',
      codigoPostal: '06600',
      currentYear: 2026,
      currentPeriod: 10,
      catalogPreset: 'SAT_STANDARD'
    });
    createdCompanyIds.push(co.id);

    const tpl = createPolizaTemplateRepo({
      companyId: co.id,
      name: 'Renta Mensual Oficina',
      tipo: 'EGRESO',
      conceptoDefault: 'Pago de renta mensual',
      movementsJson: [
        { accountCode: '601-01-003', concepto: 'Renta', cargoFixed: 10000, abonoFixed: 0 },
        { accountCode: '102-01-001', concepto: 'Banco BBVA', cargoFixed: 0, abonoFixed: 10000 }
      ]
    });
    expect(listPolizaTemplatesRepo(co.id)).toHaveLength(1);
    const updatedTpl = updatePolizaTemplateRepo(tpl.id, co.id, {
      name: 'Renta Actualizada',
      tipo: 'EGRESO',
      conceptoDefault: 'Renta oficina CDMX',
      movementsJson: tpl.movementsJson
    });
    expect(updatedTpl?.name).toBe('Renta Actualizada');

    const seg = createBusinessSegmentRepo({
      companyId: co.id,
      code: 'SUC-MTY',
      name: 'Sucursal Monterrey'
    });
    expect(listBusinessSegmentsRepo(co.id)).toHaveLength(1);

    const coAccounts = getAccounts(co.id);
    const bankAcc = coAccounts.find((a) => a.code.startsWith('102-') && a.isAffectable)!;
    const expAcc = coAccounts.find((a) => a.code.startsWith('601-') && a.isAffectable)!;

    const savedPoliza = createPolizaTransaction({
      companyId: co.id,
      ejercicio: 2026,
      periodo: 10,
      tipo: 'EGRESO',
      fecha: '2026-10-12',
      concepto: 'Pago transferencia SPEI Anexo 24',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        {
          accountId: expAcc.id,
          referencia: 'FAC-77',
          concepto: 'Gasto MTY',
          cargo: 8500,
          abono: 0,
          businessSegmentId: seg.id
        },
        {
          accountId: bankAcc.id,
          referencia: 'SPEI-77',
          concepto: 'Transferencia Banamex',
          cargo: 0,
          abono: 8500,
          paymentMethodSat: '03',
          bankCodeOri: '002',
          accountOri: '002180001122334455',
          bankCodeDest: '012',
          accountDest: '012180009988776655',
          beneficiaryName: 'PROVEEDOR REGIO SA',
          beneficiaryRfc: 'PRR010101AA1',
          businessSegmentId: seg.id
        }
      ]
    });

    const fetched = getPolizas(co.id, 2026, 10);
    expect(fetched).toHaveLength(1);
    const bankMov = fetched[0]!.movements.find((m) => m.accountId === bankAcc.id)!;
    expect(bankMov.paymentMethodSat).toBe('03');
    expect(bankMov.bankCodeOri).toBe('002');
    expect(bankMov.accountOri).toBe('002180001122334455');
    expect(bankMov.bankCodeDest).toBe('012');
    expect(bankMov.accountDest).toBe('012180009988776655');
    expect(bankMov.beneficiaryName).toBe('PROVEEDOR REGIO SA');
    expect(bankMov.beneficiaryRfc).toBe('PRR010101AA1');
    expect(bankMov.businessSegmentId).toBe(seg.id);
    expect(savedPoliza.isBalanced).toBe(true);

    const segStmt = getSegmentFinancialStatementsRepo(co.id, 2026, 10, seg.id);
    expect(segStmt).not.toBeNull();
    expect(segStmt!.incomeStatement.totalGastos).toBe(8500);

    expect(deletePolizaTemplateRepo(tpl.id, co.id)).toBe(true);
    expect(deleteBusinessSegmentRepo(seg.id, co.id)).toBe(true);
  });
});
