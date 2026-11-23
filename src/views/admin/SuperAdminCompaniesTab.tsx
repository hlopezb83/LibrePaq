import { useMemo, useRef, useState } from 'react';
import { Calendar, Check, Copy, Eye, KeyRound, X } from 'lucide-react';
import type {
  AdminCompaniesPageQuery,
  AdminCompanySummary,
  AdminUserSummary,
  PlatformRole
} from '../../shared/admin-types';
import { useToast } from '../../context/ToastContext';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { CompanyUserOwnerCell } from './CompanyUserOwnerCell';
import { SuperAdminCompanyDrawer } from './SuperAdminCompanyDrawer';
import { AdminPaginationBar } from './AdminPaginationBar';
import { AdminCompaniesFilterBar } from './AdminCompaniesFilterBar';
import { AdminTableEmptyState } from './AdminTableEmptyState';
import { formatAdminDate } from './adminFormatters';
import { exportCompaniesCsv } from './adminCsvExport';
import { enrichAndSortCompanies, type CompanySort } from './adminCompaniesHelpers';

interface SuperAdminCompaniesTabProps {
  companies: AdminCompanySummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: AdminCompaniesPageQuery;
  onQueryChange: (next: AdminCompaniesPageQuery) => void;
  users?: AdminUserSummary[];
  isLoading: boolean;
  isFetching?: boolean;
  platformRole?: PlatformRole;
  onDeleteCompany?: (companyId: string) => Promise<void> | void;
  isDeletingCompany?: boolean;
}

