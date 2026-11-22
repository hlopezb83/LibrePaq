import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { adminApi } from '../../lib/api/admin.api';
import type { AdminBroadcastMessage } from '../../shared/admin-types';

export function BroadcastBanner() {
  const [broadcast, setBroadcast] = useState<AdminBroadcastMessage | null>(() =>
    adminApi.getBroadcastMessage()
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleStorageChange = () => {
      setBroadcast(adminApi.getBroadcastMessage());
      setDismissed(false);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (!broadcast?.active || dismissed) return null;

  return (
    <aside
      aria-label="Aviso oficial de la plataforma"
      className={`px-4 py-2.5 border-b text-xs flex items-center justify-between gap-3 transition-colors ${
        broadcast.type === 'warning'
          ? 'bg-amber-500 text-slate-950 border-amber-600 font-semibold'
          : broadcast.type === 'success'
          ? 'bg-emerald-600 text-white border-emerald-700'
          : 'bg-blue-600 text-white border-blue-700'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {broadcast.type === 'warning' ? (
          <AlertCircle className="w-4 h-4 shrink-0 text-slate-950" />
        ) : broadcast.type === 'success' ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
        ) : (
          <Info className="w-4 h-4 shrink-0 text-white" />
        )}
        <span className="font-bold shrink-0">{broadcast.title}:</span>
        <span className="truncate">{broadcast.message}</span>
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-black/10 transition cursor-pointer shrink-0"
        aria-label="Cerrar aviso"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </aside>
  );
}
