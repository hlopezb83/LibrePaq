import { useMemo, useState } from 'react';
import { ClipboardList, RefreshCw, Search, X } from 'lucide-react';
import type { AdminAuditLogEntry } from '../../shared/admin-types';

export interface SuperAdminAuditTabProps {
  logs: AdminAuditLogEntry[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const ACTION_BADGE_MAP: Array<{ match: string; label: string; className: string }> = [
  {
    match: 'broadcast.publish',
    label: 'Publicó Comunicado',
    className: 'bg-blue-100 text-blue-900 border-blue-300'
  },
  {
    match: 'broadcast.clear',
    label: 'Retiró Comunicado',
    className: 'bg-amber-100 text-amber-950 border-amber-300'
  },
  {
    match: 'suspend',
    label: 'Suspendió Cuenta',
    className: 'bg-red-100 text-red-900 border-red-300'
  },
  {
    match: 'reactivate',
    label: 'Reactivó Cuenta',
    className: 'bg-emerald-100 text-emerald-900 border-emerald-300'
  },
  {
    match: 'workspace',
    label: 'Actualizó Workspace',
    className: 'bg-indigo-100 text-indigo-900 border-indigo-300'
  }
];

function getActionBadge(action: string): { label: string; className: string } {
  const lower = action.toLowerCase();
  const matched = ACTION_BADGE_MAP.find((item) => lower.includes(item.match));
  if (matched) return { label: matched.label, className: matched.className };
  if (lower.includes('delete') || lower.includes('clear') || lower.includes('revoke')) {
    return { label: action, className: 'bg-red-100 text-red-900 border-red-300' };
  }
  if (lower.includes('create') || lower.includes('publish') || lower.includes('activate')) {
    return { label: action, className: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
  }
  return { label: action, className: 'bg-slate-100 text-slate-800 border-slate-300' };
}

function formatDateEsMx(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'medium'
  });
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '[Objeto]';
  }
}

function formatMetadataSummary(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return 'Sin detalles adicionales';
  return entries
    .slice(0, 4)
    .map(([key, val]) => `${key}: ${formatMetadataValue(val)}`)
    .join(' · ');
}

export function SuperAdminAuditTab({
  logs,
  isLoading,
  isError = false,
  onRetry
}: SuperAdminAuditTabProps) {
  const [query, setQuery] = useState('');

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((entry) => {
      const metadataText = formatMetadataSummary(entry.metadata).toLowerCase();
      return (
        entry.actorEmail.toLowerCase().includes(q) ||
        entry.action.toLowerCase().includes(q) ||
        entry.targetType.toLowerCase().includes(q) ||
        (entry.targetId || '').toLowerCase().includes(q) ||
        metadataText.includes(q)
      );
    });
  }, [logs, query]);

  return (
    <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" aria-hidden="true" />
            Bitácora de Auditoría Administrativa
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Registro inmutable de acciones críticas ejecutadas desde el panel SuperAdmin
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span role="status" aria-live="polite" className="text-[11px] font-mono text-slate-700">
            {filteredLogs.length} de {logs.length} eventos
          </span>

          <search className="relative w-full sm:w-72">
            <label htmlFor="admin-audit-search" className="visually-hidden">
              Buscar en bitácora por actor, acción u objetivo
            </label>
            <Search
              className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="admin-audit-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.preventDefault();
                  setQuery('');
                }
              }}
              placeholder="Filtrar por actor, acción u objetivo..."
              className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda de bitácora"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </search>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isLoading}
              aria-label="Actualizar bitácora de auditoría"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-800 border border-slate-300 text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Actualizar
            </button>
          )}
        </div>
      </div>

      {isError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex flex-wrap items-center justify-between gap-3"
        >
          <span className="font-semibold">
            No se pudo cargar la bitácora de auditoría desde Supabase.
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3 py-1 rounded-lg bg-white border border-red-300 text-red-800 font-bold hover:bg-red-100 cursor-pointer"
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      <div
        tabIndex={0}
        role="region"
        aria-label="Tabla de eventos de auditoría administrativa"
        className="overflow-x-auto max-h-[65vh] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      >
        <table className="w-full text-left text-xs border-separate border-spacing-0">
          <caption className="visually-hidden">
            Bitácora cronológica de acciones administrativas en LibrePaq Pro
          </caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Fecha / Hora</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Actor</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Acción</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Objetivo</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Resumen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {isLoading && logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-600">
                  Cargando eventos de auditoría administrativa...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-600">
                  {query
                    ? 'No se encontraron eventos de auditoría que coincidan con tu búsqueda.'
                    : 'Aún no hay eventos registrados en la bitácora administrativa.'}
                </td>
              </tr>
            ) : (
              filteredLogs.map((entry) => {
                const badge = getActionBadge(entry.action);
                const summary = formatMetadataSummary(entry.metadata);
                return (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition">
                    <th
                      scope="row"
                      className="py-2.5 px-3.5 font-mono text-[11px] font-semibold text-slate-900 whitespace-nowrap text-left"
                    >
                      {formatDateEsMx(entry.createdAt)}
                    </th>
                    <td className="py-2.5 px-3.5">
                      <p className="font-semibold text-slate-900">{entry.actorEmail}</p>
                      {entry.actorUserId && (
                        <p className="font-mono text-[10px] text-slate-600">{entry.actorUserId}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span
                        title={entry.action}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className="font-semibold text-slate-800">{entry.targetType}</span>
                      {entry.targetId && (
                        <p className="font-mono text-[10px] text-slate-600">{entry.targetId}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 max-w-md">
                      <p className="text-[11px] text-slate-700 line-clamp-2" title={summary}>
                        {summary}
                      </p>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