export function SuperAdminCompaniesTab({
  companies,
  total,
  page,
  pageSize,
  totalPages,
  query,
  onQueryChange,
  users = [],
  isLoading,
  isFetching = false,
  platformRole = 'NONE',
  onDeleteCompany,
  isDeletingCompany = false
}: SuperAdminCompaniesTabProps) {
  const toast = useToast();
  const { copiedKey: copiedRfc, copy: copyRfc } = useCopyToClipboard<string>(1800);
  const sortBy: CompanySort = query.sortBy ?? 'createdAt';
  const sortDir: 'desc' | 'asc' = query.sortDir ?? 'desc';
  const [inspectingCompanyId, setInspectingCompanyId] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const openDrawer = (companyId: string, trigger: HTMLButtonElement | null) => {
    lastTriggerRef.current = trigger;
    setInspectingCompanyId(companyId);
  };

  const closeDrawer = () => {
    setInspectingCompanyId(null);
    requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const sortedCompanies = useMemo(
    () => enrichAndSortCompanies(companies, usersById, sortBy, sortDir),
    [companies, usersById, sortBy, sortDir]
  );

  const ownerFilter = query.ownerType || 'ALL';
  const fielFilter = query.fielFilter || 'ALL';
  const hasActiveFilters = Boolean(query.search || ownerFilter !== 'ALL' || fielFilter !== 'ALL');
  const ownerLabel = ownerFilter === 'user' ? 'De Usuarios' : ownerFilter === 'superadmin' ? 'SuperAdmin' : 'Demo';
  const fielLabel = fielFilter === 'WITH_FIEL' ? 'Con e.firma' : 'Sin e.firma';
  const inspectingUserId = inspectingCompanyId ? companies.find((c) => c.id === inspectingCompanyId)?.userId : undefined;
  const workspaceHint = inspectingUserId ? usersById.get(inspectingUserId)?.workspaceId : undefined;
  const activitySortAria = sortBy === 'polizasCount' || sortBy === 'cfdisCount' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
  const createdSortAria = sortBy === 'createdAt' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4">
      <AdminCompaniesFilterBar
        total={total}
        query={query}
        sortBy={sortBy}
        sortDir={sortDir}
        isFetching={isFetching}
        canExport={sortedCompanies.length > 0}
        exportCount={sortedCompanies.length}
        onQueryChange={onQueryChange}
        onExportCsv={() => {
          exportCompaniesCsv(sortedCompanies);
          toast.success('CSV exportado', `Se exportaron ${sortedCompanies.length} empresas de la página actual.`);
        }}
      />

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]" role="region" aria-label="Filtros activos">
          <span className="text-slate-600 font-semibold">Filtros:</span>
          {query.search && (
            <button
              type="button"
              onClick={() => onQueryChange({ ...query, page: 1, search: '' })}
              aria-label={`Quitar filtro de búsqueda ${query.search}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-semibold hover:bg-blue-100 transition cursor-pointer"
            >
              <span>Búsqueda: &ldquo;{query.search}&rdquo;</span>
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
          {ownerFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => onQueryChange({ ...query, page: 1, ownerType: 'ALL' })}
              aria-label={`Quitar filtro de propietario ${ownerLabel}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-semibold hover:bg-slate-200 transition cursor-pointer"
            >
              <span>Propietario: {ownerLabel}</span>
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
          {fielFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => onQueryChange({ ...query, page: 1, fielFilter: 'ALL' })}
              aria-label={`Quitar filtro de e.firma ${fielLabel}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold hover:bg-emerald-100 transition cursor-pointer"
            >
              <span>{fielLabel}</span>
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onQueryChange({ ...query, page: 1, search: '', ownerType: 'ALL', fielFilter: 'ALL' })}
            className="text-blue-700 hover:text-blue-900 font-bold px-1.5 py-0.5 rounded hover:bg-blue-50 transition cursor-pointer"
          >
            Limpiar todo
          </button>
        </div>
      )}

      <div tabIndex={0} role="region" aria-labelledby="admin-companies-caption" className="@container overflow-auto max-w-full max-h-[68vh] border border-slate-200 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        <table className="w-full text-left text-xs border-separate border-spacing-0">
          <caption id="admin-companies-caption" className="visually-hidden">Directorio global paginado de empresas fiscales</caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" className="py-2.5 px-3.5 max-w-[220px] border-b border-slate-200 bg-slate-50 lg:sticky lg:left-0 lg:z-20 lg:border-r lg:border-slate-200">RFC / Empresa</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Usuario Relacionado</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Régimen / C.P.</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Periodo</th>
              <th scope="col" aria-sort={activitySortAria} className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Actividad / e.firma</th>
              <th scope="col" aria-sort={createdSortAria} className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Creación</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
                  <td className="py-3 px-3.5 border-b border-slate-100"><div className="h-4 w-28 bg-slate-200 rounded mb-1.5" /><div className="h-3 w-40 bg-slate-100 rounded" /></td>
                  <td className="py-3 px-3.5 border-b border-slate-100"><div className="h-4 w-36 bg-slate-200 rounded mb-1" /><div className="h-3 w-28 bg-slate-100 rounded" /></td>
                  <td className="py-3 px-3.5 border-b border-slate-100"><div className="h-3.5 w-32 bg-slate-200 rounded mb-1" /><div className="h-3 w-16 bg-slate-100 rounded" /></td>
                  <td className="py-3 px-3.5 border-b border-slate-100"><div className="h-5 w-20 bg-slate-200 rounded" /></td>
                  <td className="py-3 px-3.5 border-b border-slate-100"><div className="h-3.5 w-28 bg-slate-200 rounded mb-1" /><div className="h-4 w-20 bg-slate-100 rounded-full" /></td>
                  <td className="py-3 px-3.5 border-b border-slate-100"><div className="h-3.5 w-20 bg-slate-200 rounded" /></td>
                  <td className="py-3 px-3.5 border-b border-slate-100 text-right"><div className="h-7 w-24 bg-slate-200 rounded-xl ml-auto" /></td>
                </tr>
              ))
            ) : sortedCompanies.length === 0 ? (
              <AdminTableEmptyState
                colSpan={7}
                message="No se encontraron empresas con estos filtros."
                hasActiveFilters={hasActiveFilters}
                onResetFilters={() => onQueryChange({ ...query, page: 1, search: '', ownerType: 'ALL', fielFilter: 'ALL' })}
              />
            ) : (
              sortedCompanies.map((c) => (
                <tr key={c.id} className="group hover:bg-slate-50 transition">
                  <th scope="row" className="py-3 px-3.5 max-w-[220px] text-left font-normal border-b border-slate-100 bg-white group-hover:bg-slate-50 lg:sticky lg:left-0 lg:border-r lg:border-slate-200 z-[1]">
                    <div className="inline-flex items-center gap-1">
                      <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{c.rfc}</span>
                      <button
                        type="button"
                        onClick={() => void copyRfc(c.rfc, c.id)}
                        aria-label={`Copiar RFC ${c.rfc}`}
                        title={copiedRfc === c.id ? 'RFC copiado' : `Copiar RFC ${c.rfc}`}
                        className="min-h-7 min-w-7 inline-flex items-center justify-center rounded text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                      >
                        {copiedRfc === c.id ? <Check className="w-3 h-3 text-emerald-700" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => openDrawer(c.id, e.currentTarget)}
                      title={c.name}
                      className="font-bold text-slate-900 hover:text-blue-700 text-left truncate block max-w-full mt-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded"
                    >
                      {c.name}
                    </button>
                  </th>
                  <td className="py-3 px-3.5 border-b border-slate-100 min-w-[220px]"><CompanyUserOwnerCell company={c} /></td>
                  <td className="py-3 px-3.5 max-w-[200px] border-b border-slate-100">
                    <p className="truncate text-slate-700" title={c.regimenFiscal}>{c.regimenFiscal}</p>
                    <p className="font-mono text-[11px] text-slate-600">C.P. {c.codigoPostal}</p>
                  </td>
                  <td className="py-3 px-3.5 border-b border-slate-100 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      <Calendar className="w-3 h-3 text-slate-600" aria-hidden="true" />
                      P{String(c.currentPeriod).padStart(2, '0')} / {c.currentYear}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 border-b border-slate-100 whitespace-nowrap">
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-[11px] font-semibold text-slate-800">{(c.polizasCount ?? 0).toLocaleString('es-MX')} pól. · {(c.cfdisCount ?? 0).toLocaleString('es-MX')} CFDI</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.hasFiel ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                        <KeyRound className="w-2.5 h-2.5" aria-hidden="true" /> {c.hasFiel ? 'e.firma activa' : 'Sin e.firma'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3.5 text-slate-600 text-[11px] border-b border-slate-100 whitespace-nowrap">
                    {formatAdminDate(c.createdAt)}
                  </td>
                  <td className="py-3 px-3.5 text-right border-b border-slate-100 whitespace-nowrap">
                    <button type="button" onClick={(e) => openDrawer(c.id, e.currentTarget)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition cursor-pointer">
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" /> Inspeccionar<span className="visually-hidden"> {c.name}</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        itemLabel="empresas"
        isFetching={isFetching}
        onPageChange={(nextPage) => onQueryChange({ ...query, page: nextPage })}
      />

      <span className="visually-hidden" aria-live="polite">
        {copiedRfc ? 'RFC copiado al portapapeles' : ''}
      </span>

      <SuperAdminCompanyDrawer
        companyId={inspectingCompanyId}
        platformRole={platformRole}
        workspaceIdHint={workspaceHint}
        onClose={closeDrawer}
        onDeleteCompany={onDeleteCompany}
        isDeletingCompany={isDeletingCompany}
      />
    </div>
  );
}
