/**
 * Utilidades deterministas de fechas calendario (sin desfase de huso horario UTC-6)
 * y neutralización de inyección de fórmulas en hojas de cálculo (CWE-1236).
 */

export interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
  isoDate: string;
}

/**
 * Extrae año, mes (1..12) y día (1..31) directamente de una cadena ISO (YYYY-MM-DD...)
 * sin instanciar `new Date("YYYY-MM-01")`, evitando que la medianoche UTC retroceda
 * al día/mes/año anterior en zonas horarias al oeste de UTC (ej. América/Ciudad de México UTC-6).
 */
export function parseCalendarDate(
  dateStr: string | null | undefined,
  fallbackYear = 2026,
  fallbackMonth = 10
): CalendarDateParts {
  const clean = (dateStr ?? '').trim();
  const match = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(clean);
  if (match) {
    const rawYear = Number.parseInt(match[1] ?? '', 10);
    const rawMonth = Number.parseInt(match[2] ?? '', 10);
    const rawDay = match[3] ? Number.parseInt(match[3], 10) : 1;

    const year = rawYear >= 1990 && rawYear <= 2100 ? rawYear : fallbackYear;
    const month = rawMonth >= 1 && rawMonth <= 12 ? rawMonth : fallbackMonth;
    const maxDay = new Date(year, month, 0).getDate();
    const day = Math.max(1, Math.min(maxDay, Number.isFinite(rawDay) ? rawDay : 1));

    return {
      year,
      month,
      day,
      isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    };
  }

  const safeYear = fallbackYear >= 1990 && fallbackYear <= 2100 ? fallbackYear : 2026;
  const safeMonth = fallbackMonth >= 1 && fallbackMonth <= 12 ? fallbackMonth : 10;
  return {
    year: safeYear,
    month: safeMonth,
    day: 1,
    isoDate: `${safeYear}-${String(safeMonth).padStart(2, '0')}-01`
  };
}

/**
 * Determina el ejercicio y periodo contable de una póliza respetando el Mes 13 (Ajuste/Cierre Anual).
 */
export function resolvePolizaYearPeriod(
  fecha: string,
  explicitPeriodo?: number | null,
  fallbackYear = 2026,
  fallbackMonth = 10
): { ejercicio: number; periodo: number; isoDate: string } {
  const parts = parseCalendarDate(fecha, fallbackYear, fallbackMonth);
  if (explicitPeriodo === 13) {
    return {
      ejercicio: parts.year,
      periodo: 13,
      isoDate: parts.isoDate
    };
  }
  return {
    ejercicio: parts.year,
    periodo: parts.month,
    isoDate: parts.isoDate
  };
}

export const MEXICO_TIMEZONE = 'America/Mexico_City';

const MEXICO_PARTS_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: MEXICO_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

function getMexicoDateParts(date: Date = new Date()): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
} {
  const parts = MEXICO_PARTS_FORMATTER.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute')
  };
}

/**
 * Retorna la fecha calendario actual en horario oficial de México (America/Mexico_City) en formato YYYY-MM-DD.
 */
export function getTodayLocalIso(now: Date = new Date()): string {
  const { year, month, day } = getMexicoDateParts(now);
  return `${year}-${month}-${day}`;
}

/**
 * Retorna el ejercicio y periodo fiscal actual en horario oficial de México (America/Mexico_City).
 */
export function getCurrentFiscalPeriod(now: Date = new Date()): { year: number; period: number } {
  const { year, month } = getMexicoDateParts(now);
  return {
    year: Number.parseInt(year, 10),
    period: Number.parseInt(month, 10)
  };
}

/**
 * Neutraliza vectores de Formula Injection (CWE-1236) en textos exportados a CSV o Excel
 * provenientes de XMLs externos (conceptos, nombres comerciales, referencias), preservando números legítimos.
 */
