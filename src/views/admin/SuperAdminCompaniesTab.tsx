import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Building2, Calendar, Download, Eye, KeyRound, Search, X } from 'lucide-react';
import type { AdminCompanySummary, AdminUserSummary } from '../../shared/admin-types';
import { CompanyUserOwnerCell } from './CompanyUserOwnerCell';
import { SuperAdminCompanyDrawer } from './SuperAdminCompanyDrawer';
import { exportCompaniesCsv } from './adminCsvExport';

type CompanyFilter = 'all' | 'users' | 'active' | 'inactive' | 'fiel' | 'demo';
type CompanySort = 'createdAt' | 'polizasCount' | 'cfdisCount';

interface SuperAdminCompaniesTabProps {
  companies: AdminCompanySummary[];
  users?: AdminUserSummary[];
  isLoading: boolean;
  initialQuery?: string;
  onDeleteCompany?: (companyId: string) => Promise<void> | void;
  isDeletingCompany?: boolean;
}

function hasActivity(c: AdminCompanySummary): boolean {
  return (c.polizasCount ?? 0) > 0 || (c.cfdisCount ?? 0) > 0 || Boolean(c.lastActivityAt);
}

export function SuperAdminCompaniesTab({
  companies,
  users = [],
  isLoading,
  initialQuery = '',
  onDeleteCompany,
  isDeletingCompany = false
}: SuperAdminCompaniesTabProps) {
  const [query, setQuery] = useState(initialQuery);
  const [ownerFilter, setOwnerFilter] = useState<CompanyFilter>('users');
  const [sortBy, setSortBy] = useState<CompanySort>('createdAt');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [inspectingCompanyId, setInspectingCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  const enrichedCompanies = useMemo(() => {
    const usersById = new Map(users.map((u) => [u.id, u]));
    return companies.map((c) => {
      if (!c.userId || c.ownerType === 'demo') return { ...c, resolvedOwnerType: 'demo' as const };
      const matched = usersById.get(c.userId);
      const userEmail = c.userEmail || (matched && !matched.email.startsWith('UID ') ? matched.email : undefined);
      const userFullName = c.userFullName || matched?.fullName || 'Usuario Registrado';
      const userProvider = c.userProvider || matched?.provider;
      const userIsSuperAdmin = Boolean(c.userIsSuperAdmin ?? matched?.isSuperAdmin);
      return {
        ...c,
        userEmail,
        userFullName,
        userProvider,
        userIsSuperAdmin,
        resolvedOwnerType: userIsSuperAdmin ? ('superadmin' as const) : ('user' as const)
      };
    });
  }, [companies, users]);

  const counts = useMemo(() => ({
    all: enrichedCompanies.length,
    users: enrichedCompanies.filter((c) => c.resolvedOwnerType !== 'demo').length,
    active: enrichedCompanies.filter(hasActivity).length,
    inactive: enrichedCompanies.filter((c) => !hasActivity(c)).length,
    fiel: enrichedCompanies.filter((c) => Boolean(c.hasFiel)).length,
    demo: enrichedCompanies.filter((c) => c.resolvedOwnerType === 'demo').length
  }), [enrichedCompanies]);

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = enrichedCompanies.filter((c) => {
      if (ownerFilter === 'users' && c.resolvedOwnerType === 'demo') return false;
      if (ownerFilter === 'demo' && c.resolvedOwnerType !== 'demo') return false;
      if (ownerFilter === 'active' && !hasActivity(c)) return false;
      if (ownerFilter === 'inactive' && hasActivity(c)) return false;
      if (ownerFilter === 'fiel' && !c.hasFiel) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.rfc.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.userFullName || '').toLowerCase().includes(q) ||
        (c.userEmail || '').toLowerCase().includes(q) ||
        (c.userId || '').toLowerCase().includes(q)
      );
    });

    const factor = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortBy === 'polizasCount') return ((a.polizasCount ?? 0) - (b.polizasCount ?? 0)) * factor;
      if (sortBy === 'cfdisCount') return ((a.cfdisCount ?? 0) - (b.cfdisCount ?? 0)) * factor;
      return ((Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0)) * factor;
    });
  }, [enrichedCompanies, ownerFilter, query, sortBy, sortDir]);

  const filterButtons: Array<{ id: CompanyFilter; label: string; count: number }> = [
    { id: 'all', label: 'Todas', count: counts.all },
    { id: 'users', label: 'De Usuarios', count: counts.users },
    { id: 'active', label: 'Con Actividad', count: counts.active },
    { id: 'inactive', label: 'Sin Actividad', count: counts.inactive },
    { id: 'fiel', label: 'Con e.firma', count: counts.fiel },
    { id: 'demo', label: 'Demo', count: counts.demo }
  ];

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
              Relación multi-tenant, actividad contable, estatus e.firma e inspección de soporte
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span role="status" aria-live="polite" className="text-[11px] font-mono text-slate-600 whitespace-nowrap">
              {filteredAndSorted.length} de {enrichedCompanies.length} empresas
            </span>

            <div className="inline-flex items-center gap-1">
              <label htmlFor="admin-companies-sort" className="visually-hidden">Ordenar empresas por</label>
              <select
                id="admin-companies-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as CompanySort)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="createdAt">Fecha creación</option>
                <option value="polizasCount">Pólizas</option>
                <option value="cfdisCount">CFDIs</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                aria-label={`Cambiar orden a ${sortDir === 'desc' ? 'ascendente' : 'descendente'}`}
                className="p-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ArrowDownUp className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              disabled={filteredAndSorted.length === 0}
              onClick={() => exportCompaniesCsv(filteredAndSorted)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-bold text-slate-700 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Exportar CSV
            </button>

            <search className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && query) {
                    e.preventDefault();
                    setQuery('');
                  }
                }}
                placeholder="Buscar RFC, empresa o usuario..."
                aria-label="Buscar por RFC, razón social, usuario o correo electrónico"
                className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Limpiar búsqueda de empresas"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </search>
          </div>
        </div>

        <div
          role="group"
          aria-label="Filtrar empresas por propietario y actividad"
          className="inline-flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold self-start gap-1"
        >
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              aria-pressed={ownerFilter === btn.id}
              onClick={() => setOwnerFilter(btn.id)}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                ownerFilter === btn.id
                  ? btn.id === 'users'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {btn.label} ({btn.count})
            </button>
          ))}
        </div>
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-labelledby="admin-companies-caption"
        className="@container overflow-auto max-w-full max-h-[72vh] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      >
        <table className="w-full text-left text-xs border-separate border-spacing-0">
          <caption id="admin-companies-caption" className="sr-only">
            Directorio global de empresas fiscales y el usuario propietario relacionado con cada empresa
          </caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">RFC / Empresa</th>
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
              <tr><td colSpan={7} className="py-8 text-center text-slate-600">Cargando empresas fiscales y relación de usuarios...</td></tr>
            ) : filteredAndSorted.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-slate-600">No se encontraron empresas con el filtro o término de búsqueda.</td></tr>
            ) : (
              filteredAndSorted.map((c) => (
                <tr key={c.id} className="group hover:bg-slate-50/80 transition">
                  <th
                    scope="row"
                    className="py-3 px-3.5 text-left font-normal border-b border-slate-100 bg-white group-hover:bg-slate-50/80 sm:sticky sm:left-0 z-[1]"
                  >
                    <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{c.rfc}</span>
                    <p className="font-bold text-slate-900 mt-1">{c.name}</p>
                  </th>
                  <td className="py-3 px-3.5 border-b border-slate-100 min-w-[220px]">
                    <CompanyUserOwnerCell company={c} />
                  </td>
                  <td className="py-3 px-3.5 max-w-[200px] border-b border-slate-100">
                    <p className="truncate text-slate-700" title={c.regimenFiscal}>{c.regimenFiscal}</p>
                    <p className="font-mono text-[11px] text-slate-500">C.P. {c.codigoPostal}</p>
                  </td>
                  <td className="py-3 px-3.5 border-b border-slate-100 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      <Calendar className="w-3 h-3 text-slate-500" aria-hidden="true" />
                      P{String(c.currentPeriod).padStart(2, '0')} / {c.currentYear}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 border-b border-slate-100 whitespace-nowrap">
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-[11px] font-semibold text-slate-800">
                        {(c.polizasCount ?? 0).toLocaleString('es-MX')} pól. · {(c.cfdisCount ?? 0).toLocaleString('es-MX')} CFDI
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.hasFiel ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <KeyRound className="w-2.5 h-2.5" aria-hidden="true" />
                        {c.hasFiel ? 'e.firma activa' : 'Sin e.firma'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3.5 text-slate-600 text-[11px] border-b border-slate-100 whitespace-nowrap">
                    {new Date(c.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="py-3 px-3.5 text-right border-b border-slate-100 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setInspectingCompanyId(c.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      Inspeccionar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SuperAdminCompanyDrawer
        companyId={inspectingCompanyId}
        onClose={() => setInspectingCompanyId(null)}
        onDeleteCompany={onDeleteCompany}
        isDeletingCompany={isDeletingCompany}
      />
    </div>
  );
}
