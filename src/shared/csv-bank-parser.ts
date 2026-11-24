import { SAFETY_BOUNDS } from './sat-constants';

const MONTH_MAP: Readonly<Record<string, number>> = {
  ene: 1, jan: 1,
  feb: 2,
  mar: 3,
  abr: 4, apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8, aug: 8,
  sep: 9, set: 9,
  oct: 10,
  nov: 11,
  dic: 12, dec: 12
};

function toValidIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Normaliza fechas bancarias comunes en México:
 * `YYYY-MM-DD`, `YYYY/MM/DD`, `DD/MM/YYYY`, `DD-MM-YYYY`, `DD/MMM/YYYY`, `DD-MMM-YYYY`.
 */
export function parseBankCsvDate(raw: string | undefined, fallbackDate: string): string {
  const clean = (raw ?? '').trim().replace(/^["']|["']$/g, '');
  if (!clean) return fallbackDate;

  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/.exec(clean);
  if (isoMatch) {
    const parsed = toValidIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    if (parsed) return parsed;
  }

  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s.*)?$/.exec(clean);
  if (dmyMatch) {
    const parsed = toValidIsoDate(Number(dmyMatch[3]), Number(dmyMatch[2]), Number(dmyMatch[1]));
    if (parsed) return parsed;
  }

  const dMonYMatch = /^(\d{1,2})[-/\s]([a-zA-Z]{3,})[-/\s](\d{4})(?:\s.*)?$/.exec(clean);
  if (dMonYMatch) {
    const monKey = (dMonYMatch[2] ?? '').slice(0, 3).toLowerCase();
    const month = MONTH_MAP[monKey];
    if (month) {
      const parsed = toValidIsoDate(Number(dMonYMatch[3]), month, Number(dMonYMatch[1]));
      if (parsed) return parsed;
    }
  }

  return fallbackDate;
}

/**
 * Divide una fila CSV respetando campos entrecomillados RFC-4180 (ej. `"SPEI, S.A.", "$1,250.00"`).
 * NASA Power of 10 - Regla 2 (H-07, H-10): Bucle acotado por longitud máxima de línea.
 */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  const maxLen = Math.min(line.length, SAFETY_BOUNDS.MAX_CSV_LINE_LENGTH);

  for (let i = 0; i < maxLen; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export interface ParsedBankStatementRow {
  fecha: string;
  referencia: string;
  descripcion: string;
  cargoBanco: number;
  abonoBanco: number;
}

function parseCleanMoney(val: string | undefined): number {
  if (!val) return 0;
  const num = Number(val.replace(/[$,\s]/g, ''));
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
}

/**
 * H-10 (Power of 10 Regla 2):
 * Parsea un estado de cuenta bancario CSV respetando comillas RFC-4180, signos de pesos y comas de miles.
 * Soporta formato de 5 columnas (Fecha, Referencia, Descripción, Cargo, Abono) y 4 columnas.
 */
export function parseBankStatementCsv(
  csvText: string,
  fallbackDate: string,
  maxRows: number = SAFETY_BOUNDS.MAX_CSV_ROWS
): ParsedBankStatementRow[] {
  const rawLines = csvText
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (rawLines.length === 0) return [];

  const firstLower = (rawLines[0] ?? '').toLowerCase();
  const startIdx =
    firstLower.includes('fecha') ||
    firstLower.includes('date') ||
    firstLower.includes('concepto') ||
    firstLower.includes('cargo')
      ? 1
      : 0;

  const upperBound = Math.min(rawLines.length, startIdx + maxRows);
  const parsed: ParsedBankStatementRow[] = [];

  for (let i = startIdx; i < upperBound; i += 1) {
    const row = rawLines[i];
    if (!row) continue;
    const cols = splitCsvLine(row);
    if (cols.length < 3) continue;

    const fecha = parseBankCsvDate(cols[0], fallbackDate);

    if (cols.length >= 5) {
      const referencia = cols[1] || `CSV-${100 + i}`;
      const descripcion = cols[2] || `Movimiento importado CSV #${i}`;
      const cargoBanco = Math.abs(parseCleanMoney(cols[3]));
      const abonoBanco = Math.abs(parseCleanMoney(cols[4]));
      if (cargoBanco > 0 || abonoBanco > 0) {
        parsed.push({ fecha, referencia, descripcion, cargoBanco, abonoBanco });
      }
    } else {
      const referencia = cols[1] || `CSV-${100 + i}`;
      const descripcion = cols[2] || `Movimiento importado CSV #${i}`;
      const rawAmount = parseCleanMoney(cols[3]);
      if (rawAmount !== 0) {
        parsed.push({
          fecha,
          referencia,
          descripcion,
          cargoBanco: rawAmount < 0 ? Math.abs(rawAmount) : 0,
          abonoBanco: rawAmount > 0 ? rawAmount : 0
        });
      }
    }
  }

  return parsed;
}
