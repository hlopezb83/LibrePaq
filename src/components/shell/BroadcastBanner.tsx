import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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
  const { user, session, loading, isGuest } = useAuth();
  const [dismissedId, setDismissedId] = useState<string | null>(() => readDismissedBroadcastId());

  const { data: broadcast } = useQuery({
    queryKey: ['platform-broadcast'],
    queryFn: () => apiClient.getActiveBroadcast(),
    enabled: !loading && !isGuest && Boolean(user && session),
    staleTime: 60_000,
    retry: false
  });

  if (!broadcast || !broadcast.active) return null;
  if (broadcast.startsAt && new Date(broadcast.startsAt).getTime() > Date.now()) return null;
  if (broadcast.expiresAt && new Date(broadcast.expiresAt).getTime() <= Date.now()) return null;
  if (dismissedId === broadcast.id) return null;

  const handleDismiss = () => {
    writeDismissedBroadcastId(broadcast.id);
    setDismissedId(broadcast.id);
  };

  return (
    <div
      role="region"
      aria-label="Aviso oficial de la plataforma"
      className={`no-print px-4 py-2.5 border-b text-xs flex items-center justify-between gap-3 transition-colors ${
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
        <p className="min-w-0 line-clamp-2 sm:truncate" title={`${broadcast.title}: ${broadcast.message}`}>
          <strong className="font-bold mr-1">{broadcast.title}:</strong>
          {broadcast.message}
        </p>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="min-h-7 min-w-7 inline-flex items-center justify-center p-1 rounded hover:bg-black/15 focus:outline-none focus:ring-2 focus:ring-current transition cursor-pointer shrink-0"
        aria-label="Cerrar aviso"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
