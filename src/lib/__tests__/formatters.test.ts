import { describe, expect, test } from 'bun:test';
import {
  formatCurrency,
  formatShortDate,
  getDefaultDateForPeriod,
  parseBankStatementCsv,
  splitCsvLine
} from '../formatters';

describe('formatters — Currency and Date Utilities', () => {
  test('formatCurrency correctly formats Mexican Pesos with $ and 2 decimals', () => {
    const formatted = formatCurrency(1234.5);
    expect(formatted).toContain('1,234.50');
    expect(formatCurrency(0)).toContain('0.00');
    expect(formatCurrency(null)).toContain('0.00');
    expect(formatCurrency(undefined)).toContain('0.00');
  });

  test('formatShortDate formats YYYY-MM-DD into human readable Spanish date', () => {
    expect(formatShortDate('2026-10-15')).toBe('15 Oct 2026');
    expect(formatShortDate('2026-01-01')).toBe('01 Ene 2026');
    expect(formatShortDate('2026-12-31')).toBe('31 Dic 2026');
    expect(formatShortDate('')).toBe('');
    expect(formatShortDate('invalid')).toBe('invalid');
  });

  test('getDefaultDateForPeriod calculates safe default dates within financial year/period', () => {
    expect(getDefaultDateForPeriod(2026, 10)).toBe('2026-10-31');
    expect(getDefaultDateForPeriod(2025, 3)).toBe('2025-03-31');
    expect(getDefaultDateForPeriod(2026, 2)).toBe('2026-02-28');
    expect(getDefaultDateForPeriod(2024, 2)).toBe('2024-02-29'); // Bisiesto
    expect(getDefaultDateForPeriod(2026, 4)).toBe('2026-04-30');
    // Period 13 (Ajuste Anual / Cierre) defaults to December 31
    expect(getDefaultDateForPeriod(2026, 13)).toBe('2026-12-31');
    // Fallback on null or out-of-range bounds
    expect(getDefaultDateForPeriod(null, null)).toBe('2026-10-31');
    expect(getDefaultDateForPeriod(1800, 99)).toBe('2026-10-31');
  });
});

describe('formatters — CSV Parsing & Bank Import', () => {
  test('splitCsvLine correctly handles RFC-4180 quotes, escaped quotes and empty cells', () => {
    const row = 'A,"B, with comma","C with ""quotes""",D,,F';
    const cells = splitCsvLine(row);
    expect(cells).toEqual([
      'A',
      'B, with comma',
      'C with "quotes"',
      'D',
      '',
      'F'
    ]);
  });

  test('parseBankStatementCsv parses 5-column CSV statements (Fecha, Ref, Desc, Cargo, Abono)', () => {
    const csv = [
      'Fecha,Referencia,Concepto,Cargo,Abono',
      '2026-10-01,REF-001,PAGO SERVICIOS,1500.00,0',
      '2026-10-02,REF-002,DEPOSITO CLIENTE,0,"$12,500.00"'
    ].join('\n');

    const result = parseBankStatementCsv(csv, '2026-10-15');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      fecha: '2026-10-01',
      referencia: 'REF-001',
      descripcion: 'PAGO SERVICIOS',
      cargoBanco: 1500,
      abonoBanco: 0
    });
    expect(result[1]).toEqual({
      fecha: '2026-10-02',
      referencia: 'REF-002',
      descripcion: 'DEPOSITO CLIENTE',
      cargoBanco: 0,
      abonoBanco: 12500
    });
  });

  test('parseBankStatementCsv parses 4-column CSV with signed single Amount column', () => {
    const csv = [
      'Fecha,Referencia,Concepto,Monto',
      '2026-10-05,SPEI-1,VENTA MOSTRADOR,4500.50',
      '2026-10-06,SPEI-2,COMISION BANCARIA,-348.00'
    ].join('\n');

    const result = parseBankStatementCsv(csv, '2026-10-15');
    expect(result).toHaveLength(2);
    expect(result[0]?.cargoBanco).toBe(0);
    expect(result[0]?.abonoBanco).toBe(4500.50);
    expect(result[1]?.cargoBanco).toBe(348);
    expect(result[1]?.abonoBanco).toBe(0);
  });

  test('parseBankStatementCsv gracefully handles empty or invalid lines', () => {
    expect(parseBankStatementCsv('', '2026-10-15')).toEqual([]);
    expect(parseBankStatementCsv('   \n  \n', '2026-10-15')).toEqual([]);
  });
});
