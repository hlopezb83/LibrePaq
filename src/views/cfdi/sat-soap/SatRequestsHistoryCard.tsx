import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  History,
  RefreshCw,
  XCircle
} from 'lucide-react';
import type { SatDownloadRequestRecord } from '../../../shared/types';
import { useToast } from '../../../context/ToastContext';

export interface SatRequestsHistoryCardProps {
  satRequests: SatDownloadRequestRecord[];
  onVerifyPending?: () => void;
  isVerifyingPending?: boolean;
  isReadOnlyClient?: boolean;
}

export function SatRequestsHistoryCard({
  satRequests,
  onVerifyPending,
  isVerifyingPending,
  isReadOnlyClient = false
}: SatRequestsHistoryCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toast = useToast();

  if (satRequests.length === 0) return null;

  const hasPending = satRequests.some(
    (r) => r.estadoSolicitud === 'ACEPTADA' || r.estadoSolicitud === 'EN_PROCESO'
  );

  const handleCopy = (folio: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(folio);
      toast.success('Folio SAT Copiado', folio);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/60">
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-100/80 transition">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <History className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
            <span className="text-xs font-bold text-slate-800 truncate">
              Bitácora de Solicitudes y Descargas SAT
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 text-slate-700 font-mono shrink-0">
              {satRequests.length}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium shrink-0">
            <span>{isOpen ? 'Ocultar' : 'Ver bitácora'}</span>
            {isOpen ? (
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            )}
          </div>
        </button>

        {hasPending && onVerifyPending && (
          <button
            type="button"
            disabled={isVerifyingPending || isReadOnlyClient}
            onClick={onVerifyPending}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title="Consultar al SAT estatus de las solicitudes pendientes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingPending ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">{isVerifyingPending ? 'Consultando...' : '↻ Comprobar con el SAT'}</span>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white space-y-2.5">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Registro oficial de peticiones comunicadas con los Servicios Oficiales del SAT para esta empresa.
          </p>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden font-mono text-xs">
            {satRequests.slice(0, 10).map((r) => {
              const isDone = r.estadoSolicitud === 'TERMINADA';
              const isError = r.estadoSolicitud === 'ERROR';
              const isPending = r.estadoSolicitud === 'ACEPTADA' || r.estadoSolicitud === 'EN_PROCESO';

              return (
                <div
                  key={r.id}
                  className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-slate-50/80 transition"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 font-sans text-xs">
                        {r.tipoSolicitud === 'EMITIDOS'
                          ? '📤 Emitidas (Ingresos)'
                          : '📥 Recibidas (Gastos)'}
                      </span>
                      <span className="text-slate-500" aria-hidden="true">•</span>
                      <span className="text-slate-600 text-[11px]">
                        {r.fechaInicial} al {r.fechaFinal}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <span>Folio:</span>
                      <strong className="text-slate-800 truncate max-w-[140px] sm:max-w-[200px]" title={r.idSolicitudSat}>
                        {r.idSolicitudSat}
                      </strong>
                      <button
                        type="button"
                        onClick={() => handleCopy(r.idSolicitudSat)}
                        aria-label={`Copiar folio SAT ${r.idSolicitudSat}`}
                        title="Copiar Folio SAT"
                        className="min-h-[28px] min-w-[28px] inline-flex items-center justify-center p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Copy className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start md:self-center font-sans">
                    {isDone && (r.cfdisDescargados || 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                        {r.cfdisDescargados} XMLs integrados
                      </span>
                    )}

                    {isDone && (!r.cfdisDescargados || r.cfdisDescargados === 0) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                        0 comprobantes (periodo sin emitir)
                      </span>
                    )}

                    {isPending && (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 animate-pulse">
                          <Clock className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                          En proceso SAT
                        </span>
                        {onVerifyPending && (
                          <button
                            type="button"
                            disabled={isVerifyingPending || isReadOnlyClient}
                            onClick={onVerifyPending}
                            className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Comprobar estatus oficial en el SAT"
                          >
                            ↻ Comprobar
                          </button>
                        )}
                      </div>
                    )}

                    {isError && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900" title={r.mensajeSat || ''}>
                        <XCircle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                        {r.codigoEstadoSat === '301'
                          ? 'Fecha futura (301)'
                          : r.codigoEstadoSat === '5004'
                          ? 'Sin CFDIs (5004)'
                          : r.codigoEstadoSat === '5' || r.codigoEstadoSat === '5002'
                          ? 'Ya atendida (5)'
                          : `Rechazada (${r.codigoEstadoSat || '5'})`}
                      </span>
                    )}

                    <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                      {r.createdAt?.slice(5, 16).replace('T', ' ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
