import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  buildDeliverablesSheets,
  exportDeliverablesXlsx
} from '../src/lib/excel-export';
import {
  DEFAULT_DELIVERABLE_CONFIG,
  loadDeliverableBranding,
  saveDeliverableBranding
} from '../src/lib/supabase/supabase-deliverables-branding';
import { getSeedAccountsForPreset } from '../src/shared/catalogs/base-accounts.seed';
import { formatBalanceCutoffLabel, formatIncomePeriodLabel } from '../src/shared/date-utils';
import {
  buildDashboardKpisFromTrialBalance,
  computeDashboardCashCoverage
} from '../src/shared/engine/dashboard.engine';
import { computeExtendedFinancialStatements } from '../src/shared/engine/extended-statements.engine';
import { computeExecutiveFinancialRatios } from '../src/shared/engine/financial-ratios.engine';
import {
  computeFinancialStatementsData
} from '../src/shared/engine/financial-reports.engine';
import type {
  AccountWithBalance,
  Company,
  FiscalWorkpaperResponse
} from '../src/shared/types';

const COMPANY: Company = {
  id: 'comp_r7_ola4',
  name: 'GRUPO INDUSTRIAL REGIOMONTANO S.A. DE C.V.',
  rfc: 'GIR200101AB1',
  regimenFiscal: '601 - General de Ley Personas Morales',
  codigoPostal: '64000',
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

function makeAcc(
  overrides: Partial<AccountWithBalance> &
    Pick<AccountWithBalance, 'id' | 'code' | 'name' | 'type' | 'nature' | 'satGroupCode'>
): AccountWithBalance {
  return {
    companyId: COMPANY.id,
    parentCode: null,
    level: 3,
    isAffectable: true,
    currency: 'MXN',
    initialBalance: 0,
    initialBalanceComputed: 0,
    periodCharges: 0,
    periodCredits: 0,
    finalBalance: 0,
    ...overrides
  };
}

describe('Ronda 7 — Ola 4: NIF B-6/B-3/B-2/B-4, Dossier PDF/Excel & Dashboard', () => {
  test('1. ORDEN accounts never roll up into Activo/Pasivo/Capital or Income Statement', () => {
    const catalog = [
      ...makeSeedCatalog(),
      makeAcc({
        id: 'ord_l1',
        code: '900-00-000',
        name: 'CUENTAS DE ORDEN',
        type: 'ORDEN',
        nature: 'DEUDORA',
        satGroupCode: '900',
        level: 1,
        isAffectable: false
      }),
      makeAcc({
        id: 'ord_d',
        code: '901-01-001',
        name: 'Pérdidas Fiscales por Amortizar (Orden)',
        type: 'ORDEN',
        nature: 'DEUDORA',
        satGroupCode: '901.01',
        parentCode: '100-00-000', // Incluso con parentCode mal apuntado a 100-00-000
        level: 3,
        isAffectable: true
      }),
      makeAcc({
        id: 'ord_a',
        code: '902-01-001',
        name: 'Control Pérdidas Fiscales (Contra Orden)',
        type: 'ORDEN',
        nature: 'ACREEDORA',
        satGroupCode: '902.01',
        parentCode: '900-00-000',
        level: 3,
        isAffectable: true
      })
    ];

    const movs = [
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 50_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 5 } },
      { account_id: `${COMPANY.id}_301-01-001`, cargo: 0, abono: 50_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 5 } },
      { account_id: 'ord_d', cargo: 200_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 5 } },
      { account_id: 'ord_a', cargo: 0, abono: 200_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 5 } }
    ];

    const fs = computeFinancialStatementsData(COMPANY, catalog, movs, 2026, 5);
    expect(fs.balanceSheet.totalActivo).toBe(50_000);
    expect(fs.balanceSheet.totalPasivo).toBe(0);
    expect(fs.balanceSheet.totalCapitalBase).toBe(50_000);
    expect(fs.balanceSheet.isBalanced).toBe(true);
    expect(fs.balanceSheet.activos.some((a) => a.type === 'ORDEN')).toBe(false);
    expect(fs.incomeStatement.totalIngresos).toBe(0);
  });

  test('2. Rollover routes prior closed/unclosed & zeroed P&L initialBalances into 301-02-001 (not 305-01-001)', () => {
    const catalog = makeSeedCatalog().map((a) => {
      if (a.code === '102-01-001') return { ...a, initialBalance: 100_000 };
      if (a.code === '301-01-001') return { ...a, initialBalance: 80_000 };
      // Saldo inicial en P&L de migración (20,000 ingresos) que será anulado en 2026 por zeroResultInitialBalances
      if (a.code === '401-01-001') return { ...a, initialBalance: 20_000 };
      return a;
    });

    const movs = [
      // 2025 cerrado a 305-01-001 por +30,000
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 30_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 6 } },
      { account_id: `${COMPANY.id}_401-01-001`, cargo: 0, abono: 30_000, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 6 } },
      { account_id: `${COMPANY.id}_401-01-001`, cargo: 30_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 13 } },
      { account_id: `${COMPANY.id}_305-01-001`, cargo: 0, abono: 30_000, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 13 } },
      // 2026 venta nueva de 45,000
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 45_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 2 } },
      { account_id: `${COMPANY.id}_401-01-001`, cargo: 0, abono: 45_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 2 } }
    ];

    const fs2026 = computeFinancialStatementsData(COMPANY, catalog, movs, 2026, 2);
    const acc30102 = fs2026.trialBalance.find((a) => a.code === '301-02-001');
    const acc305 = fs2026.trialBalance.find((a) => a.code === '305-01-001');

    // 301-02-001 recibe 30,000 (cierre 2025) + 20,000 (P&L initialBalance anulado) = 50,000
    expect(acc30102?.finalBalance).toBe(50_000);
    // 305-01-001 permanece en $0.00 en balanza para el ejercicio en curso
    expect(acc305?.initialBalanceComputed).toBe(0);
    expect(acc305?.finalBalance).toBe(0);
    // Activo = 100k + 30k + 45k = 175k; Capital = 80k + 50k + 45k = 175k
    expect(fs2026.balanceSheet.totalActivo).toBe(175_000);
    expect(fs2026.balanceSheet.totalPasivoMasCapital).toBe(175_000);
    expect(fs2026.balanceSheet.isBalanced).toBe(true);
  });

  test('3. NIF B-3 Waterfall (Mes + YTD), 801-01-002 NOT in ISR, RIF (702 - 701/601-01-005), 702 excluded from Ventas', () => {
    const catalog = makeSeedCatalog();
    const movs = [
      // Mes 9: Ventas 100k, Costos 40k, Gastos 10k
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 100_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 9 } },
      { account_id: `${COMPANY.id}_401-01-001`, cargo: 0, abono: 100_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 9 } },
      { account_id: `${COMPANY.id}_501-01-001`, cargo: 40_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 9 } },
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 0, abono: 40_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 9 } },
      { account_id: `${COMPANY.id}_601-01-001`, cargo: 10_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 9 } },
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 0, abono: 10_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 9 } },
      // Mes 10: Ventas 50k, 801-01-002 No Deducibles 3k, Comisiones 601-01-005 (701.10) 1k, Pérdida Cambiaria 701-01-001 2k, Utilidad Cambiaria 702-01-001 5k, ISR 801-01-001 12k
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 50_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_401-01-001`, cargo: 0, abono: 50_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_801-01-002`, cargo: 3_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 0, abono: 3_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_601-01-005`, cargo: 1_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 0, abono: 1_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_701-01-001`, cargo: 2_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 0, abono: 2_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 5_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_702-01-001`, cargo: 0, abono: 5_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_801-01-001`, cargo: 12_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_213-01-002`, cargo: 0, abono: 12_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } }
    ];

    const fs = computeFinancialStatementsData(COMPANY, catalog, movs, 2026, 10);
    const er = fs.incomeStatement;

    // 702-01-001 NO entra en Ventas Netas
    expect(er.totalIngresos).toBe(150_000);
    expect(er.totalCostos).toBe(40_000);
    expect(er.utilidadBruta).toBe(110_000);
    // 801-01-002 (3k) se queda en Gastos de Operación (10k + 3k = 13k), NO en ISR
    expect(er.totalGastos).toBe(13_000);
    expect(er.gastos.some((g) => g.code === '801-01-002')).toBe(true);
    expect(er.utilidadOperativa).toBe(97_000);
    // RIF = 702 (5k) - 701 (2k + 1k comisiones 601-01-005) = +2,000
    expect(er.totalRifProductos).toBe(5_000);
    expect(er.totalRifGastos).toBe(3_000);
    expect(er.rifNeto).toBe(2_000);
    expect(er.utilidadAntesImpuestos).toBe(99_000);
    // Solo 801-01-001 en ISR
    expect(er.totalIsr).toBe(12_000);
    expect(er.isrEjercicio?.some((a) => a.code === '801-01-002')).toBe(false);
    expect(er.utilidadNeta).toBe(87_000);

    // Mes 10 (Del Mes): Ingresos 50k, Gastos 3k (801-01-002), Util Op 47k, RIF +2k, UAI 49k, ISR 12k, Neta 37k
    expect(er.periodTotals?.totalIngresos).toBe(50_000);
    expect(er.periodTotals?.totalCostos).toBe(0);
    expect(er.periodTotals?.totalGastos).toBe(3_000);
    expect(er.periodTotals?.utilidadOperativa).toBe(47_000);
    expect(er.periodTotals?.rifNeto).toBe(2_000);
    expect(er.periodTotals?.utilidadAntesImpuestos).toBe(49_000);
    expect(er.periodTotals?.totalIsr).toBe(12_000);
    expect(er.periodTotals?.utilidadNeta).toBe(37_000);
    expect(fs.balanceSheet.isBalanced).toBe(true);
  });

  test('4. NIF B-6 classification, zero duplicate 305-01-001, and custom level-1 accounts preserve A = P + C', () => {
    const customCatalog = [
      ...makeSeedCatalog(),
      makeAcc({ id: 'c150', code: '150-00-000', name: 'ACTIVO FIJO PERSONALIZADO', type: 'ACTIVO', nature: 'DEUDORA', satGroupCode: '150', level: 1, isAffectable: false }),
      makeAcc({ id: 'c150_1', code: '150-01-001', name: 'Nave Industrial', type: 'ACTIVO', nature: 'DEUDORA', satGroupCode: '152.01', parentCode: '150-00-000', level: 3, isAffectable: true }),
      makeAcc({ id: 'c250', code: '250-00-000', name: 'PASIVO LARGO PLAZO', type: 'PASIVO', nature: 'ACREEDORA', satGroupCode: '250', level: 1, isAffectable: false }),
      makeAcc({ id: 'c250_1', code: '252-01-001', name: 'Crédito Hipotecario LP', type: 'PASIVO', nature: 'ACREEDORA', satGroupCode: '252.01', parentCode: '250-00-000', level: 3, isAffectable: true }),
      makeAcc({ id: 'c700', code: '700-00-000', name: 'RIF PERSONALIZADO', type: 'GASTOS', nature: 'DEUDORA', satGroupCode: '701', level: 1, isAffectable: false }),
      makeAcc({ id: 'c700_1', code: '701-02-001', name: 'Intereses Bancarios LP', type: 'GASTOS', nature: 'DEUDORA', satGroupCode: '701.02', parentCode: '700-00-000', level: 3, isAffectable: true })
    ];

    const movs = [
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 120_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 4 } },
      { account_id: `${COMPANY.id}_301-01-001`, cargo: 0, abono: 120_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 4 } },
      { account_id: 'c150_1', cargo: 300_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 4 } },
      { account_id: 'c250_1', cargo: 0, abono: 300_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 4 } },
      { account_id: 'c700_1', cargo: 5_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 4 } },
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 0, abono: 5_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 4 } }
    ];

    const fs = computeFinancialStatementsData(COMPANY, customCatalog, movs, 2026, 4);
    const nif = fs.balanceSheet.nifB6!;
    expect(nif.totalActivoCirculante).toBe(115_000);
    expect(nif.totalActivoNoCirculante).toBe(300_000);
    expect(fs.balanceSheet.totalActivo).toBe(415_000);
    expect(nif.totalPasivoCortoPlazo).toBe(0);
    expect(nif.totalPasivoLargoPlazo).toBe(300_000);
    expect(fs.balanceSheet.totalPasivo).toBe(300_000);
    expect(nif.totalCapitalContribuido).toBe(120_000);
    expect(nif.totalCapitalGanado).toBe(-5_000);
    expect(fs.balanceSheet.totalPasivoMasCapital).toBe(415_000);
    expect(fs.balanceSheet.isBalanced).toBe(true);
    // Sin duplicar 305-01-001
    expect(fs.balanceSheet.capital.some((a) => a.code.startsWith('305'))).toBe(false);
    expect(nif.capitalGanado.some((a) => a.code.startsWith('305'))).toBe(false);
  });

  test('5. NIF B-4 has zero phantom negative dividends when prior year unclosed; P13 pre-close ER & YoY Comparative work', () => {
    const catalog = makeSeedCatalog();
    const movs = [
      // 2025 SIN póliza de cierre P13: Ventas 100k, Gastos 40k => Utilidad 2025 = 60k
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 100_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 8 } },
      { account_id: `${COMPANY.id}_401-01-001`, cargo: 0, abono: 100_000, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 8 } },
      { account_id: `${COMPANY.id}_601-01-001`, cargo: 40_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 8 } },
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 0, abono: 40_000, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 8 } },
      // 2026 con póliza de cierre P13: Ventas 150k, Gastos 50k => Cierre P13 traspasa 100k a 305-01-001
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 150_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 6 } },
      { account_id: `${COMPANY.id}_401-01-001`, cargo: 0, abono: 150_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 6 } },
      { account_id: `${COMPANY.id}_601-01-001`, cargo: 50_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 6 } },
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 0, abono: 50_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 6 } },
      { account_id: `${COMPANY.id}_401-01-001`, cargo: 150_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 13 } },
      { account_id: `${COMPANY.id}_601-01-001`, cargo: 0, abono: 50_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 13 } },
      { account_id: `${COMPANY.id}_305-01-001`, cargo: 0, abono: 100_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 13 } }
    ];

    const prevFs2025 = computeFinancialStatementsData(COMPANY, catalog, movs, 2025, 13);
    const currFs2026P13 = computeFinancialStatementsData(COMPANY, catalog, movs, 2026, 13);

    // P13 pre-close ER no muestra $0.00 sino $150k ingresos, $50k gastos, $100k utilidad
    expect(currFs2026P13.incomeStatement.isPreCloseP13).toBe(true);
    expect(currFs2026P13.incomeStatement.totalIngresos).toBe(150_000);
    expect(currFs2026P13.incomeStatement.totalGastos).toBe(50_000);
    expect(currFs2026P13.incomeStatement.utilidadNeta).toBe(100_000);
    expect(currFs2026P13.balanceSheet.totalActivo).toBe(160_000);
    expect(currFs2026P13.balanceSheet.totalPasivoMasCapital).toBe(160_000);
    expect(currFs2026P13.balanceSheet.isBalanced).toBe(true);
    expect(formatBalanceCutoffLabel(2026, 13, 'Cierre')).toBe('Al 31 de Diciembre de 2026 (Cierre Mes 13)');
    expect(formatIncomePeriodLabel(2026, 13, 'Cierre')).toBe('Del 01 de Enero al 31 de Diciembre de 2026 (Cierre Mes 13)');

    // NIF B-4 sin fila fantasma negativa de dividendos
    const ext = computeExtendedFinancialStatements({
      company: COMPANY,
      ejercicio: 2026,
      periodo: 13,
      currentTrialBalance: currFs2026P13.trialBalance,
      previousTrialBalance: prevFs2025.trialBalance
    });
    expect(ext.equityChanges.isBalanced).toBe(true);
    expect(ext.equityChanges.rows.some((r) => r.id === 'resultados-acum')).toBe(false);
    const netIncomeRow = ext.equityChanges.rows.find((r) => r.id === 'net-income');
    expect(netIncomeRow?.resultadoEjercicio).toBe(100_000);

    // Ahora probar YoY Comparative cuando 2025 SI tuvo póliza de cierre P13
    const closed2025Movs = [
      ...movs,
      { account_id: `${COMPANY.id}_401-01-001`, cargo: 100_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 13 } },
      { account_id: `${COMPANY.id}_601-01-001`, cargo: 0, abono: 40_000, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 13 } },
      { account_id: `${COMPANY.id}_305-01-001`, cargo: 0, abono: 60_000, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 13 } }
    ];
    const prevClosed2025 = computeFinancialStatementsData(COMPANY, catalog, closed2025Movs, 2025, 13);
    const currAfterClosed2025 = computeFinancialStatementsData(COMPANY, catalog, closed2025Movs, 2026, 13);
    const extYoY = computeExtendedFinancialStatements({
      company: COMPANY,
      ejercicio: 2026,
      periodo: 13,
      currentTrialBalance: currAfterClosed2025.trialBalance,
      previousTrialBalance: prevClosed2025.trialBalance
    });
    const ventasRow = extYoY.comparative.find((r) => r.code === '401-01-001');
    expect(ventasRow?.previousBalance).toBe(100_000);
    expect(ventasRow?.currentBalance).toBe(150_000);
    expect(ventasRow?.variancePct).toBe(50);

    // NIF B-2 incluye cuenta 103 Inversiones Temporales y etiqueta de ventana explícita
    const tb103: AccountWithBalance[] = [
      makeAcc({ id: 'a103', code: '103-01-001', name: 'CETES 28 días', type: 'ACTIVO', nature: 'DEUDORA', satGroupCode: '103.01', initialBalanceComputed: 50_000, finalBalance: 80_000 }),
      makeAcc({ id: 'c301', code: '301-01-001', name: 'Capital', type: 'CAPITAL', nature: 'ACREEDORA', satGroupCode: '301.01', initialBalanceComputed: 50_000, finalBalance: 80_000 })
    ];
    const ext103 = computeExtendedFinancialStatements({ company: COMPANY, ejercicio: 2026, periodo: 5, currentTrialBalance: tb103 });
    expect(ext103.cashFlow.efectivoInicial).toBe(50_000);
    expect(ext103.cashFlow.efectivoFinal).toBe(80_000);
    expect(ext103.cashFlowWindowLabel).toContain('Periodo 5 / 2026');
  });

  test('6. Excel builder has column widths on all 7 sheets, banners, Sumas Iguales, Total Capital Contable & clean labels', () => {
    const catalog = makeSeedCatalog();
    const movs = [
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 100_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_401-01-001`, cargo: 0, abono: 100_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } }
    ];
    const reportsData = computeFinancialStatementsData(COMPANY, catalog, movs, 2026, 10);
    const ext = computeExtendedFinancialStatements({
      company: COMPANY,
      ejercicio: 2026,
      periodo: 10,
      currentTrialBalance: reportsData.trialBalance
    });
    const mockFiscal: FiscalWorkpaperResponse = {
      company: COMPANY,
      ejercicio: 2026,
      periodo: 10,
      parameters: { companyId: COMPANY.id, ejercicio: 2026, coeficienteUtilidad: 0.2, perdidasFiscalesPendientes: 0, pagosProvisionalesAnteriores: 0, saldoFavorIvaAnterior: 0, tipoCambioDofCierre: 20 },
      isrProvisional: { regimenClave: '601', esResico: false, ingresosPeriodo: 100_000, ingresosAcumuladosEjercicio: 100_000, deduccionesAutorizadasPeriodo: 0, coeficienteUtilidadAplicado: 0.2, utilidadFiscalEstimada: 20_000, perdidasFiscalesAplicadas: 0, baseGravableIsr: 20_000, tasaIsrPct: 30, isrCausado: 6_000, pagosProvisionalesPrevios: 0, isrRetenidoPeriodo: 0, isrNetoAPagar: 6_000 },
      ivaDefinitivo: { actosGravadosCobrado16: 100_000, ivaTrasladadoCobrado: 16_000, ivaAcreditablePagado: 4_000, ivaRetenidoPorPagar: 0, ivaRetenidoAcreditable: 1_500, saldoFavorIvaAcreditable: 0, ivaNetoAPagar: 10_500, saldoFavorIvaRemanente: 0 },
      fluctuacionCambiaria: { cfdisUsdCount: 0, saldoMonedaExtranjeraUsd: 0, tipoCambioPromedioRegistro: 20, tipoCambioDofCierre: 20, valuacionLibrosMxn: 0, valuacionCierreDofMxn: 0, diferenciaCambiariaMxn: 0, tipoDiferencia: 'SIN_CAMBIO' },
      resumenLineaCapturaSat: { isrProvisionalAPagar: 6_000, ivaDefinitivoAPagar: 10_500, retencionesIsrPorEnterar: 0, retencionesIvaPorEnterar: 0, totalEstimadoDia17: 16_500 }
    };

    const sheets = buildDeliverablesSheets({
      reportsData,
      fiscalData: mockFiscal,
      company: COMPANY,
      year: 2026,
      period: 10,
      formatVerticalPct: (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '0.0%'),
      extendedStatements: ext,
      mesNombre: 'Octubre',
      hideZeroAccounts: true
    });

    const cellVal = (c: unknown): string =>
      typeof c === 'object' && c !== null && 'value' in c
        ? String((c as { value?: unknown }).value ?? '')
        : String(c ?? '');

    expect(sheets).toHaveLength(7);
    for (const s of sheets) {
      expect(s.columns.length).toBeGreaterThanOrEqual(3);
      expect(s.columns.every((c) => c.width >= 8)).toBe(true);
      expect(cellVal(s.data[1]?.[0])).toContain(COMPANY.rfc);
    }

    const balanzaFlat = sheets[0]!.data.flat().map(cellVal);
    expect(balanzaFlat.some((v) => v.includes('SUMAS IGUALES'))).toBe(true);

    const erFlat = sheets[1]!.data.flat().map(cellVal);
    expect(erFlat.some((v) => v.includes('Resultado Neto Contable'))).toBe(true);
    expect(erFlat.some((v) => v.includes('Resultado Neto Fiscal'))).toBe(false);

    const bgFlat = sheets[2]!.data.flat().map(cellVal);
    expect(bgFlat.some((v) => v === 'TOTAL CAPITAL CONTABLE')).toBe(true);
    expect(bgFlat.filter((v) => v === '305-01-001')).toHaveLength(1);

    const d17Flat = sheets[3]!.data.flat().map(cellVal);
    expect(d17Flat.some((v) => v.includes('IVA Retenido Acreditable'))).toBe(true);
    expect(typeof exportDeliverablesXlsx).toBe('function');
  });

  test('7. Dashboard aligns IVA Neto with Día 17, Cobertura s/Pasivo uses totalPasivo, Ratios & Branding fallback work', async () => {
    const catalog = [
      ...makeSeedCatalog(),
      makeAcc({ id: 'p250', code: '250-00-000', name: 'PASIVO LP', type: 'PASIVO', nature: 'ACREEDORA', satGroupCode: '250', level: 1, isAffectable: false }),
      makeAcc({ id: 'p252', code: '252-01-001', name: 'Crédito LP', type: 'PASIVO', nature: 'ACREEDORA', satGroupCode: '252.01', parentCode: '250-00-000', level: 3, isAffectable: true })
    ];
    const movs = [
      // Mes 9: IVA trasladado 16k (acumulado YTD no debe contaminar Mes 10)
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 116_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 9 } },
      { account_id: `${COMPANY.id}_401-01-001`, cargo: 0, abono: 100_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 9 } },
      { account_id: `${COMPANY.id}_208-01-001`, cargo: 0, abono: 16_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 9 } },
      // Mes 10: Proveedores 10k + Pasivo LP 90k = Total Pasivo 100k; Bancos ya tiene 116k + 90k = 206k
      { account_id: `${COMPANY.id}_102-01-001`, cargo: 90_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: 'p252', cargo: 0, abono: 90_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_601-01-001`, cargo: 8_620.69, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_118-01-001`, cargo: 1_379.31, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } },
      { account_id: `${COMPANY.id}_201-01-001`, cargo: 0, abono: 10_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 10 } }
    ];

    const fs = computeFinancialStatementsData(COMPANY, catalog, movs, 2026, 10);
    const { kpis } = buildDashboardKpisFromTrialBalance({
      trialBalance: fs.trialBalance,
      polizas: [],
      cfdis: [],
      year: 2026,
      period: 10
    });

    // IVA Neto del Mes 10 (sin arrastrar los $16k de Mes 9): 0 - 1,379.31 = -1,379.31 (a favor)
    expect(kpis.ivaPorPagarNeto).toBe(-1379.31);
    // Total Pasivo = 10k Proveedores + 16k IVA + 90k Pasivo LP = 116k (no solo 10k Proveedores)
    expect(kpis.totalPasivo).toBe(116_000);
    expect(computeDashboardCashCoverage(kpis.efectivoBancos, kpis.totalPasivo ?? 0)).toBe('1.78');

    const ratios = computeExecutiveFinancialRatios(fs);
    expect(ratios.capitalTrabajoNeto).toBe(181_379.31);
    expect(ratios.razonCirculante).toBeGreaterThan(7);

    // Branding read-only guard y fallback sin throwing en entorno local/test
    const readOnlyRes = await saveDeliverableBranding(COMPANY.id, DEFAULT_DELIVERABLE_CONFIG, { isReadOnly: true });
    expect(readOnlyRes.savedToCloud).toBe(false);
    const loaded = await loadDeliverableBranding(COMPANY.id);
    expect(loaded.firmName).toBe(DEFAULT_DELIVERABLE_CONFIG.firmName);
  });

  test('8. CI Invariant: Ola 4 files in src/ <= 350 lines and zero : any in src/views or src/components', () => {
    const collectFiles = (dir: string): string[] => {
      const entries = readdirSync(dir);
      const out: string[] = [];
      for (const e of entries) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) out.push(...collectFiles(full));
        else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
      }
      return out;
    };

    const ola4Files = [
      'src/shared/engine/financial-reports.engine.ts',
      'src/shared/engine/financial-reports-helpers.ts',
      'src/shared/engine/financial-reports-rollup.ts',
      'src/shared/engine/extended-statements.engine.ts',
      'src/shared/engine/financial-ratios.engine.ts',
      'src/shared/engine/dashboard.engine.ts',
      'src/lib/supabase/supabase-deliverables-branding.ts',
      'src/lib/excel-export.ts',
      'src/lib/excel-deliverable-sheets.ts',
      'src/lib/excel-extended-sheets.ts',
      ...collectFiles(resolve(process.cwd(), 'src/components/deliverables')).map((f) =>
        f.replace(process.cwd() + '\\', '').replace(/\\/g, '/')
      ),
      ...collectFiles(resolve(process.cwd(), 'src/views/reportes')).map((f) =>
        f.replace(process.cwd() + '\\', '').replace(/\\/g, '/')
      ),
      ...collectFiles(resolve(process.cwd(), 'src/views/dashboard')).map((f) =>
        f.replace(process.cwd() + '\\', '').replace(/\\/g, '/')
      )
    ];

    const oversized = ola4Files.filter((rel) => {
      const lines = readFileSync(resolve(process.cwd(), rel), 'utf8').trimEnd().split(/\r?\n/).length;
      return lines > 350;
    });
    expect(oversized).toEqual([]);

    const srcFiles = collectFiles(resolve(process.cwd(), 'src'));
    const uiFiles = srcFiles.filter((f) => f.includes(`${join('src', 'views')}`) || f.includes(`${join('src', 'components')}`));
    const withAny = uiFiles.filter((f) => /:\s*any\b|\bas\s+any\b/.test(readFileSync(f, 'utf8')));
    expect(withAny).toEqual([]);
  });
});
