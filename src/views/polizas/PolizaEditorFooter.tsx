import React, { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, Lock, Scale } from 'lucide-react';
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
  const keepEditingRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmDiscard) {
      requestAnimationFrame(() => keepEditingRef.current?.focus());
    }
  }, [confirmDiscard]);

  return (
    <footer
      className={`shrink-0 w-full min-w-0 max-w-full px-3 sm:px-4 py-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-semibold transition-colors ${
        isBalanced
          ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
          : isEmpty
          ? 'bg-slate-50 border-slate-300 text-slate-800'
          : 'bg-amber-50 border-amber-300 text-amber-950'
      }`}
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex-1 flex items-center gap-2.5 min-w-0"
      >
        {isBalanced ? (
          <>
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="font-bold block text-emerald-900 truncate">
                Póliza Cuadrada — Sumas Iguales Verificadas
              </span>
              <span className="text-[11px] text-emerald-800 font-mono tabular-nums block truncate">
                Cargos: {formatCurrency(totalCargos)} • Abonos: {formatCurrency(totalAbonos)} • Dif: $0.00
              </span>
            </div>
          </>
        ) : isEmpty ? (
          <>
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
              <Info className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="font-bold block text-slate-800 truncate">
                Póliza en Captura — Sin importes registrados
              </span>
              <span className="text-[11px] text-slate-600 font-mono tabular-nums block truncate">
                Sumas Iguales (Partida Doble): Cargos $0.00 • Abonos $0.00
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="font-bold block text-amber-950 truncate">
                Descuadrada por {formatCurrency(Math.abs(difference))} (
                {difference > 0 ? 'Falta en Haber' : 'Falta en Debe'})
              </span>
              <span className="text-[11px] text-amber-900 font-mono tabular-nums block truncate">
                Sumas Iguales: Cargos {formatCurrency(totalCargos)} • Abonos {formatCurrency(totalAbonos)} • Pulsa{' '}
                <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-amber-300 font-bold">=</kbd>
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 w-full sm:w-auto min-w-0">
        {confirmDiscard ? (
          <div
            role="alertdialog"
            aria-label="Confirmar descarte de cambios"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onCancelDiscard?.();
              }
            }}
            className="flex flex-wrap items-center gap-2 bg-amber-100 border border-amber-400 rounded-xl px-3 py-1.5"
          >
            <span className="text-amber-950 font-bold">
              {editingPolizaId ? '¿Descartar cambios?' : '¿Descartar borrador?'}
            </span>
            <button
              type="button"
              onClick={onConfirmDiscard}
              className="px-2.5 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold cursor-pointer"
            >
              Sí, descartar
            </button>
            <button
              ref={keepEditingRef}
              type="button"
              autoFocus
              onClick={onCancelDiscard}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              Seguir editando
            </button>
          </div>
        ) : (
          <>
            {isRealDiscrepancy && (
              <button
                type="button"
                onClick={autoBalanceDifference}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-950 bg-amber-200/80 hover:bg-amber-300 border border-amber-400 cursor-pointer transition shadow-2xs"
              >
                <Scale className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Cuadrar</span>
              </button>
            )}

            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white/80 cursor-pointer"
            >
              Cancelar
            </button>

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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md transition whitespace-normal sm:whitespace-nowrap shrink-0"
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
    </footer>
  );
}
