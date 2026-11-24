import { useRef, useState } from 'react';
import { Ban, Check, CheckCircle, Copy, Crown, Download, Gauge, Mail, Megaphone, UserCheck, X } from 'lucide-react';
import type { AdminUserSummary, AdminUsersPageQuery, PlatformRole } from '../../shared/admin-types';
import { useToast } from '../../context/ToastContext';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { AdminPaginationBar } from './AdminPaginationBar';
import { AdminSearchInput } from './AdminSearchInput';
import { AdminTableEmptyState } from './AdminTableEmptyState';
import { AdminUserRoleControl, AdminUserStatusControl } from './AdminUserRowActions';
import { AdminUserQuotaModal, type AdminUserQuotaTarget } from './AdminUserQuotaModal';
import { ADMIN_ROLE_OPTIONS, formatAdminDate } from './adminFormatters';
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
  canManageQuotas?: boolean;
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
  mutatingUserId = null,
  canManageQuotas = false
}: SuperAdminUsersTabProps) {
  const toast = useToast();
  const { copiedKey: copiedEmail, copy: copyEmail } = useCopyToClipboard<string>(1800);
  const [quotaTarget, setQuotaTarget] = useState<AdminUserQuotaTarget | null>(null);
  const lastQuotaTriggerRef = useRef<HTMLButtonElement | null>(null);
  const statusFilter = query.status || 'ALL';
  const roleFilter = query.role || 'ALL';
  const hasActiveFilters = Boolean(query.search || statusFilter !== 'ALL' || roleFilter !== 'ALL');
  const roleLabel = ADMIN_ROLE_OPTIONS.find((r) => r.value === roleFilter)?.label ?? roleFilter;

  const openQuotaModal = (target: AdminUserQuotaTarget, trigger: HTMLButtonElement) => {
    lastQuotaTriggerRef.current = trigger;
    setQuotaTarget(target);
  };

  const closeQuotaModal = () => {
    setQuotaTarget(null);
    requestAnimationFrame(() => lastQuotaTriggerRef.current?.focus());
  };

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
            {ADMIN_ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>

          <button
            type="button"
            disabled={users.length === 0}
            title={users.length === 0 ? 'No hay usuarios en la página actual para exportar' : `Exportar ${users.length} usuarios de la página actual en CSV`}
            onClick={() => {
              exportUsersCsv(users);
              toast.success('CSV exportado', `Se exportaron ${users.length} usuarios de la página actual.`);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-slate-700 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" /> Exportar CSV
          </button>

          <AdminSearchInput id="admin-users-search" label="Buscar usuario por correo, nombre o campaña" value={query.search || ''} onDebouncedChange={(search) => onQueryChange({ ...query, page: 1, search })} placeholder="Buscar correo o nombre... (/)" clearAriaLabel="Limpiar búsqueda de usuarios" isFetching={isFetching} className="w-full sm:w-56" />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]" role="region" aria-label="Filtros activos">
          <span className="text-slate-600 font-semibold">Filtros:</span>
          {query.search && (
            <button type="button" onClick={() => onQueryChange({ ...query, page: 1, search: '' })} aria-label={`Quitar filtro de búsqueda ${query.search}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-semibold hover:bg-blue-100 transition cursor-pointer">
              <span>Búsqueda: &ldquo;{query.search}&rdquo;</span>
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
          {statusFilter !== 'ALL' && (
            <button type="button" onClick={() => onQueryChange({ ...query, page: 1, status: 'ALL' })} aria-label={`Quitar filtro de estatus ${statusFilter}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-semibold hover:bg-slate-200 transition cursor-pointer">
              <span>Estatus: {statusFilter === 'ACTIVO' ? 'Activos' : 'Suspendidos'}</span>
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
          {roleFilter !== 'ALL' && (
            <button type="button" onClick={() => onQueryChange({ ...query, page: 1, role: 'ALL' })} aria-label={`Quitar filtro de rol ${roleLabel}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold hover:bg-indigo-100 transition cursor-pointer">
              <span>Rol: {roleLabel}</span>
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={() => onQueryChange({ ...query, page: 1, search: '', status: 'ALL', role: 'ALL' })} className="text-blue-700 hover:text-blue-900 font-bold px-1.5 py-0.5 rounded hover:bg-blue-50 transition cursor-pointer">
            Limpiar todo
          </button>
        </div>
      )}

      <div tabIndex={0} role="region" aria-label="Tabla de usuarios registrados" className="overflow-x-auto max-h-[68vh] border border-slate-200 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        <table className="w-full text-left text-xs border-separate border-spacing-0">
          <caption className="visually-hidden">Directorio paginado de usuarios registrados y niveles de acceso</caption>
          <thead className="sticky top-0 z-20 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" className="sticky left-0 z-30 py-2.5 px-2.5 border-b border-r border-slate-200 bg-slate-50">Usuario / Correo</th>
              <th scope="col" className="py-2.5 px-2.5 border-b border-slate-200 bg-slate-50">Despacho / Nivel de acceso</th>
              <th scope="col" className="py-2.5 px-2.5 border-b border-slate-200 bg-slate-50">Canal / Acceso</th>
              <th scope="col" className="py-2.5 px-2.5 border-b border-slate-200 bg-slate-50">Empresas</th>
              <th scope="col" className="py-2.5 px-2.5 border-b border-slate-200 bg-slate-50">Registro</th>
              <th scope="col" className="py-2.5 px-2.5 border-b border-slate-200 bg-slate-50">Último acceso</th>
              <th scope="col" className="py-2.5 px-2.5 border-b border-slate-200 bg-slate-50 text-right">Estado / Control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
                  <td className="py-2.5 px-2.5"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-slate-200 shrink-0" /><div><div className="h-3.5 w-28 bg-slate-200 rounded mb-1" /><div className="h-3 w-36 bg-slate-100 rounded" /></div></div></td>
                  <td className="py-2.5 px-2.5"><div className="h-5 w-32 bg-slate-200 rounded-lg mb-1" /><div className="h-6 w-28 bg-slate-100 rounded-lg" /></td>
                  <td className="py-2.5 px-2.5"><div className="h-4 w-16 bg-slate-200 rounded mb-1" /><div className="h-3 w-24 bg-slate-100 rounded" /></td>
                  <td className="py-2.5 px-2.5"><div className="h-5 w-12 bg-slate-200 rounded-lg" /></td>
                  <td className="py-2.5 px-2.5"><div className="h-3.5 w-20 bg-slate-200 rounded" /></td>
                  <td className="py-2.5 px-2.5"><div className="h-3.5 w-20 bg-slate-200 rounded" /></td>
                  <td className="py-2.5 px-2.5 text-right"><div className="h-5 w-16 bg-slate-200 rounded-full ml-auto" /></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <AdminTableEmptyState colSpan={7} message="No se encontraron usuarios con estos criterios." hasActiveFilters={hasActiveFilters} onResetFilters={() => onQueryChange({ ...query, page: 1, search: '', status: 'ALL', role: 'ALL' })} />
            ) : (
              users.map((u) => {
                const isMutating = mutatingUserId === u.id;
                const isSuspended = u.status === 'SUSPENDIDO';
                const currentRole: PlatformRole = u.platformRole || (u.isSuperAdmin ? 'SUPERADMIN' : 'NONE');
                const workspaceLabel = u.workspaceName || `Despacho — ${u.fullName}`;

                return (
                  <tr key={u.id} className="group hover:bg-slate-50/80 transition">
                    <th scope="row" className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-100 py-2.5 px-2.5 max-w-[215px] text-left font-normal">
                      <div className="flex items-center gap-2 min-w-0">
                        <div aria-hidden="true" className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                          {u.fullName.slice(0, 2).toUpperCase() || 'CP'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 truncate" title={u.fullName}>{u.fullName}</p>
                          <div className="text-[11px] text-slate-600 flex items-center gap-1 min-w-0">
                            <Mail className="w-3 h-3 text-slate-600 shrink-0" aria-hidden="true" />
                            <span className="truncate" title={u.email}>{u.email}</span>
                            <button type="button" onClick={() => void copyEmail(u.email, u.id)} aria-label={`Copiar correo ${u.email}`} title={copiedEmail === u.id ? 'Correo copiado' : `Copiar correo ${u.email}`} className="min-h-7 min-w-7 inline-flex items-center justify-center rounded text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer shrink-0">
                              {copiedEmail === u.id ? <Check className="w-3 h-3 text-emerald-700" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </th>
                    <td className="py-2.5 px-2.5 max-w-[190px] space-y-1.5">
                      {currentRole === 'SUPERADMIN' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <Crown className="w-3 h-3 text-amber-700" aria-hidden="true" /> SuperAdmin
                        </span>
                      ) : (
                        <div className="max-w-full">
                          <span
                            title={workspaceLabel}
                            className="inline-block max-w-full truncate px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 align-bottom"
                          >
                            {workspaceLabel}
                          </span>
                          {u.workspaceId && <p className="text-[10px] font-mono text-slate-600 mt-0.5 truncate" title={u.workspaceId}>{u.workspaceId}</p>}
                        </div>
                      )}
                      {u.workspaceId && (
                        <button
                          type="button"
                          onClick={(e) => openQuotaModal({ userId: u.id, fullName: u.fullName, email: u.email, workspaceId: u.workspaceId!, workspaceName: u.workspaceName }, e.currentTarget)}
                          title={canManageQuotas ? 'Editar plan y cuota del despacho' : 'Consultar plan y cuota del despacho (solo lectura)'}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-bold transition cursor-pointer"
                        >
                          <Gauge className="w-3 h-3" aria-hidden="true" /> {canManageQuotas ? 'Plan / Cuota' : 'Ver Cuota'}<span className="visually-hidden"> de {u.fullName}</span>
                        </button>
                      )}
                      {onChangeUserRole && (
                        <AdminUserRoleControl user={u} currentRole={currentRole} isMutating={isMutating} onChangeUserRole={onChangeUserRole} />
                      )}
                    </td>
                    <td className="py-2.5 px-2.5">
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
                    <td className="py-2.5 px-2.5 font-bold text-slate-900 whitespace-nowrap">
                      {u.companiesCount > 0 && onViewUserCompanies ? (
                        <button
                          type="button"
                          aria-label={`Ver ${u.companiesCount} empresas de ${u.fullName}`}
                          onClick={() => onViewUserCompanies(u.email.startsWith('UID ') ? u.id : u.email)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold tabular-nums transition cursor-pointer"
                        >
                          {u.companiesCount} ver →
                        </button>
                      ) : (
                        <span className="text-slate-600 font-medium tabular-nums">{u.companiesCount}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-600 text-[11px] whitespace-nowrap">{formatAdminDate(u.createdAt)}</td>
                    <td className="py-2.5 px-2.5 text-slate-600 text-[11px] whitespace-nowrap">{formatAdminDate(u.lastSignInAt)}</td>
                    <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex flex-col items-end gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${isSuspended ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-emerald-100 text-emerald-800'}`}>
                          {isSuspended ? <Ban className="w-3 h-3 text-red-600" aria-hidden="true" /> : <CheckCircle className="w-3 h-3 text-emerald-600" aria-hidden="true" />}
                          {u.status}
                        </span>
                        {currentRole !== 'SUPERADMIN' && onToggleUserStatus && (
                          <AdminUserStatusControl user={u} isSuspended={isSuspended} isMutating={isMutating} onToggleUserStatus={onToggleUserStatus} />
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
      <span className="visually-hidden" aria-live="polite">
        {copiedEmail ? 'Correo electrónico copiado al portapapeles' : ''}
      </span>
      <AdminUserQuotaModal target={quotaTarget} canEdit={canManageQuotas} onClose={closeQuotaModal} />
    </div>
  );
}
