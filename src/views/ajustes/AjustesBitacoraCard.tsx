import { useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { MEXICO_TIMEZONE } from '../../shared/date-utils';
import type { Company } from '../../shared/types';
import type { CompanyAuditLogRecord } from '../../shared/types/despacho-rbac.types';

const AUDIT_DATE_FMT = new Intl.DateTimeFormat('es-MX', {
  timeZone: MEXICO_TIMEZONE,
  dateStyle: 'short',
  timeStyle: 'short'
});

export interface AjustesBitacoraCardProps {
  activeCompany: Company | null;
  auditLogs: CompanyAuditLogRecord[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function AjustesBitacoraCard({
  activeCompany,
  auditLogs,
  isLoading,
  onRefresh
}: AjustesBitacoraCardProps) {
  const [auditSearch, setAuditSearch] = useState('');

  const filteredLogs = auditLogs.filter((log) => {
    if (!auditSearch.trim()) return true;
    const q = auditSearch.toLowerCase();
    return (
      log.actorEmail.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.entityType.toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 p-4 sm:p-5 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-700" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900">
            Bitácora Contable {activeCompany ? `— ${activeCompany.name}` : ''}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            aria-label="Filtrar bitácora contable"
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
            placeholder="Filtrar por usuario o acción..."
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
          />
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Actualizar bitácora"
            className="p-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {!activeCompany ? (
        <p className="text-xs text-slate-500">Selecciona una empresa activa para consultar su bitácora.</p>
      ) : isLoading ? (
        <p className="text-xs text-slate-500">Cargando bitácora...</p>
      ) : filteredLogs.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">Sin movimientos registrados en bitácora para esta empresa.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-3 font-semibold">Fecha (CDMX)</th>
                <th className="py-2 pr-3 font-semibold">Actor</th>
                <th className="py-2 pr-3 font-semibold">Acción</th>
                <th className="py-2 pr-3 font-semibold">Entidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-600">
                    {AUDIT_DATE_FMT.format(new Date(log.createdAt))}
                  </td>
                  <td className="py-2 pr-3 font-medium text-slate-800">{log.actorEmail}</td>
                  <td className="py-2 pr-3 font-mono text-[11px] text-blue-800">{log.action}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    {log.entityType}
                    {log.entityId ? ` (${log.entityId})` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
