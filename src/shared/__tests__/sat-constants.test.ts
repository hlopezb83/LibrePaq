import { describe, expect, test } from 'bun:test';
import {
  FISCAL_ACCOUNT_ROLES,
  MESES_SAT,
  REGIMENES_FISCALES_SAT,
  SAFETY_BOUNDS,
  SAT_GROUP_CODES
} from '../sat-constants';

describe('sat-constants — Catalogs & Safety Bounds Invariants', () => {
  test('SAFETY_BOUNDS defines strictly positive bounds according to NASA Power of 10 rules', () => {
    expect(SAFETY_BOUNDS.MAX_XML_CONCEPTOS).toBeGreaterThan(0);
    expect(SAFETY_BOUNDS.MAX_XML_TAGS).toBeGreaterThan(0);
    expect(SAFETY_BOUNDS.MAX_CSV_ROWS).toBeGreaterThan(0);
    expect(SAFETY_BOUNDS.MAX_CSV_LINE_LENGTH).toBeGreaterThan(0);
    expect(SAFETY_BOUNDS.MAX_BATCH_CFDI).toBeGreaterThan(0);
    expect(SAFETY_BOUNDS.MAX_ACCOUNT_LEVEL).toBe(5);
    expect(SAFETY_BOUNDS.MAX_POLIZA_MOVEMENTS).toBeGreaterThan(0);
  });

  test('MESES_SAT contains all 13 official SAT accounting periods', () => {
    expect(MESES_SAT).toHaveLength(13);
    expect(MESES_SAT[0]?.periodo).toBe(1);
    expect(MESES_SAT[0]?.nombre).toBe('Enero');
    expect(MESES_SAT[11]?.periodo).toBe(12);
    expect(MESES_SAT[11]?.nombre).toBe('Diciembre');
    expect(MESES_SAT[12]?.periodo).toBe(13);
    expect(MESES_SAT[12]?.nombre).toContain('Cierre');
  });

  test('REGIMENES_FISCALES_SAT includes General PM, Personas Fisicas and RESICO', () => {
    expect(REGIMENES_FISCALES_SAT.length).toBeGreaterThanOrEqual(5);
    expect(REGIMENES_FISCALES_SAT.some((r) => r.startsWith('601'))).toBe(true);
    expect(REGIMENES_FISCALES_SAT.some((r) => r.startsWith('612'))).toBe(true);
    expect(REGIMENES_FISCALES_SAT.some((r) => r.startsWith('626'))).toBe(true);
  });

  test('SAT_GROUP_CODES has consistent types and natures', () => {
    expect(SAT_GROUP_CODES.length).toBeGreaterThan(30);
    for (const item of SAT_GROUP_CODES) {
      expect(['ACTIVO', 'PASIVO', 'CAPITAL', 'INGRESOS', 'COSTOS', 'GASTOS']).toContain(
        item.type
      );
      expect(['DEUDORA', 'ACREEDORA']).toContain(item.nature);
      expect(item.code.length).toBeGreaterThan(0);
      expect(item.name.length).toBeGreaterThan(0);
    }
  });

  test('FISCAL_ACCOUNT_ROLES contains all required fiscal mapping keys', () => {
    expect(FISCAL_ACCOUNT_ROLES.BANCO_PRINCIPAL.code).toBe('102-01-001');
    expect(FISCAL_ACCOUNT_ROLES.CLIENTES_NACIONALES.code).toBe('105-01-099');
    expect(FISCAL_ACCOUNT_ROLES.PROVEEDORES_NACIONALES.code).toBe('201-01-099');
    expect(FISCAL_ACCOUNT_ROLES.IVA_TRASLADADO_COBRADO.code).toBe('208-01-001');
    expect(FISCAL_ACCOUNT_ROLES.IVA_ACREDITABLE_PAGADO.code).toBe('118-01-001');
    expect(FISCAL_ACCOUNT_ROLES.ISR_RETENIDO_POR_PAGAR.code).toBe('216-01-001');
    expect(FISCAL_ACCOUNT_ROLES.IVA_RETENIDO_POR_PAGAR.code).toBe('216-01-002');
  });
});
