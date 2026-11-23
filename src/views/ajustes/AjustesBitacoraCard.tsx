import { useState } from 'react';
import { AlertCircle, History, RefreshCw, Search, X } from 'lucide-react';
import { MEXICO_TIMEZONE } from '../../shared/date-utils';
import type { Company } from '../../shared/types';
import type { CompanyAuditLogRecord } from '../../shared/types/despacho-rbac.types';

const AUDIT_DATE_FMT = new Intl.DateTimeFormat('es-MX', {
  timeZone: MEXICO_TIMEZONE,
  dateStyle: 'short',
  timeStyle: 'short'
});

const ACTION_LABELS: Record<string, string> = {
  POLIZA_CREATE: 'Alta de póliza contable',
  POLIZA_UPDATE: 'Edición de póliza contable',
  POLIZA_DELETE: 'Eliminación de póliza',
  ACCOUNT_CREATE: 'Alta de cuenta contable',
  ACCOUNT_UPDATE: 'Edición de cuenta contable',
  ACCOUNT_DELETE: 'Eliminación de cuenta',
  CFDI_IMPORT: 'Importación de CFDI 4.0',
  CFDI_DELETE: 'Eliminación de CFDI',
  PERIOD_LOCK: 'Bloqueo de periodo fiscal',
  PERIOD_UNLOCK: 'Reapertura de periodo fiscal',
  COMPANY_UPDATE: 'Actualización de ficha fiscal',
  MEMBER_INVITE: 'Autorización de colaborador',
  MEMBER_ROLE_UPDATE: 'Cambio de rol en despacho',
  MEMBER_REVOKE: 'Revocación de acceso',
  MEMBER_ACCESS_UPDATE: 'Actualización de empresas visibles',
  FIEL_UPLOAD: 'Carga de e.firma SAT',
  TAX_PARAMS_SAVE: 'Guardado de parámetros Día 17',
  BANK_RECONCILE: 'Conciliación bancaria',
  RULE_UPSERT: 'Guardado de regla contable',
  RULE_DELETE: 'Eliminación de regla contable',
  YEAR_CLOSE: 'Cierre de ejercicio anual (P13)'
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  poliza: 'Póliza',
  polizas: 'Póliza',
  account: 'Cuenta Contable',
  accounts: 'Cuenta Contable',
  cfdi: 'CFDI 4.0',
  cfdi_document: 'CFDI 4.0',
  period_lock: 'Candado Fiscal',
  company: 'Empresa',
  workspace_member: 'Colaborador',
  accounting_rule: 'Regla Contable',
  fiel: 'e.firma SAT',
  tax_parameters: 'Parámetros Fiscales',
  bank_statement: 'Estado de Cuenta'
};

function getActionLabel(action: string): string {
  const upper = action.trim().toUpperCase();
  if (ACTION_LABELS[upper]) return ACTION_LABELS[upper];
  return upper.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (ch) => ch.toUpperCase());
}

function getEntityLabel(entityType: string): string {
  const lower = entityType.trim().toLowerCase();
  if (ENTITY_TYPE_LABELS[lower]) return ENTITY_TYPE_LABELS[lower];
  return entityType.replace(/_/g, ' ');
}

function formatMetadataSummary(metadata: Record<string, unknown> | undefined): string {
  if (!metadata || typeof metadata !== 'object') return '';
  const entries = Object.entries(metadata).filter(
    ([, val]) => val !== null && val !== undefined && String(val).trim() !== ''
  );
  if (entries.length === 0) return '';
  return entries
    .slice(0, 4)
    .map(([key, val]) => `${key}: ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`)
    .join(' · ');
}

function formatAuditDate(raw: string | Date | null | undefined): string {
  if (!raw) return '—';
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return '—';
  return AUDIT_DATE_FMT.format(date);
}

