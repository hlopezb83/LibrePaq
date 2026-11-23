import { useEffect, useState } from 'react';
import {
  Search,
  Building2,
  Calendar
} from 'lucide-react';
import type { AdminCompanySummary, AdminUserSummary } from '../../shared/admin-types';
import { CompanyUserOwnerCell } from './CompanyUserOwnerCell';

interface SuperAdminCompaniesTabProps {
  companies: AdminCompanySummary[];
  users?: AdminUserSummary[];
  isLoading: boolean;
  initialQuery?: string;
}

export function SuperAdminCompaniesTab({
  companies,
  users = [],
  isLoading,
  initialQuery = ''
}: SuperAdminCompaniesTabProps) {
  const [query, setQuery] = useState(initialQuery);
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'users' | 'demo'>('users');

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  const usersById = new Map(users.map((u) => [u.id, u]));

  const enrichedCompanies = companies.map((c) => {
    if (!c.userId || c.ownerType === 'demo') {
      return { ...c, resolvedOwnerType: 'demo' as const };
    }
    const matchedUser = usersById.get(c.userId);
    const resolvedEmail =
      c.userEmail ||
      (matchedUser && !matchedUser.email.startsWith('UID ') ? matchedUser.email : undefined);
    const resolvedName = c.userFullName || matchedUser?.fullName || 'Usuario Registrado';
    const resolvedProvider = c.userProvider || matchedUser?.provider;
    const resolvedSuper = Boolean(c.userIsSuperAdmin ?? matchedUser?.isSuperAdmin);

    return {
      ...c,
      userEmail: resolvedEmail,
      userFullName: resolvedName,
      userProvider: resolvedProvider,
      userIsSuperAdmin: resolvedSuper,
      resolvedOwnerType: resolvedSuper ? ('superadmin' as const) : ('user' as const)
    };
  });

  const userOwnedCount = enrichedCompanies.filter((c) => c.resolvedOwnerType !== 'demo').length;
  const demoCount = enrichedCompanies.filter((c) => c.resolvedOwnerType === 'demo').length;

  const filtered = enrichedCompanies.filter((c) => {
    if (ownerFilter === 'users' && c.resolvedOwnerType === 'demo') return false;
    if (ownerFilter === 'demo' && c.resolvedOwnerType !== 'demo') return false;

    const q = query.trim().toLowerCase();
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

  return (
    <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
            Directorio Global de Empresas Fiscales y Usuarios Asignados
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Relación multi-tenant entre cada empresa fiscal dada de alta y la cuenta de usuario propietaria
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <div
            role="group"
            aria-label="Filtrar empresas por propietario"
            className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold shrink-0"
          >
            <button
              type="button"
              aria-pressed={ownerFilter === 'all'}
              onClick={() => setOwnerFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                ownerFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas ({enrichedCompanies.length})
            </button>
            <button
              type="button"
              aria-pressed={ownerFilter === 'users'}
              onClick={() => setOwnerFilter('users')}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                ownerFilter === 'users'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              De Usuarios ({userOwnedCount})
            </button>
            <button
              type="button"
              aria-pressed={ownerFilter === 'demo'}
              onClick={() => setOwnerFilter('demo')}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                ownerFilter === 'demo'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Demo ({demoCount})
            </button>
          </div>

          <search className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar RFC, empresa, usuario o correo..."
              aria-label="Buscar por RFC, razón social, usuario o correo electrónico"
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </search>
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
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">
                RFC / Empresa
              </th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">
                Usuario Relacionado
              </th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">
                Régimen Fiscal
              </th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">
                C.P.
              </th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">
                Periodo Activo
              </th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">
                Fecha Creación
              </th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">
                ID Empresa
              </th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-600">
                  Cargando empresas fiscales y relación de usuarios...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-600">
                  No se encontraron empresas con el filtro o término de búsqueda.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="group hover:bg-slate-50/80 transition">
                  <th
                    scope="row"
                    className="py-3 px-3.5 text-left font-normal border-b border-slate-100 bg-white group-hover:bg-slate-50/80 sm:sticky sm:left-0 z-[1]"
                  >
                    <div>
                      <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {c.rfc}
                      </span>
                      <p className="font-bold text-slate-900 mt-1">{c.name}</p>
                    </div>
                  </th>

                  <td className="py-3 px-3.5 border-b border-slate-100 min-w-[230px]">
                    <CompanyUserOwnerCell company={c} />
                  </td>

                  <td
                    className="py-3 px-3.5 max-w-xs truncate text-slate-600 border-b border-slate-100"
                    title={c.regimenFiscal}
                  >
                    {c.regimenFiscal}
                  </td>

                  <td className="py-3 px-3.5 font-mono text-slate-600 border-b border-slate-100">
                    {c.codigoPostal}
                  </td>

                  <td className="py-3 px-3.5 border-b border-slate-100">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      <Calendar className="w-3 h-3 text-slate-500" aria-hidden="true" />
                      P{String(c.currentPeriod).padStart(2, '0')} / {c.currentYear}
                    </span>
                  </td>

                  <td className="py-3 px-3.5 text-slate-600 text-[11px] border-b border-slate-100 whitespace-nowrap">
                    {new Date(c.createdAt).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>

                  <td className="py-3 px-3.5 text-right font-mono text-[11px] text-slate-600 border-b border-slate-100">
                    {c.id}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
