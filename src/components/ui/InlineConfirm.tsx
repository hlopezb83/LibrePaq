import { useEffect } from 'react';
import type React from 'react';

export interface InlineConfirmProps {
  message?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'primary';
  busy?: boolean;
  ariaLabel?: string;
  className?: string;
}

const CONFIRM_TONES = {
  danger: 'bg-red-700 hover:bg-red-800 text-white',
  warning: 'bg-amber-700 hover:bg-amber-800 text-white',
  primary: 'bg-blue-700 hover:bg-blue-800 text-white'
};

/**
 * Confirmación destructiva o sensible en línea para filas de tabla.
 * Mantiene orden simétrico `[Cancelar] [Confirmar]`, soporte de tecla `Escape` y semántica `alertdialog`.
 */
export function InlineConfirm({
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  busy = false,
  ariaLabel = 'Confirmar acción',
  className = ''
}: InlineConfirmProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div
      role="alertdialog"
      aria-label={ariaLabel}
      className={`inline-flex flex-wrap items-center gap-1.5 px-2 py-1 rounded-lg bg-red-50 border border-red-200 ${className}`.trim()}
    >
      {message && <span className="text-[11px] font-semibold text-red-900 mr-0.5">{message}</span>}
      <button
        type="button"
        disabled={busy}
        onClick={onCancel}
        className="px-2 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onConfirm}
        className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 ${CONFIRM_TONES[tone]}`}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
