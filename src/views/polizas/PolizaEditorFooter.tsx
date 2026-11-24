import React from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, Lock, Scale } from 'lucide-react';
import { Button, InlineConfirm, StatusBadge } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';

interface PolizaEditorFooterProps {
  isBalanced: boolean;
  totalCargos: number;
  totalAbonos: number;
  difference: number;
  isPendingSave: boolean;
  isPeriodLocked: boolean;
  editingPolizaId: string | null;
  submitButtonRef: React.RefObject<HTMLButtonElement | null>;
  autoBalanceDifference: () => void;
  confirmDiscard?: boolean;
  onConfirmDiscard?: () => void;
  onCancelDiscard?: () => void;
  onCancel: () => void;
}

export function PolizaEditorFooter({
  isBalanced,
  totalCargos,
  totalAbonos,
  difference,
  isPendingSave,
  isPeriodLocked,
  editingPolizaId,
  submitButtonRef,
  autoBalanceDifference,
  confirmDiscard,
  onConfirmDiscard,
  onCancelDiscard,
  onCancel
}: PolizaEditorFooterProps) {
  const isEmpty = totalCargos === 0 && totalAbonos === 0;
  const isRealDiscrepancy = !isBalanced && !isEmpty;

  return (
    <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex-1 flex flex-wrap items-center gap-2 min-w-0"
      >
        {isBalanced ? (
          <>
            <StatusBadge
              tone="emerald"
              icon={<CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Póliza Cuadrada
            </StatusBadge>
            <span className="text-[11px] text-slate-600 font-mono tabular-nums truncate">
              Cargos: {formatCurrency(totalCargos)} • Abonos: {formatCurrency(totalAbonos)} • Dif: $0.00
            </span>
          </>
        ) : isEmpty ? (
          <>
            <StatusBadge
              tone="blue"
              icon={<Info className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              En Captura
            </StatusBadge>
            <span className="text-[11px] text-slate-600 font-mono tabular-nums truncate">
              Sumas Iguales: Cargos $0.00 • Abonos $0.00
            </span>
          </>
        ) : (
          <>
            <StatusBadge
              tone="amber"
              icon={<AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />}
              className="font-mono tabular-nums"
            >
              Descuadre {formatCurrency(Math.abs(difference))} ({difference > 0 ? 'Falta Haber' : 'Falta Debe'})
            </StatusBadge>
            <span className="text-[11px] text-slate-600 font-mono tabular-nums truncate">
              Pulsa <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-300 font-bold">=</kbd> para cuadrar
            </span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 w-full sm:w-auto min-w-0">
        {confirmDiscard ? (
          <InlineConfirm
            tone="danger"
            message={editingPolizaId ? '¿Descartar cambios?' : '¿Descartar borrador?'}
            confirmLabel="Sí, descartar"
            cancelLabel="Seguir editando"
            ariaLabel="Confirmar descarte de cambios"
            onConfirm={() => onConfirmDiscard?.()}
            onCancel={() => onCancelDiscard?.()}
          />
        ) : (
          <>
            {isRealDiscrepancy && (
              <Button
                variant="secondary"
                size="sm"
                onClick={autoBalanceDifference}
                className="bg-amber-50! border-amber-300! text-amber-900! hover:bg-amber-100!"
                leftIcon={<Scale className="w-3.5 h-3.5" aria-hidden="true" />}
              >
                Cuadrar
              </Button>
            )}

            <Button variant="secondary" size="md" disabled={isPendingSave} onClick={onCancel}>
              Cancelar
            </Button>

            <button
              ref={submitButtonRef}
              type="submit"
              form="poliza-form"
              disabled={!isBalanced || isPendingSave || isPeriodLocked}
              title={
                isPeriodLocked
                  ? 'Periodo fiscal bloqueado ante el SAT'
                  : !isBalanced
                  ? `Póliza descuadrada (Diferencia de ${formatCurrency(Math.abs(difference))})`
                  : editingPolizaId
                  ? 'Guardar cambios de la póliza (Ctrl+Enter)'
                  : 'Guardar y aplicar póliza (Ctrl+Enter)'
              }
              aria-label={
                isPendingSave
                  ? 'Guardando póliza contable'
                  : isPeriodLocked
                  ? 'Periodo bloqueado ante el SAT'
                  : !isBalanced
                  ? `Póliza descuadrada por ${formatCurrency(Math.abs(difference))}`
                  : editingPolizaId
                  ? 'Guardar cambios de la póliza'
                  : 'Guardar y aplicar póliza'
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition whitespace-normal sm:whitespace-nowrap shrink-0"
            >
              {isPendingSave ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
              ) : isPeriodLocked ? (
                <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>
                {isPendingSave ? (
                  'Guardando...'
                ) : isPeriodLocked ? (
                  'Periodo Bloqueado'
                ) : editingPolizaId ? (
                  'Guardar Cambios'
                ) : (
                  <>
                    Guardar y Aplicar{' '}
                    <span className="hidden md:inline font-normal opacity-90">(Ctrl+Enter)</span>
                  </>
                )}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
