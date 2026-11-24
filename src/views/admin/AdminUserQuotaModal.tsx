import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Gauge, X } from 'lucide-react';
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

  useDialogLightDismiss(dialogRef, onClose, { isOpen: Boolean(target) });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target && !dialog.open) dialog.showModal();
    else if (!target && dialog.open) dialog.close();
  }, [target]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
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
            onClick={onClose}
            aria-label="Cerrar modal de plan y cuota"
            className="min-h-8 min-w-8 inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </header>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          {target && (
            <SuperAdminQuotaCard
              workspaceId={target.workspaceId}
              userId={target.userId}
              canEdit={canEdit}
            />
          )}
        </div>
      </div>
    </dialog>,
    document.body
  );
}
