import { useState } from 'react';
import { Search, CheckCircle, Mail, Megaphone, UserCheck } from 'lucide-react';
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
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            Directorio de Usuarios Registrados
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cuentas sincronizadas con Supabase Auth, Workspaces y atribución Google Ads
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar correo, nombre o google_ads..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-2.5 px-3.5">Usuario / Correo</th>
              <th className="py-2.5 px-3.5">Workspace / Nivel</th>
              <th className="py-2.5 px-3.5">Canal / Acceso</th>
              <th className="py-2.5 px-3.5">Empresas</th>
              <th className="py-2.5 px-3.5">Fecha Registro</th>
              <th className="py-2.5 px-3.5 text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Cargando directorio de usuarios de Supabase...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No se encontraron usuarios con el término de búsqueda.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                        {u.fullName.slice(0, 2).toUpperCase() || 'CP'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{u.fullName}</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3.5">
                    {u.isSuperAdmin ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        👑 SuperAdmin
                      </span>
                    ) : (
                      <div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {u.workspaceName || `Workspace — ${u.fullName}`}
                        </span>
                        {u.workspaceId && (
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">
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
                          <span className="text-[10px] text-slate-400">Orgánico / Directo</span>
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
                      <span className="text-slate-400 font-medium">{u.companiesCount}</span>
                    )}
                  </td>
                  <td className="py-3 px-3.5 text-slate-500 text-[11px]">
                    {new Date(u.createdAt).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="py-3 px-3.5 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
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