export function sanitizeSpreadsheetText(value: string): string {
  if (!value) return '';
  const trimmed = value.trimStart();
  if (!trimmed) return value;
  const firstChar = trimmed[0];
  if (
    firstChar === '=' ||
    firstChar === '+' ||
    firstChar === '-' ||
    firstChar === '@' ||
    firstChar === '\t' ||
    firstChar === '\r' ||
    firstChar === '\n'
  ) {
    if (/^[+-]?\d+(?:\.\d+)?$/.test(trimmed.trimEnd())) {
      return value;
    }
    return `'${value}`;
  }
  return value;
}

/**
 * Calcula la fecha de vencimiento fiscal del Día 17 del SAT según el Art. 12 del CFF.
 * Si el día 17 cae en sábado o domingo, se recorre al siguiente día hábil (lunes).
 */
export function calculateDia17Deadline(year: number, period: number): {
  date: Date;
  isoDate: string;
  formattedSpanish: string;
} {
  const clampedPeriod = Math.max(1, Math.min(12, Math.floor(period || 1)));
  const nextMonthIndex = clampedPeriod;
  const nextYear = clampedPeriod === 12 ? year + 1 : year;
  const targetDate = new Date(nextYear, nextMonthIndex % 12, 17);
  const dayOfWeek = targetDate.getDay();
  if (dayOfWeek === 6) {
    targetDate.setDate(19);
  } else if (dayOfWeek === 0) {
    targetDate.setDate(18);
  }
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const d = String(targetDate.getDate()).padStart(2, '0');
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const y = targetDate.getFullYear();
  return {
    date: targetDate,
    isoDate: `${y}-${m}-${d}`,
    formattedSpanish: `${targetDate.getDate()} de ${meses[targetDate.getMonth()]} de ${y}`
  };
}

/**
 * Retorna el primer día calendario del ejercicio y periodo contable (YYYY-MM-01).
 */
export function getFirstDateForPeriod(year?: number | null, period?: number | null): string {
  const safeYear = year && year >= 2000 && year <= 2100 ? year : 2026;
  const normalizedMonth =
    period && period >= 1 && period <= 12 ? period : period === 13 ? 12 : 10;
  const monthStr = String(normalizedMonth).padStart(2, '0');
  return `${safeYear}-${monthStr}-01`;
}

/**
 * Retorna el último día calendario del ejercicio y periodo contable (YYYY-MM-DD),
 * calculando con precisión años bisiestos y meses de 28, 29, 30 o 31 días.
 */
export function getLastDateForPeriod(year?: number | null, period?: number | null): string {
  const safeYear = year && year >= 2000 && year <= 2100 ? year : 2026;
  const normalizedMonth =
    period && period >= 1 && period <= 12 ? period : period === 13 ? 12 : 10;
  const monthStr = String(normalizedMonth).padStart(2, '0');
  const lastDay = new Date(safeYear, normalizedMonth, 0).getDate();
  return `${safeYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Retorna la fecha de cierre del periodo contable activo (YYYY-MM-DD).
 */
export function getDefaultDateForPeriod(year?: number | null, period?: number | null): string {
  return getLastDateForPeriod(year, period);
}

/**
 * Formatea la leyenda de fecha de corte para Balance General / Dossier (maneja Mes 13).
 */
export function formatBalanceCutoffLabel(
  year: number,
  period: number,
  mesNombre: string
): string {
  if (period === 13) {
    return `Al 31 de Diciembre de ${year} (Cierre Mes 13)`;
  }
  const clamped = Math.min(12, Math.max(1, period || 1));
  const lastDay = new Date(year, clamped, 0).getDate();
  return `Al ${String(lastDay).padStart(2, '0')} de ${mesNombre} de ${year}`;
}

/**
 * Formatea la leyenda de rango acumulado para Estado de Resultados Integral (maneja Mes 13).
 */
export function formatIncomePeriodLabel(
  year: number,
  period: number,
  mesNombre: string
): string {
  if (period === 13) {
    return `Del 01 de Enero al 31 de Diciembre de ${year} (Cierre Mes 13)`;
  }
  const clamped = Math.min(12, Math.max(1, period || 1));
  const lastDay = new Date(year, clamped, 0).getDate();
  return `Del 01 de Enero al ${String(lastDay).padStart(2, '0')} de ${mesNombre} de ${year}`;
}
