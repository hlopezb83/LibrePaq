import { describe, expect, test } from 'bun:test';
import {
  computePayrollPeriodSummary,
  computeSuaAndIsnProvision,
  MEXICO_ISN_RATES
} from '../src/shared/engine/payroll-summary.engine';
import { AccountingInvariantError, sumCents, toCents } from '../src/shared/engine/invariants-and-math';
import type { Account, AccountWithBalance, CfdiDocument } from '../src/shared/types';

function makeAccount(overrides: Partial<AccountWithBalance> & { id: string; code: string; name: string }): AccountWithBalance {
  return {
    companyId: 'comp-1',
    parentCode: null,
    type: 'PASIVO',
    nature: 'ACREEDORA',
    level: 3,
    isAffectable: true,
    satGroupCode: '211.01',
    currency: 'MXN',
    initialBalance: 0,
    initialBalanceComputed: 0,
    periodCharges: 0,
    periodCredits: 0,
    finalBalance: 0,
    ...overrides
  };
}

function makeNominaCfdi(overrides: Partial<CfdiDocument> & { id: string; uuid: string }): CfdiDocument {
  return {
    companyId: 'comp-1',
    fecha: '2026-10-15',
    tipoComprobante: 'N',
    direction: 'RECIBIDO',
    serie: 'NOM',
    folio: '1',
    emisorRfc: 'EMP010101AAA',
    emisorNombre: 'EMPRESA DEMO SA',
    receptorRfc: 'TRAB900101XX1',
    receptorNombre: 'EMPLEADO UNO',
    conceptoPrincipal: 'Pago de nómina',
    claveProdServ: '84111505',
    moneda: 'MXN',
    tipoCambio: 1,
    subtotal: 10000,
    descuento: 300,
    ivaTrasladado: 0,
    isrRetenido: 800,
    ivaRetenido: 0,
    total: 8900,
    metodoPago: 'PUE',
    formaPago: '99',
    usoCfdi: 'CN01',
    statusSat: 'VIGENTE',
    polizaId: null,
    xmlRaw: '',
    ...overrides
  };
}

