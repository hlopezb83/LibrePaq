import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CloudDownload,
  Lightbulb,
  RefreshCw
} from 'lucide-react';
import { AlertBanner, Button, StatusBadge } from '../../../components/ui';
import type { SatDownloadRequestRecord } from '../../../shared/types';

interface SatPendingStatusBannerProps {
  pendingRequests: SatDownloadRequestRecord[];
  onVerifyPending?: () => void;
  isVerifyingPending?: boolean;
  isReadOnlyClient?: boolean;
}

export function SatPendingStatusBanner({
  pendingRequests,
  onVerifyPending,
  isVerifyingPending,
  isReadOnlyClient = false
}: SatPendingStatusBannerProps) {
  if (pendingRequests.length === 0) return null;
  const verifyDisabledReason = isReadOnlyClient
    ? 'Modo solo lectura: consulta SAT deshabilitada'
    : isVerifyingPending
    ? 'Consultando paquetes ante el SAT...'
    : 'Consultar al SAT si los paquetes ya fueron generados para descargarlos e importarlos';

  return (
    <div className="p-4 rounded-2xl bg-white border border-blue-200 text-xs text-slate-900 space-y-3 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="font-bold flex items-center gap-2 text-slate-900 text-xs sm:text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-700 shrink-0" aria-hidden="true" />
          <span>Solicitud en curso ante el SAT</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onVerifyPending && (
            <Button
              variant="primary"
              size="sm"
              loading={isVerifyingPending}
              disabled={isVerifyingPending || isReadOnlyClient}
              onClick={onVerifyPending}
              title={verifyDisabledReason}
              leftIcon={
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isVerifyingPending ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              }
            >
              {isVerifyingPending ? 'Consultando SAT...' : 'Comprobar con el SAT ahora'}
            </Button>
          )}
          <StatusBadge tone="blue" icon={<Clock className="w-3 h-3" aria-hidden="true" />}>
            En proceso SAT
          </StatusBadge>
        </div>
      </div>

      {/* Timeline Visual de 3 Pasos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
          <div className="text-[11px] leading-tight">
            <div className="font-bold text-emerald-950">1. Petición Aceptada</div>
            <div className="text-[10px] text-emerald-700">Firmada con e.firma</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/60 border border-blue-200">
          <Clock className="w-4 h-4 text-blue-700 animate-pulse shrink-0" aria-hidden="true" />
          <div className="text-[11px] leading-tight">
            <div className="font-bold text-blue-950">2. SAT Preparando ZIP</div>
            <div className="text-[10px] text-blue-700">Por lotes (15-90 min)</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <CloudDownload className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          <div className="text-[11px] leading-tight">
            <div className="font-bold text-slate-700">3. Bóveda ADD</div>
            <div className="text-[10px] text-slate-500">Auto-descarga de fondo</div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-700 leading-relaxed">
        <strong>No necesitas tener la app abierta ni repetir la solicitud</strong>. Nuestro servicio
        en segundo plano revisará el avance periódicamente y descargará tus XMLs directamente a la
        Bóveda en cuanto el SAT termine de empaquetarlos.
      </p>

      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1 font-mono text-[11px] text-slate-800">
        <span className="text-[10px] uppercase font-bold text-slate-500 block">
          Folios oficiales asignados por el SAT:
        </span>
        {pendingRequests.slice(0, 2).map((r) => (
          <div
            key={r.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] gap-0.5"
          >
            <span className="inline-flex items-center gap-1.5">
              {r.tipoSolicitud === 'EMITIDOS' ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
              ) : (
                <ArrowDownLeft className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
              )}
              <span>
                {r.tipoSolicitud === 'EMITIDOS' ? 'Emitidas (Ingresos)' : 'Recibidas (Gastos)'}:{' '}
                <strong className="text-blue-900">{r.idSolicitudSat}</strong>
              </span>
            </span>
            <span className="text-slate-600 text-[11px]">
              ({r.fechaInicial} al {r.fechaFinal})
            </span>
          </div>
        ))}
      </div>

      <AlertBanner tone="info" icon={<Lightbulb className="w-4 h-4" aria-hidden="true" />}>
        <em>¿Quieres ver tus datos de inmediato?</em> Si ya tienes los archivos XML o ZIP en tu
        computadora, arrástralos a la zona superior para contabilizarlos en 2 segundos sin esperar al
        SAT.
      </AlertBanner>
    </div>
  );
}
