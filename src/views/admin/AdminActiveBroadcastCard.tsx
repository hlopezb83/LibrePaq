import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Info, Trash2 } from 'lucide-react';
import type { AdminBroadcastMessage } from '../../shared/admin-types';
import { formatAdminDateTime } from './adminFormatters';

export type BroadcastType = AdminBroadcastMessage['type'];

export const BROADCAST_TYPE_STYLES: Record<
  BroadcastType,
  { box: string; icon: typeof Info; iconClass: string }
> = {
  warning: { box: 'bg-amber-50 border-amber-300 text-amber-950', icon: AlertCircle, iconClass: 'text-amber-700' },
  success: { box: 'bg-emerald-50 border-emerald-300 text-emerald-950', icon: CheckCircle2, iconClass: 'text-emerald-700' },
  info: { box: 'bg-blue-50 border-blue-300 text-blue-950', icon: Info, iconClass: 'text-blue-700' }
};

export interface AdminActiveBroadcastCardProps {
  broadcast: AdminBroadcastMessage;
  canManage: boolean;
  isPending: boolean;
  isClearing: boolean;
  onClear: () => void;
}

export function AdminActiveBroadcastCard({
  broadcast,
  canManage,
  isPending,
  isClearing,
  onClear
}: AdminActiveBroadcastCardProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const clearTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setConfirmClear(false);
  }, [broadcast.id]);

  const cancelConfirmClear = () => {
    setConfirmClear(false);
    requestAnimationFrame(() => clearTriggerRef.current?.focus());
  };

  const activeStyle = BROADCAST_TYPE_STYLES[broadcast.type];
  const ActiveIcon = activeStyle.icon;

  return (
    <div className={`p-4 rounded-xl border space-y-3 ${activeStyle.box}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <ActiveIcon className={`w-5 h-5 shrink-0 mt-0.5 ${activeStyle.iconClass}`} aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider">Aviso Activo:</span>
              <span className="text-xs font-black">{broadcast.title}</span>
              {broadcast.expiresAt && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/80 text-slate-700 border border-slate-300">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  Expira: {formatAdminDateTime(broadcast.expiresAt)}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5 text-slate-800">{broadcast.message}</p>
          </div>
        </div>
        {canManage && !confirmClear && (
          <button
            ref={clearTriggerRef}
            type="button"
            disabled={isPending}
            onClick={() => setConfirmClear(true)}
            className="p-2 rounded-lg text-slate-700 hover:text-red-700 hover:bg-white/80 disabled:opacity-50 transition cursor-pointer shrink-0"
            title="Desactivar y retirar comunicado"
            aria-label="Desactivar y retirar comunicado"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {confirmClear && (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-label="Confirmar retiro del comunicado global"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !isPending) {
              e.preventDefault();
              cancelConfirmClear();
            }
          }}
          className="p-3 rounded-lg bg-white border border-red-300 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <span className="font-bold text-red-900">¿Retirar este comunicado para todos los usuarios?</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              autoFocus
              disabled={isPending}
              onClick={cancelConfirmClear}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 font-semibold hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={onClear}
              className="px-3 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold disabled:opacity-50 cursor-pointer"
            >
              {isClearing ? 'Retirando...' : 'Sí, retirar aviso'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
