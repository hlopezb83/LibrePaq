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
  it('contains historical INPC series from 2020 through 2026', () => {
    for (let year = 2020; year <= 2026; year++) {
      expect(OFFICIAL_INPC_TABLE[year]).toBeDefined();
      for (let m = 1; m <= 12; m++) {
        expect(OFFICIAL_INPC_TABLE[year]![m]).toBeGreaterThan(100);
      }
    }
  });

  it('retrieves specific monthly INPC correctly', () => {
    // Mayo 2024
    const inpcMay24 = getOfficialInpc(2024, 5);
    expect(inpcMay24).toBe(135.011);

    // Junio 2022
    const inpcJun22 = getOfficialInpc(2022, 6);
    expect(inpcJun22).toBe(123.084);

    // Mes fuera de rango
    expect(getOfficialInpc(1999, 1)).toBeNull();
  });

  it('resolves INPC by ISO date', () => {
    expect(getInpcForIsoDate('2024-05-18')).toBe(135.011);
    expect(getInpcForIsoDate('2023-12-01')).toBe(133.298);
    expect(getInpcForIsoDate('2021-01-15')).toBe(111.215);
  });

  it('calculates INPC factor according to Art. 31 LISR criteria', () => {
    // Adquisición Mayo 2023 (129.196), Uso Junio 2024 (135.525)
    // 135.525 / 129.196 = 1.048987... -> 1.0489
    const factor = calculateInpcFactor(129.196, 135.525);
    expect(factor).toBe(1.0489);

    // Si el INPC medio periodo es menor o igual, el factor no puede ser menor a 1.0000
    const factorFlat = calculateInpcFactor(140.0, 135.0);
    expect(factorFlat).toBe(1.0);

    // Manejo de ceros o valores inválidos
    expect(calculateInpcFactor(0, 135)).toBe(1.0);
    expect(calculateInpcFactor(135, 0)).toBe(1.0);
  });

  it('resolves INPC medio de periodo for fiscal year', () => {
    // Por defecto mes 6 (Junio)
    expect(getInpcMedioPeriodo(2024)).toBe(135.525);
    // Mes específico (ej. Octubre)
    expect(getInpcMedioPeriodo(2024, 10)).toBe(137.828);
  });

  it('provides official DOF closing exchange rates', () => {
    expect(getOfficialDofExchangeRate(2023, 12)).toBe(16.9666);
    expect(getOfficialDofExchangeRate(2024, 12)).toBe(20.3540);
    expect(getOfficialDofExchangeRate(2025, 1)).toBe(20.4520);
  });
});
