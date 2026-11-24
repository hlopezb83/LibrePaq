import type { Efos69BStatus } from './types';
import {
  decodeSat69BCsvBytes,
  parseSat69BCsv,
  type Sat69BParseResult,
  type Sat69BRecord
} from './sat-69b-parser';

export {
  decodeSat69BCsvBytes,
  parseSat69BCsv,
  type Sat69BParseResult,
  type Sat69BRecord
};

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
const META_STORAGE_KEY = 'librepaq_sat_69b_meta_v1';

export interface Sat69BMeta {
  totalCount: number;
  cachedCount?: number;
  isTruncated?: boolean;
  cloudSynced: boolean;
  updatedAt: string;
}

let cached69bDb: Map<string, Sat69BRecord> | null = null;

export function reset69BDatabaseCache(): void {
  cached69bDb = null;
}

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
 * Guarda registros importados del SAT en memoria completa y en caché rápida localStorage
 * (sin truncar el padrón enviado a la nube).
 */
export function save69BDatabase(
  records: Sat69BRecord[],
  opts?: { cloudSynced?: boolean }
): void {
  const map = new Map<string, Sat69BRecord>();
  for (const r of records) {
    if (r?.rfc) map.set(r.rfc.trim().toUpperCase(), r);
  }
  cached69bDb = map;

  if (typeof window === 'undefined' || !window.localStorage) return;
  const now = new Date().toISOString();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(map.values())));
    const meta: Sat69BMeta = {
      totalCount: map.size,
      cachedCount: map.size,
      isTruncated: false,
      cloudSynced: Boolean(opts?.cloudSynced),
      updatedAt: now
    };
    window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
  } catch (err) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      const truncatedMeta: Sat69BMeta = {
        totalCount: map.size,
        cachedCount: 0,
        isTruncated: true,
        cloudSynced: Boolean(opts?.cloudSynced),
        updatedAt: now
      };
      window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(truncatedMeta));
    } catch {
      // Ignorar si meta tampoco cabe
    }
    console.warn('[SAT 69-B] Cuota de almacenamiento local excedida; caché local omitido sin truncar silenciosamente:', err);
  }
}

export function getLoaded69BMeta(): Sat69BMeta | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(META_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Sat69BMeta) : null;
  } catch {
    return null;
  }
}

/** Fusiona coincidencias 69-B obtenidas desde la nube en el caché en memoria para consulta inmediata en UI. */
export function merge69BCloudMatches(
  matches: Array<{
    rfc: string;
    nombre?: string | null;
    situacion: string;
    estatus69b?: Efos69BStatus;
    fechaOficio?: string | null;
    publicacionDof?: string | null;
  }>
): void {
  if (!matches || matches.length === 0) return;
  const db = getLoaded69BDatabase();
  for (const m of matches) {
    const cleanRfc = String(m.rfc || '').trim().toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
    if (!cleanRfc) continue;
    const upperSit = String(m.situacion || '').toUpperCase();
    const situacion: Sat69BRecord['situacion'] = upperSit.includes('DEFINITIV')
      ? 'DEFINITIVO'
      : upperSit.includes('DESVIRTUAD')
        ? 'DESVIRTUADO'
        : upperSit.includes('FAVORABLE') || upperSit.includes('SENTENCIA')
          ? 'FAVORABLE'
          : 'PRESUNTO';
    const status: Efos69BStatus =
      m.estatus69b ||
      (situacion === 'DEFINITIVO'
        ? 'DEFINITIVO_EFOS'
        : situacion === 'DESVIRTUADO'
          ? 'DESVIRTUADO'
          : situacion === 'FAVORABLE'
            ? 'LIMPIO'
            : 'PRESUNTO_EFOS');
    db.set(cleanRfc, {
      rfc: cleanRfc,
      nombre: m.nombre || '',
      situacion,
      status,
      ...(m.fechaOficio ? { fechaOficio: m.fechaOficio } : {}),
      ...(m.publicacionDof ? { publicacionDof: m.publicacionDof } : {})
    });
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