function truncateEntityId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 12)}…` : id;
}

export interface AjustesBitacoraCardProps {
  activeCompany: Company | null;
  auditLogs: CompanyAuditLogRecord[];
  isLoading: boolean;
  isError?: boolean;
  error?: unknown;
  onRefresh: () => void;
}

export function AjustesBitacoraCard({
  activeCompany,
  auditLogs,
  isLoading,
  isError = false,
  error,
  onRefresh
}: AjustesBitacoraCardProps) {
  const [auditSearch, setAuditSearch] = useState('');

  const filteredLogs = auditLogs.filter((log) => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return true;
    const actionLabel = getActionLabel(log.action).toLowerCase();
    const entityLabel = getEntityLabel(log.entityType).toLowerCase();
    const metaSummary = formatMetadataSummary(log.metadata).toLowerCase();
    return (
      log.actorEmail.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      actionLabel.includes(q) ||
      log.entityType.toLowerCase().includes(q) ||
      entityLabel.includes(q) ||
      (log.entityId ?? '').toLowerCase().includes(q) ||
      metaSummary.includes(q)
    );
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 p-4 sm:p-5 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900 truncate">
            Bitácora Contable {activeCompany ? `— ${activeCompany.name}` : ''}
          </h3>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[280px]">
          <search className="relative flex-1 min-w-0">
            <label htmlFor="audit-search" className="visually-hidden">
              Filtrar bitácora contable
            </label>
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              id="audit-search"
              type="search"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Filtrar por usuario, acción o folio..."
              className="w-full flex-1 min-w-0 pl-8 pr-7 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
            {auditSearch && (
              <button
                type="button"
                onClick={() => setAuditSearch('')}
                aria-label="Limpiar filtro de bitácora"
                title="Limpiar filtro"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </search>
          <button
            type="button"
            disabled={isLoading || !activeCompany}
            onClick={onRefresh}
            aria-label="Actualizar bitácora contable"
            title={
              !activeCompany
                ? 'Selecciona una empresa activa'
                : isLoading
                ? 'Actualizando bitácora...'
                : 'Actualizar bitácora contable'
            }
            className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center p-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {!activeCompany ? (
        <p className="text-xs text-slate-600">Selecciona una empresa activa para consultar su bitácora.</p>
      ) : isError ? (
        <div role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-red-900">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
            <span>{error instanceof Error ? error.message : 'Error al cargar la bitácora contable.'}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      ) : isLoading ? (
        <p role="status" aria-live="polite" aria-busy="true" className="text-xs text-slate-600 py-2">
          Cargando bitácora contable...
        </p>
      ) : auditLogs.length === 0 ? (
        <p className="text-xs text-slate-600 py-2">
          Sin movimientos registrados en bitácora para esta empresa.
        </p>
      ) : filteredLogs.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-700">
            No hay registros que coincidan con <strong>"{auditSearch}"</strong>.
          </span>
          <button
            type="button"
            onClick={() => setAuditSearch('')}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-blue-800 font-semibold cursor-pointer"
          >
            Limpiar filtro
          </button>
        </div>
      ) : (
        <>
          <ul className="sm:hidden space-y-2.5">
            {filteredLogs.map((log) => {
              const metaSummary = formatMetadataSummary(log.metadata);
              return (
                <li key={log.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-blue-900">{getActionLabel(log.action)}</span>
                    <span className="text-[11px] text-slate-600 whitespace-nowrap">{formatAuditDate(log.createdAt)}</span>
                  </div>
                  <p className="text-[11px] text-slate-800 font-medium break-all">{log.actorEmail}</p>
                  <p className="text-[11px] text-slate-600">
                    {getEntityLabel(log.entityType)}
                    {log.entityId && (
                      <span title={log.entityId} className="font-mono ml-1 text-slate-700">
                        ({truncateEntityId(log.entityId)})
                      </span>
                    )}
                  </p>
                  {metaSummary && <p className="text-[11px] text-slate-600 break-words">{metaSummary}</p>}
                </li>
              );
            })}
          </ul>

          <div
            tabIndex={0}
            role="region"
            aria-label="Tabla de bitácora contable"
            className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200"
          >
            <table className="w-full text-left text-xs border-collapse">
              <caption className="visually-hidden">
                Registro de movimientos contables y administrativos de la empresa
              </caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th scope="col" className="py-2 px-3 font-semibold">Fecha (CDMX)</th>
                  <th scope="col" className="py-2 px-3 font-semibold">Usuario</th>
                  <th scope="col" className="py-2 px-3 font-semibold">Acción</th>
                  <th scope="col" className="py-2 px-3 font-semibold">Elemento y Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const metaSummary = formatMetadataSummary(log.metadata);
                  return (
                    <tr key={log.id} className="align-top">
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                        {formatAuditDate(log.createdAt)}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800">{log.actorEmail}</td>
                      <td className="py-2 px-3">
                        <span className="font-semibold text-blue-900 block">
                          {getActionLabel(log.action)}
                        </span>
                        <span className="font-mono text-[10px] text-slate-600">{log.action}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        <div>
                          <span className="font-medium">{getEntityLabel(log.entityType)}</span>
                          {log.entityId && (
                            <span title={log.entityId} className="font-mono text-[11px] text-slate-600 ml-1.5">
                              ({truncateEntityId(log.entityId)})
                            </span>
                          )}
                        </div>
                        {metaSummary && (
                          <p className="text-[11px] text-slate-600 mt-0.5 break-words">{metaSummary}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
