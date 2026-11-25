import type { CustomInpcEntry } from './types';

/**
 * Catálogo Oficial Histórico del Índice Nacional de Precios al Consumidor (INPC)
 * Publicado por el INEGI en el Diario Oficial de la Federación (DOF).
 * Base: Segunda quincena de julio de 2018 = 100 puntos.
 *
 * Fundamento Fiscal: Artículos 20 y 31 de la Ley del Impuesto sobre la Renta (LISR).
 */

export const OFFICIAL_INPC_TABLE: Record<number, Record<number, number>> = {
  2015: {
    1: 87.110, 2: 87.275, 3: 87.631, 4: 87.404, 5: 86.967, 6: 87.113,
    7: 87.241, 8: 87.425, 9: 87.752, 10: 88.204, 11: 88.685, 12: 89.047
  },
  2016: {
    1: 89.386, 2: 89.778, 3: 89.910, 4: 89.625, 5: 89.226, 6: 89.324,
    7: 89.557, 8: 89.809, 9: 90.358, 10: 90.906, 11: 91.617, 12: 92.039
  },
  2017: {
    1: 93.604, 2: 94.145, 3: 94.722, 4: 94.839, 5: 94.725, 6: 94.964,
    7: 95.323, 8: 95.794, 9: 96.094, 10: 96.698, 11: 97.695, 12: 98.273
  },
  2018: {
    1: 98.795, 2: 99.171, 3: 99.492, 4: 99.155, 5: 98.994, 6: 99.376,
    7: 99.909, 8: 100.492, 9: 100.917, 10: 101.440, 11: 102.303, 12: 103.020
  },
  2019: {
    1: 103.108, 2: 103.079, 3: 103.476, 4: 103.531, 5: 103.233, 6: 103.299,
    7: 103.687, 8: 103.670, 9: 103.942, 10: 104.503, 11: 105.346, 12: 105.934
  },
  2020: {
    1: 106.248, 2: 106.683, 3: 106.628, 4: 105.547, 5: 105.952, 6: 106.539,
    7: 107.244, 8: 107.667, 9: 108.341, 10: 108.995, 11: 109.851, 12: 110.270
  },
  2021: {
    1: 111.215, 2: 111.911, 3: 112.836, 4: 113.208, 5: 113.432, 6: 114.032,
    7: 114.685, 8: 114.908, 9: 115.619, 10: 116.593, 11: 117.922, 12: 118.346
  },
  2022: {
    1: 119.043, 2: 119.986, 3: 121.173, 4: 121.826, 5: 122.049, 6: 123.084,
    7: 124.004, 8: 124.871, 9: 125.647, 10: 126.368, 11: 127.098, 12: 127.578
  },
  2023: {
    1: 128.441, 2: 129.162, 3: 129.507, 4: 129.479, 5: 129.196, 6: 129.327,
    7: 129.951, 8: 130.669, 9: 131.253, 10: 131.758, 11: 132.602, 12: 133.298
  },
  2024: {
    1: 133.555, 2: 133.681, 3: 134.065, 4: 134.336, 5: 134.087, 6: 134.594,
    7: 136.003, 8: 136.013, 9: 136.080, 10: 136.828, 11: 137.424, 12: 137.949
  },
  2025: {
    1: 138.343, 2: 138.726, 3: 139.161, 4: 139.620, 5: 140.012, 6: 140.405,
    7: 140.780, 8: 140.867, 9: 141.197, 10: 141.708, 11: 142.645, 12: 143.042
  },
  2026: {
    1: 143.588, 2: 144.307, 3: 145.544, 4: 145.831, 5: 145.527, 6: 145.131,
    7: 145.169, 8: 145.462, 9: 146.075, 10: 147.026
  }
};

/**
 * Tipos de cambio oficiales de cierre mensual publicados por el Banco de México en el DOF.
 * Solo incluye cifras publicadas (sin proyecciones sintéticas).
 */
export const OFFICIAL_DOF_EXCHANGE_RATES: Record<number, Record<number, number>> = {
  2023: {
    1: 18.7735, 2: 18.3970, 3: 18.0201, 4: 18.0002, 5: 17.6890, 6: 17.1342,
    7: 16.7410, 8: 16.7405, 9: 17.6210, 10: 18.0450, 11: 17.3890, 12: 16.9666
  },
  2024: {
    1: 17.1425, 2: 17.0540, 3: 16.7022, 4: 17.1250, 5: 16.9680, 6: 18.2862,
    7: 18.6015, 8: 19.7212, 9: 19.6921, 10: 20.0315, 11: 20.4510, 12: 20.3540
  },
  2025: {
    1: 20.4520
  }
};

