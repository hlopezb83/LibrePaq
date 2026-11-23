import { useMemo, useState } from 'react';
import { AlertCircle, CloudDownload, X } from 'lucide-react';
import type { SatDownloadRequestRecord } from '../../../shared/types';
import { SatDatePresetBar } from './SatDatePresetBar';
import { SatCelebrationSuccessCard } from './SatCelebrationSuccessCard';
import { SatRequestsHistoryCard } from './SatRequestsHistoryCard';
import { SatPendingStatusBanner } from './SatPendingStatusBanner';
import { SAT_TIPO_SOLICITUD_OPTS } from './satSoapHelpers';

interface SatSoapDownloadCardProps {
  tipoSolicitud: 'RECIBIDOS' | 'EMITIDOS' | 'AMBOS';
  setTipoSolicitud: (val: 'RECIBIDOS' | 'EMITIDOS' | 'AMBOS') => void;
  fechaInicial: string;
  setFechaInicial: (val: string) => void;
  fechaFinal: string;
  setFechaFinal: (val: string) => void;
  modoEjecucion: 'SAT_LIVE' | 'SANDBOX_CRYPTO';
  setModoEjecucion: (val: 'SAT_LIVE' | 'SANDBOX_CRYPTO') => void;
  soapDownloadMutation: { isPending: boolean; mutate: () => void };
  hasCredentials: boolean;
  satRequests: SatDownloadRequestRecord[];
  isDemoCompany?: boolean;
  onVerifyPending?: () => void;
  isVerifyingPending?: boolean;
  currentYear?: number;
  currentPeriod?: number;
  pendingCfdisCount?: number;
  onBatchAutoPoliza?: () => void;
  isBatchAutoPolizaPending?: boolean;
}

