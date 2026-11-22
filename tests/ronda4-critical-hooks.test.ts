import { describe, expect, test } from 'bun:test';
import {
  fromCents,
  sumCents,
  validateDoubleEntryMovements,
  validateRfcModulo11
} from '../src/shared/accounting-engine';
import { parseBankStatementCsv, splitCsvLine } from '../src/shared/csv-bank-parser';

describe('Ronda 4 Remediation — Critical Engines & Hook Invariants', () => {
  describe('1. Company Onboarding & RFC Modulo 11 Invariants', () => {
    test('strictly validates Persona Moral and Persona Física check digits', () => {
      // Known valid RFCs
      const pm = validateRfcModulo11('BBA830831LJ2');
      expect(pm.isValidCheckDigit).toBe(true);
      expect(pm.expectedCheckDigit).toBe('2');

      const pf = validateRfcModulo11('GODE561231GR8');
      expect(pf.isValidCheckDigit).toBe(true);
    });

    test('detects check digit mismatch and calculates correct replacement', () => {
      // Invalidate last char
      const mismatched = validateRfcModulo11('BBA830831LJ0');
      expect(mismatched.isValidCheckDigit).toBe(false);
      expect(mismatched.expectedCheckDigit).toBe('2');
      expect(mismatched.actualCheckDigit).toBe('0');
    });

    test('generates strictly balanced opening journal entry from bank balance', () => {
      const initialBalanceMxn = 150000.75;
      const movements = [
        {
          accountId: 'acc-banco',
          referencia: 'APERTURA',
          concepto: 'Apertura de cuenta BBVA Bancomer',
          cargo: initialBalanceMxn,
          abono: 0
        },
        {
          accountId: 'acc-capital',
          referencia: 'APERTURA',
          concepto: 'Capital Social Fijo',
          cargo: 0,
          abono: initialBalanceMxn
        }
      ];

      const isValid = validateDoubleEntryMovements(movements);
      expect(isValid.totalCargo).toBe(150000.75);
      expect(isValid.totalAbono).toBe(150000.75);
      expect(isValid.totalCargo - isValid.totalAbono).toBe(0);
    });
  });

  describe('2. Draft Movements & Auto-Balancing Logic', () => {
    test('computes exact cent differences without floating point drift', () => {
      const cargos = [100.10, 200.20, 300.30];
      const abonos = [600.60];

      const cargosCents = sumCents(cargos);
      const abonosCents = sumCents(abonos);
      expect(cargosCents).toBe(60060);
      expect(abonosCents).toBe(60060);
      expect(cargosCents - abonosCents).toBe(0);
      expect(fromCents(cargosCents - abonosCents)).toBe(0);
    });

    test('calculates exact difference when unbalance occurs', () => {
      const cargos = [1250.55];
      const abonos = [1000.00];

      const diffCents = sumCents(cargos) - sumCents(abonos);
      expect(diffCents).toBe(25055);
      expect(fromCents(diffCents)).toBe(250.55);
    });
  });

  describe('3. CSV Banking Parser (RFC-4180)', () => {
    test('parses quoted cells with commas and quotes correctly', () => {
      const line = '2026-10-15,"TRANSFERENCIA INTERBANCARIA, S.A.",SPEI-001,"$15,400.50","$0.00"';
      const cols = splitCsvLine(line);
      expect(cols.length).toBe(5);
      expect(cols[1]).toBe('TRANSFERENCIA INTERBANCARIA, S.A.');
      expect(cols[3]).toBe('$15,400.50');
    });

    test('parses bank statement text into typed statement rows', () => {
      const csv = `Fecha,Referencia,Concepto,Cargo,Abono
2026-10-01,REF-01,"PAGO PROVEEDOR, S.A.","$2,500.00","$0.00"
2026-10-02,REF-02,COBRO CLIENTE,"$0.00","$8,500.00"`;

      const rows = parseBankStatementCsv(csv, '2026-10-01');
      expect(rows.length).toBe(2);
      expect(rows[0]?.cargoBanco).toBe(2500);
      expect(rows[0]?.abonoBanco).toBe(0);
      expect(rows[1]?.cargoBanco).toBe(0);
      expect(rows[1]?.abonoBanco).toBe(8500);
    });
  });
});
