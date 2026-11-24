import { Eye, LogOut, ShieldAlert } from 'lucide-react';
import type { SupportImpersonationSession } from '../../shared/admin-types';

export interface SupportModeBannerProps {
  session: SupportImpersonationSession;
  onExit: () => void;
  isExiting?: boolean;
}

export function SupportModeBanner({ session, onExit, isExiting = false }: SupportModeBannerProps) {
  return (
    <div
      role="region"
      aria-label="Modo Soporte solo lectura"
      className="no-print bg-amber-950 text-amber-50 border-b border-amber-700 px-4 py-2.5 shadow-sm"
    >
      <div className="max-w-[1800px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-900 border border-amber-700 text-amber-200 shrink-0">
            <Eye className="w-4 h-4" aria-hidden="true" />
          </span>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            <span className="font-bold text-amber-100 truncate max-w-[min(260px,65vw)]" title={session.companyName}>
              {session.companyName}
            </span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-amber-900/90 border border-amber-700 text-amber-100">
              {session.companyRfc}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-800/90 border border-amber-600 text-amber-50 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-200" aria-hidden="true" />
              Solo lectura — Escritura bloqueada
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onExit}
          disabled={isExiting}
          aria-busy={isExiting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-white disabled:opacity-60 text-amber-950 font-bold transition cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-amber-300"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          {isExiting ? 'Saliendo...' : 'Salir de Modo Soporte'}
        </button>
      </div>
    </div>
  );
}
