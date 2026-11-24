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

  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})(?:\s.*)?$/.exec(clean);
  if (dmyMatch) {
    const rawYear = dmyMatch[3] ?? '';
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    const parsed = toValidIsoDate(year, Number(dmyMatch[2]), Number(dmyMatch[1]));
    if (parsed) return parsed;
  }

  const dMonYMatch = /^(\d{1,2})[-/\s]([a-zA-Z]{3,})[-/\s](\d{2}|\d{4})(?:\s.*)?$/.exec(clean);
  if (dMonYMatch) {
    const monKey = (dMonYMatch[2] ?? '').slice(0, 3).toLowerCase();
    const month = MONTH_MAP[monKey];
    const rawYear = dMonYMatch[3] ?? '';
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    if (month) {
      const parsed = toValidIsoDate(year, month, Number(dMonYMatch[1]));
      if (parsed) return parsed;
    }
  }

  return fallbackDate;
}

/**
 * Divide una fila CSV respetando campos entrecomillados RFC-4180 (ej. `"SPEI, S.A.", "$1,250.00"`).
 * NASA Power of 10 - Regla 2 (H-07, H-10): Bucle acotado por longitud máxima de línea.
 */
export function splitCsvLine(line: string, delimiter: ',' | ';' | '\t' = ','): string[] {
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
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function detectCsvDelimiter(sampleLine: string): ',' | ';' | '\t' {
  let commas = 0;
  let semicolons = 0;
  let tabs = 0;
  let inQuotes = false;
  for (let i = 0; i < sampleLine.length; i += 1) {
    const ch = sampleLine[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === ',') commas += 1;
      else if (ch === ';') semicolons += 1;
      else if (ch === '\t') tabs += 1;
    }
  }
  if (tabs >= commas && tabs >= semicolons && tabs > 0) return '\t';
  return semicolons > commas ? ';' : ',';
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
  let clean = val.trim();
  const isParensNegative = /^\(.*\)$/.test(clean);
  if (isParensNegative) clean = clean.slice(1, -1);
  clean = clean.replace(/[$,\s]|mxn/gi, '');
  if (!clean || clean === '-') return 0;
  const num = Number(clean);
  if (!Number.isFinite(num)) return 0;
  const signed = isParensNegative ? -Math.abs(num) : num;
  return Number(signed.toFixed(2));
}

function normalizeHeaderToken(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .trim();
}

interface BankCsvColumnMap {
  fechaIdx: number;
  refIdx: number;
  descIdx: number;
  cargoIdx: number;
  abonoIdx: number;
  montoIdx: number;
}

function buildHeaderColumnMap(headerCols: string[]): BankCsvColumnMap | null {
  if (headerCols.length < 3) return null;
  const norm = headerCols.map(normalizeHeaderToken);
  const findIdx = (re: RegExp) => norm.findIndex((h) => re.test(h));
  const fechaIdx = findIdx(/\b(fecha|date|fec)\b/);
  const refIdx = findIdx(/\b(ref|referencia|folio|docto|documento|clave|autorizacion|cheque|operacion)\b/);
  const descIdx = findIdx(/\b(concepto|descripcion|detalle|movimiento|leyenda|narrativa)\b/);
  const cargoIdx = findIdx(/\b(cargo|cargos|retiro|retiros|debito|egreso|salida)\b/);
  const abonoIdx = findIdx(/\b(abono|abonos|deposito|depositos|credito|ingreso|entrada)\b/);
  const montoIdx = findIdx(/\b(monto|importe|cantidad|valor)\b/);

  const hasAmountOrDesc = cargoIdx >= 0 || abonoIdx >= 0 || montoIdx >= 0 || descIdx >= 0;
  if (fechaIdx < 0 || !hasAmountOrDesc) return null;

  return {
    fechaIdx,
    refIdx,
    descIdx: descIdx >= 0 ? descIdx : refIdx,
    cargoIdx,
    abonoIdx,
    montoIdx
  };
}

function buildSignedAmountRow(
  fecha: string,
  referencia: string,
  descripcion: string,
  rawAmount: number
): ParsedBankStatementRow | null {
  if (rawAmount === 0) return null;
  return {
    fecha,
    referencia,
    descripcion,
    cargoBanco: rawAmount < 0 ? Math.abs(rawAmount) : 0,
    abonoBanco: rawAmount > 0 ? rawAmount : 0
  };
}