type CustomInpcLike = Pick<CustomInpcEntry, 'year' | 'month' | 'inpcValue'>;

/**
 * Retorna el último INPC oficial publicado en el catálogo (o el personalizado más reciente).
 */
export function getLatestPublishedInpc(customEntries?: ReadonlyArray<CustomInpcLike>): number {
  let bestKey = -1;
  let bestVal: number | null = null;
  for (const [yStr, monthsObj] of Object.entries(OFFICIAL_INPC_TABLE)) {
    const yr = Number(yStr);
    for (const [mStr, val] of Object.entries(monthsObj ?? {})) {
      const key = yr * 100 + Number(mStr);
      if (key > bestKey && Number.isFinite(val)) {
        bestKey = key;
        bestVal = val;
      }
    }
  }
  for (const ce of customEntries ?? []) {
    const key = ce.year * 100 + ce.month;
    if (key >= bestKey && ce.inpcValue > 0) {
      bestKey = key;
      bestVal = ce.inpcValue;
    }
  }
  return bestVal ?? 143.042;
}

/**
 * Obtiene el INPC oficial (o personalizado si existe captura manual) para un año y mes específico.
 */
export function getOfficialInpc(
  year: number,
  month: number,
  customEntries?: ReadonlyArray<CustomInpcLike>
): number | null {
  const m = Math.max(1, Math.min(12, month));
  const custom = customEntries?.find((c) => c.year === year && c.month === m && c.inpcValue > 0);
  if (custom) return custom.inpcValue;
  const yearData = OFFICIAL_INPC_TABLE[year];
  if (!yearData) return null;
  return yearData[m] ?? null;
}

/**
 * Obtiene el INPC correspondiente a una fecha ISO (YYYY-MM-DD).
 * Soporta serie histórica oficial 2015–2026 y entradas manuales personalizadas.
 */
export function getInpcForIsoDate(
  isoDate: string,
  customEntries?: ReadonlyArray<CustomInpcLike>
): number {
  if (!isoDate || isoDate.length < 7) {
    return getLatestPublishedInpc(customEntries);
  }
  const parts = isoDate.split('-');
  const year = parseInt(parts[0] ?? '2024', 10);
  const month = parseInt(parts[1] ?? '1', 10);

  const found = getOfficialInpc(year, month, customEntries);
  if (found !== null) return found;

  if (year < 2015) return OFFICIAL_INPC_TABLE[2015]?.[1] ?? 87.110;
  return getLatestPublishedInpc(customEntries);
}

/**
 * Calcula el INPC del último mes de la primera mitad del periodo en que el bien
 * haya sido utilizado en el ejercicio (Art. 31 LISR).
 */
export function getInpcMedioPeriodo(
  fiscalYear: number,
  fiscalMonth: number = 6,
  customEntries?: ReadonlyArray<CustomInpcLike>
): number {
  const targetYear = Math.max(2015, Math.min(2030, fiscalYear));
  const targetMonth = Math.max(1, Math.min(12, fiscalMonth));
  const found = getOfficialInpc(targetYear, targetMonth, customEntries);
  return found ?? getLatestPublishedInpc(customEntries);
}

/**
 * Calcula el factor de actualización conforme al Artículo 31 LISR:
 * Factor = INPC Mes Medio Periodo / INPC Mes Adquisición
 * Truncado a 4 decimales. Si es menor a 1, se toma 1.0000.
 */
export function calculateInpcFactor(inpcAdquisicion: number, inpcMedioPeriodo: number): number {
  if (!inpcAdquisicion || inpcAdquisicion <= 0 || !inpcMedioPeriodo || inpcMedioPeriodo <= 0) {
    return 1.0;
  }
  if (inpcMedioPeriodo < inpcAdquisicion) {
    return 1.0;
  }
  const rawFactor = inpcMedioPeriodo / inpcAdquisicion;
  return Math.floor(rawFactor * 10000) / 10000;
}

/**
 * Obtiene el tipo de cambio FIX / DOF oficial de cierre mensual publicado (sin proyecciones sintéticas).
 */
export function getOfficialDofExchangeRate(year: number, month: number): number {
  const m = Math.max(1, Math.min(12, month));
  const yearData = OFFICIAL_DOF_EXCHANGE_RATES[year];
  if (yearData && yearData[m]) {
    return yearData[m];
  }
  if (year < 2023) return 18.0;
  return 20.4520;
}
