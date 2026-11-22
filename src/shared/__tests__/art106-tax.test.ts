import { describe, expect, it } from 'bun:test';
import { calculateArt106PfIsr } from '../engine/art106-tax.engine';
import { toCents } from '../accounting-engine';

describe('Art. 106 LISR — Tarifa Progresiva Acumulada para Personas Físicas', () => {
  it('determina impuesto en cero para base gravable nula o negativa', () => {
    expect(calculateArt106PfIsr(0, 1)).toEqual({ isrCents: 0, effectiveRatePct: 0 });
    expect(calculateArt106PfIsr(-10000, 5)).toEqual({ isrCents: 0, effectiveRatePct: 0 });
  });

  it('calcula correctamente el ISR en el primer tramo (hasta $746.04) para mes 1', () => {
    // Base de $500.00 en mes 1: tasa 1.92%, cuota 0
    const baseCents = toCents(500);
    const result = calculateArt106PfIsr(baseCents, 1);
    // 500 * 0.0192 = 9.60 MXN = 960 centavos
    expect(result.isrCents).toBe(960);
    expect(result.effectiveRatePct).toBe(1.92);
  });

  it('escala los tramos progresivamente según el mes del ejercicio (Art. 106 LISR)', () => {
    // Base de $10,000 en mes 1 (Enero) vs mes 6 (Junio)
    const baseCents = toCents(10000);
    const resMes1 = calculateArt106PfIsr(baseCents, 1);
    const resMes6 = calculateArt106PfIsr(baseCents, 6);

    // En mes 6, el tramo 1 excede $746.04 * 6 = $4,476.24, y tramo 2 es hasta $6,332.05 * 6 = $37,992.30
    // Por ende, la tasa efectiva en mes 6 es significativamente menor que en mes 1
    expect(resMes6.isrCents).toBeLessThan(resMes1.isrCents);
    expect(resMes6.effectiveRatePct).toBeLessThan(resMes1.effectiveRatePct);
  });

  it('aplica la cuota fija y porcentaje sobre excedente en tramos superiores', () => {
    // Base de $50,000 en mes 1
    const baseCents = toCents(50000);
    const res = calculateArt106PfIsr(baseCents, 1);
    expect(res.isrCents).toBeGreaterThan(0);
    expect(res.effectiveRatePct).toBeGreaterThan(15);
    expect(res.effectiveRatePct).toBeLessThan(35);
  });
});
