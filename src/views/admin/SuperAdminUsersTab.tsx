import { useEffect, useState } from 'react';
import {
  Ban, CheckCircle, Crown, Download, Loader2, Mail, Megaphone, RotateCcw, Search, UserCheck, X
} from 'lucide-react';
import type { AdminUserSummary, AdminUsersPageQuery, PlatformRole } from '../../shared/admin-types';
import { AdminPaginationBar } from './AdminPaginationBar';
import { exportUsersCsv } from './adminCsvExport';

interface SuperAdminUsersTabProps {
  users: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: AdminUsersPageQuery;
  onQueryChange: (next: AdminUsersPageQuery) => void;
  isLoading: boolean;
  isFetching?: boolean;
  onViewUserCompanies?: (query: string) => void;
  onToggleUserStatus?: (userId: string, nextStatus: 'ACTIVO' | 'SUSPENDIDO') => void;
  onChangeUserRole?: (userId: string, nextRole: PlatformRole) => void;
  mutatingUserId?: string | null;
}

const ROLE_OPTIONS: Array<{ value: PlatformRole; label: string }> = [
  { value: 'NONE', label: 'Cliente estándar' },
  { value: 'SUPPORT_READONLY', label: 'Soporte (Solo lectura)' },
  { value: 'BILLING_OPS', label: 'Operaciones y Cuotas' },
  { value: 'SUPERADMIN', label: 'SuperAdmin' }
];

