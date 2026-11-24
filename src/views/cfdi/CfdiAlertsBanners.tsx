import { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { AlertBanner, Button, InlineConfirm } from '../../components/ui';

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

  const renderReverseAction = (variant: 'secondary' | 'danger') => {
    if (!onReverseCancelledPoliza) return null;
    if (confirmReverse) {
      return (
        <InlineConfirm
          tone="warning"
          busy={isReversingCancelled}
          confirmLabel={
            isReversingCancelled ? 'Revirtiendo...' : `Confirmar reverso en ${periodTag}`
          }
          cancelLabel="No"
          ariaLabel={`Confirmar reversión de pólizas en ${periodTag}`}
          onConfirm={() => {
            setConfirmReverse(false);
            onReverseCancelledPoliza();
          }}
          onCancel={() => setConfirmReverse(false)}
        />
      );
    }
    return (
      <Button
        variant={variant}
        size="sm"
        loading={isReversingCancelled}
        disabled={isReadOnlyClient || isPeriodLocked || isReversingCancelled}
        onClick={() => setConfirmReverse(true)}
        title={reverseBlockedTitle}
        leftIcon={
          isReversingCancelled ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          )
        }
      >
        {isReversingCancelled ? 'Revirtiendo...' : 'Revertir Póliza'}
      </Button>
    );
  };

  return (
    <>
      {satBatchAlert && satBatchAlert.cancelledWithPolizaCount > 0 && (
        <AlertBanner
          tone="danger"
          icon={<AlertCircle className="w-4 h-4" aria-hidden="true" />}
          title={`Alerta SAT: ${satBatchAlert.cancelledWithPolizaCount} ${
            satBatchAlert.cancelledWithPolizaCount === 1
              ? 'factura cancelada aún tiene póliza contable registrada'
              : 'facturas canceladas aún tienen póliza contable registrada'
          }`}
          onDismiss={onDismissSatBatchAlert}
          dismissLabel="Ocultar alerta de facturas canceladas con póliza"
          action={
            <div className="flex flex-wrap items-center gap-2">
              {renderReverseAction('secondary')}
              {satBatchAlert.alerts[0] && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onLocateCancelled(satBatchAlert)}
                >
                  {satBatchAlert.cancelledWithPolizaCount === 1
                    ? 'Localizar cancelado'
                    : `Localizar cancelados (${satBatchAlert.cancelledWithPolizaCount})`}
                </Button>
              )}
            </div>
          }
        >
          <span>
            De {satBatchAlert.checkedCount} comprobantes validados ante el SAT,{' '}
            <strong>{satBatchAlert.cancelledWithPolizaCount}</strong> están cancelados y mantienen
            póliza contable activa. Revísalos y revierte las pólizas afectadas.
          </span>
        </AlertBanner>
      )}

      {(!satBatchAlert || satBatchAlert.cancelledWithPolizaCount === 0) &&
        cancelledWithPolizaCount > 0 &&
        onReverseCancelledPoliza && (
          <AlertBanner
            tone="danger"
            icon={<AlertCircle className="w-4 h-4" aria-hidden="true" />}
            title={`${cancelledWithPolizaCount} CFDI(s) CANCELADO(s) con póliza contable activa`}
            onDismiss={onDismissCancelledAlert}
            dismissLabel="Ocultar alerta de CFDIs cancelados con póliza"
            action={renderReverseAction('danger')}
          >
            <span>
              Existen comprobantes cancelados ante el SAT que mantienen póliza registrada. Genera la
              póliza inversa para revertir el efecto contable.
            </span>
          </AlertBanner>
        )}

      {batchPartialAlert && batchPartialAlert.items.length > 0 && (
        <AlertBanner
          tone="warning"
          icon={<AlertTriangle className="w-4 h-4" aria-hidden="true" />}
          title={batchPartialAlert.title}
          onDismiss={onDismissBatchPartialAlert}
          dismissLabel="Descartar aviso de errores en lote"
        >
          <p className="mt-0.5">{batchPartialAlert.summary}</p>
          <ul className="mt-2 bg-white border border-amber-200 rounded-xl p-2.5 space-y-1 max-h-36 overflow-y-auto font-mono text-[11px] text-slate-800">
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
        </AlertBanner>
      )}
    </>
  );
}
