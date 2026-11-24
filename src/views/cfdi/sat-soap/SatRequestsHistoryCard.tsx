import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  History,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { Button, StatusBadge } from '../../../components/ui';
import type { SatDownloadRequestRecord } from '../../../shared/types';
import { useToast } from '../../../context/ToastContext';
import { translateSatErrorCode } from './satErrorTranslator';

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
  const [showAll, setShowAll] = useState(false);
  const toast = useToast();

  if (satRequests.length === 0) return null;

  const hasPending = satRequests.some(
    (r) => r.estadoSolicitud === 'ACEPTADA' || r.estadoSolicitud === 'EN_PROCESO'
  );
  const visibleRequests = showAll ? satRequests : satRequests.slice(0, 10);
  const verifyDisabledReason = isReadOnlyClient
    ? 'Modo solo lectura: consulta SAT deshabilitada'
    : isVerifyingPending
    ? 'Consultando estatus de solicitudes ante el SAT...'
    : 'Consultar al SAT estatus de las solicitudes pendientes';

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
            <StatusBadge tone="slate" shape="tag" className="shrink-0">
              {satRequests.length}
            </StatusBadge>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-600 font-medium shrink-0">
            <span>{isOpen ? 'Ocultar' : 'Ver bitácora'}</span>
            {isOpen ? (
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            )}
          </div>
        </button>

        {hasPending && onVerifyPending && (
          <Button
            variant="primary"
            size="sm"
            loading={isVerifyingPending}
            disabled={isVerifyingPending || isReadOnlyClient}
            onClick={onVerifyPending}
            aria-label={
              isVerifyingPending
                ? 'Consultando al SAT solicitudes pendientes'
                : 'Comprobar con el SAT solicitudes pendientes'
            }
            title={verifyDisabledReason}
            leftIcon={
              <RefreshCw
                className={`w-3.5 h-3.5 ${isVerifyingPending ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            }
          >
            <span className="hidden sm:inline">
              {isVerifyingPending ? 'Consultando...' : 'Comprobar con el SAT'}
            </span>
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white space-y-2.5">
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Registro oficial de peticiones comunicadas con los Servicios Oficiales del SAT para
            esta empresa.
          </p>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden font-mono text-xs">
            {visibleRequests.map((r) => {
              const isDone = r.estadoSolicitud === 'TERMINADA';
              const isPartial =
                r.estadoSolicitud === 'PARCIAL' || r.estadoSolicitud === 'ERROR_LIMITE';
              const isError = r.estadoSolicitud === 'ERROR';
              const isPending =
                r.estadoSolicitud === 'ACEPTADA' || r.estadoSolicitud === 'EN_PROCESO';
              const translated = isError
                ? translateSatErrorCode(r.codigoEstadoSat, r.mensajeSat)
                : null;

              return (
                <div
                  key={r.id}
                  className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-slate-50/80 transition"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 font-sans text-xs">
                        {r.tipoSolicitud === 'EMITIDOS' ? (
                          <ArrowUpRight
                            className="w-3.5 h-3.5 text-emerald-700 shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <ArrowDownLeft
                            className="w-3.5 h-3.5 text-blue-700 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        {r.tipoSolicitud === 'EMITIDOS'
                          ? 'Emitidas (Ingresos)'
                          : 'Recibidas (Gastos)'}
                      </span>
                      <span className="text-slate-500" aria-hidden="true">
                        •
                      </span>
                      <span className="text-slate-600 text-[11px]">
                        {r.fechaInicial} al {r.fechaFinal}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <span>Folio:</span>
                      <strong
                        className="text-slate-800 truncate max-w-[140px] sm:max-w-[200px]"
                        title={r.idSolicitudSat}
                      >
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

                  <div className="flex items-center gap-2 shrink-0 self-start md:self-center font-sans flex-wrap">
                    {isDone && (r.cfdisDescargados || 0) > 0 && (
                      <StatusBadge
                        tone="emerald"
                        icon={<CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
                      >
                        {r.cfdisDescargados} XMLs integrados
                      </StatusBadge>
                    )}

                    {isDone && (!r.cfdisDescargados || r.cfdisDescargados === 0) && (
                      <StatusBadge tone="slate">0 comprobantes en el periodo</StatusBadge>
                    )}

                    {isPartial && (
                      <div className="flex flex-col items-start md:items-end gap-0.5">
                        <span title={r.mensajeSat}>
                          <StatusBadge
                            tone="amber"
                            icon={<XCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                          >
                            {r.cfdisDescargados || 0} XMLs (Parcial · límite SAT)
                          </StatusBadge>
                        </span>
                        {r.mensajeSat && (
                          <span className="text-[10px] text-amber-900 font-sans max-w-xs md:text-right">
                            {r.mensajeSat}
                          </span>
                        )}
                      </div>
                    )}

                    {isPending && (
                      <div className="flex items-center gap-1.5">
                        <StatusBadge
                          tone="blue"
                          icon={<Clock className="w-3.5 h-3.5" aria-hidden="true" />}
                        >
                          En proceso SAT
                        </StatusBadge>
                        {onVerifyPending && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isVerifyingPending || isReadOnlyClient}
                            onClick={onVerifyPending}
                            title={verifyDisabledReason}
                          >
                            Comprobar
                          </Button>
                        )}
                      </div>
                    )}

                    {isError && translated && (
                      <span title={r.mensajeSat || translated.explanation}>
                        <StatusBadge
                          tone="amber"
                          icon={<XCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                        >
                          {translated.shortLabel}
                        </StatusBadge>
                      </span>
                    )}

                    <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                      {r.createdAt?.slice(5, 16).replace('T', ' ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {satRequests.length > 10 && (
            <div className="flex justify-center pt-1">
              <Button variant="secondary" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Mostrar últimas 10' : `Ver todas (${satRequests.length})`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
