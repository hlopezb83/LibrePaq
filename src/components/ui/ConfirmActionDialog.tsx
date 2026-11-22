import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  message: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmActionDialog({
  open,
  title,
  message,
  details,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  isPending = false,
  onConfirm,
  onCancel
}: ConfirmActionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.returnValue = '';
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (typeof document === 'undefined') return null;

  const isDanger = tone === 'danger';

  return createPortal(
    <dialog
      ref={dialogRef}
      closedby="closerequest"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={() => {
        const dialog = dialogRef.current;
        const val = dialog?.returnValue ?? '';
        if (dialog) dialog.returnValue = '';
        if (val !== 'confirm' && open) {
          onCancel();
        }
      }}
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-md overflow-hidden backdrop:bg-slate-950/60"
    >
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isDanger
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
          >
            {isDanger ? (
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            ) : (
              <HelpCircle className="w-5 h-5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 space-y-1.5">
            <h2 id={titleId} className="text-sm font-bold text-slate-900">
              {title}
            </h2>
            <p id={descId} className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
              {message}
            </p>
            {details && details.length > 0 && (
              <ul className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
                {details.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (dialogRef.current) dialogRef.current.returnValue = '';
              dialogRef.current?.close();
              onCancel();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (dialogRef.current) dialogRef.current.returnValue = 'confirm';
              dialogRef.current?.close();
              onConfirm();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow-xs cursor-pointer disabled:opacity-50 ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            {isPending ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>,
    document.body
  );
}
