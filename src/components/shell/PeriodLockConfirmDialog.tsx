import React from 'react';
import { Loader2, Lock, LockOpen, ShieldAlert } from 'lucide-react';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';

interface PeriodLockConfirmDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  isPeriodLocked: boolean;
  companyName: string;
  companyRfc: string;
  period: number;
  year: number;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function PeriodLockConfirmDialog({
  dialogRef,
  isPeriodLocked,
  companyName,
  companyRfc,
  period,
  year,
  isPending,
  onCancel,
  onConfirm
}: PeriodLockConfirmDialogProps) {
  useDialogLightDismiss(dialogRef, onCancel);
  const periodLabel = `P${String(period).padStart(2, '0')}/${year}`;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onCancel={onCancel}
      role="alertdialog"
      aria-labelledby="period-lock-confirm-title"
      aria-describedby="period-lock-confirm-desc"
      className="no-print rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-md max-h-[92dvh] flex flex-col p-0 overflow-hidden backdrop:bg-slate-950/60"
    >
      <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isPeriodLocked
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {isPeriodLocked ? (
              <LockOpen className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Lock className="w-5 h-5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <h2 id="period-lock-confirm-title" className="text-sm font-bold text-slate-900">
              {isPeriodLocked
                ? `¿Reabrir el periodo ${periodLabel}?`
                : `¿Bloquear el periodo ${periodLabel}?`}
            </h2>
            <p id="period-lock-confirm-desc" className="text-xs text-slate-600 leading-relaxed">
              {isPeriodLocked
                ? `Al reabrir ${periodLabel} para ${companyName} (${companyRfc}), se volverá a permitir el registro y modificación de pólizas, CFDIs e inventarios.`
                : `Al bloquear ${periodLabel} para ${companyName} (${companyRfc}), nadie podrá capturar, editar ni eliminar pólizas o inventarios de ese mes ante el SAT.`}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-[11px] text-slate-700">
          <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          <span>Esta acción queda registrada en la Bitácora Contable de la empresa.</span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            autoFocus
            disabled={isPending}
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-50 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isPending}
            aria-busy={isPending}
            title={isPending ? 'Actualizando candado de periodo...' : undefined}
            onClick={onConfirm}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-wait ${
              isPeriodLocked
                ? 'bg-emerald-700 hover:bg-emerald-800'
                : 'bg-amber-700 hover:bg-amber-800'
            }`}
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
            <span>
              {isPending
                ? 'Actualizando...'
                : isPeriodLocked
                ? 'Sí, reabrir periodo'
                : 'Sí, bloquear periodo'}
            </span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