export function SatSoapDownloadCard({
  tipoSolicitud,
  setTipoSolicitud,
  fechaInicial,
  setFechaInicial,
  fechaFinal,
  setFechaFinal,
  modoEjecucion,
  setModoEjecucion,
  soapDownloadMutation,
  hasCredentials,
  satRequests,
  isDemoCompany,
  onVerifyPending,
  isVerifyingPending,
  currentYear = new Date().getFullYear(),
  currentPeriod = new Date().getMonth() + 1,
  pendingCfdisCount,
  onBatchAutoPoliza,
  isBatchAutoPolizaPending
}: SatSoapDownloadCardProps) {
  const [dismissedErrorId, setDismissedErrorId] = useState<string | null>(null);
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isDateRangeInvalid = Boolean(fechaInicial && fechaFinal && fechaInicial > fechaFinal);
  const completedRequests = satRequests.filter((r) => r.estadoSolicitud === 'TERMINADA');
  const periodCompletedRequests = completedRequests.filter((r) => r.fechaInicial === fechaInicial && r.fechaFinal === fechaFinal);
  const periodHasCompleted = periodCompletedRequests.length > 0;
  const periodDownloadedCount = periodCompletedRequests.reduce((acc, r) => acc + (r.cfdisDescargados || 0), 0);
  const latestCompleted = periodCompletedRequests[0] || satRequests.find((r) => r.estadoSolicitud === 'TERMINADA' && r.fechaInicial === fechaInicial && r.fechaFinal === fechaFinal);
  const totalDownloaded = periodDownloadedCount > 0 ? periodDownloadedCount : completedRequests.reduce((acc, r) => acc + (r.cfdisDescargados || 0), 0);
  const pendingRequests = satRequests.filter((r) => r.estadoSolicitud === 'ACEPTADA' || r.estadoSolicitud === 'EN_PROCESO');

  const activePendingInPeriod = pendingRequests.find(
    (r) =>
      r.fechaInicial === fechaInicial &&
      r.fechaFinal === fechaFinal &&
      (tipoSolicitud === 'AMBOS' || r.tipoSolicitud === tipoSolicitud)
  );

  const existingCompletedInPeriod = completedRequests.find(
    (r) =>
      r.fechaInicial === fechaInicial &&
      r.fechaFinal === fechaFinal &&
      (tipoSolicitud === 'AMBOS' || r.tipoSolicitud === tipoSolicitud)
  );

  const relevantError = satRequests.find(
    (r) =>
      r.estadoSolicitud === 'ERROR' &&
      r.id !== dismissedErrorId &&
      r.fechaInicial === fechaInicial &&
      r.fechaFinal === fechaFinal &&
      !periodHasCompleted
  );

  return (
    <div className="w-full p-4 sm:p-5 rounded-2xl bg-white border border-slate-300/80 space-y-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Descarga de Facturas del Periodo desde el SAT
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Elige los comprobantes a sincronizar con tu e.firma directamente a la Bóveda ADD.
          </p>
        </div>

        {isDemoCompany && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0" role="group" aria-label="Modo de ejecución SAT">
            <button
              type="button"
              aria-pressed={modoEjecucion === 'SAT_LIVE'}
              onClick={() => setModoEjecucion('SAT_LIVE')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${modoEjecucion === 'SAT_LIVE' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-white'}`}
            >
              🟢 SAT Live
            </button>
            <button
              type="button"
              aria-pressed={modoEjecucion === 'SANDBOX_CRYPTO'}
              onClick={() => setModoEjecucion('SANDBOX_CRYPTO')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${modoEjecucion === 'SANDBOX_CRYPTO' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-white'}`}
            >
              🟡 Sandbox Demo
            </button>
          </div>
        )}
      </div>

      {/* Selector Contable de Tipo de Comprobantes */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-800">
          1. ¿Qué tipo de comprobantes deseas descargar?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="group" aria-label="Tipo de comprobantes a descargar">
          {SAT_TIPO_SOLICITUD_OPTS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = tipoSolicitud === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setTipoSolicitud(opt.id)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                  isSelected ? opt.activeBorder : 'bg-slate-50/60 hover:bg-slate-100/70 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Icon className={`w-4 h-4 ${opt.iconColor}`} aria-hidden="true" />
                    {opt.label}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${isSelected ? opt.dotColor : 'bg-slate-300'}`} />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selector de Rango de Fechas con Atajos Rápidos */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="block text-xs font-bold text-slate-800">
            2. Rango de Fechas a Consultar en el SAT
          </label>
        </div>

        <SatDatePresetBar
          fechaInicial={fechaInicial}
          fechaFinal={fechaFinal}
          currentYear={currentYear}
          currentPeriod={currentPeriod}
          onSelectRange={(start, end) => {
            setFechaInicial(start);
            setFechaFinal(end);
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label htmlFor="soap-inicio" className="block text-[11px] font-semibold text-slate-700 mb-1">
              Fecha Inicial (Desde)
            </label>
            <input
              id="soap-inicio"
              type="date"
              max={todayStr}
              value={fechaInicial}
              onChange={(e) => setFechaInicial(e.target.value > todayStr ? todayStr : e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
            />
          </div>

          <div>
            <label htmlFor="soap-fin" className="block text-[11px] font-semibold text-slate-700 mb-1">
              Fecha Final (Hasta)
            </label>
            <input
              id="soap-fin"
              type="date"
              max={todayStr}
              value={fechaFinal}
              onChange={(e) => setFechaFinal(e.target.value > todayStr ? todayStr : e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
            />
          </div>
        </div>
        {isDateRangeInvalid && (
          <p role="alert" className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            La fecha inicial ({fechaInicial}) no puede ser posterior a la fecha final ({fechaFinal}).
          </p>
        )}
      </div>

      {/* Botón Principal de Descarga y Prevención 5002 */}
      <div className="space-y-3 pt-1">
        <button
          type="button"
          disabled={soapDownloadMutation.isPending || !hasCredentials || Boolean(activePendingInPeriod) || isDateRangeInvalid}
          onClick={() => soapDownloadMutation.mutate()}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs transition"
        >
          <CloudDownload className="w-4 h-4 text-indigo-100" aria-hidden="true" />
          {soapDownloadMutation.isPending
            ? 'Firmando con e.firma y descargando facturas del SAT...'
            : !hasCredentials
            ? 'Conecta la e.firma de tu empresa primero'
            : activePendingInPeriod
            ? `⏳ Solicitud ya en proceso ante el SAT (${activePendingInPeriod.idSolicitudSat.slice(0, 8)}...)`
            : tipoSolicitud === 'AMBOS'
            ? `⚡ Descargar Gastos e Ingresos del SAT (${fechaInicial} al ${fechaFinal})`
            : tipoSolicitud === 'EMITIDOS'
            ? `📤 Descargar Facturas Emitidas (Ingresos) (${fechaInicial} al ${fechaFinal})`
            : `📥 Descargar Facturas Recibidas (Gastos) (${fechaInicial} al ${fechaFinal})`}
        </button>

        {existingCompletedInPeriod && !activePendingInPeriod && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-[11px]">
            <span className="font-bold text-slate-700">💡 Nota de periodo:</span>
            <span>Este periodo ya cuenta con descarga previa ({periodDownloadedCount || existingCompletedInPeriod.cfdisDescargados || 0} comprobantes). Puedes volver a solicitar si requieres actualizar facturas emitidas hoy.</span>
          </div>
        )}

        {latestCompleted && (
          <SatCelebrationSuccessCard
            latestCompleted={latestCompleted}
            totalDownloaded={totalDownloaded}
            pendingCfdisCount={pendingCfdisCount}
            onBatchAutoPoliza={onBatchAutoPoliza}
            isBatchAutoPolizaPending={isBatchAutoPolizaPending}
          />
        )}

        {!isDemoCompany && (
          <SatPendingStatusBanner
            pendingRequests={pendingRequests}
            onVerifyPending={onVerifyPending}
            isVerifyingPending={isVerifyingPending}
          />
        )}

        {!isDemoCompany && pendingRequests.length === 0 && relevantError && (
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-xs text-amber-950 space-y-2.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-bold flex items-center gap-2 text-amber-900 text-xs sm:text-sm">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Respuesta del SAT: Solicitud rechazada o ya atendida</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-mono">
                  {relevantError.codigoEstadoSat || 'SAT Código 5'}
                </span>
                <button
                  type="button"
                  onClick={() => setDismissedErrorId(relevantError.id)}
                  className="p-1 rounded-lg text-amber-800 hover:bg-amber-200/80 transition cursor-pointer"
                  title="Descartar aviso"
                  aria-label="Descartar aviso"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <p className="text-[11px] text-amber-900 leading-relaxed">
              {relevantError.mensajeSat ||
                'El SAT reportó código 5 (Solicitud rechazada). Esto ocurre habitualmente cuando ya existe una solicitud reciente para este mismo rango de fechas o tus comprobantes ya fueron descargados.'}
            </p>

            <div className="bg-white/80 p-2 rounded-lg border border-amber-200 font-mono text-[11px] text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span>Folio SAT: <strong className="select-all underline text-slate-900">{relevantError.idSolicitudSat}</strong></span>
              <span className="text-slate-500 text-[10px]">({relevantError.fechaInicial} al {relevantError.fechaFinal})</span>
            </div>

            <p className="text-[11px] text-slate-600">
              💡 <em>¿Qué puedes hacer?</em> Si tus comprobantes de este periodo ya están en la Bóveda ADD, no es necesario volver a solicitar. Si buscas comprobantes nuevos, puedes cambiar el rango de fechas o arrastrar tus archivos XML directamente a la zona superior.
            </p>
          </div>
        )}

        {/* Bitácora / Historial de Solicitudes SAT */}
        <SatRequestsHistoryCard
          satRequests={satRequests}
          onVerifyPending={onVerifyPending}
          isVerifyingPending={isVerifyingPending}
        />
      </div>
    </div>
  );
}
