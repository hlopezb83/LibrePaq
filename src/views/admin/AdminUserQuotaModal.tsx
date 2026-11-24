import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Gauge, X } from 'lucide-react';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { SuperAdminQuotaCard } from './SuperAdminQuotaCard';

export interface AdminUserQuotaTarget {
  userId: string;
  fullName: string;
  email: string;
  workspaceId: string;
  workspaceName?: string;
}

interface AdminUserQuotaModalProps {
  target: AdminUserQuotaTarget | null;
  canEdit?: boolean;
  onClose: () => void;
}

export function AdminUserQuotaModal({ target, canEdit = true, onClose }: AdminUserQuotaModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const handleStateChange = useCallback((state: { isDirty: boolean; isSaving: boolean }) => {
    setIsDirty(state.isDirty);
    setIsSaving(state.isSaving);
    if (!state.isDirty) setShowDiscardConfirm(false);
  }, []);

  const requestClose = useCallback(() => {
    if (isSaving) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    setShowDiscardConfirm(false);
    onClose();
  }, [isSaving, isDirty, onClose]);

  const confirmDiscardAndClose = () => {
    setShowDiscardConfirm(false);
    setIsDirty(false);
    onClose();
  };

  useDialogLightDismiss(dialogRef, requestClose, {
    isOpen: Boolean(target) && !isSaving && !isDirty,
    deferClose: isSaving || isDirty
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target) {
      setShowDiscardConfirm(false);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [target]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      closedby={isSaving ? 'none' : 'any'}
      onCancel={(e) => {
        if (isSaving || isDirty) {
          e.preventDefault();
          if (!isSaving && isDirty) setShowDiscardConfirm(true);
        }
      }}
      onClose={() => {
        if (!isSaving) {
          setShowDiscardConfirm(false);
          onClose();
        }
      }}
      aria-labelledby="admin-user-quota-modal-title"
      className="m-auto rounded-2xl shadow-2xl border border-slate-300 bg-white w-[calc(100%-2rem)] max-w-2xl max-h-[92dvh] overflow-hidden backdrop:bg-slate-900/60"
    >
      <div className="flex flex-col max-h-[92dvh]">
        <header className="p-4 sm:p-5 border-b border-slate-200 flex items-start justify-between gap-3 bg-white shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
              <Gauge className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="admin-user-quota-modal-title" className="text-sm font-bold text-slate-900 truncate">
                {target ? `Plan y Cuota — ${target.workspaceName || target.fullName}` : 'Plan y Cuota del Despacho'}
              </h2>
              {target && (
                <p className="text-xs text-slate-600 truncate mt-0.5">
                  {target.email} · <span className="font-mono text-[11px]">{target.workspaceId}</span>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            autoFocus
            disabled={isSaving}
            title={isSaving ? 'Guardando cuota...' : 'Cerrar modal de plan y cuota'}
            onClick={requestClose}
            aria-label="Cerrar modal de plan y cuota"
            className="min-h-8 min-w-8 inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </header>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 overscroll-contain space-y-3">
          {showDiscardConfirm && isDirty && (
            <div
              role="alertdialog"
              aria-modal="false"
              aria-labelledby="quota-discard-title"
              className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2.5"
            >
              <div id="quota-discard-title" className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                <span>Tienes cambios sin guardar en la cuota. ¿Deseas descartarlos?</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Seguir editando
                </button>
                <button
                  type="button"
                  onClick={confirmDiscardAndClose}
                  className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold cursor-pointer"
                >
                  Descartar y cerrar
                </button>
              </div>
            </div>
          )}

          {target && (
            <SuperAdminQuotaCard
              workspaceId={target.workspaceId}
              userId={target.userId}
              canEdit={canEdit}
              onStateChange={handleStateChange}
            />
          )}
        </div>
      </div>
    </dialog>,
    document.body
  );
}
