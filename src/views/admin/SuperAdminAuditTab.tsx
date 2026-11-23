import { useEffect, useState } from 'react';
import { ClipboardList, Loader2, RefreshCw, Search, X } from 'lucide-react';
import type { AdminAuditLogEntry, AdminAuditLogsPageQuery } from '../../shared/admin-types';
import { AdminPaginationBar } from './AdminPaginationBar';

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
  { match: 'set_user_role', label: 'Cambió Rol RBAC', className: 'bg-purple-100 text-purple-900 border-purple-300' },
  { match: 'upsert_workspace_quota', label: 'Actualizó Cuota', className: 'bg-teal-100 text-teal-900 border-teal-300' }
];

function getActionBadge(action: string): { label: string; className: string } {
  const lower = action.toLowerCase();
  const matched = ACTION_BADGE_MAP.find((item) => lower.includes(item.match));
  if (matched) return { label: matched.label, className: matched.className };
  if (lower.includes('delete') || lower.includes('clear') || lower.includes('revoke')) return { label: action, className: 'bg-red-100 text-red-900 border-red-300' };
  if (lower.includes('create') || lower.includes('publish') || lower.includes('activate') || lower.includes('resolve')) return { label: action, className: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
  return { label: action, className: 'bg-slate-100 text-slate-800 border-slate-300' };
}

function formatDateEsMx(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return '[Objeto]'; }
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
  const [searchInput, setSearchInput] = useState(query.search || '');

  useEffect(() => { setSearchInput(query.search || ''); }, [query.search]);

  useEffect(() => {
    const t = setTimeout(() => {
      if ((query.search || '') !== searchInput) onQueryChange({ ...query, page: 1, search: searchInput });
    }, 220);
    return () => clearTimeout(t);
  }, [searchInput, query, onQueryChange]);

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
            <option value="workspace">Workspaces</option>
            <option value="broadcast">Comunicados</option>
            <option value="platform_alert">Alertas</option>
          </select>

          <search className="relative w-full sm:w-64">
            <label htmlFor="admin-audit-search" className="visually-hidden">Buscar en bitácora por actor, acción u objetivo</label>
            {isFetching ? (
              <Loader2 className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none animate-spin" aria-hidden="true" />
            ) : (
              <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            )}
            <input
              id="admin-audit-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape' && searchInput) { e.preventDefault(); setSearchInput(''); onQueryChange({ ...query, page: 1, search: '' }); } }}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="search"
              placeholder="Filtrar por actor, acción u objetivo..."
              className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(''); onQueryChange({ ...query, page: 1, search: '' }); }} aria-label="Limpiar búsqueda de bitácora" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-600 hover:text-slate-900 cursor-pointer">
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </search>

          {onRetry && (
            <button type="button" onClick={onRetry} disabled={isLoading || isFetching} aria-label="Actualizar bitácora de auditoría" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-800 border border-slate-300 text-xs font-bold transition cursor-pointer">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isFetching ? 'animate-spin' : ''}`} aria-hidden="true" /> Actualizar
            </button>
          )}
        </div>
      </div>

      {isError && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold">No se pudo cargar la bitácora de auditoría desde Supabase.</span>
          {onRetry && <button type="button" onClick={onRetry} className="px-3 py-1 rounded-lg bg-white border border-red-300 text-red-800 font-bold hover:bg-red-100 cursor-pointer">Reintentar</button>}
        </div>
      )}

      <div tabIndex={0} role="region" aria-label="Tabla de eventos de auditoría administrativa" className="overflow-x-auto max-h-[65vh] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40">
        <table className="w-full text-left text-xs border-separate border-spacing-0">
          <caption className="visually-hidden">Bitácora cronológica de acciones administrativas en LibrePaq Pro</caption>
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
              <tr><td colSpan={5} className="py-8 text-center text-slate-600">Cargando eventos de auditoría administrativa...</td></tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-600">
                  <div className="flex flex-col items-center gap-2">
                    <span>No se encontraron eventos de auditoría con estos filtros.</span>
                    {(query.search || query.targetType) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchInput('');
                          onQueryChange({ ...query, page: 1, search: '', targetType: '' });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        Restablecer filtros
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((entry) => {
                const badge = getActionBadge(entry.action);
                const summary = formatMetadataSummary(entry.metadata);
                return (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition">
                    <th scope="row" className="py-2.5 px-3.5 font-mono text-[11px] font-semibold text-slate-900 whitespace-nowrap text-left">{formatDateEsMx(entry.createdAt)}</th>
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
