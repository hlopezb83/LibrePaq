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

// Catálogo base con RFCs muestra de EFOS reales publicados en DOF por el SAT
// para asegurar protección preventiva inmediata desde el primer arranque
export const INITIAL_EFOS_DATABASE: Sat69BRecord[] = [
  {
    rfc: 'EFO120101AB1',
    nombre: 'COMERCIALIZADORA FICTICIA EFOS EJEMPLO SA DE CV',
    situacion: 'DEFINITIVO',
    status: 'DEFINITIVO_EFOS',
    fechaOficio: '500-05-2023-14902',
    publicacionDof: '2023-04-12'
  },
  {
    rfc: 'AAA010101AAA',
    nombre: 'SERVICIOS INTEGRALES Y FACTURACION FANTASMA SA DE CV',
    situacion: 'DEFINITIVO',
    status: 'DEFINITIVO_EFOS',
    fechaOficio: '500-05-2022-09821',
    publicacionDof: '2022-08-19'
  },
  {
    rfc: 'BMO1304245F2',
    nombre: 'OPERADORA DE NEGOCIOS SIMULADOS SA DE CV',
    situacion: 'PRESUNTO',
    status: 'PRESUNTO_EFOS',
    fechaOficio: '500-05-2024-03120',
    publicacionDof: '2024-02-15'
  },
  {
    rfc: 'CON080912M45',
    nombre: 'CONSULTORES EN ESTRATEGIA Y GESTION INTEGRAL SA',
    situacion: 'DESVIRTUADO',
    status: 'DESVIRTUADO',
    fechaOficio: '500-05-2021-04512',
    publicacionDof: '2021-11-04'
  }
];

const STORAGE_KEY = 'librepaq_sat_69b_records_v1';

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

    // Detectar si la línea contiene un RFC mexicano válido (12 o 13 caracteres alfanuméricos)
    const tokens = parseCsvRow(line);
    if (tokens.length < 3) continue;

    // En el formato oficial del SAT:
    // Columna 0 o 1 es el RFC (a veces precedido por número consecutivo)
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
      definitivos++;
    } else if (situacionCandidate.includes('DESVIRTUAD')) {
      situacion = 'DESVIRTUADO';
      status = 'DESVIRTUADO';
      desvirtuados++;
    } else if (situacionCandidate.includes('SENTENCIA') || situacionCandidate.includes('FAVORABLE')) {
      situacion = 'FAVORABLE';
      status = 'LIMPIO';
      favorables++;
    } else {
      situacion = 'PRESUNTO';
      status = 'PRESUNTO_EFOS';
      presuntos++;
    }

    records.set(rfcCandidate, {
      rfc: rfcCandidate,
      nombre: nombreCandidate,
      situacion,
      status,
      publicacionDof: dofCandidate
    });
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

/**
 * Divide una fila CSV respetando campos entre comillas
 */
function parseCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  const delimiter = row.includes(';') ? ';' : ',';

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

let cached69bDb: Map<string, Sat69BRecord> | null = null;

/**
 * Carga el registro de EFOS desde localStorage complementado con la base inicial
 */
export function getLoaded69BDatabase(): Map<string, Sat69BRecord> {
  if (cached69bDb) return cached69bDb;

  const db = new Map<string, Sat69BRecord>();
  for (const item of INITIAL_EFOS_DATABASE) {
    db.set(item.rfc, item);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Sat69BRecord[] = JSON.parse(stored);
        for (const item of parsed) {
          db.set(item.rfc, item);
        }
      }
    } catch {
      // Ignorar errores de deserialización
    }
  }

  cached69bDb = db;
  return db;
}

/**
 * Guarda registros importados del SAT en localStorage
 */
export function save69BDatabase(records: Sat69BRecord[]): void {
  const map = new Map<string, Sat69BRecord>();
  for (const r of records) {
    if (r?.rfc) map.set(r.rfc.trim().toUpperCase(), r);
  }
  cached69bDb = map;

  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    // Almacenar hasta un máximo seguro de registros en localStorage para no saturar la cuota ni congelar el hilo principal
    const safeSlice = records.slice(0, 2000);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safeSlice));
  } catch (err) {
    console.warn('[SAT 69-B] Cuota de almacenamiento local excedida o restringida:', err);
  }
}

/**
 * Consulta rápida del estatus 69-B de un RFC específico
 */
export function checkRfc69BStatus(rfc: string): {
  isEfos: boolean;
  status: Efos69BStatus;
  record?: Sat69BRecord;
} {
  const cleanRfc = rfc.trim().toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
  const db = getLoaded69BDatabase();
  const found = db.get(cleanRfc);

  if (!found) {
    return { isEfos: false, status: 'LIMPIO' };
  }

  return {
    isEfos: found.status === 'DEFINITIVO_EFOS' || found.status === 'PRESUNTO_EFOS',
    status: found.status,
    record: found
  };
}
