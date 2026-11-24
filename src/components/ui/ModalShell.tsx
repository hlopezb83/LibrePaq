import type React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';

export type ModalMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
export type ModalIconTone = 'blue' | 'amber' | 'red' | 'emerald' | 'slate';

const MAX_W_CLASSES: Record<ModalMaxWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl'
};

const ICON_TONE_CLASSES: Record<ModalIconTone, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200'
};

export interface ModalShellProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconTone?: ModalIconTone;
  titleId: string;
  descriptionId?: string;
  maxWidth?: ModalMaxWidth;
  busy?: boolean;
  deferClose?: boolean;
  closeLabel?: string;
  headerExtra?: React.ReactNode;
  headerTabs?: React.ReactNode;
  footer?: React.ReactNode;
  footerJustify?: 'end' | 'between';
  footerClassName?: string;
  bodyClassName?: string;
  usePortal?: boolean;
  noPrint?: boolean;
  role?: 'dialog' | 'alertdialog';
  dialogClassName?: string;
  children: React.ReactNode;
}

/**
 * Contenedor `<dialog>` canónico para todos los modales internos del ERP.
 * Garantiza cabecera y pie pegajosos (sticky), superficie blanca limpia, cierre X 44x44px y light-dismiss seguro.
 */
export function ModalShell({
  dialogRef,
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  iconTone = 'blue',
  titleId,
  descriptionId,
  maxWidth = '2xl',
  busy = false,
  deferClose = false,
  closeLabel = 'Cerrar ventana',
  headerExtra,
  headerTabs,
  footer,
  footerJustify = 'end',
  footerClassName = '',
  bodyClassName = '',
  usePortal = false,
  noPrint = false,
  role = 'dialog',
  dialogClassName = '',
  children
}: ModalShellProps) {
  useDialogLightDismiss(dialogRef, busy ? undefined : onClose, {
    isOpen,
    deferClose: busy || deferClose
  });

  const dialogNode = (
    <dialog
      ref={dialogRef}
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      closedby={busy ? 'none' : 'any'}
      onCancel={(e) => {
        if (busy) {
          e.preventDefault();
          return;
        }
        if (deferClose) e.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (!busy && !deferClose) onClose();
      }}
      className={`bg-white rounded-2xl shadow-2xl border border-slate-300 w-[calc(100vw-1rem)] sm:w-full ${MAX_W_CLASSES[maxWidth]} max-h-[92dvh] open:flex open:flex-col overflow-hidden p-0 m-auto backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs ${noPrint ? 'no-print' : ''} ${dialogClassName}`.trim()}
    >
      <header className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            {icon && (
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${ICON_TONE_CLASSES[iconTone]}`}
                aria-hidden="true"
              >
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                {title}
              </h2>
              {subtitle && (
                <p id={descriptionId} className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerExtra}
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              aria-label={closeLabel}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        {headerTabs && <div className="mt-3 pt-2.5 border-t border-slate-100">{headerTabs}</div>}
      </header>

      <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 ${bodyClassName}`.trim()}>
        {children}
      </div>

      {footer && (
        <footer
          className={`px-4 sm:px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center ${footerJustify === 'between' ? 'justify-between' : 'justify-end'} gap-2.5 shrink-0 ${footerClassName}`.trim()}
        >
          {footer}
        </footer>
      )}
    </dialog>
  );

  if (usePortal && typeof document !== 'undefined') {
    return createPortal(dialogNode, document.body);
  }
  return dialogNode;
}