function formatShortDate(value?: string): string {
  if (!value) return 'Sin registro';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Sin registro' : d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function SuperAdminUsersTab({
  users,
  total,
  page,
  pageSize,
  totalPages,
  query,
  onQueryChange,
  isLoading,
  isFetching = false,
  onViewUserCompanies,
  onToggleUserStatus,
  onChangeUserRole,
  mutatingUserId = null
}: SuperAdminUsersTabProps) {
  const [searchInput, setSearchInput] = useState(query.search || '');
  const [pendingUser, setPendingUser] = useState<{ id: string; nextStatus: 'ACTIVO' | 'SUSPENDIDO' } | null>(null);
  const [pendingRole, setPendingRole] = useState<{ id: string; fullName: string; nextRole: PlatformRole } | null>(null);

  useEffect(() => {
    setSearchInput(query.search || '');
  }, [query.search]);

  useEffect(() => {
    const t = setTimeout(() => {
      if ((query.search || '') !== searchInput) {
        onQueryChange({ ...query, page: 1, search: searchInput });
      }
    }, 220);
    return () => clearTimeout(t);
  }, [searchInput, query, onQueryChange]);

  const hasActiveFilters = Boolean(searchInput || (query.status && query.status !== 'ALL') || (query.role && query.role !== 'ALL'));

  return (
    <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" aria-hidden="true" />
            Directorio de Usuarios y Roles de Plataforma
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Consulta en tiempo real, niveles de acceso a consola y control de cuentas
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span role="status" aria-live="polite" className="text-[11px] font-mono text-slate-600">
            {total.toLocaleString('es-MX')} usuarios
          </span>

          <label htmlFor="admin-users-status-filter" className="visually-hidden">Filtrar por estatus</label>
          <select
            id="admin-users-status-filter"
            value={query.status || 'ALL'}
            onChange={(e) => onQueryChange({ ...query, page: 1, status: e.target.value as AdminUsersPageQuery['status'] })}
            className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <option value="ALL">Todos los estatus</option>
            <option value="ACTIVO">Activos</option>
            <option value="SUSPENDIDO">Suspendidos</option>
          </select>

          <label htmlFor="admin-users-role-filter" className="visually-hidden">Filtrar por rol</label>
          <select
            id="admin-users-role-filter"
            value={query.role || 'ALL'}
            onChange={(e) => onQueryChange({ ...query, page: 1, role: e.target.value as AdminUsersPageQuery['role'] })}
            className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <option value="ALL">Todos los roles</option>
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>

          <button
            type="button"
            disabled={users.length === 0}
            title={users.length === 0 ? 'No hay usuarios en la página actual para exportar' : undefined}
            onClick={() => exportUsersCsv(users)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-slate-700 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" /> Exportar CSV
          </button>

          <search className="relative w-full sm:w-56">
            <label htmlFor="admin-users-search" className="visually-hidden">Buscar usuario por correo, nombre o campaña</label>
            {isFetching ? (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            ) : (
              <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            )}
            <input
              id="admin-users-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchInput) {
                  e.preventDefault();
                  setSearchInput('');
                  onQueryChange({ ...query, page: 1, search: '' });
                }
              }}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="search"
              placeholder="Buscar correo o nombre..."
              className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(''); onQueryChange({ ...query, page: 1, search: '' }); }}
                aria-label="Limpiar búsqueda de usuarios"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </search>
        </div>
      </div>

      <div tabIndex={0} role="region" aria-label="Tabla de usuarios registrados" className="overflow-x-auto max-h-[68vh] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40">
        <table className="w-full text-left text-xs border-separate border-spacing-0">
          <caption className="visually-hidden">Directorio paginado de usuarios registrados y niveles de acceso</caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Usuario / Correo</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Despacho / Nivel de acceso</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Canal / Acceso</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Empresas</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Registro</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Último acceso</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">Estado / Control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {isLoading ? (
              <tr><td colSpan={7} className="py-8 text-center text-slate-600">Cargando directorio de usuarios...</td></tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-600 space-y-2">
                  <p>No se encontraron usuarios con estos criterios.</p>
                  {hasActiveFilters && (
                    <button type="button" onClick={() => { setSearchInput(''); onQueryChange({ ...query, page: 1, search: '', status: 'ALL', role: 'ALL' }); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer">
                      Restablecer filtros
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isMutating = mutatingUserId === u.id;
                const isConfirming = pendingUser?.id === u.id;
                const isConfirmingRole = pendingRole?.id === u.id;
                const isSuspended = u.status === 'SUSPENDIDO';
                const nextStatus: 'ACTIVO' | 'SUSPENDIDO' = isSuspended ? 'ACTIVO' : 'SUSPENDIDO';
                const currentRole: PlatformRole = u.platformRole || (u.isSuperAdmin ? 'SUPERADMIN' : 'NONE');
                const pendingRoleLabel = isConfirmingRole && pendingRole
                  ? ROLE_OPTIONS.find((opt) => opt.value === pendingRole.nextRole)?.label ?? pendingRole.nextRole
                  : '';

                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    <th scope="row" className="py-3 px-3.5 text-left font-normal">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                          {u.fullName.slice(0, 2).toUpperCase() || 'CP'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{u.fullName}</p>
                          <p className="text-[11px] text-slate-600 flex items-center gap-1"><Mail className="w-3 h-3 text-slate-600" aria-hidden="true" /> {u.email}</p>
                        </div>
                      </div>
                    </th>
                    <td className="py-3 px-3.5 space-y-1.5">
                      {currentRole === 'SUPERADMIN' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <Crown className="w-3 h-3 text-amber-700" aria-hidden="true" /> SuperAdmin
                        </span>
                      ) : (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {u.workspaceName || `Despacho — ${u.fullName}`}
                          </span>
                          {u.workspaceId && <p className="text-[10px] font-mono text-slate-600 mt-0.5">{u.workspaceId}</p>}
                        </div>
                      )}
                      {onChangeUserRole && (
                        <div className="space-y-1.5">
                          <label htmlFor={`role-select-${u.id}`} className="visually-hidden">Nivel de acceso para {u.email}</label>
                          <select
                            id={`role-select-${u.id}`}
                            disabled={isMutating}
                            value={isConfirmingRole && pendingRole ? pendingRole.nextRole : currentRole}
                            onChange={(e) => {
                              const nextRole = e.target.value as PlatformRole;
                              if (nextRole === currentRole) {
                                setPendingRole(null);
                                return;
                              }
                              setPendingRole({ id: u.id, fullName: u.fullName, nextRole });
                            }}
                            className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-800 cursor-pointer disabled:opacity-60"
                          >
                            {ROLE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                          {isConfirmingRole && pendingRole && (
                            <div role="alertdialog" aria-modal="false" aria-label={`Confirmar cambio de rol para ${pendingRole.fullName}`} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setPendingRole(null); } }} className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-lg bg-amber-50 border border-amber-300 text-[11px]">
                              <span className="font-bold text-amber-950">¿Asignar rol {pendingRoleLabel}?</span>
                              <button type="button" autoFocus onClick={() => setPendingRole(null)} className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer">Cancelar</button>
                              <button type="button" disabled={isMutating} onClick={() => { onChangeUserRole(u.id, pendingRole.nextRole); setPendingRole(null); }} className="px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-800 font-bold text-white cursor-pointer disabled:opacity-50">Confirmar</button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <span className="capitalize font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{u.provider}</span>
                        {!u.isSuperAdmin && (u.acquisitionSource === 'google_ads' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Megaphone className="w-3 h-3" aria-hidden="true" /> Google Ads
                          </span>
                        ) : u.acquisitionSource === 'utm' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">Campaña UTM</span>
                        ) : (
                          <span className="text-[10px] text-slate-600">Orgánico / Directo</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 font-bold text-slate-900">
                      {u.companiesCount > 0 && onViewUserCompanies ? (
                        <button type="button" onClick={() => onViewUserCompanies(u.email.startsWith('UID ') ? u.id : u.email)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold transition cursor-pointer">
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
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${isSuspended ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-emerald-100 text-emerald-800'}`}>
                          {isSuspended ? <Ban className="w-3 h-3 text-red-600" aria-hidden="true" /> : <CheckCircle className="w-3 h-3 text-emerald-600" aria-hidden="true" />}
                          {u.status}
                        </span>
                        {currentRole !== 'SUPERADMIN' && onToggleUserStatus && !isConfirming && (
                          <button type="button" disabled={isMutating} onClick={() => setPendingUser({ id: u.id, nextStatus })} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer disabled:opacity-50 ${isSuspended ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-white hover:bg-red-50 text-red-700 border-red-200'}`}>
                            {isMutating ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : isSuspended ? <RotateCcw className="w-3 h-3" aria-hidden="true" /> : <Ban className="w-3 h-3" aria-hidden="true" />}
                            {isSuspended ? 'Reactivar' : 'Suspender'}<span className="visually-hidden"> a {u.fullName}</span>
                          </button>
                        )}
                        {isConfirming && pendingUser && onToggleUserStatus && (
                          <div role="alertdialog" aria-modal="false" aria-label={`Confirmar cambio de estado para ${u.fullName}`} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setPendingUser(null); } }} className="inline-flex flex-wrap items-center justify-end gap-1.5 p-1.5 rounded-lg bg-red-50 border border-red-200 text-[11px]">
                            <span className="font-bold text-red-900">{pendingUser.nextStatus === 'SUSPENDIDO' ? '¿Suspender?' : '¿Reactivar?'}</span>
                            <button type="button" autoFocus onClick={() => setPendingUser(null)} className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer">Cancelar</button>
                            <button type="button" disabled={isMutating} onClick={() => { onToggleUserStatus(u.id, pendingUser.nextStatus); setPendingUser(null); }} className={`px-2 py-0.5 rounded font-bold text-white cursor-pointer disabled:opacity-50 ${pendingUser.nextStatus === 'SUSPENDIDO' ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}>Confirmar</button>
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

      <AdminPaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} itemLabel="usuarios" isFetching={isFetching} onPageChange={(nextPage) => onQueryChange({ ...query, page: nextPage })} />
    </div>
  );
}
