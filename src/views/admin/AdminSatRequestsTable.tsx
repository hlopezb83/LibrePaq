import type { AdminSatHealthResponse } from '../../shared/admin-types';
import { formatAdminDateTime } from './adminFormatters';
import { SatCompanyRfcCell } from './AdminSatFielTable';

function getRequestStatusBadge(estado: string): string {
  const lower = estado.toLowerCase();
  if (lower.includes('termin') || lower.includes('complet') || lower === '3') return 'bg-emerald-100 text-emerald-900 border-emerald-300';
  if (lower.includes('error') || lower.includes('rechaz') || lower.includes('fall') || lower === '4' || lower === '5') {
    return 'bg-red-100 text-red-900 border-red-300';
  }
  return 'bg-amber-100 text-amber-950 border-amber-300';
}

interface AdminSatRequestsTableProps {
  recentRequests?: AdminSatHealthResponse['recentRequests'];
  isLoading: boolean;
  onInspectCompanyRfc?: (rfc: string) => void;
}

export function AdminSatRequestsTable({ recentRequests, isLoading, onInspectCompanyRfc }: AdminSatRequestsTableProps) {
  return (
    <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-3">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Solicitudes de Descarga Masiva Recientes</h2>
        <p className="text-xs text-slate-600 mt-0.5">Últimas peticiones enviadas al WebService del SAT</p>
      </div>

      <div tabIndex={0} role="region" aria-label="Solicitudes SAT recientes" className="overflow-x-auto max-h-[55vh] border border-slate-200 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        <table className="w-full text-left text-xs border-separate border-spacing-0">
          <caption className="visually-hidden">Solicitudes recientes al servicio de descarga masiva del SAT</caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Empresa / RFC</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Tipo</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Estado</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Código / Mensaje SAT</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">CFDIs</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {!recentRequests || recentRequests.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-600">
                  {isLoading ? 'Cargando solicitudes recientes...' : 'No hay solicitudes SAT recientes registradas.'}
                </td>
              </tr>
            ) : (
              recentRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/80">
                  <SatCompanyRfcCell companyName={req.companyName} companyRfc={req.companyRfc} onInspectCompanyRfc={onInspectCompanyRfc} />
                  <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700">{req.tipoSolicitud}</td>
                  <td className="py-2.5 px-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${getRequestStatusBadge(req.estadoSolicitud)}`}>
                      {req.estadoSolicitud}
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 max-w-xs">
                    <span className="font-mono font-bold text-slate-900 mr-1.5">{req.codigoEstadoSat || '—'}</span>
                    <span className="text-[11px] text-slate-700 line-clamp-2" title={req.mensajeSat}>
                      {req.mensajeSat || 'Sin mensaje adicional'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 text-right font-semibold tabular-nums">{req.cfdisDescargados.toLocaleString('es-MX')}</td>
                  <td className="py-2.5 px-3.5 text-right text-slate-700 whitespace-nowrap">{formatAdminDateTime(req.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
