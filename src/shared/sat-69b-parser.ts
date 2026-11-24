import type { Efos69BStatus } from './types';

export interface Sat69BRecord {
  rfc: string;
  nombre: string;
  situacion: 'PRESUNTO' | 'DEFINITIVO' | 'DESVIRTUADO' | 'FAVORABLE';
  status: Efos69BStatus;
  fechaOficio?: string;
  publicacionDof?: string;
}

export interface Sat69BParseResult {
  records: Map<string, Sat69BRecord>;
  total: number;
  presuntos: number;
  definitivos: number;
  desvirtuados: number;
  favorables: number;
}

/**
 * Decodifica bytes del CSV oficial del SAT Art. 69-B preservando caracteres Ñ/acentos
 * cuando el archivo viene codificado en Windows-1252 / ISO-8859-1.
 */
export function decodeSat69BCsvBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function detectUnquotedDelimiter(row: string): ';' | ',' {
  let inQuotes = false;
  let semiCount = 0;
  let commaCount = 0;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ';') semiCount++;
      else if (ch === ',') commaCount++;
    }
  }
  return semiCount > commaCount ? ';' : ',';
}

function parseCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  const delimiter = detectUnquotedDelimiter(row);

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Parsea el archivo CSV oficial del SAT (Listado_Completo_69-B.csv).
 * Soporta delimitadores coma o punto y coma, comillas dobles y saltos de línea.
 */
export function parseSat69BCsv(csvContent: string): Sat69BParseResult {
  const records = new Map<string, Sat69BRecord>();
  let presuntos = 0;
  let definitivos = 0;
  let desvirtuados = 0;
  let favorables = 0;

  const lines = csvContent.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const tokens = parseCsvRow(line);
    if (tokens.length < 3) continue;

    let rfcCandidate = '';
    let nombreCandidate = '';
    let situacionCandidate = '';
    let dofCandidate = '';

    for (let i = 0; i < Math.min(tokens.length, 5); i++) {
      const rawToken = tokens[i];
      if (!rawToken) continue;
      const val = rawToken.trim().toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
      if (/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(val)) {
        rfcCandidate = val;
        nombreCandidate = tokens[i + 1]?.trim() || '';
        situacionCandidate = tokens[i + 2]?.trim().toUpperCase() || '';
        dofCandidate = tokens[i + 5]?.trim() || '';
        break;
      }
    }

    if (!rfcCandidate) continue;

    let situacion: Sat69BRecord['situacion'] = 'PRESUNTO';
    let status: Efos69BStatus = 'PRESUNTO_EFOS';

    if (situacionCandidate.includes('DEFINITIV')) {
      situacion = 'DEFINITIVO';
      status = 'DEFINITIVO_EFOS';
    } else if (situacionCandidate.includes('DESVIRTUAD')) {
      situacion = 'DESVIRTUADO';
      status = 'DESVIRTUADO';
    } else if (situacionCandidate.includes('SENTENCIA') || situacionCandidate.includes('FAVORABLE')) {
      situacion = 'FAVORABLE';
      status = 'LIMPIO';
    } else {
      situacion = 'PRESUNTO';
      status = 'PRESUNTO_EFOS';
    }

    records.set(rfcCandidate, {
      rfc: rfcCandidate,
      nombre: nombreCandidate,
      situacion,
      status,
      publicacionDof: dofCandidate
    });
  }

  for (const rec of records.values()) {
    if (rec.situacion === 'DEFINITIVO') definitivos++;
    else if (rec.situacion === 'DESVIRTUADO') desvirtuados++;
    else if (rec.situacion === 'FAVORABLE') favorables++;
    else presuntos++;
  }

  return {
    records,
    total: records.size,
    presuntos,
    definitivos,
    desvirtuados,
    favorables
  };
}
