import { Check, Copy, Server } from 'lucide-react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
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
  const { copiedKey, copy } = useCopyToClipboard<string>(2000);

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
        <Server className="w-4 h-4 text-blue-700" aria-hidden="true" />
        Historial de Descargas del SAT con e.firma
      </h3>
      {soapRequests && soapRequests.length > 0 ? (
        <div
          tabIndex={0}
          role="region"
          aria-label="Tabla de descargas masivas SAT"
          className="overflow-x-auto rounded-xl border border-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <table className="w-full text-left text-xs">
            <caption className="visually-hidden">
              Historial de descargas masivas del SAT con e.firma para {companyRfc}
            </caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th scope="col" className="py-2 px-2.5">Folio SAT</th>
                <th scope="col" className="py-2 px-2.5">Tipo</th>
                <th scope="col" className="py-2 px-2.5">Periodo</th>
                <th scope="col" className="py-2 px-2.5">Estado</th>
                <th scope="col" className="py-2 px-2.5">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {soapRequests.map((req) => {
                const folioFull = req.idSolicitudSat || req.id;
                const copied = copiedKey === folioFull;
                return (
                  <tr key={req.id}>
                    <td className="py-2 px-2.5 font-mono text-slate-900 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <span title={folioFull}>
                          {req.idSolicitudSat ? `${req.idSolicitudSat.slice(0, 16)}…` : `${req.id.slice(0, 12)}…`}
                        </span>
                        <button
                          type="button"
                          onClick={() => void copy(folioFull, folioFull)}
                          aria-label={`Copiar folio SAT ${folioFull}`}
                          title={copied ? 'Folio SAT copiado' : 'Copiar folio completo de solicitud SAT'}
                          className="min-w-7 min-h-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                        >
                          {copied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-2 px-2.5">{req.tipoSolicitud}</td>
                    <td className="py-2 px-2.5 font-mono text-[11px] whitespace-nowrap">
                      {req.fechaInicial} / {req.fechaFinal}
                    </td>
                    <td className="py-2 px-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        {req.estadoSolicitud}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-slate-600 whitespace-nowrap">
                      {formatShortDate(req.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-600 py-3 text-center">
          No hay solicitudes de descarga masiva pendientes ante el SAT para {companyRfc}.
        </p>
      )}
    </div>
  );
}
