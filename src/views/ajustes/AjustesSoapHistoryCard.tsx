import { Server } from 'lucide-react';
import { formatShortDate } from '../../lib/formatters';

export interface SoapHistoryItem {
  id: string;
  idSolicitudSat?: string;
  tipoSolicitud: string;
  fechaInicial: string;
  fechaFinal: string;
  estadoSolicitud: string;
  createdAt: string;
}

interface AjustesSoapHistoryCardProps {
  companyRfc: string;
  soapRequests?: SoapHistoryItem[];
}

export function AjustesSoapHistoryCard({
  companyRfc,
  soapRequests
}: AjustesSoapHistoryCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
        <Server className="w-4 h-4 text-blue-700" aria-hidden="true" />
        Historial de Descargas del SAT con e.firma
      </h3>
      {soapRequests && soapRequests.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="visually-hidden">
              Historial de descargas masivas del SAT con e.firma para {companyRfc}
            </caption>
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                <th scope="col" className="py-2">Folio SAT</th>
                <th scope="col" className="py-2">Tipo</th>
                <th scope="col" className="py-2">Periodo</th>
                <th scope="col" className="py-2">Estado</th>
                <th scope="col" className="py-2">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {soapRequests.map((req) => (
                <tr key={req.id}>
                  <td className="py-2 font-mono text-slate-900">
                    {req.idSolicitudSat ? req.idSolicitudSat.slice(0, 16) : req.id}...
                  </td>
                  <td className="py-2">{req.tipoSolicitud}</td>
                  <td className="py-2 font-mono text-[11px]">
                    {req.fechaInicial} / {req.fechaFinal}
                  </td>
                  <td className="py-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {req.estadoSolicitud}
                    </span>
                  </td>
                  <td className="py-2 text-slate-500">{formatShortDate(req.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-400 py-3 text-center">
          No hay solicitudes de descarga masiva pendientes ante el SAT para {companyRfc}.
        </p>
      )}
    </div>
  );
}
