import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CloudDownload,
  FlaskConical,
  Lightbulb,
  Radio
} from 'lucide-react';
import { AlertBanner, Button, FormField, Input } from '../../../components/ui';
import type { SatDownloadRequestRecord } from '../../../shared/types';
import { getCurrentFiscalPeriod, getTodayLocalIso } from '../../../shared/date-utils';
import { SatDatePresetBar } from './SatDatePresetBar';
import { SatCelebrationSuccessCard } from './SatCelebrationSuccessCard';
import { SatRequestsHistoryCard } from './SatRequestsHistoryCard';
import { SatPendingStatusBanner } from './SatPendingStatusBanner';
import { SatSoapErrorBanner } from './SatSoapErrorBanner';
import { getSatDownloadDisabledReason } from './satErrorTranslator';
import { SAT_TIPO_SOLICITUD_OPTS, summarizeSatRequestsForRange } from './satSoapHelpers';

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
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
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
  currentYear = getCurrentFiscalPeriod().year,
  currentPeriod = getCurrentFiscalPeriod().period,
  pendingCfdisCount,
  onBatchAutoPoliza,
  isBatchAutoPolizaPending,
  isPeriodLocked = false,
  isReadOnlyClient = false
}: SatSoapDownloadCardProps) {
  const [dismissedErrorId, setDismissedErrorId] = useState<string | null>(null);
  const todayStr = useMemo(() => getTodayLocalIso(), []);
  const isDateRangeInvalid = Boolean(fechaInicial && fechaFinal && fechaInicial > fechaFinal);

  const {
    periodDownloadedCount,
    latestCompleted,
    totalDownloaded,
    pendingRequests,
    activePendingInPeriod,
    existingCompletedInPeriod,
    relevantError
  } = summarizeSatRequestsForRange({
    satRequests,
    fechaInicial,
    fechaFinal,
    tipoSolicitud,
    dismissedErrorId
  });

  const downloadDisabledReason = getSatDownloadDisabledReason({
    isReadOnlyClient,
    hasCredentials,
    activePendingId: activePendingInPeriod?.idSolicitudSat,
    isDateRangeInvalid,
    isPending: soapDownloadMutation.isPending
  });

  const downloadLabel = soapDownloadMutation.isPending ? (
    'Firmando con e.firma y descargando facturas del SAT...'
  ) : !hasCredentials ? (
    'Conecta la e.firma de tu empresa primero'
  ) : activePendingInPeriod ? (
    <span className="inline-flex items-center gap-1.5">
      <Clock className="w-4 h-4" aria-hidden="true" />
      <span>
        Solicitud ya en proceso ante el SAT ({activePendingInPeriod.idSolicitudSat.slice(0, 8)}...)
      </span>
    </span>
  ) : tipoSolicitud === 'AMBOS' ? (
    `Descargar Gastos e Ingresos del SAT (${fechaInicial} al ${fechaFinal})`
  ) : tipoSolicitud === 'EMITIDOS' ? (
    <span className="inline-flex items-center gap-1.5">
      <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
      <span>Descargar Facturas Emitidas (Ingresos) ({fechaInicial} al {fechaFinal})</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      <ArrowDownLeft className="w-4 h-4" aria-hidden="true" />
      <span>Descargar Facturas Recibidas (Gastos) ({fechaInicial} al {fechaFinal})</span>
    </span>
  );

  return (
    <div className="w-full p-4 sm:p-5 rounded-2xl bg-white border border-slate-300/90 space-y-5 shadow-2xs">
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
          <div
            className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0"
            role="group"
            aria-label="Modo de ejecución SAT"
          >
            <button
              type="button"
              aria-pressed={modoEjecucion === 'SAT_LIVE'}
              onClick={() => setModoEjecucion('SAT_LIVE')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                modoEjecucion === 'SAT_LIVE'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              <Radio className="w-3 h-3" aria-hidden="true" />
              <span>SAT Live</span>
            </button>
            <button
              type="button"
              aria-pressed={modoEjecucion === 'SANDBOX_CRYPTO'}
              onClick={() => setModoEjecucion('SANDBOX_CRYPTO')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                modoEjecucion === 'SANDBOX_CRYPTO'
                  ? 'bg-amber-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              <FlaskConical className="w-3 h-3" aria-hidden="true" />
              <span>Sandbox Demo</span>
            </button>
          </div>
        )}
      </div>

      {/* Selector Contable de Tipo de Comprobantes */}
      <div className="space-y-1.5">
        <p id="sat-tipo-solicitud-label" className="block text-xs font-bold text-slate-800">
          1. ¿Qué tipo de comprobantes deseas descargar?
        </p>
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
          role="group"
          aria-labelledby="sat-tipo-solicitud-label"
        >
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
                  isSelected
                    ? opt.activeBorder
                    : 'bg-slate-50/60 hover:bg-slate-100/70 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Icon className={`w-4 h-4 ${opt.iconColor}`} aria-hidden="true" />
                    {opt.label}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${isSelected ? opt.dotColor : 'bg-slate-300'}`}
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selector de Rango de Fechas con Atajos Rápidos */}
      <div className="space-y-3" role="group" aria-labelledby="sat-rango-fechas-label">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p id="sat-rango-fechas-label" className="block text-xs font-bold text-slate-800">
            2. Rango de Fechas a Consultar en el SAT
          </p>
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
          <FormField label="Fecha Inicial (Desde)" htmlFor="soap-inicio">
            <Input
              id="soap-inicio"
              type="date"
              max={todayStr}
              value={fechaInicial}
              onChange={(e) => setFechaInicial(e.target.value > todayStr ? todayStr : e.target.value)}
              className="font-mono"
            />
          </FormField>
          <FormField label="Fecha Final (Hasta)" htmlFor="soap-fin">
            <Input
              id="soap-fin"
              type="date"
              max={todayStr}
              value={fechaFinal}
              onChange={(e) => setFechaFinal(e.target.value > todayStr ? todayStr : e.target.value)}
              className="font-mono"
            />
          </FormField>
        </div>
        {isDateRangeInvalid && (
          <AlertBanner tone="danger">
            La fecha inicial ({fechaInicial}) no puede ser posterior a la fecha final ({fechaFinal}
            ).
          </AlertBanner>
        )}
      </div>

      {/* Botón Principal de Descarga y Prevención 5002 */}
      <div className="space-y-3 pt-1">
        <Button
          variant="primary"
          size="lg"
          loading={soapDownloadMutation.isPending}
          disabled={
            soapDownloadMutation.isPending ||
            !hasCredentials ||
            Boolean(activePendingInPeriod) ||
            isDateRangeInvalid ||
            isReadOnlyClient
          }
          title={downloadDisabledReason}
          onClick={() => soapDownloadMutation.mutate()}
          leftIcon={<CloudDownload className="w-4 h-4" aria-hidden="true" />}
          className="w-full py-3"
        >
          {downloadLabel}
        </Button>

        {existingCompletedInPeriod && !activePendingInPeriod && (
          <AlertBanner
            tone="info"
            icon={<Lightbulb className="w-4 h-4" aria-hidden="true" />}
            title="Nota de periodo:"
          >
            Este periodo ya cuenta con descarga previa (
            {periodDownloadedCount || existingCompletedInPeriod.cfdisDescargados || 0}{' '}
            comprobantes). Puedes volver a solicitar si requieres actualizar facturas emitidas
            hoy.
          </AlertBanner>
        )}

        {latestCompleted && (
          <SatCelebrationSuccessCard
            latestCompleted={latestCompleted}
            totalDownloaded={totalDownloaded}
            pendingCfdisCount={pendingCfdisCount}
            onBatchAutoPoliza={onBatchAutoPoliza}
            isBatchAutoPolizaPending={isBatchAutoPolizaPending}
            isPeriodLocked={isPeriodLocked}
            isReadOnlyClient={isReadOnlyClient}
          />
        )}

        {!isDemoCompany && (
          <SatPendingStatusBanner
            pendingRequests={pendingRequests}
            onVerifyPending={onVerifyPending}
            isVerifyingPending={isVerifyingPending}
            isReadOnlyClient={isReadOnlyClient}
          />
        )}

        {!isDemoCompany && pendingRequests.length === 0 && relevantError && (
          <SatSoapErrorBanner
            relevantError={relevantError}
            onDismiss={() => setDismissedErrorId(relevantError.id)}
          />
        )}

        <SatRequestsHistoryCard
          satRequests={satRequests}
          onVerifyPending={onVerifyPending}
          isVerifyingPending={isVerifyingPending}
          isReadOnlyClient={isReadOnlyClient}
        />
      </div>
    </div>
  );
}
