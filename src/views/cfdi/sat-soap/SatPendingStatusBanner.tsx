import { CheckCircle2, Clock, CloudDownload, RefreshCw } from 'lucide-react';
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

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/80 border-2 border-blue-200 text-xs text-blue-950 space-y-3 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="font-bold flex items-center gap-2 text-blue-900 text-xs sm:text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse shrink-0" />
          <span>Solicitud en curso ante el SAT</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onVerifyPending && (
            <button
              type="button"
              disabled={isVerifyingPending || isReadOnlyClient}
              onClick={onVerifyPending}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Consultar al SAT si los paquetes ya fueron generados para descargarlos e importarlos"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingPending ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{isVerifyingPending ? 'Consultando SAT...' : '↻ Comprobar con el SAT ahora'}</span>
            </button>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-200/70 text-blue-900 font-bold">
            ⏳ En proceso SAT
          </span>
        </div>
      </div>

      {/* Timeline Visual de 3 Pasos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="flex items-center gap-2 p-2 rounded-xl bg-white/85 border border-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <div className="text-[11px] leading-tight">
            <div className="font-bold text-emerald-950">1. Petición Aceptada</div>
            <div className="text-[10px] text-emerald-700">Firmada con e.firma</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-100/90 border border-blue-300">
          <Clock className="w-4 h-4 text-blue-600 animate-pulse shrink-0" aria-hidden="true" />
          <div className="text-[11px] leading-tight">
            <div className="font-bold text-blue-950">2. SAT Preparando ZIP</div>
            <div className="text-[10px] text-blue-700">Por lotes (15-90 min)</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 border border-slate-200">
          <CloudDownload className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          <div className="text-[11px] leading-tight">
            <div className="font-bold text-slate-700">3. Bóveda ADD</div>
            <div className="text-[10px] text-slate-500">Auto-descarga de fondo</div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-blue-950 leading-relaxed">
        <strong>No necesitas tener la app abierta ni repetir la solicitud</strong>. Nuestro servicio en segundo plano revisará el avance periódicamente y descargará tus XMLs directamente a la Bóveda en cuanto el SAT termine de empaquetarlos.
      </p>

      <div className="bg-white/85 p-2 rounded-xl border border-blue-200 space-y-1 font-mono text-[11px] text-slate-800">
        <span className="text-[10px] uppercase font-bold text-slate-500 block">Folios oficiales asignados por el SAT:</span>
        {pendingRequests.slice(0, 2).map((r) => (
          <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] gap-0.5">
            <span>
              • {r.tipoSolicitud === 'EMITIDOS' ? '📤 Emitidas (Ingresos)' : '📥 Recibidas (Gastos)'}:{' '}
              <strong className="text-blue-900">{r.idSolicitudSat}</strong>
            </span>
            <span className="text-slate-500 text-[10px]">({r.fechaInicial} al {r.fechaFinal})</span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-600">
        💡 <em>¿Quieres ver tus datos de inmediato?</em> Si ya tienes los archivos XML o ZIP en tu computadora, arrástralos a la zona superior para contabilizarlos en 2 segundos sin esperar al SAT.
      </p>
    </div>
  );
}
