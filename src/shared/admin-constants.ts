import type { WorkspacePlanTier, WorkspaceQuota } from './admin-types';

/** Cuota base asignada a workspaces sin registro explícito en `workspace_quotas`. */
export const DEFAULT_FREE_QUOTA: Pick<
  WorkspaceQuota,
  'planTier' | 'maxCompanies' | 'maxCfdisPerMonth' | 'maxStorageMb'
> = {
  planTier: 'FREE',
  maxCompanies: 3,
  maxCfdisPerMonth: 500,
  maxStorageMb: 250
};

/** Construye un objeto `WorkspaceQuota` por defecto para un workspace dado. */
export function createDefaultWorkspaceQuota(workspaceId: string): WorkspaceQuota {
  return {
    workspaceId,
    userId: null,
    ...DEFAULT_FREE_QUOTA,
    notes: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null
  };
}

/** Presets de cuotas recomendadas por nivel de plan comercial. */
export const PLAN_QUOTA_PRESETS: Record<
  WorkspacePlanTier,
  { maxCompanies: number; maxCfdisPerMonth: number; maxStorageMb: number }
> = {
  FREE: { maxCompanies: 3, maxCfdisPerMonth: 500, maxStorageMb: 250 },
  PRO: { maxCompanies: 15, maxCfdisPerMonth: 5000, maxStorageMb: 2048 },
  DESPACHO: { maxCompanies: 50, maxCfdisPerMonth: 25000, maxStorageMb: 10240 },
  ENTERPRISE: { maxCompanies: 250, maxCfdisPerMonth: 150000, maxStorageMb: 51200 }
};

/** Determina si un registro de empresa corresponde a un entorno demo o sin propietario real. */
export function isDemoCompanyRecord(company: {
  rfc?: unknown;
  name?: unknown;
  user_id?: unknown;
  userId?: unknown;
}): boolean {
  const hasUidKey = 'userId' in company || 'user_id' in company;
  const uid = company.userId ?? company.user_id;
  const uidStr = uid ? String(uid) : '';
  if (hasUidKey && (!uidStr || uidStr === 'demo')) return true;
  const rfc = String(company.rfc || '').toUpperCase();
  const name = String(company.name || '').toUpperCase();
  return rfc === 'CEJ2106158A0' || name.startsWith('[DEMO]');
}

/** Evalúa si una solicitud de descarga SAT presenta un estado o código de error. */
export function isSatErrorCode(estadoSolicitud: unknown, codigoEstadoSat: unknown): boolean {
  const st = String(estadoSolicitud || '').trim().toUpperCase();
  const code = String(codigoEstadoSat || '').trim();
  return st === 'ERROR' || st === 'RECHAZADA' || st === 'VENCIDA' || (code !== '' && code !== '5000');
}
