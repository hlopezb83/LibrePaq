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

/**
 * Retorna la fecha calendario local actual en formato YYYY-MM-DD (sin salto a día siguiente tras las 18:00 CST).
 */
export function getTodayLocalIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentFiscalPeriod(): { year: number; period: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    period: now.getMonth() + 1
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
  const nextMonthIndex = period;
  const nextYear = period === 12 ? year + 1 : year;
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
