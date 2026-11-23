import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { apiClient } from '../../lib/api-client';

const DISMISSED_BROADCAST_STORAGE_KEY = 'librepaq_dismissed_broadcast_id';

function readDismissedBroadcastId(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_BROADCAST_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeDismissedBroadcastId(broadcastId: string): void {
  try {
    window.localStorage.setItem(DISMISSED_BROADCAST_STORAGE_KEY, broadcastId);
  } catch {
    // Ignorar errores de cuota o almacenamiento restringido
  }
}

export function BroadcastBanner() {
  const [dismissedId, setDismissedId] = useState<string | null>(() => readDismissedBroadcastId());

  const { data: broadcast } = useQuery({
    queryKey: ['platform-broadcast'],
    queryFn: () => apiClient.getActiveBroadcast(),
    staleTime: 60_000,
    retry: false
  });

  if (!broadcast || !broadcast.active) return null;
  if (broadcast.expiresAt && new Date(broadcast.expiresAt).getTime() <= Date.now()) return null;
  if (dismissedId === broadcast.id) return null;

  const handleDismiss = () => {
    writeDismissedBroadcastId(broadcast.id);
    setDismissedId(broadcast.id);
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Aviso oficial de la plataforma"
      className={`px-4 py-2.5 border-b text-xs flex items-center justify-between gap-3 transition-colors ${
        broadcast.type === 'warning'
          ? 'bg-amber-400 text-slate-950 border-amber-600 font-semibold'
          : broadcast.type === 'success'
          ? 'bg-emerald-700 text-white border-emerald-800'
          : 'bg-blue-700 text-white border-blue-800'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {broadcast.type === 'warning' ? (
          <AlertCircle className="w-4 h-4 shrink-0 text-slate-950" aria-hidden="true" />
        ) : broadcast.type === 'success' ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-white" aria-hidden="true" />
        ) : (
          <Info className="w-4 h-4 shrink-0 text-white" aria-hidden="true" />
        )}
        <span className="font-bold shrink-0">{broadcast.title}:</span>
        <span className="line-clamp-2 sm:truncate" title={broadcast.message}>
          {broadcast.message}
        </span>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="p-1 rounded hover:bg-black/15 focus:outline-none focus:ring-2 focus:ring-current transition cursor-pointer shrink-0"
        aria-label="Cerrar aviso"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </aside>
  );
}
