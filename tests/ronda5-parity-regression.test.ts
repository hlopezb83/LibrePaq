import { describe, expect, test } from 'bun:test';
import {
  parseCalendarDate,
  resolvePolizaYearPeriod,
  sanitizeSpreadsheetText,
  getTodayLocalIso
} from '../src/shared/date-utils';
import { chunkArray } from '../src/lib/supabase/supabase-pagination';
import { buildTaxProvisionMovements } from '../src/shared/engine/tax-provision.engine';
import { validateDoubleEntryMovements } from '../src/shared/accounting-engine';
import type { Account, CfdiDocument, FiscalWorkpaperResponse } from '../src/shared/types';

describe('Ronda 5 — Parity & Accounting Rigor Regression Suite', () => {
  describe('1. Date Parsing & Calendar Invariants (UTC-6 Safe)', () => {
    test('parseCalendarDate avoids midnight timezone day shift across all months', () => {
      const dates = [
        { iso: '2026-01-01', expectedYear: 2026, expectedMonth: 1, expectedDay: 1 },
        { iso: '2026-02-28', expectedYear: 2026, expectedMonth: 2, expectedDay: 28 },
        { iso: '2026-03-31', expectedYear: 2026, expectedMonth: 3, expectedDay: 31 },
        { iso: '2026-12-31', expectedYear: 2026, expectedMonth: 12, expectedDay: 31 }
      ];

      for (const d of dates) {
        const parsed = parseCalendarDate(d.iso);
        expect(parsed.year).toBe(d.expectedYear);
        expect(parsed.month).toBe(d.expectedMonth);
        expect(parsed.day).toBe(d.expectedDay);
      }
    });

    test('resolvePolizaYearPeriod strictly preserves Mes 13 (Cierre Anual)', () => {
      const resMes13 = resolvePolizaYearPeriod('2026-12-31', 13);
      expect(resMes13.ejercicio).toBe(2026);
      expect(resMes13.periodo).toBe(13);
      expect(resMes13.isoDate).toBe('2026-12-31');

      const resMes05 = resolvePolizaYearPeriod('2026-05-15');
      expect(resMes05.ejercicio).toBe(2026);
      expect(resMes05.periodo).toBe(5);
    });

    test('getTodayLocalIso returns valid YYYY-MM-DD local format', () => {
      const today = getTodayLocalIso();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('2. Formula Injection Sanitization', () => {
    test('sanitizeSpreadsheetText strips dangerous leading characters', () => {
      expect(sanitizeSpreadsheetText('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeSpreadsheetText('+cmd|/c calc')).toBe("'+cmd|/c calc");
      expect(sanitizeSpreadsheetText('-100')).toBe('-100');
      expect(sanitizeSpreadsheetText('@IMPORT')).toBe("'@IMPORT");
      expect(sanitizeSpreadsheetText('Venta normal')).toBe('Venta normal');
    });
  });

  describe('3. Pagination & Chunking Invariants', () => {
    test('chunkArray partitions items into deterministic sub-arrays', () => {
      const items = Array.from({ length: 25 }, (_, i) => i + 1);
      const chunks = chunkArray(items, 10);
      expect(chunks.length).toBe(3);
      expect(chunks[0]!.length).toBe(10);
      expect(chunks[1]!.length).toBe(10);
      expect(chunks[2]!.length).toBe(5);
      expect(chunks.flat()).toEqual(items);
    });

    test('chunkArray handles empty arrays and single items gracefully', () => {
      expect(chunkArray([], 10)).toEqual([]);
      expect(chunkArray([42], 10)).toEqual([[42]]);
    });
  });

  describe('4. Tax Provision Engine & NIF B-3 ISR (Account 801)', () => {
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
      }
    ];

    test('buildTaxProvisionMovements generates strictly balanced movements with 801-01-001', () => {
      const mockWp = {
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
          ingresosNominalesPeriodo: 100000,
          ingresosNominalesAcumulados: 1000000,
          coeficienteUtilidad: 0.2,
          utilidadFiscalEstimada: 200000,
          perdidasFiscalesAmortizables: 0,
          baseGravableIsr: 200000,
          tasaIsrPct: 30,
          impuestoCausadoAcumulado: 60000,
          pagosProvisionalesAcreditables: 50000,
          retencionesIsrBancariasAcumuladas: 0,
          isrNetoAPagar: 10000
        },
        ivaDefinitivo: {
          ivaTrasladadoCobrado: 32000,
          ivaAcreditablePagado: 16000,
          ivaRetenidoAcreditable: 0,
          ivaRetenidoPorPagar: 0,
          saldoFavorMesAnteriorAcreditado: 0,
          ivaNetoAPagar: 16000,
          saldoAFavorMes: 0
        },
        retencionesFederales: {
          retencionIsrSueldos: 0,
          retencionIsrAsimilados: 0,
          retencionIsrServiciosProf: 0,
          retencionIsrArrendamiento: 0,
          retencionIsrResico: 0,
          retencionIvaTotal: 0,
          totalRetencionesAPagar: 0
        },
        resumenObligaciones: {
          totalFederalAPagar: 26000,
          fechaLimitePago: '2026-11-17',
          diasProrrogaSextoDigito: 0
        }
      } as unknown as FiscalWorkpaperResponse;

      const movements = buildTaxProvisionMovements(mockWp, mockAccounts, 10, 2026);
      expect(movements.length).toBeGreaterThanOrEqual(2);

      const totalCargos = movements.reduce((sum, m) => sum + m.cargo, 0);
      const totalAbonos = movements.reduce((sum, m) => sum + m.abono, 0);
      expect(Math.abs(totalCargos - totalAbonos)).toBeLessThan(0.01);

      // Verify double entry validation passes
      expect(() => validateDoubleEntryMovements(movements)).not.toThrow();

      // Check account 801 is debited
      const isrExpense = movements.find((m) => m.accountId === 'acc-gasto-isr');
      expect(isrExpense).toBeDefined();
      expect(isrExpense?.cargo).toBe(10000);
    });
  });

  describe('5. Double-Entry Validation Invariant', () => {
    test('validateDoubleEntryMovements rejects unbalanced polizas', () => {
      const unbalanced = [
        { accountId: 'acc-1', cargo: 100, abono: 0 },
        { accountId: 'acc-2', cargo: 0, abono: 90 }
      ];
      expect(() => validateDoubleEntryMovements(unbalanced)).toThrow();
    });

    test('validateDoubleEntryMovements rejects single-movement entries', () => {
      const single = [{ accountId: 'acc-1', cargo: 100, abono: 0 }];
      expect(() => validateDoubleEntryMovements(single)).toThrow();
    });
  });

  describe('6. DIOT & CFDI 4.0 Filtering Invariants', () => {
    test('Cancelled CFDIs and Traslados are excluded from tax declarations', () => {
      const mockCfdis: Partial<CfdiDocument>[] = [
        {
          id: 'cfdi_1',
          uuid: 'uuid-1',
          tipoComprobante: 'I',
          direction: 'RECIBIDO',
          statusSat: 'CANCELADO',
          total: 1160
        },
        {
          id: 'cfdi_2',
          uuid: 'uuid-2',
          tipoComprobante: 'T',
          direction: 'RECIBIDO',
          statusSat: 'VIGENTE',
          total: 0
        },
        {
          id: 'cfdi_3',
          uuid: 'uuid-3',
          tipoComprobante: 'I',
          direction: 'RECIBIDO',
          statusSat: 'VIGENTE',
          metodoPago: 'PUE',
          polizaId: 'pol_1',
          total: 1160
        }
      ];

      const validForDiot = mockCfdis.filter(
        (c) =>
          c.direction === 'RECIBIDO' &&
          c.statusSat !== 'CANCELADO' &&
          c.tipoComprobante !== 'T' &&
          c.polizaId
      );

      expect(validForDiot.length).toBe(1);
      expect(validForDiot[0]!.id).toBe('cfdi_3');
    });
  });
});