describe('Ola 3C — Nómina 1.2, Amarre ISR (216-01-001), Provisión SUA e ISN Estatal', () => {
  const catalog: Account[] = [
    makeAccount({ id: 'acc-sueldos', code: '601-01-001', name: 'Sueldos y Salarios Administrativos', type: 'GASTOS', nature: 'DEUDORA', satGroupCode: '601.01' }),
    makeAccount({ id: 'acc-imss-gasto', code: '601-01-010', name: 'Cuotas Patronales IMSS e INFONAVIT', type: 'GASTOS', nature: 'DEUDORA', satGroupCode: '601.26' }),
    makeAccount({ id: 'acc-isn-gasto', code: '601-01-011', name: 'Impuesto Sobre Nóminas Estatal (ISN)', type: 'GASTOS', nature: 'DEUDORA', satGroupCode: '601.58' }),
    makeAccount({ id: 'acc-sua-pasivo', code: '211-01-002', name: 'Provisión Cuotas IMSS / RCV / INFONAVIT por Pagar', type: 'PASIVO', nature: 'ACREEDORA', satGroupCode: '211.01' }),
    makeAccount({ id: 'acc-isn-pasivo', code: '213-01-003', name: 'ISN Estatal por Pagar', type: 'PASIVO', nature: 'ACREEDORA', satGroupCode: '213.09' }),
    makeAccount({ id: 'acc-216', code: '216-01-001', name: 'Retenciones de ISR por Pagar', type: 'PASIVO', nature: 'ACREEDORA', satGroupCode: '216.04' })
  ];

  test('1. Catálogo MEXICO_ISN_RATES contiene exactamente los 32 estados con tasas vigentes', () => {
    expect(MEXICO_ISN_RATES.length).toBe(32);
    const codes = new Set(MEXICO_ISN_RATES.map((s) => s.code));
    expect(codes.size).toBe(32);

    const byCode = new Map(MEXICO_ISN_RATES.map((s) => [s.code, s.ratePct]));
    expect(byCode.get('CMX')).toBe(3.0);
    expect(byCode.get('NLE')).toBe(3.0);
    expect(byCode.get('JAL')).toBe(3.0);
    expect(byCode.get('MEX')).toBe(3.0);
    expect(byCode.get('GUA')).toBe(3.0);
    expect(byCode.get('CHH')).toBe(4.0);
    expect(byCode.get('BCN')).toBe(4.25);
    expect(byCode.get('QUE')).toBe(3.0);
  });

  test('2. Consolida múltiples CFDIs Tipo N vigentes, filtra cancelados/otros periodos y cuadra vs 216-01-001', () => {
    const cfdis: CfdiDocument[] = [
      makeNominaCfdi({
        id: 'n1',
        uuid: 'UUID-N1',
        fecha: '2026-10-15',
        subtotal: 10500, // 10,000 percepciones + 500 subsidio
        descuento: 310.25,
        isrRetenido: 820.5,
        total: 9369.25,
        xmlRaw: '<cfdi:Comprobante><nomina12:Nomina TotalPercepciones="10000.00" TotalOtrosPagos="500.00"><nomina12:Deducciones><nomina12:Deduccion TipoDeduccion="001" Importe="310.25"/></nomina12:Deducciones></nomina12:Nomina></cfdi:Comprobante>'
      }),
      makeNominaCfdi({
        id: 'n2',
        uuid: 'UUID-N2',
        fecha: '2026-10-30',
        subtotal: 15000,
        descuento: 450,
        isrRetenido: 1450.75,
        total: 13099.25,
        xmlRaw: '<cfdi:Comprobante><nomina12:Nomina TotalPercepciones="15000.00" TotalOtrosPagos="0.00"/></cfdi:Comprobante>'
      }),
      makeNominaCfdi({
        id: 'n-cancelado',
        uuid: 'UUID-N-CANC',
        fecha: '2026-10-15',
        statusSat: 'CANCELADO',
        subtotal: 99999,
        isrRetenido: 9999,
        total: 90000
      }),
      makeNominaCfdi({
        id: 'n-otro-mes',
        uuid: 'UUID-N-SEP',
        fecha: '2026-09-30',
        subtotal: 12000,
        isrRetenido: 1000,
        total: 11000
      }),
      makeNominaCfdi({
        id: 'i-factura',
        uuid: 'UUID-I1',
        tipoComprobante: 'I',
        fecha: '2026-10-20',
        subtotal: 50000,
        isrRetenido: 5000,
        total: 53000
      })
    ];

    const trialBalance: AccountWithBalance[] = [
      makeAccount({
        id: 'acc-216',
        code: '216-01-001',
        name: 'Retenciones de ISR por Pagar',
        satGroupCode: '216.04',
        initialBalanceComputed: 1500,
        periodCharges: 1500,
        periodCredits: 2271.25, // 820.50 + 1450.75
        finalBalance: 2271.25
      })
    ];

    const summary = computePayrollPeriodSummary({
      cfdis,
      trialBalance,
      ejercicio: 2026,
      periodo: 10
    });

    expect(summary.nominaCount).toBe(2);
    expect(summary.totalPercepciones).toBe(25000);
    expect(summary.totalSubsidioEmpleo).toBe(500);
    expect(summary.isrRetenidoCfdis).toBe(2271.25);
    expect(summary.imssObreroEstimado).toBe(760.25);
    expect(summary.totalNetoPagado).toBe(22468.5);
    expect(summary.isrRetenidoLibros).toBe(2271.25);
    expect(summary.diferenciaIsrAmarre).toBe(0);
    expect(summary.amarreStatus).toBe('CUADRADO');
  });

  test('3. Detecta diferencia de amarre ISR cuando contabilidad (216-01-001) no coincide con CFDIs y SIN_NOMINA cuando está vacío', () => {
    const cfdis: CfdiDocument[] = [
      makeNominaCfdi({ id: 'n1', uuid: 'UUID-1', isrRetenido: 1250.4 })
    ];
    const tbDiff: AccountWithBalance[] = [
      makeAccount({
        id: 'acc-216',
        code: '216-01-001',
        name: 'Retenciones de ISR por Pagar',
        satGroupCode: '216.04',
        periodCredits: 1000
      })
    ];

    const diffSummary = computePayrollPeriodSummary({
      cfdis,
      trialBalance: tbDiff,
      ejercicio: 2026,
      periodo: 10
    });
    expect(diffSummary.amarreStatus).toBe('DIFERENCIA');
    expect(diffSummary.diferenciaIsrAmarre).toBe(250.4);

    const emptySummary = computePayrollPeriodSummary({
      cfdis: [],
      trialBalance: [],
      ejercicio: 2026,
      periodo: 10
    });
    expect(emptySummary.nominaCount).toBe(0);
    expect(emptySummary.amarreStatus).toBe('SIN_NOMINA');
  });

  test('4. Calcula provisión SUA + ISN Estatal y genera póliza cuadrada al centavo (Debe = Haber)', () => {
    const result = computeSuaAndIsnProvision(
      {
        ejercicio: 2026,
        periodo: 10,
        stateCode: 'BCN', // 4.25%
        baseGravableNomina: 12345.67, // 12345.67 * 4.25% = 524.690975 -> 524.69
        imssPatronal: 1850.33,
        rcv: 642.18,
        infonavit: 617.28
      },
      catalog
    );

    expect(result.stateCode).toBe('BCN');
    expect(result.tasaIsnPct).toBe(4.25);
    expect(result.isnEstatal).toBe(524.69);
    expect(result.totalSuaPatronal).toBe(3109.79);
    expect(result.totalProvision).toBe(3634.48);
    expect(result.isBalanced).toBe(true);
    expect(result.polizaTipo).toBe('DIARIO');
    expect(result.totalCargos).toBe(3634.48);
    expect(result.totalAbonos).toBe(3634.48);

    const cargosCents = sumCents(result.polizaMovements.map((m) => m.cargo));
    const abonosCents = sumCents(result.polizaMovements.map((m) => m.abono));
    expect(cargosCents).toBe(toCents(3634.48));
    expect(cargosCents).toBe(abonosCents);
  });

  test('5. Lanza AccountingInvariantError si la provisión es $0.00 o el estado ISN es inválido', () => {
    expect(() =>
      computeSuaAndIsnProvision(
        {
          ejercicio: 2026,
          periodo: 10,
          stateCode: 'XYZ',
          baseGravableNomina: 10000,
          imssPatronal: 0,
          rcv: 0,
          infonavit: 0
        },
        catalog
      )
    ).toThrow(AccountingInvariantError);

    expect(() =>
      computeSuaAndIsnProvision(
        {
          ejercicio: 2026,
          periodo: 10,
          stateCode: 'CMX',
          baseGravableNomina: 0,
          imssPatronal: 0,
          rcv: 0,
          infonavit: 0
        },
        catalog
      )
    ).toThrow(AccountingInvariantError);
  });
});
