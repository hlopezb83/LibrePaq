import { describe, expect, it } from 'bun:test';
import {
  calculateInpcFactor,
  getInpcForIsoDate,
  getInpcMedioPeriodo,
  getOfficialDofExchangeRate,
  getOfficialInpc,
  OFFICIAL_INPC_TABLE
} from '../sat-inpc-catalog';

describe('SAT INPC & DOF Official Catalog', () => {
  it('contains historical INPC series from 2015 through 2025 and published 2026 months', () => {
    for (let year = 2015; year <= 2025; year++) {
      expect(OFFICIAL_INPC_TABLE[year]).toBeDefined();
      for (let m = 1; m <= 12; m++) {
        expect(OFFICIAL_INPC_TABLE[year]![m]).toBeGreaterThan(80);
      }
    }
    expect(OFFICIAL_INPC_TABLE[2026]).toBeDefined();
    for (let m = 1; m <= 10; m++) {
      expect(OFFICIAL_INPC_TABLE[2026]![m]).toBeGreaterThan(140);
    }
  });

  it('retrieves specific monthly INPC correctly', () => {
    // Mayo 2024 (INEGI oficial)
    const inpcMay24 = getOfficialInpc(2024, 5);
    expect(inpcMay24).toBe(134.087);

    // Diciembre 2024 y Diciembre 2025 (INEGI oficial)
    expect(getOfficialInpc(2024, 12)).toBe(137.949);
    expect(getOfficialInpc(2025, 12)).toBe(143.042);

    // Junio 2022
    const inpcJun22 = getOfficialInpc(2022, 6);
    expect(inpcJun22).toBe(123.084);

    // Mes fuera de rango
    expect(getOfficialInpc(1999, 1)).toBeNull();
  });

  it('resolves INPC by ISO date', () => {
    expect(getInpcForIsoDate('2024-05-18')).toBe(134.087);
    expect(getInpcForIsoDate('2023-12-01')).toBe(133.298);
    expect(getInpcForIsoDate('2021-01-15')).toBe(111.215);
    expect(getInpcForIsoDate('2016-06-15')).toBe(89.324);
  });

  it('calculates INPC factor according to Art. 31 LISR criteria', () => {
    // Adquisición Mayo 2023 (129.196), Uso Junio 2024 (134.594)
    // 134.594 / 129.196 = 1.041781... -> 1.0417
    const factor = calculateInpcFactor(129.196, 134.594);
    expect(factor).toBe(1.0417);

    // Si el INPC medio periodo es menor o igual, el factor no puede ser menor a 1.0000
    const factorFlat = calculateInpcFactor(140.0, 135.0);
    expect(factorFlat).toBe(1.0);

    // Manejo de ceros o valores inválidos
    expect(calculateInpcFactor(0, 135)).toBe(1.0);
    expect(calculateInpcFactor(135, 0)).toBe(1.0);
  });

  it('resolves INPC medio de periodo for fiscal year', () => {
    // Por defecto mes 6 (Junio)
    expect(getInpcMedioPeriodo(2024)).toBe(134.594);
    // Mes específico (ej. Octubre)
    expect(getInpcMedioPeriodo(2024, 10)).toBe(136.828);
  });

  it('provides official DOF closing exchange rates', () => {
    expect(getOfficialDofExchangeRate(2023, 12)).toBe(16.9666);
    expect(getOfficialDofExchangeRate(2024, 12)).toBe(20.3540);
    expect(getOfficialDofExchangeRate(2025, 1)).toBe(20.4520);
  });
});
