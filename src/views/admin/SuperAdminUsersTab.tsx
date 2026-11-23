import { useState } from 'react';
import { Search, CheckCircle, Crown, Mail, Megaphone, UserCheck, X } from 'lucide-react';
import type { AdminUserSummary } from '../../shared/admin-types';

interface SuperAdminUsersTabProps {
  users: AdminUserSummary[];
  isLoading: boolean;
  onViewUserCompanies?: (query: string) => void;
}

export function SuperAdminUsersTab({
  users,
  isLoading,
  onViewUserCompanies
}: SuperAdminUsersTabProps) {
  const [query, setQuery] = useState('');

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      (u.acquisitionSource || '').toLowerCase().includes(q) ||
      (u.utmCampaign || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" aria-hidden="true" />
            Directorio de Usuarios Registrados
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Cuentas sincronizadas con Supabase Auth, Workspaces y atribución Google Ads
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span role="status" aria-live="polite" className="text-[11px] font-mono text-slate-600">
            {filtered.length} de {users.length} usuarios
          </span>
          <search className="relative w-full sm:w-64">
            <label htmlFor="admin-users-search" className="visually-hidden">
              Buscar usuario por correo, nombre o campaña
            </label>
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              id="admin-users-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.preventDefault();
                  setQuery('');
                }
              }}
              placeholder="Buscar correo, nombre o campaña..."
              className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda de usuarios"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 hover:text-slate-700 cursor-pointer"
              >
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
          <caption className="visually-hidden">
            Directorio de usuarios registrados en la plataforma
          </caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Usuario / Correo</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Workspace / Nivel</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Canal / Acceso</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Empresas</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Fecha Registro</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-600">
                  Cargando directorio de usuarios de Supabase...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-600">
                  No se encontraron usuarios con el término de búsqueda.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
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
                        {u.workspaceId && (
                          <p className="text-[10px] font-mono text-slate-600 mt-0.5">
                            {u.workspaceId}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3.5">
                    <div className="flex flex-col items-start gap-1">
                      <span className="capitalize font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {u.provider}
                      </span>
                      {!u.isSuperAdmin &&
                        (u.acquisitionSource === 'google_ads' ? (
                          <span
                            title={
                              u.utmCampaign || u.utmTerm || u.gclid
                                ? `Campaña: ${u.utmCampaign || 'Google Ads'} • Keyword: ${u.utmTerm || 'N/A'} • GCLID: ${u.gclid || 'sí'}`
                                : 'Adquirido vía campaña de Google Ads'
                            }
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
                        onClick={() =>
                          onViewUserCompanies(u.email.startsWith('UID ') ? u.id : u.email)
                        }
                        title="Ver empresas asociadas a este usuario"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold transition cursor-pointer"
                      >
                        {u.companiesCount} ver →
                      </button>
                    ) : (
                      <span className="text-slate-600 font-medium">{u.companiesCount}</span>
                    )}
                  </td>
                  <td className="py-3 px-3.5 text-slate-600 text-[11px]">
                    {new Date(u.createdAt).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="py-3 px-3.5 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                      <CheckCircle className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                      {u.status}
                    </span>
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
