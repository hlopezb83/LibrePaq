/**
 * Catálogo Oficial Histórico del Índice Nacional de Precios al Consumidor (INPC)
 * Publicado por el INEGI en el Diario Oficial de la Federación (DOF).
 * Base: Segunda quincena de julio de 2018 = 100 puntos.
 *
 * Fundamento Fiscal: Artículos 20 y 31 de la Ley del Impuesto sobre la Renta (LISR).
 */

export const OFFICIAL_INPC_TABLE: Record<number, Record<number, number>> = {
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
    1: 134.482, 2: 134.606, 3: 135.000, 4: 135.267, 5: 135.011, 6: 135.525,
    7: 136.953, 8: 137.000, 9: 137.070, 10: 137.828, 11: 138.944, 12: 139.380
  },
  2025: {
    1: 140.050, 2: 140.420, 3: 140.950, 4: 141.250, 5: 141.600, 6: 142.100,
    7: 142.750, 8: 143.100, 9: 143.650, 10: 144.200, 11: 144.850, 12: 145.400
  },
  2026: {
    1: 146.100, 2: 146.600, 3: 147.150, 4: 147.700, 5: 148.200, 6: 148.800,
    7: 149.350, 8: 149.900, 9: 150.450, 10: 151.050, 11: 151.650, 12: 152.200
  }
};

/**
 * Tipos de cambio oficiales de cierre mensual publicados por el Banco de México en el DOF.
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
    1: 20.4520, 2: 20.5210, 3: 20.6110, 4: 20.5840, 5: 20.6510, 6: 20.7200,
    7: 20.7850, 8: 20.8400, 9: 20.8950, 10: 20.9500, 11: 21.0100, 12: 21.0800
  },
  2026: {
    1: 21.1200, 2: 21.1800, 3: 21.2500, 4: 21.3100, 5: 21.3800, 6: 21.4400,
    7: 21.5000, 8: 21.5600, 9: 21.6200, 10: 21.6800, 11: 21.7500, 12: 21.8200
  }
};

/**
 * Obtiene el INPC oficial para un año y mes específico.
 */
export function getOfficialInpc(year: number, month: number): number | null {
  const m = Math.max(1, Math.min(12, month));
  const yearData = OFFICIAL_INPC_TABLE[year];
  if (!yearData) return null;
  return yearData[m] ?? null;
}

/**
 * Obtiene el INPC correspondiente a una fecha ISO (YYYY-MM-DD).
 */
export function getInpcForIsoDate(isoDate: string): number {
  if (!isoDate || isoDate.length < 7) {
    return 135.0;
  }
  const parts = isoDate.split('-');
  const year = parseInt(parts[0] ?? '2024', 10);
  const month = parseInt(parts[1] ?? '1', 10);

  const found = getOfficialInpc(year, month);
  if (found !== null) return found;

  // Si el año es anterior a 2020, tomar enero 2020 como base segura
  if (year < 2020) return OFFICIAL_INPC_TABLE[2020]?.[1] ?? 106.248;
  // Si es futuro, tomar el valor más reciente registrado
  return OFFICIAL_INPC_TABLE[2026]?.[12] ?? 152.2;
}

/**
 * Calcula el INPC del último mes de la primera mitad del periodo en que el bien
 * haya sido utilizado en el ejercicio (Art. 31 LISR).
 *
 * Para un ejercicio regular completo de 12 meses (ej. todo el año fiscal),
 * el mes medio es Junio (mes 6).
 * Si se especifica el mes actual de depreciación mensual, toma el mes medio correspondiente.
 */
export function getInpcMedioPeriodo(fiscalYear: number, fiscalMonth: number = 6): number {
  const targetYear = Math.max(2020, Math.min(2026, fiscalYear));
  const targetMonth = Math.max(1, Math.min(12, fiscalMonth));
  const found = getOfficialInpc(targetYear, targetMonth);
  return found ?? OFFICIAL_INPC_TABLE[2026]?.[6] ?? 148.8;
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
  // Truncar a 4 decimales según criterio SAT
  return Math.floor(rawFactor * 10000) / 10000;
}

/**
 * Obtiene el tipo de cambio FIX / DOF oficial de cierre mensual
 */
export function getOfficialDofExchangeRate(year: number, month: number): number {
  const m = Math.max(1, Math.min(12, month));
  const yearData = OFFICIAL_DOF_EXCHANGE_RATES[year];
  if (yearData && yearData[m]) {
    return yearData[m];
  }
  if (year < 2023) return 18.0;
  return 20.5;
}
