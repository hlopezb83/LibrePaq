import { StatusBadge, type BadgeTone } from '../../components/ui';
import type { AdminSatHealthResponse } from '../../shared/admin-types';
import { formatAdminDateTime } from './adminFormatters';
import { SatCompanyRfcCell } from './AdminSatFielTable';

function getRequestStatusTone(estado: string): BadgeTone {
  const lower = estado.toLowerCase();
  if (lower.includes('termin') || lower.includes('complet') || lower === '3') return 'emerald';
  if (lower.includes('error') || lower.includes('rechaz') || lower.includes('fall') || lower === '4' || lower === '5') {
    return 'red';
  }
  return 'amber';
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
          <tbody className="text-slate-800">
            {!recentRequests || recentRequests.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-600 border-b border-slate-200">
                  {isLoading ? 'Cargando solicitudes recientes...' : 'No hay solicitudes SAT recientes registradas.'}
                </td>
              </tr>
            ) : (
              recentRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/80">
                  <SatCompanyRfcCell companyName={req.companyName} companyRfc={req.companyRfc} onInspectCompanyRfc={onInspectCompanyRfc} />
                  <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700 border-b border-slate-200">{req.tipoSolicitud}</td>
                  <td className="py-2.5 px-3.5 border-b border-slate-200">
                    <StatusBadge tone={getRequestStatusTone(req.estadoSolicitud)}>
                      {req.estadoSolicitud}
                    </StatusBadge>
                  </td>
                  <td className="py-2.5 px-3.5 max-w-xs border-b border-slate-200">
                    <span className="font-mono font-bold text-slate-900 mr-1.5">{req.codigoEstadoSat || '—'}</span>
                    <span className="text-[11px] text-slate-700 line-clamp-2" title={req.mensajeSat}>
                      {req.mensajeSat || 'Sin mensaje adicional'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 text-right font-semibold font-mono tabular-nums border-b border-slate-200">{req.cfdisDescargados.toLocaleString('es-MX')}</td>
                  <td className="py-2.5 px-3.5 text-right text-slate-700 whitespace-nowrap border-b border-slate-200">{formatAdminDateTime(req.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
