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

const STATUS_PRECEDENCE: Readonly<Record<Efos69BStatus, number>> = {
  DEFINITIVO_EFOS: 4,
  PRESUNTO_EFOS: 3,
  DESVIRTUADO: 2,
  LIMPIO: 1
};

const RFC_REGEX = /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/;

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

function detectCsvDelimiter(content: string): ';' | ',' {
  let inQuotes = false;
  let semiCount = 0;
  let commaCount = 0;
  const limit = Math.min(content.length, 4096);
  for (let i = 0; i < limit; i += 1) {
    const ch = content[i];
    if (ch === '"') {
      if (inQuotes && content[i + 1] === '"') i += 1;
      else inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === '\n' && (semiCount > 0 || commaCount > 0)) break;
      if (ch === ';') semiCount += 1;
      else if (ch === ',') commaCount += 1;
    }
  }
  return semiCount > commaCount ? ';' : ',';
}

/**
 * Parsea registros CSV RFC-4180 completos (soportando saltos de línea dentro de campos entrecomillados)
 * ANTES de dividir en filas lógicas.
 */
function parseCsvRecords(csvContent: string): string[][] {
  const clean = csvContent.replace(/^\uFEFF/, '');
  const delimiter = detectCsvDelimiter(clean);
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i]!;
    if (ch === '"') {
      if (inQuotes && clean[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && ch === delimiter) {
      row.push(current.trim());
      current = '';
    } else if (!inQuotes && (ch === '\r' || ch === '\n')) {
      if (ch === '\r' && clean[i + 1] === '\n') i += 1;
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = '';
    } else if (inQuotes && (ch === '\r' || ch === '\n')) {
      if (ch === '\r' && clean[i + 1] === '\n') i += 1;
      current += ' ';
    } else {
      current += ch;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function resolveSituacionAndStatus(
  situacionRaw: string
): { situacion: Sat69BRecord['situacion']; status: Efos69BStatus } | null {
  const upper = situacionRaw.trim().toUpperCase();
  if (!upper) return null;
  if (upper.includes('DEFINITIV')) {
    return { situacion: 'DEFINITIVO', status: 'DEFINITIVO_EFOS' };
  }
  if (upper.includes('DESVIRTUAD')) {
    return { situacion: 'DESVIRTUADO', status: 'DESVIRTUADO' };
  }
  if (upper.includes('SENTENCIA') || upper.includes('FAVORABLE')) {
    return { situacion: 'FAVORABLE', status: 'LIMPIO' };
  }
  if (upper.includes('PRESUNT')) {
    return { situacion: 'PRESUNTO', status: 'PRESUNTO_EFOS' };
  }
  return null;
}

interface Sat69BHeaderColumns {
  dofByStatus: Partial<Record<Sat69BRecord['situacion'], number>>;
  oficioByStatus: Partial<Record<Sat69BRecord['situacion'], number>>;
}

function detectHeaderColumns(tokens: readonly string[]): Sat69BHeaderColumns | null {
  const norm = tokens.map((t) =>
    t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  );
  if (!norm.some((h) => h.includes('rfc')) || !norm.some((h) => h.includes('situacion'))) {
    return null;
  }
  const findCol = (re: RegExp) => {
    const idx = norm.findIndex((h) => re.test(h));
    return idx >= 0 ? idx : undefined;
  };
  return {
    dofByStatus: {
      PRESUNTO: findCol(/publicaci[oó]?n.*dof.*presunt/),
      DESVIRTUADO: findCol(/publicaci[oó]?n.*dof.*desvirtu/),
      DEFINITIVO: findCol(/publicaci[oó]?n.*dof.*definitiv/),
      FAVORABLE: findCol(/publicaci[oó]?n.*dof.*(favorable|sentencia)/)
    },
    oficioByStatus: {
      PRESUNTO: findCol(/oficio.*presunt.*sat/) ?? findCol(/oficio.*presunt/),
      DESVIRTUADO: findCol(/oficio.*desvirtu.*sat/) ?? findCol(/oficio.*desvirtu/),
      DEFINITIVO: findCol(/oficio.*definitiv.*sat/) ?? findCol(/oficio.*definitiv/),
      FAVORABLE: findCol(/oficio.*(favorable|sentencia).*sat/) ?? findCol(/oficio.*(favorable|sentencia)/)
    }
  };
}

function extractDofAndOficio(
  tokens: readonly string[],
  rfcIdx: number,
  situacion: Sat69BRecord['situacion'],
  headerCols: Sat69BHeaderColumns | null
): { publicacionDof: string; fechaOficio?: string } {
  const headerDofIdx = headerCols?.dofByStatus[situacion];
  const headerOficioIdx = headerCols?.oficioByStatus[situacion];
  if (headerDofIdx !== undefined) {
    const dof = tokens[headerDofIdx]?.trim() || '';
    const oficio = headerOficioIdx !== undefined ? tokens[headerOficioIdx]?.trim() : undefined;
    return { publicacionDof: dof, ...(oficio ? { fechaOficio: oficio } : {}) };
  }

  // Layout oficial SAT Listado_Completo_69-B.csv (20 columnas desde rfcIdx)
  if (tokens.length > rfcIdx + 6) {
    const offsetMap: Record<Sat69BRecord['situacion'], { dof: number[]; oficio: number[] }> = {
      PRESUNTO: { dof: [6, 5, 4], oficio: [3, 5] },
      DESVIRTUADO: { dof: [10, 9, 8], oficio: [7, 9] },
      DEFINITIVO: { dof: [14, 13, 12], oficio: [11, 13] },
      FAVORABLE: { dof: [18, 17, 16], oficio: [15, 17] }
    };
    const spec = offsetMap[situacion];
    const dof = spec.dof.map((o) => tokens[rfcIdx + o]?.trim() || '').find(Boolean) || '';
    const oficio = spec.oficio.map((o) => tokens[rfcIdx + o]?.trim() || '').find(Boolean);
    return { publicacionDof: dof, ...(oficio ? { fechaOficio: oficio } : {}) };
  }

  const c4 = tokens[rfcIdx + 4]?.trim() || '';
  const c5 = tokens[rfcIdx + 5]?.trim() || '';
  const c3 = tokens[rfcIdx + 3]?.trim() || '';
  const dof = /\d{2,4}[-/]\d{2}[-/]\d{2,4}/.test(c4) && !c5 ? c4 : c5 || c4;
  return { publicacionDof: dof, ...(c3 ? { fechaOficio: c3 } : {}) };
}

/**
 * Parsea el archivo CSV oficial del SAT (Listado_Completo_69-B.csv).
 * Soporta delimitadores coma o punto y coma, comillas RFC-4180 multi-línea y precedencia oficial.
 */
export function parseSat69BCsv(csvContent: string): Sat69BParseResult {
  const records = new Map<string, Sat69BRecord>();
  const rows = parseCsvRecords(csvContent);
  let headerCols: Sat69BHeaderColumns | null = null;

  for (const tokens of rows) {
    if (!headerCols) {
      const detected = detectHeaderColumns(tokens);
      if (detected) {
        headerCols = detected;
        continue;
      }
    }
    if (tokens.length < 3) continue;

    let rfcIdx = -1;
    let rfcCandidate = '';
    for (let i = 0; i < Math.min(tokens.length, 5); i += 1) {
      const rawToken = tokens[i];
      if (!rawToken) continue;
      const val = rawToken.trim().toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
      if (RFC_REGEX.test(val)) {
        rfcIdx = i;
        rfcCandidate = val;
        break;
      }
    }
    if (!rfcCandidate || rfcIdx < 0) continue;

    const nombreCandidate = tokens[rfcIdx + 1]?.trim() || '';
    const resolvedStatus = resolveSituacionAndStatus(tokens[rfcIdx + 2] ?? '');
    if (!resolvedStatus) continue;

    const prev = records.get(rfcCandidate);
    if (prev && STATUS_PRECEDENCE[prev.status] > STATUS_PRECEDENCE[resolvedStatus.status]) {
      continue;
    }

    const { publicacionDof, fechaOficio } = extractDofAndOficio(
      tokens,
      rfcIdx,
      resolvedStatus.situacion,
      headerCols
    );

    records.set(rfcCandidate, {
      rfc: rfcCandidate,
      nombre: nombreCandidate,
      situacion: resolvedStatus.situacion,
      status: resolvedStatus.status,
      ...(fechaOficio ? { fechaOficio } : {}),
      publicacionDof
    });
  }

  let presuntos = 0;
  let definitivos = 0;
  let desvirtuados = 0;
  let favorables = 0;
  for (const rec of records.values()) {
    if (rec.situacion === 'DEFINITIVO') definitivos += 1;
    else if (rec.situacion === 'DESVIRTUADO') desvirtuados += 1;
    else if (rec.situacion === 'FAVORABLE') favorables += 1;
    else presuntos += 1;
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