/**
 * H-10 (Power of 10 Regla 2):
 * Parsea un estado de cuenta bancario CSV respetando comillas RFC-4180, punto y coma, signos negativos `(1,250.00)`
 * y encabezados bancarios mexicanos de 3 a 6 columnas (incluyendo `Fecha, Concepto, Cargo, Abono, Saldo`).
 */
export function parseBankStatementCsv(
  csvText: string,
  fallbackDate: string,
  maxRows: number = SAFETY_BOUNDS.MAX_CSV_ROWS
): ParsedBankStatementRow[] {
  const rawLines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (rawLines.length === 0) return [];

  const scanLimit = Math.min(rawLines.length, 25);
  let delimiter: ',' | ';' | '\t' = detectCsvDelimiter(rawLines[0] ?? '');
  let colMap: BankCsvColumnMap | null = null;
  let startIdx = 0;

  for (let idx = 0; idx < scanLimit; idx += 1) {
    const line = rawLines[idx]!;
    const candDelim = detectCsvDelimiter(line);
    const cols = splitCsvLine(line, candDelim);
    const candMap = buildHeaderColumnMap(cols);
    if (candMap) {
      delimiter = candDelim;
      colMap = candMap;
      startIdx = idx + 1;
      break;
    }
  }

  if (!colMap) {
    for (let idx = 0; idx < scanLimit; idx += 1) {
      const line = rawLines[idx]!;
      const candDelim = detectCsvDelimiter(line);
      const cols = splitCsvLine(line, candDelim);
      if (cols.length >= 3 && parseBankCsvDate(cols[0], '') !== '') {
        delimiter = candDelim;
        startIdx = idx;
        break;
      }
    }
  }

  const upperBound = Math.min(rawLines.length, startIdx + maxRows);
  const parsed: ParsedBankStatementRow[] = [];

  for (let i = startIdx; i < upperBound; i += 1) {
    const row = rawLines[i];
    if (!row) continue;
    const cols = splitCsvLine(row, delimiter);
    if (cols.length < 3) continue;

    if (colMap) {
      const fecha = parseBankCsvDate(cols[colMap.fechaIdx], fallbackDate);
      const descripcion = (colMap.descIdx >= 0 ? cols[colMap.descIdx] : '') || `Movimiento importado CSV #${i}`;
      const referencia = (colMap.refIdx >= 0 ? cols[colMap.refIdx] : '') || `CSV-${100 + i}`;

      if (colMap.cargoIdx >= 0 || colMap.abonoIdx >= 0) {
        const cargoBanco = colMap.cargoIdx >= 0 ? Math.abs(parseCleanMoney(cols[colMap.cargoIdx])) : 0;
        const abonoBanco = colMap.abonoIdx >= 0 ? Math.abs(parseCleanMoney(cols[colMap.abonoIdx])) : 0;
        if (cargoBanco > 0 || abonoBanco > 0) {
          parsed.push({ fecha, referencia, descripcion, cargoBanco, abonoBanco });
        }
      } else if (colMap.montoIdx >= 0) {
        const item = buildSignedAmountRow(fecha, referencia, descripcion, parseCleanMoney(cols[colMap.montoIdx]));
        if (item) parsed.push(item);
      }
      continue;
    }

    const fecha = parseBankCsvDate(cols[0], fallbackDate);
    if (cols.length >= 5) {
      const cargoBanco = Math.abs(parseCleanMoney(cols[3]));
      const abonoBanco = Math.abs(parseCleanMoney(cols[4]));
      if (cargoBanco > 0 || abonoBanco > 0) {
        parsed.push({
          fecha,
          referencia: cols[1] || `CSV-${100 + i}`,
          descripcion: cols[2] || `Movimiento importado CSV #${i}`,
          cargoBanco,
          abonoBanco
        });
      }
    } else if (cols.length === 4) {
      const item = buildSignedAmountRow(
        fecha,
        cols[1] || `CSV-${100 + i}`,
        cols[2] || `Movimiento importado CSV #${i}`,
        parseCleanMoney(cols[3])
      );
      if (item) parsed.push(item);
    } else {
      const item = buildSignedAmountRow(
        fecha,
        `CSV-${100 + i}`,
        cols[1] || `Movimiento importado CSV #${i}`,
        parseCleanMoney(cols[2])
      );
      if (item) parsed.push(item);
    }
  }

  return parsed;
}
