import { Fragment, useCallback, useState } from 'react';
import { Check, ChevronDown, ChevronRight, ClipboardList, Copy, RefreshCw } from 'lucide-react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import type { AdminAuditLogEntry, AdminAuditLogsPageQuery } from '../../shared/admin-types';
import { AdminErrorBanner } from './AdminErrorBanner';
import { AdminPaginationBar } from './AdminPaginationBar';
import { AdminSearchInput } from './AdminSearchInput';
import { AdminTableEmptyState } from './AdminTableEmptyState';
import { formatAdminDateTime } from './adminFormatters';

export interface SuperAdminAuditTabProps {
  logs: AdminAuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: AdminAuditLogsPageQuery;
  onQueryChange: (next: AdminAuditLogsPageQuery) => void;
  isLoading: boolean;
  isFetching?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const ACTION_BADGE_MAP: Array<{ match: string; label: string; className: string }> = [
  { match: 'broadcast.publish', label: 'Publicó Comunicado', className: 'bg-blue-100 text-blue-900 border-blue-300' },
  { match: 'publish_broadcast', label: 'Publicó Comunicado', className: 'bg-blue-100 text-blue-900 border-blue-300' },
  { match: 'clear_broadcast', label: 'Retiró Comunicado', className: 'bg-amber-100 text-amber-950 border-amber-300' },
  { match: 'start_support_impersonation', label: 'Inicio Modo Soporte', className: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
  { match: 'end_support_impersonation', label: 'Fin Modo Soporte', className: 'bg-slate-100 text-slate-900 border-slate-300' },
  { match: 'set_user_role', label: 'Cambió Nivel de Acceso', className: 'bg-purple-100 text-purple-900 border-purple-300' },
  { match: 'set_user_status', label: 'Cambió Estatus Usuario', className: 'bg-amber-100 text-amber-950 border-amber-300' },
  { match: 'upsert_workspace_quota', label: 'Actualizó Cuota', className: 'bg-teal-100 text-teal-900 border-teal-300' },
  { match: 'inspect_tenant', label: 'Inspeccionó Empresa', className: 'bg-sky-100 text-sky-900 border-sky-300' },
  { match: 'delete_company', label: 'Eliminó Empresa', className: 'bg-red-100 text-red-900 border-red-300' },
  { match: 'run_health_scan', label: 'Escaneo Salud SAT', className: 'bg-cyan-100 text-cyan-900 border-cyan-300' },
  { match: 'resolve_platform_alert', label: 'Actualizó Alerta', className: 'bg-emerald-100 text-emerald-900 border-emerald-300' }
];

function getActionBadge(action: string): { label: string; className: string } {
  const lower = action.toLowerCase();
  const matched = ACTION_BADGE_MAP.find((item) => lower.includes(item.match));
  if (matched) return { label: matched.label, className: matched.className };
  if (lower.includes('delete') || lower.includes('clear') || lower.includes('revoke')) {
    return { label: action, className: 'bg-red-100 text-red-900 border-red-300' };
  }
  if (lower.includes('create') || lower.includes('publish') || lower.includes('activate') || lower.includes('resolve')) {
    return { label: action, className: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
  }
  return { label: action, className: 'bg-slate-100 text-slate-800 border-slate-300' };
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '[Objeto]';
  }
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  company: 'Empresa',
  user: 'Usuario',
  workspace: 'Despacho',
  broadcast: 'Comunicado',
  platform_alert: 'Alerta',
  platform: 'Plataforma'
};

const METADATA_KEY_LABELS: Record<string, string> = {
  actorRole: 'Rol',
  companyRfc: 'RFC',
  companyName: 'Empresa',
  planTier: 'Plan',
  maxCompanies: 'Máx. empresas',
  maxCfdisPerMonth: 'Máx. CFDIs/mes',
  maxStorageMb: 'Almacenamiento MB',
  platformRole: 'Nuevo rol',
  status: 'Estatus',
  title: 'Título',
  code: 'Código',
  ownerEmail: 'Titular'
};

function formatMetadataSummary(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length === 0
    ? 'Sin detalles adicionales'
    : entries
        .slice(0, 4)
        .map(([k, v]) => `${METADATA_KEY_LABELS[k] ?? k}: ${formatMetadataValue(v)}`)
        .join(' · ');
}

export function SuperAdminAuditTab({
  logs, total, page, pageSize, totalPages, query, onQueryChange, isLoading, isFetching = false, isError = false, onRetry
}: SuperAdminAuditTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { copiedKey: copiedTargetId, copy: copyTargetId } = useCopyToClipboard<string>(1800);

  const handleSearchChange = useCallback(
    (search: string) => {
      onQueryChange({ ...query, page: 1, search });
    },
    [query, onQueryChange]
  );

  return (
    <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" aria-hidden="true" />
            Bitácora de Auditoría Administrativa
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">Registro inmutable de cambios de acceso, cuotas, soporte y bajas de empresas</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span role="status" aria-live="polite" className="text-[11px] font-mono text-slate-700">{total.toLocaleString('es-MX')} eventos</span>

          <label htmlFor="admin-audit-target-filter" className="visually-hidden">Filtrar por tipo de objetivo</label>
          <select
            id="admin-audit-target-filter"
            value={query.targetType || ''}
            onChange={(e) => onQueryChange({ ...query, page: 1, targetType: e.target.value })}
            className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <option value="">Todos los objetivos</option>
            <option value="company">Empresas</option>
            <option value="user">Usuarios</option>
            <option value="workspace">Despachos</option>
            <option value="broadcast">Comunicados</option>
            <option value="platform_alert">Alertas</option>
          </select>

          <AdminSearchInput
            id="admin-audit-search"
            label="Buscar en bitácora por actor, acción u objetivo"
            value={query.search || ''}
            onDebouncedChange={handleSearchChange}
            placeholder="Filtrar por actor, acción u objetivo... (/)"
            clearAriaLabel="Limpiar búsqueda de bitácora"
            isFetching={isFetching}
          />

          {onRetry && (
            <button type="button" onClick={onRetry} disabled={isLoading || isFetching} aria-label="Actualizar bitácora de auditoría" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-800 border border-slate-300 text-xs font-bold transition cursor-pointer">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isFetching ? 'animate-spin' : ''}`} aria-hidden="true" /> Actualizar
            </button>
          )}
        </div>
      </div>

      {isError && (
        <AdminErrorBanner message="No se pudo cargar la bitácora de auditoría desde Supabase." onRetry={onRetry} />
      )}

      <div tabIndex={0} role="region" aria-label="Tabla de eventos de auditoría administrativa" className="overflow-x-auto max-h-[65vh] border border-slate-200 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        <table className="w-full text-left text-xs border-separate border-spacing-0">
          <caption className="visually-hidden">Bitácora cronológica de acciones administrativas en LibrePaq Pro</caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" className="py-2.5 px-2.5 border-b border-slate-200 bg-slate-50 w-10"><span className="visually-hidden">Detalles</span></th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Fecha / Hora</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Actor</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Acción</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Objetivo</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Resumen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {isLoading && logs.length === 0 ? (
              [0, 1, 2, 3].map((idx) => (
                <tr key={idx} aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
                  <td className="py-3 px-2.5"><div className="h-5 w-5 rounded bg-slate-200 mx-auto" /></td>
                  <td className="py-3 px-3.5"><div className="h-3.5 w-28 rounded bg-slate-200" /></td>
                  <td className="py-3 px-3.5"><div className="h-3.5 w-36 rounded bg-slate-200" /></td>
                  <td className="py-3 px-3.5"><div className="h-5 w-28 rounded-full bg-slate-200" /></td>
                  <td className="py-3 px-3.5"><div className="h-3.5 w-20 rounded bg-slate-200" /></td>
                  <td className="py-3 px-3.5"><div className="h-3.5 w-48 rounded bg-slate-200" /></td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <AdminTableEmptyState
                colSpan={6}
                message="No se encontraron eventos de auditoría con estos filtros."
                hasActiveFilters={Boolean(query.search || query.targetType)}
                onResetFilters={() => onQueryChange({ ...query, page: 1, search: '', targetType: '' })}
              />
            ) : (
              logs.map((entry) => {
                const badge = getActionBadge(entry.action);
                const summary = formatMetadataSummary(entry.metadata);
                const isExpanded = expandedId === entry.id;
                const metadataEntries = Object.entries(entry.metadata || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
                return (
                  <Fragment key={entry.id}>
                    <tr className="hover:bg-slate-50/80 transition">
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? `Ocultar detalles de evento ${entry.id}` : `Ver detalles de evento ${entry.id}`}
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="inline-flex items-center justify-center min-h-7 min-w-7 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" aria-hidden="true" /> : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
                        </button>
                      </td>
                      <th scope="row" className="py-2.5 px-3.5 font-mono text-[11px] font-semibold text-slate-900 whitespace-nowrap text-left">{formatAdminDateTime(entry.createdAt, true)}</th>
                      <td className="py-2.5 px-3.5">
                        <p className="font-semibold text-slate-900">{entry.actorEmail}</p>
                        {entry.actorUserId && <p className="font-mono text-[10px] text-slate-600">{entry.actorUserId}</p>}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span title={entry.action} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.className}`}>{badge.label}</span>
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className="font-semibold text-slate-800">{TARGET_TYPE_LABELS[entry.targetType] ?? entry.targetType}</span>
                        {entry.targetId && <p className="font-mono text-[10px] text-slate-600">{entry.targetId}</p>}
                      </td>
                      <td className="py-2.5 px-3.5 max-w-md"><p className="text-[11px] text-slate-700 line-clamp-2" title={summary}>{summary}</p></td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/90">
                        <td colSpan={6} className="px-4 py-3 border-t border-slate-200/80">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Metadatos completos ({entry.action})</span>
                            {entry.targetId && (
                              <button
                                type="button"
                                onClick={() => void copyTargetId(entry.targetId as string, entry.id)}
                                className="inline-flex items-center gap-1 min-h-7 min-w-7 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-[11px] font-semibold text-slate-800 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                              >
                                {copiedTargetId === entry.id ? <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />}
                                {copiedTargetId === entry.id ? 'ID copiado' : `Copiar ID objetivo`}
                              </button>
                            )}
                          </div>
                          {metadataEntries.length === 0 ? (
                            <p className="text-[11px] text-slate-600">Sin metadatos adicionales registrados.</p>
                          ) : (
                            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5 text-[11px]">
                              {metadataEntries.map(([k, v]) => (
                                <div key={k} className="flex items-baseline gap-1.5 min-w-0">
                                  <dt className="font-semibold text-slate-600 shrink-0">{METADATA_KEY_LABELS[k] ?? k}:</dt>
                                  <dd className="font-mono text-slate-900 break-all">{formatMetadataValue(v)}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AdminPaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} itemLabel="eventos" isFetching={isFetching} onPageChange={(nextPage) => onQueryChange({ ...query, page: nextPage })} />
    </div>
  );
}
