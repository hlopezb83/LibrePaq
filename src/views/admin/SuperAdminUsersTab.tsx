import { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Ban,
  CheckCircle,
  Crown,
  Download,
  Loader2,
  Mail,
  Megaphone,
  RotateCcw,
  Search,
  UserCheck,
  X
} from 'lucide-react';
import type { AdminUserSummary } from '../../shared/admin-types';
import { exportUsersCsv } from './adminCsvExport';

type UserSortKey = 'createdAt' | 'lastSignInAt' | 'companiesCount';

interface SuperAdminUsersTabProps {
  users: AdminUserSummary[];
  isLoading: boolean;
  onViewUserCompanies?: (query: string) => void;
  onToggleUserStatus?: (userId: string, nextStatus: 'ACTIVO' | 'SUSPENDIDO') => void;
  mutatingUserId?: string | null;
}

function formatShortDate(value?: string): string {
  if (!value) return 'Sin registro';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Sin registro';
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function SuperAdminUsersTab({
  users,
  isLoading,
  onViewUserCompanies,
  onToggleUserStatus,
  mutatingUserId = null
}: SuperAdminUsersTabProps) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<UserSortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [pendingUser, setPendingUser] = useState<{ id: string; nextStatus: 'ACTIVO' | 'SUSPENDIDO' } | null>(null);

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? users.filter(
          (u) =>
            u.email.toLowerCase().includes(q) ||
            u.fullName.toLowerCase().includes(q) ||
            u.id.toLowerCase().includes(q) ||
            (u.acquisitionSource || '').toLowerCase().includes(q) ||
            (u.utmCampaign || '').toLowerCase().includes(q)
        )
      : [...users];

    const factor = sortDir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      if (sortBy === 'companiesCount') return (a.companiesCount - b.companiesCount) * factor;
      const aTs = Date.parse((sortBy === 'lastSignInAt' ? a.lastSignInAt : a.createdAt) || '') || 0;
      const bTs = Date.parse((sortBy === 'lastSignInAt' ? b.lastSignInAt : b.createdAt) || '') || 0;
      return (aTs - bTs) * factor;
    });
  }, [users, query, sortBy, sortDir]);

  return (
    <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" aria-hidden="true" />
            Directorio de Usuarios Registrados
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Cuentas sincronizadas con Supabase Auth, Workspaces, atribución Google Ads y control de acceso
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span role="status" aria-live="polite" className="text-[11px] font-mono text-slate-600">
            {filteredAndSorted.length} de {users.length} usuarios
          </span>

          <div className="inline-flex items-center gap-1">
            <label htmlFor="admin-users-sort" className="visually-hidden">Ordenar usuarios por</label>
            <select id="admin-users-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as UserSortKey)} className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
              <option value="createdAt">Fecha registro</option>
              <option value="lastSignInAt">Último acceso</option>
              <option value="companiesCount">Empresas</option>
            </select>
            <button type="button" onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))} aria-label={`Cambiar orden a ${sortDir === 'desc' ? 'ascendente' : 'descendente'}`} title={sortDir === 'desc' ? 'Descendente' : 'Ascendente'} className="p-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer">
              <ArrowDownUp className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <button type="button" disabled={filteredAndSorted.length === 0} onClick={() => exportUsersCsv(filteredAndSorted)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-bold text-slate-700 transition cursor-pointer">
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Exportar CSV
          </button>

          <search className="relative w-full sm:w-60">
            <label htmlFor="admin-users-search" className="visually-hidden">Buscar usuario por correo, nombre o campaña</label>
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              id="admin-users-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
              placeholder="Buscar correo, nombre o campaña..."
              className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda de usuarios" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 hover:text-slate-700 cursor-pointer">
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </search>
        </div>
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label="Tabla de usuarios registrados"
        className="overflow-x-auto max-h-[70vh] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      >
        <table className="w-full text-left text-xs border-separate border-spacing-0">
          <caption className="visually-hidden">Directorio de usuarios registrados en la plataforma</caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Usuario / Correo</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Workspace / Nivel</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Canal / Acceso</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Empresas</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Registro</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Último acceso</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">Estado / Control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {isLoading ? (
              <tr><td colSpan={7} className="py-8 text-center text-slate-600">Cargando directorio de usuarios de Supabase...</td></tr>
            ) : filteredAndSorted.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-slate-600">No se encontraron usuarios con el término de búsqueda.</td></tr>
            ) : (
              filteredAndSorted.map((u) => {
                const isMutating = mutatingUserId === u.id;
                const isConfirming = pendingUser?.id === u.id;
                const isSuspended = u.status === 'SUSPENDIDO';
                const nextStatus: 'ACTIVO' | 'SUSPENDIDO' = isSuspended ? 'ACTIVO' : 'SUSPENDIDO';

                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    <th scope="row" className="py-3 px-3.5 text-left font-normal">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                          {u.fullName.slice(0, 2).toUpperCase() || 'CP'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{u.fullName}</p>
                          <p className="text-[11px] text-slate-600 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-500" aria-hidden="true" />
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </th>
                    <td className="py-3 px-3.5">
                      {u.isSuperAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <Crown className="w-3 h-3 text-amber-700" aria-hidden="true" />
                          SuperAdmin
                        </span>
                      ) : (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {u.workspaceName || `Workspace — ${u.fullName}`}
                          </span>
                          {u.workspaceId && <p className="text-[10px] font-mono text-slate-600 mt-0.5">{u.workspaceId}</p>}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <span className="capitalize font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{u.provider}</span>
                        {!u.isSuperAdmin &&
                          (u.acquisitionSource === 'google_ads' ? (
                            <span
                              title={u.utmCampaign || u.utmTerm || u.gclid ? `Campaña: ${u.utmCampaign || 'Google Ads'} • Keyword: ${u.utmTerm || 'N/A'} • GCLID: ${u.gclid || 'sí'}` : 'Adquirido vía campaña de Google Ads'}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                            >
                              <Megaphone className="w-3 h-3" aria-hidden="true" />
                              Google Ads
                            </span>
                          ) : u.acquisitionSource === 'utm' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Campaña UTM
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-600">Orgánico / Directo</span>
                          ))}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 font-bold text-slate-900">
                      {u.companiesCount > 0 && onViewUserCompanies ? (
                        <button
                          type="button"
                          onClick={() => onViewUserCompanies(u.email.startsWith('UID ') ? u.id : u.email)}
                          title="Ver empresas asociadas a este usuario"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold transition cursor-pointer"
                        >
                          {u.companiesCount} ver →
                        </button>
                      ) : (
                        <span className="text-slate-600 font-medium">{u.companiesCount}</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-slate-600 text-[11px] whitespace-nowrap">{formatShortDate(u.createdAt)}</td>
                    <td className="py-3 px-3.5 text-slate-600 text-[11px] whitespace-nowrap">{formatShortDate(u.lastSignInAt)}</td>
                    <td className="py-3 px-3.5 text-right">
                      <div className="inline-flex flex-col items-end gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            isSuspended ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isSuspended ? <Ban className="w-3 h-3 text-red-600" aria-hidden="true" /> : <CheckCircle className="w-3 h-3 text-emerald-600" aria-hidden="true" />}
                          {u.status}
                        </span>

                        {!u.isSuperAdmin && onToggleUserStatus && !isConfirming && (
                          <button
                            type="button"
                            disabled={isMutating}
                            onClick={() => setPendingUser({ id: u.id, nextStatus })}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer disabled:opacity-50 ${
                              isSuspended ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-white hover:bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {isMutating ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : isSuspended ? <RotateCcw className="w-3 h-3" aria-hidden="true" /> : <Ban className="w-3 h-3" aria-hidden="true" />}
                            {isSuspended ? 'Reactivar' : 'Suspender'}
                          </button>
                        )}

                        {isConfirming && pendingUser && onToggleUserStatus && (
                          <div
                            role="alertdialog"
                            aria-modal="false"
                            aria-label={`Confirmar cambio de estado para ${u.fullName}`}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                setPendingUser(null);
                              }
                            }}
                            className="inline-flex flex-wrap items-center justify-end gap-1.5 p-1.5 rounded-lg bg-red-50 border border-red-200 text-[11px]"
                          >
                            <span className="font-bold text-red-900">
                              {pendingUser.nextStatus === 'SUSPENDIDO' ? '¿Suspender?' : '¿Reactivar?'}
                            </span>
                            <button
                              type="button"
                              autoFocus
                              onClick={() => setPendingUser(null)}
                              className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() => {
                                onToggleUserStatus(u.id, pendingUser.nextStatus);
                                setPendingUser(null);
                              }}
                              className={`px-2 py-0.5 rounded font-bold text-white cursor-pointer disabled:opacity-50 ${
                                pendingUser.nextStatus === 'SUSPENDIDO' ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800'
                              }`}
                            >
                              Confirmar
                            </button>
                          </div>
                        )}
                      </div>
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
