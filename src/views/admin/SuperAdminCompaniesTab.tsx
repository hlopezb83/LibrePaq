import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownWideNarrow, ArrowUpNarrowWide, Building2, Calendar, Check, Copy, Download, Eye, KeyRound, Loader2, Search, X
} from 'lucide-react';
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
  const [searchInput, setSearchInput] = useState(query.search || '');
  const sortBy: CompanySort = query.sortBy ?? 'createdAt';
  const sortDir: 'desc' | 'asc' = query.sortDir ?? 'desc';
  const [inspectingCompanyId, setInspectingCompanyId] = useState<string | null>(null);

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

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const sortedCompanies = useMemo(
    () => enrichAndSortCompanies(companies, usersById, sortBy, sortDir),
    [companies, usersById, sortBy, sortDir]
  );

  const ownerFilter = query.ownerType || 'ALL';
  const fielFilter = query.fielFilter || 'ALL';
  const hasActiveFilters = Boolean(searchInput || ownerFilter !== 'ALL' || fielFilter !== 'ALL');
  const inspectingUserId = inspectingCompanyId ? companies.find((c) => c.id === inspectingCompanyId)?.userId : undefined;
  const workspaceHint = inspectingUserId ? usersById.get(inspectingUserId)?.workspaceId : undefined;

  return (
    <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              Directorio Global de Empresas Fiscales y Usuarios Asignados
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Consulta en tiempo real, cuotas de despacho y diagnóstico en Modo Soporte
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span role="status" aria-live="polite" className="text-[11px] font-mono text-slate-600 whitespace-nowrap">
              {total.toLocaleString('es-MX')} empresas encontradas
            </span>

            <div className="inline-flex items-center gap-1">
              <label htmlFor="admin-companies-sort" className="visually-hidden">Ordenar empresas</label>
              <select
                id="admin-companies-sort"
                value={sortBy}
                onChange={(e) => onQueryChange({ ...query, page: 1, sortBy: e.target.value as CompanySort, sortDir })}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer"
              >
                <option value="createdAt">Fecha creación</option>
                <option value="polizasCount">Pólizas</option>
                <option value="cfdisCount">CFDIs</option>
              </select>
              <button
                type="button"
                onClick={() => onQueryChange({ ...query, page: 1, sortBy, sortDir: sortDir === 'desc' ? 'asc' : 'desc' })}
                aria-label={`Cambiar orden a ${sortDir === 'desc' ? 'ascendente' : 'descendente'}`}
                title={sortDir === 'desc' ? 'Orden descendente (clic para cambiar a ascendente)' : 'Orden ascendente (clic para cambiar a descendente)'}
                className="p-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {sortDir === 'desc' ? (
                  <ArrowDownWideNarrow className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <ArrowUpNarrowWide className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            </div>

            <button
              type="button"
              disabled={sortedCompanies.length === 0}
              title={sortedCompanies.length === 0 ? 'No hay empresas en la página actual para exportar' : `Exportar ${sortedCompanies.length} empresas de la página actual en CSV`}
              onClick={() => {
                exportCompaniesCsv(sortedCompanies);
                toast.success('CSV exportado', `Se exportaron ${sortedCompanies.length} empresas de la página actual.`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-slate-700 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" /> Exportar CSV
            </button>

            <search className="relative w-full sm:w-60">
              <label htmlFor="admin-companies-search" className="visually-hidden">
                Buscar por RFC, razón social o correo electrónico
              </label>
              {isFetching ? (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              ) : (
                <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              )}
              <input
                id="admin-companies-search"
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
                placeholder="Buscar RFC, empresa o correo... (/)"
                className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    onQueryChange({ ...query, page: 1, search: '' });
                  }}
                  aria-label="Limpiar búsqueda de empresas"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </search>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filtrar empresas por propietario" className="inline-flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold gap-1">
            {([
              { id: 'ALL', label: 'Todas' },
              { id: 'user', label: 'De Usuarios' },
              { id: 'superadmin', label: 'SuperAdmin' },
              { id: 'demo', label: 'Demo' }
            ] as const).map((btn) => (
              <button
                key={btn.id}
                type="button"
                aria-pressed={ownerFilter === btn.id}
                onClick={() => onQueryChange({ ...query, page: 1, ownerType: btn.id })}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  ownerFilter === btn.id ? (btn.id === 'user' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-white text-slate-900 shadow-2xs') : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div role="group" aria-label="Filtrar empresas por vigencia e.firma" className="inline-flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold gap-1">
            {([
              { id: 'ALL', label: 'Cualquier FIEL' },
              { id: 'WITH_FIEL', label: 'Con e.firma' },
              { id: 'WITHOUT_FIEL', label: 'Sin e.firma' }
            ] as const).map((btn) => (
              <button
                key={btn.id}
                type="button"
                aria-pressed={fielFilter === btn.id}
                onClick={() => onQueryChange({ ...query, page: 1, fielFilter: btn.id })}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  fielFilter === btn.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div tabIndex={0} role="region" aria-labelledby="admin-companies-caption" className="@container overflow-auto max-w-full max-h-[68vh] border border-slate-200 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        <table className="w-full text-left text-xs border-separate border-spacing-0">
          <caption id="admin-companies-caption" className="sr-only">Directorio global paginado de empresas fiscales</caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 sm:sticky sm:left-0 sm:z-20">RFC / Empresa</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Usuario Relacionado</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Régimen / C.P.</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Periodo</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Actividad / e.firma</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Creación</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {isLoading ? (
              <tr><td colSpan={7} className="py-8 text-center text-slate-600">Cargando empresas fiscales...</td></tr>
            ) : sortedCompanies.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-600 space-y-2">
                  <p>No se encontraron empresas con estos filtros.</p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput('');
                        onQueryChange({ ...query, page: 1, search: '', ownerType: 'ALL', fielFilter: 'ALL' });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer"
                    >
                      Restablecer filtros
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              sortedCompanies.map((c) => (
                <tr key={c.id} className="group hover:bg-slate-50/80 transition">
                  <th scope="row" className="py-3 px-3.5 text-left font-normal border-b border-slate-100 bg-white group-hover:bg-slate-50/80 sm:sticky sm:left-0 z-[1]">
                    <div className="inline-flex items-center gap-1">
                      <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{c.rfc}</span>
                      <button
                        type="button"
                        onClick={() => void copyRfc(c.rfc, c.id)}
                        aria-label={`Copiar RFC ${c.rfc}`}
                        title={copiedRfc === c.id ? 'RFC copiado' : `Copiar RFC ${c.rfc}`}
                        className="p-1 rounded text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                      >
                        {copiedRfc === c.id ? <Check className="w-3 h-3 text-emerald-700" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                      </button>
                    </div>
                    <p className="font-bold text-slate-900 mt-1">{c.name}</p>
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
                    {new Date(c.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="py-3 px-3.5 text-right border-b border-slate-100 whitespace-nowrap">
                    <button type="button" onClick={() => setInspectingCompanyId(c.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition cursor-pointer">
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
        onClose={() => setInspectingCompanyId(null)}
        onDeleteCompany={onDeleteCompany}
        isDeletingCompany={isDeletingCompany}
      />
    </div>
  );
}
