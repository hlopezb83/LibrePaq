import { describe, expect, test } from 'bun:test';
import {
  buildExchangeFluctuationMovements,
  buildTaxProvisionMovements
} from '../engine/tax-provision.engine';
import type { Account, FiscalWorkpaperResponse } from '../types';
import { sumCents } from '../engine/invariants-and-math';

describe('Tax Provision Engine — Provisión de Impuestos Federales e IVA Definitivo', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-banco',
      companyId: 'comp-1',
      code: '102-01-001',
      name: 'BBVA Bancomer',
      parentCode: '102-00-000',
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 3,
      isAffectable: true,
      satGroupCode: '102.01',
      currency: 'MXN',
      initialBalance: 100000
    },
    {
      id: 'acc-iva-favor',
      companyId: 'comp-1',
      code: '113-01-001',
      name: 'IVA a Favor',
      parentCode: '113-00-000',
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 3,
      isAffectable: true,
      satGroupCode: '113.01',
      currency: 'MXN',
      initialBalance: 0
    },
    {
      id: 'acc-iva-pagado',
      companyId: 'comp-1',
      code: '118-01-001',
      name: 'IVA Acreditable Pagado',
      parentCode: '118-00-000',
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 3,
      isAffectable: true,
      satGroupCode: '118.01',
      currency: 'MXN',
      initialBalance: 0
    },
    {
      id: 'acc-iva-cobrado',
      companyId: 'comp-1',
      code: '208-01-001',
      name: 'IVA Trasladado Cobrado',
      parentCode: '208-00-000',
      type: 'PASIVO',
      nature: 'ACREEDORA',
      level: 3,
      isAffectable: true,
      satGroupCode: '208.01',
      currency: 'MXN',
      initialBalance: 0
    },
    {
      id: 'acc-iva-pagar',
      companyId: 'comp-1',
      code: '213-01-001',
      name: 'IVA por Pagar SAT',
      parentCode: '213-00-000',
      type: 'PASIVO',
      nature: 'ACREEDORA',
      level: 3,
      isAffectable: true,
      satGroupCode: '213.01',
      currency: 'MXN',
      initialBalance: 0
    },
    {
      id: 'acc-isr-pagar',
      companyId: 'comp-1',
      code: '213-01-002',
      name: 'ISR Provisional por Pagar SAT',
      parentCode: '213-00-000',
      type: 'PASIVO',
      nature: 'ACREEDORA',
      level: 3,
      isAffectable: true,
      satGroupCode: '213.03',
      currency: 'MXN',
      initialBalance: 0
    },
    {
      id: 'acc-gasto-isr',
      companyId: 'comp-1',
      code: '801-01-001',
      name: 'Impuesto a la Utilidad del Ejercicio (No Deducible)',
      parentCode: '801-00-000',
      type: 'GASTOS',
      nature: 'DEUDORA',
      level: 3,
      isAffectable: true,
      satGroupCode: '801.01',
      currency: 'MXN',
      initialBalance: 0
    },
    {
      id: 'acc-util-camb',
      companyId: 'comp-1',
      code: '702-01-001',
      name: 'Utilidad Cambiaria',
      parentCode: '702-00-000',
      type: 'INGRESOS',
      nature: 'ACREEDORA',
      level: 3,
      isAffectable: true,
      satGroupCode: '702.01',
      currency: 'MXN',
      initialBalance: 0
    },
    {
      id: 'acc-perd-camb',
      companyId: 'comp-1',
      code: '701-01-001',
      name: 'Pérdida Cambiaria',
      parentCode: '701-00-000',
      type: 'GASTOS',
      nature: 'DEUDORA',
      level: 3,
      isAffectable: true,
      satGroupCode: '701.01',
      currency: 'MXN',
      initialBalance: 0
    }
  ];

  function createMockWorkpaper(overrides?: Partial<FiscalWorkpaperResponse>): FiscalWorkpaperResponse {
    return {
      company: {
        id: 'comp-1',
        name: 'TEST CORP SA DE CV',
        rfc: 'TCO200101AA1',
        regimenFiscal: '601 - General de Ley Personas Morales',
        codigoPostal: '64000',
        maskFormat: 'XXX-XX-XXX',
        currentYear: 2026,
        currentPeriod: 10,
        createdAt: '2026-01-01'
      },
      ejercicio: 2026,
      periodo: 10,
      parameters: {
        companyId: 'comp-1',
        ejercicio: 2026,
        coeficienteUtilidad: 0.2,
        perdidasFiscalesPendientes: 0,
        pagosProvisionalesAnteriores: 0,
        saldoFavorIvaAnterior: 0,
        tipoCambioDofCierre: 20.0
      },
      isrProvisional: {
        regimenClave: '601',
        esResico: false,
        ingresosPeriodo: 100000,
        ingresosAcumuladosEjercicio: 100000,
        deduccionesAutorizadasPeriodo: 50000,
        coeficienteUtilidadAplicado: 0.2,
        utilidadFiscalEstimada: 20000,
        perdidasFiscalesAplicadas: 0,
        baseGravableIsr: 20000,
        tasaIsrPct: 30,
        isrCausado: 6000,
        pagosProvisionalesPrevios: 0,
        isrRetenidoPeriodo: 0,
        isrNetoAPagar: 6000
      },
      ivaDefinitivo: {
        actosGravadosCobrado16: 100000,
        ivaTrasladadoCobrado: 16000,
        ivaAcreditablePagado: 10000,
        ivaRetenidoPorPagar: 0,
        saldoFavorIvaAcreditable: 0,
        ivaNetoAPagar: 6000,
        saldoFavorIvaRemanente: 0
      },
      fluctuacionCambiaria: {
        cfdisUsdCount: 1,
        saldoMonedaExtranjeraUsd: 1000,
        tipoCambioPromedioRegistro: 19.5,
        tipoCambioDofCierre: 20.0,
        valuacionLibrosMxn: 19500,
        valuacionCierreDofMxn: 20000,
        diferenciaCambiariaMxn: 500,
        tipoDiferencia: 'UTILIDAD_CAMBIARIA'
      },
      resumenLineaCapturaSat: {
        isrProvisionalAPagar: 6000,
        ivaDefinitivoAPagar: 6000,
        retencionesIsrPorEnterar: 0,
        retencionesIvaPorEnterar: 0,
        totalEstimadoDia17: 12000
      },
      ...overrides
    };
  }

  test('1. Provisión de ISR carga a Gasto por Impuestos No Deducible (801-01-001) y abona a ISR por Pagar (213-01-002)', () => {
    const wp = createMockWorkpaper();
    const movements = buildTaxProvisionMovements(wp, mockAccounts, 10, 2026);

    // Debe existir cargo a 801-01-001 (no a 601-01-003)
    const isrDebit = movements.find((m) => m.cargo > 0 && m.accountCode === '801-01-001');
    expect(isrDebit).toBeDefined();
    expect(isrDebit?.cargo).toBe(6000);
    expect(isrDebit?.concepto).toContain('No Deducible Art. 28 LISR');

    // Debe existir abono a 213-01-002
    const isrCredit = movements.find((m) => m.abono > 0 && m.accountCode === '213-01-002');
    expect(isrCredit).toBeDefined();
    expect(isrCredit?.abono).toBe(6000);
  });

  test('2. Liquidación mensual de IVA por pagar: cancela 208-01-001, acredita 118-01-001 y abona 213-01-001', () => {
    const wp = createMockWorkpaper();
    const movements = buildTaxProvisionMovements(wp, mockAccounts, 10, 2026);

    const ivaMovements = movements.filter((m) => m.referencia === 'IVA-M10');
    // Cargo IVA Cobrado: 16,000
    const cargoCobrado = ivaMovements.find((m) => m.accountCode === '208-01-001');
    expect(cargoCobrado?.cargo).toBe(16000);

    // Abono IVA Pagado: 10,000
    const abonoPagado = ivaMovements.find((m) => m.accountCode === '118-01-001');
    expect(abonoPagado?.abono).toBe(10000);

    // Abono IVA por Pagar: 6,000
    const abonoPagar = ivaMovements.find((m) => m.accountCode === '213-01-001');
    expect(abonoPagar?.abono).toBe(6000);

    // Verificación de cuadre estricto de partida doble
    const totalCargo = sumCents(ivaMovements.map((m) => m.cargo));
    const totalAbono = sumCents(ivaMovements.map((m) => m.abono));
    expect(totalCargo).toBe(totalAbono);
  });

  test('3. Liquidación mensual de IVA con Saldo a Favor: debita 113-01-001 (IVA a Favor) y es estrictamente cuadrada', () => {
    const wpFavor = createMockWorkpaper({
      ivaDefinitivo: {
        actosGravadosCobrado16: 50000,
        ivaTrasladadoCobrado: 8000,
        ivaAcreditablePagado: 15000,
        ivaRetenidoPorPagar: 0,
        saldoFavorIvaAcreditable: 0,
        ivaNetoAPagar: 0,
        saldoFavorIvaRemanente: 7000
      }
    });

    const movements = buildTaxProvisionMovements(wpFavor, mockAccounts, 10, 2026);
    const ivaMovements = movements.filter((m) => m.referencia === 'IVA-M10');

    // Cargo a IVA Cobrado: 8,000
    const cargoCobrado = ivaMovements.find((m) => m.accountCode === '208-01-001');
    expect(cargoCobrado?.cargo).toBe(8000);

    // Cargo a IVA a Favor: 7,000
    const cargoFavor = ivaMovements.find((m) => m.accountCode === '113-01-001');
    expect(cargoFavor?.cargo).toBe(7000);

    // Abono a IVA Pagado: 15,000
    const abonoPagado = ivaMovements.find((m) => m.accountCode === '118-01-001');
    expect(abonoPagado?.abono).toBe(15000);

    // Cuadre exacto: 8,000 + 7,000 = 15,000
    const totalCargo = sumCents(ivaMovements.map((m) => m.cargo));
    const totalAbono = sumCents(ivaMovements.map((m) => m.abono));
    expect(totalCargo).toBe(1500000);
    expect(totalAbono).toBe(1500000);
    expect(totalCargo).toBe(totalAbono);
  });

  test('4. Fluctuación cambiaria genera póliza de utilidad cambiaria devengada', () => {
    const wp = createMockWorkpaper();
    const result = buildExchangeFluctuationMovements(wp, mockAccounts);

    expect(result.concept).toContain('T.C. DOF $20.0000');
    expect(result.movements).toHaveLength(2);
    expect(result.movements[0]?.accountCode).toBe('102-01-001');
    expect(result.movements[0]?.cargo).toBe(500);
    expect(result.movements[1]?.accountCode).toBe('702-01-001');
    expect(result.movements[1]?.abono).toBe(500);
  });
});
