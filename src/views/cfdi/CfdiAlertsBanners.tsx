import { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, Lock, RotateCcw, X } from 'lucide-react';

export interface SatBatchAlertData {
  cancelledWithPolizaCount: number;
  checkedCount: number;
  alerts: Array<{ cfdiId: string; uuid: string }>;
}

export interface BatchPartialAlertData {
  title: string;
  summary: string;
  items: Array<{ id: string; uuid?: string; error: string }>;
}

interface CfdiAlertsBannersProps {
  isReadOnlyClient: boolean;
  isPeriodLocked: boolean;
  currentPeriod: number;
  currentYear: number;
  satBatchAlert: SatBatchAlertData | null;
  cancelledWithPolizaCount?: number;
  isReversingCancelled?: boolean;
  onReverseCancelledPoliza?: () => void;
  onDismissCancelledAlert?: () => void;
  onLocateCancelled: (alert: SatBatchAlertData) => void;
  onDismissSatBatchAlert: () => void;
  batchPartialAlert: BatchPartialAlertData | null;
  onDismissBatchPartialAlert: () => void;
}

export function CfdiAlertsBanners({
  isReadOnlyClient,
  isPeriodLocked,
  currentPeriod,
  currentYear,
  satBatchAlert,
  cancelledWithPolizaCount = 0,
  isReversingCancelled = false,
  onReverseCancelledPoliza,
  onDismissCancelledAlert,
  onLocateCancelled,
  onDismissSatBatchAlert,
  batchPartialAlert,
  onDismissBatchPartialAlert
}: CfdiAlertsBannersProps) {
  const [confirmReverse, setConfirmReverse] = useState(false);

  useEffect(() => {
    setConfirmReverse(false);
  }, [cancelledWithPolizaCount, satBatchAlert]);

  const periodTag = `P${String(currentPeriod).padStart(2, '0')}`;
  const reverseBlockedTitle = isReadOnlyClient
    ? 'Modo solo lectura: no puedes generar pólizas inversas'
    : isPeriodLocked
    ? 'Periodo fiscal bloqueado ante el SAT'
    : `Generar Póliza Inversa (Reversión) en ${periodTag}/${currentYear} para los CFDIs cancelados`;

  const renderReverseAction = (primaryCls: string) => {
    if (!onReverseCancelledPoliza) return null;
    if (confirmReverse) {
      return (
        <div
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setConfirmReverse(false);
            }
          }}
          className="inline-flex flex-wrap items-center gap-1 bg-white border border-amber-400 rounded-lg px-2 py-1"
        >
          <button
            type="button"
            disabled={isReadOnlyClient || isPeriodLocked || isReversingCancelled}
            aria-busy={isReversingCancelled}
            onClick={() => {
              setConfirmReverse(false);
              onReverseCancelledPoliza();
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-amber-950 hover:bg-amber-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isReversingCancelled && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
            <span>{isReversingCancelled ? 'Revirtiendo...' : `Confirmar reverso en ${periodTag}`}</span>
          </button>
          <span className="text-amber-300" aria-hidden="true">|</span>
          <button
            type="button"
            autoFocus
            disabled={isReversingCancelled}
            onClick={() => setConfirmReverse(false)}
            className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            No
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        disabled={isReadOnlyClient || isPeriodLocked || isReversingCancelled}
        aria-busy={isReversingCancelled}
        onClick={() => setConfirmReverse(true)}
        title={reverseBlockedTitle}
        className={primaryCls}
      >
        {isReversingCancelled ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        <span>{isReversingCancelled ? 'Revirtiendo...' : 'Revertir Póliza'}</span>
      </button>
    );
  };
  return (
    <>
      {isReadOnlyClient && !isPeriodLocked && (
        <div
          role="status"
          className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-start gap-3 text-blue-950 text-xs shadow-2xs"
        >
          <Lock className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="font-bold text-sm block text-blue-950">
              Modo Solo Lectura Activo
            </span>
            <p className="text-blue-900 leading-relaxed">
              Estás consultando la Bóveda Digital ADD en modo solo lectura. La carga de XML, contabilización y eliminación de comprobantes se encuentran deshabilitadas.
            </p>
          </div>
        </div>
      )}

      {isPeriodLocked && (
        <div
          role="status"
          className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs shadow-2xs"
        >
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="font-bold text-sm block text-amber-950">
              Periodo Fiscal P{String(currentPeriod).padStart(2, '0')}/{currentYear} Bloqueado ante el SAT
            </span>
            <p className="text-amber-800 leading-relaxed">
              La contabilización y eliminación de comprobantes CFDI en este mes se encuentran deshabilitadas para proteger la declaración presentada ante el SAT.
            </p>
          </div>
        </div>
      )}

      {satBatchAlert && satBatchAlert.cancelledWithPolizaCount > 0 && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-red-950 text-xs shadow-2xs"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5">
              <span className="font-bold text-sm block text-red-950">
                Alerta SAT: {satBatchAlert.cancelledWithPolizaCount}{' '}
                {satBatchAlert.cancelledWithPolizaCount === 1
                  ? 'factura cancelada aún tiene póliza contable registrada'
                  : 'facturas canceladas aún tienen póliza contable registrada'}
              </span>
              <p className="text-red-800 leading-relaxed">
                De {satBatchAlert.checkedCount} comprobantes validados ante el SAT,{' '}
                <strong>{satBatchAlert.cancelledWithPolizaCount}</strong> están cancelados y mantienen póliza contable activa. Revísalos y revierte las pólizas afectadas.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-start">
            {renderReverseAction(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold cursor-pointer shrink-0 transition'
            )}
            {satBatchAlert.alerts[0] && (
              <button
                type="button"
                onClick={() => onLocateCancelled(satBatchAlert)}
                className="px-2.5 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold cursor-pointer shrink-0 transition"
              >
                {satBatchAlert.cancelledWithPolizaCount === 1
                  ? 'Localizar cancelado'
                  : `Localizar cancelados (${satBatchAlert.cancelledWithPolizaCount})`}
              </button>
            )}
            <button
              type="button"
              onClick={onDismissSatBatchAlert}
              aria-label="Ocultar alerta de facturas canceladas con póliza"
              className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 font-semibold cursor-pointer shrink-0 transition"
            >
              Ocultar
            </button>
          </div>
        </div>
      )}

      {(!satBatchAlert || satBatchAlert.cancelledWithPolizaCount === 0) && cancelledWithPolizaCount > 0 && onReverseCancelledPoliza && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-950 text-xs shadow-2xs"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-bold text-sm block text-red-950">
                {cancelledWithPolizaCount} CFDI(s) CANCELADO(s) con póliza contable activa
              </span>
              <p className="text-red-800">
                Existen comprobantes cancelados ante el SAT que mantienen póliza registrada. Genera la póliza inversa para revertir el efecto contable.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
            {renderReverseAction(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold cursor-pointer shrink-0 transition'
            )}
            {onDismissCancelledAlert && (
              <button
                type="button"
                onClick={onDismissCancelledAlert}
                aria-label="Ocultar alerta de CFDIs cancelados con póliza"
                className="px-2.5 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-900 font-semibold cursor-pointer shrink-0 transition"
              >
                Ocultar
              </button>
            )}
          </div>
        </div>
      )}

      {batchPartialAlert && batchPartialAlert.items.length > 0 && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col gap-2.5 text-amber-950 text-xs shadow-2xs"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-bold text-sm text-amber-950">{batchPartialAlert.title}</p>
                <p className="text-amber-900 mt-0.5">{batchPartialAlert.summary}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismissBatchPartialAlert}
              aria-label="Descartar aviso de errores en lote"
              title="Descartar aviso"
              className="p-1.5 rounded-lg text-amber-800 hover:bg-amber-200/70 transition cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <ul className="bg-white/80 border border-amber-200 rounded-xl p-2.5 space-y-1 max-h-36 overflow-y-auto font-mono text-[11px] text-slate-800">
            {batchPartialAlert.items.slice(0, 15).map((item, idx) => (
              <li key={`${item.id}-${idx}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <strong className="text-amber-950">{item.uuid ? item.uuid : item.id}:</strong>
                <span className="font-sans text-slate-700">{item.error}</span>
              </li>
            ))}
            {batchPartialAlert.items.length > 15 && (
              <li className="font-sans text-amber-800 font-semibold">
                ... y {batchPartialAlert.items.length - 15} incidencia(s) adicional(es).
              </li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}
