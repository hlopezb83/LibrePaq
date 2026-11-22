/**
 * Determinación del Pago Provisional de ISR para Personas Físicas con
 * Actividades Empresariales y Profesionales (Art. 106 LISR).
 * Tarifas oficiales Anexo 8 RMF (2023-2025 y actualización inflacionaria Art. 152 LISR 2026+).
 */

interface Art96Bracket {
  readonly limit: number;
  readonly cuota: number;
  readonly pct: number;
}

/** Tarifa mensual base Anexo 8 RMF 2023-2025 (cuotas fijas verificadas al centavo) */
const ART_96_BRACKETS_2025: readonly Art96Bracket[] = [
  { limit: 746.04, cuota: 0.0, pct: 0.0192 },
  { limit: 6332.05, cuota: 14.32, pct: 0.064 },
  { limit: 11128.01, cuota: 371.83, pct: 0.1088 },
  { limit: 12935.82, cuota: 893.63, pct: 0.16 },
  { limit: 15487.71, cuota: 1182.88, pct: 0.1792 },
  { limit: 31236.49, cuota: 1640.18, pct: 0.2136 },
  { limit: 49233.0, cuota: 5004.12, pct: 0.2352 },
  { limit: 93993.9, cuota: 9236.89, pct: 0.3 },
  { limit: 125325.2, cuota: 22665.17, pct: 0.32 },
  { limit: 375975.61, cuota: 32691.18, pct: 0.34 },
  { limit: Infinity, cuota: 117912.32, pct: 0.35 }
];

/** Tarifa mensual actualizada por inflación acumulada >10% (Art. 152 LISR / Anexo 8 RMF 2026, factor 1.1321) */
const ART_96_BRACKETS_2026: readonly Art96Bracket[] = [
  { limit: 844.59, cuota: 0.0, pct: 0.0192 },
  { limit: 7168.51, cuota: 16.22, pct: 0.064 },
  { limit: 12598.02, cuota: 420.95, pct: 0.1088 },
  { limit: 14644.64, cuota: 1011.68, pct: 0.16 },
  { limit: 17533.64, cuota: 1339.14, pct: 0.1792 },
  { limit: 35362.83, cuota: 1856.84, pct: 0.2136 },
  { limit: 55736.68, cuota: 5665.16, pct: 0.2352 },
  { limit: 106410.5, cuota: 10457.09, pct: 0.3 },
  { limit: 141880.66, cuota: 25659.23, pct: 0.32 },
  { limit: 425641.99, cuota: 37009.69, pct: 0.34 },
  { limit: Infinity, cuota: 133488.54, pct: 0.35 }
];

export function calculateArt106PfIsr(
  baseGravableCents: number,
  periodo: number,
  ejercicio = 2025
): { isrCents: number; effectiveRatePct: number } {
  if (baseGravableCents <= 0) return { isrCents: 0, effectiveRatePct: 0 };
  const m = Math.max(1, Math.min(12, periodo));
  const baseMxn = baseGravableCents / 100;
  const brackets = ejercicio >= 2026 ? ART_96_BRACKETS_2026 : ART_96_BRACKETS_2025;

  let prevLimit = 0;
  for (const b of brackets) {
    const curLimit = b.limit === Infinity ? Infinity : Number((b.limit * m).toFixed(2));
    const curCuota = Number((b.cuota * m).toFixed(2));
    if (baseMxn <= curLimit) {
      const excedente = Math.max(0, baseMxn - prevLimit);
      const isrMxn = curCuota + excedente * b.pct;
      const isrCents = Math.round(isrMxn * 100);
      const effectiveRatePct = Number(((isrMxn / baseMxn) * 100).toFixed(2));
      return { isrCents, effectiveRatePct };
    }
    prevLimit = curLimit;
  }
  return { isrCents: Math.round(baseMxn * 0.35 * 100), effectiveRatePct: 35.0 };
}
