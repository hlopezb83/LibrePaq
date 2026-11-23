import { describe, expect, test } from 'bun:test';
import {
  buildCashFlowSheetData,
  buildComparativeSheetData,
  buildEquityChangesSheetData
} from '../src/lib/excel-extended-sheets';
import { computeExtendedFinancialStatements } from '../src/shared/engine/extended-statements.engine';
import { computeFinancialStatementsData } from '../src/shared/engine/financial-reports.engine';
import type { AccountWithBalance, Company } from '../src/shared/types';

const COMPANY: Company = {
  id: 'comp-nif-test',
  name: 'TECNOLOGIA AVANZADA DEL NORTE S.A. DE C.V.',
  rfc: 'TAN200101AB1',
  regimenFiscal: '601 - General de Ley Personas Morales',
  codigoPostal: '64000',
  maskFormat: '3-2-3',
  currentYear: 2026,
  currentPeriod: 12,
  createdAt: '2026-01-01T00:00:00.000Z'
};

function makeAcc(
  overrides: Partial<AccountWithBalance> & Pick<AccountWithBalance, 'id' | 'code' | 'name' | 'type' | 'nature' | 'satGroupCode'>
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

describe('Ola 3B — Estados Financieros Extendidos (NIF B-2, NIF B-4, Comparativo y Excel)', () => {
  test('NIF B-2 Método Indirecto cuadra flujoNetoOperacion + Inversión + Financiamiento === Efectivo Final - Inicial', () => {
    const tb: AccountWithBalance[] = [
      makeAcc({ id: 'a-102', code: '102-01-001', name: 'BBVA MXN', type: 'ACTIVO', nature: 'DEUDORA', satGroupCode: '102.01', initialBalanceComputed: 100_000, finalBalance: 185_000 }),
      makeAcc({ id: 'a-105', code: '105-01-001', name: 'Clientes Nacionales', type: 'ACTIVO', nature: 'DEUDORA', satGroupCode: '105.01', initialBalanceComputed: 50_000, finalBalance: 75_000 }),
      makeAcc({ id: 'a-115', code: '115-01-001', name: 'Almacén Inventarios', type: 'ACTIVO', nature: 'DEUDORA', satGroupCode: '115.01', initialBalanceComputed: 30_000, finalBalance: 20_000 }),
      makeAcc({ id: 'a-156', code: '156-01-001', name: 'Equipo de Cómputo', type: 'ACTIVO', nature: 'DEUDORA', satGroupCode: '156.01', initialBalanceComputed: 100_000, finalBalance: 160_000 }),
      makeAcc({ id: 'a-171', code: '171-01-001', name: 'Depreciación Acumulada', type: 'ACTIVO', nature: 'ACREEDORA', satGroupCode: '171', initialBalanceComputed: 10_000, finalBalance: 22_000 }),
      makeAcc({ id: 'p-201', code: '201-01-001', name: 'Proveedores', type: 'PASIVO', nature: 'ACREEDORA', satGroupCode: '201.01', initialBalanceComputed: 40_000, finalBalance: 65_000 }),
      makeAcc({ id: 'p-213', code: '213-01-002', name: 'ISR por Pagar', type: 'PASIVO', nature: 'ACREEDORA', satGroupCode: '213.03', initialBalanceComputed: 10_000, finalBalance: 18_000 }),
      makeAcc({ id: 'p-252', code: '252-01-001', name: 'Crédito Bancario LP', type: 'PASIVO', nature: 'ACREEDORA', satGroupCode: '252.01', initialBalanceComputed: 50_000, finalBalance: 80_000 }),
      makeAcc({ id: 'c-301', code: '301-01-001', name: 'Capital Social Fijo', type: 'CAPITAL', nature: 'ACREEDORA', satGroupCode: '301.01', initialBalanceComputed: 170_000, finalBalance: 200_000 }),
      makeAcc({ id: 'i-401', code: '401-01-001', name: 'Ventas Gravadas', type: 'INGRESOS', nature: 'ACREEDORA', satGroupCode: '401.01', level: 2, finalBalance: 150_000 }),
      makeAcc({ id: 'g-601', code: '601-01-001', name: 'Sueldos y Salarios', type: 'GASTOS', nature: 'DEUDORA', satGroupCode: '601.01', level: 2, finalBalance: 83_000 }),
      makeAcc({ id: 'g-dep', code: '601-01-006', name: 'Depreciación Contable', type: 'GASTOS', nature: 'DEUDORA', satGroupCode: '601.84', level: 2, finalBalance: 12_000 })
    ];

    const res = computeExtendedFinancialStatements({
      company: COMPANY,
      ejercicio: 2026,
      periodo: 12,
      currentTrialBalance: tb
    });

    expect(res.hasPreviousComparative).toBe(false);
    expect(res.cashFlow.utilidadNeta).toBe(55_000);
    expect(res.cashFlow.totalPartidasVirtuales).toBe(12_000);
    // Capital trabajo: -25k clientes + 10k inventario + 25k proveedores + 8k ISR = +18,000
    expect(res.cashFlow.totalCambiosCapitalTrabajo).toBe(18_000);
    // Operación: 55,000 + 12,000 + 18,000 = 85,000
    expect(res.cashFlow.flujoNetoOperacion).toBe(85_000);
    // Inversión: -60,000 equipo
    expect(res.cashFlow.flujoNetoInversion).toBe(-60_000);
    // Financiamiento: +30,000 deuda LP + 30,000 capital social = +60,000
    expect(res.cashFlow.flujoNetoFinanciamiento).toBe(60_000);
    expect(res.cashFlow.variacionNetaEfectivo).toBe(85_000);
    expect(res.cashFlow.efectivoFinal - res.cashFlow.efectivoInicial).toBe(85_000);
    expect(res.cashFlow.flujoNetoOperacion + res.cashFlow.flujoNetoInversion + res.cashFlow.flujoNetoFinanciamiento).toBe(res.cashFlow.efectivoFinal - res.cashFlow.efectivoInicial);
    expect(res.cashFlow.diferenciaReconciliacion).toBe(0);
    expect(res.cashFlow.isReconciled).toBe(true);
  });

  test('NIF B-4 y NIF B-2 con comparativo interanual (computeFinancialStatementsData) cuadran horizontal/verticalmente', () => {
    const catalog = [
      makeAcc({ id: 'a-100', code: '100-00-000', name: 'ACTIVO', type: 'ACTIVO', nature: 'DEUDORA', satGroupCode: '100', level: 1, isAffectable: false }),
      makeAcc({ id: 'a-102', code: '102-01-001', name: 'BBVA', type: 'ACTIVO', nature: 'DEUDORA', satGroupCode: '102.01', parentCode: '100-00-000', level: 2, initialBalance: 200_000 }),
      makeAcc({ id: 'a-105', code: '105-01-001', name: 'Clientes', type: 'ACTIVO', nature: 'DEUDORA', satGroupCode: '105.01', parentCode: '100-00-000', level: 2, initialBalance: 0 }),
      makeAcc({ id: 'p-200', code: '200-00-000', name: 'PASIVO', type: 'PASIVO', nature: 'ACREEDORA', satGroupCode: '200', level: 1, isAffectable: false }),
      makeAcc({ id: 'p-201', code: '201-01-001', name: 'Proveedores', type: 'PASIVO', nature: 'ACREEDORA', satGroupCode: '201.01', parentCode: '200-00-000', level: 2, initialBalance: 0 }),
      makeAcc({ id: 'c-300', code: '300-00-000', name: 'CAPITAL', type: 'CAPITAL', nature: 'ACREEDORA', satGroupCode: '300', level: 1, isAffectable: false }),
      makeAcc({ id: 'c-301', code: '301-01-001', name: 'Capital Social', type: 'CAPITAL', nature: 'ACREEDORA', satGroupCode: '301.01', parentCode: '300-00-000', level: 2, initialBalance: 200_000 }),
      makeAcc({ id: 'c-303', code: '303-01-001', name: 'Reserva Legal', type: 'CAPITAL', nature: 'ACREEDORA', satGroupCode: '303.01', parentCode: '300-00-000', level: 2, initialBalance: 0 }),
      makeAcc({ id: 'c-304', code: '301-02-001', name: 'Utilidades Acumuladas', type: 'CAPITAL', nature: 'ACREEDORA', satGroupCode: '304.01', parentCode: '300-00-000', level: 2, initialBalance: 0 }),
      makeAcc({ id: 'i-400', code: '400-00-000', name: 'INGRESOS', type: 'INGRESOS', nature: 'ACREEDORA', satGroupCode: '400', level: 1, isAffectable: false }),
      makeAcc({ id: 'i-401', code: '401-01-001', name: 'Ventas', type: 'INGRESOS', nature: 'ACREEDORA', satGroupCode: '401.01', parentCode: '400-00-000', level: 2 }),
      makeAcc({ id: 'g-600', code: '600-00-000', name: 'GASTOS', type: 'GASTOS', nature: 'DEUDORA', satGroupCode: '600', level: 1, isAffectable: false }),
      makeAcc({ id: 'g-601', code: '601-01-001', name: 'Gastos Generales', type: 'GASTOS', nature: 'DEUDORA', satGroupCode: '601.01', parentCode: '600-00-000', level: 2 })
    ];

    const movs = [
      // 2025: Ventas al contado 100,000 y Gastos pagados 40,000 => Utilidad 2025 = 60,000
      { account_id: 'a-102', cargo: 100_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 6 } },
      { account_id: 'i-401', cargo: 0, abono: 100_000, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 6 } },
      { account_id: 'g-601', cargo: 40_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 6 } },
      { account_id: 'a-102', cargo: 0, abono: 40_000, polizas: { company_id: COMPANY.id, ejercicio: 2025, periodo: 6 } },
      // 2026: Ventas a crédito 150,000, cobro parcial 110,000, incremento reserva legal 3,000 desde acumulados, aportación capital 50,000
      { account_id: 'a-105', cargo: 150_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 3 } },
      { account_id: 'i-401', cargo: 0, abono: 150_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 3 } },
      { account_id: 'a-102', cargo: 110_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 4 } },
      { account_id: 'a-105', cargo: 0, abono: 110_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 4 } },
      { account_id: 'c-304', cargo: 3_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 5 } },
      { account_id: 'c-303', cargo: 0, abono: 3_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 5 } },
      { account_id: 'a-102', cargo: 50_000, abono: 0, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 5 } },
      { account_id: 'c-301', cargo: 0, abono: 50_000, polizas: { company_id: COMPANY.id, ejercicio: 2026, periodo: 5 } }
    ];

    const prevFs = computeFinancialStatementsData(COMPANY, catalog, movs, 2025, 12);
    const currFs = computeFinancialStatementsData(COMPANY, catalog, movs, 2026, 12);

    const ext = computeExtendedFinancialStatements({
      company: COMPANY,
      ejercicio: 2026,
      periodo: 12,
      currentTrialBalance: currFs.trialBalance,
      previousTrialBalance: prevFs.trialBalance
    });

    expect(ext.hasPreviousComparative).toBe(true);
    // NIF B-2 cuadre exacto
    expect(ext.cashFlow.efectivoInicial).toBe(260_000);
    expect(ext.cashFlow.efectivoFinal).toBe(420_000);
    expect(ext.cashFlow.flujoNetoOperacion).toBe(110_000);
    expect(ext.cashFlow.flujoNetoInversion).toBe(0);
    expect(ext.cashFlow.flujoNetoFinanciamiento).toBe(50_000);
    expect(ext.cashFlow.flujoNetoOperacion + ext.cashFlow.flujoNetoInversion + ext.cashFlow.flujoNetoFinanciamiento).toBe(ext.cashFlow.efectivoFinal - ext.cashFlow.efectivoInicial);
    expect(ext.cashFlow.isReconciled).toBe(true);

    // NIF B-4 cuadre horizontal y vertical
    expect(ext.equityChanges.isBalanced).toBe(true);
    expect(ext.equityChanges.saldoInicialTotal).toBe(260_000);
    expect(ext.equityChanges.movimientoNetoTotal).toBe(200_000);
    expect(ext.equityChanges.saldoFinalTotal).toBe(460_000);
    for (const row of ext.equityChanges.rows) {
      expect(row.capitalSocial + row.reservaLegal + row.resultadosAcumulados + row.resultadoEjercicio).toBe(row.total);
    }

    // Comparativo %: Ventas 150k vs 100k => +50,000 (+50%), Clientes 40k vs 0 => null
    const ventasComp = ext.comparative.find((r) => r.code === '401-01-001');
    expect(ventasComp?.varianceAmount).toBe(50_000);
    expect(ventasComp?.variancePct).toBe(50);
    const clientesComp = ext.comparative.find((r) => r.code === '105-01-001');
    expect(clientesComp?.varianceAmount).toBe(40_000);
    expect(clientesComp?.variancePct).toBeNull();

    // Verificación de constructores Excel
    const cfSheet = buildCashFlowSheetData(ext, 'Diciembre');
    const eqSheet = buildEquityChangesSheetData(ext, 'Diciembre');
    const compSheet = buildComparativeSheetData(ext, 'Diciembre');
    expect(cfSheet.length).toBeGreaterThan(10);
    expect(eqSheet.length).toBeGreaterThan(6);
    expect(compSheet.length).toBeGreaterThan(5);
  });
});
