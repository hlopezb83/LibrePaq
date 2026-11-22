import { Crown, LogOut, CheckCircle2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { DEFAULT_WHATSAPP_PHONE } from '../WhatsAppSupportButton';

interface ExecutiveTopHeaderProps {
  user: User | null;
  onSignOut: () => void;
}

export function ExecutiveTopHeader({ user, onSignOut }: ExecutiveTopHeaderProps) {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-300/80 px-2.5 sm:px-5 py-1.5 sticky top-0 z-20 shadow-2xs no-print min-h-[42px] flex items-center justify-between gap-2">
      {/* Lado Izquierdo: Identidad de Dueño */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-50 border border-amber-300 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
          <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-black text-slate-900 tracking-tight truncate">
              <span className="hidden sm:inline">LibrePaq Pro • </span>Consola del Propietario
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-mono shrink-0">
              SUPERADMIN
            </span>
          </div>
          <p className="hidden md:block text-[10px] text-slate-500 truncate">
            Gobernanza global, clientes y monitoreo de producción librepaq.com
          </p>
        </div>
      </div>

      {/* Lado Derecho: Estado del Sistema y Perfil */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="hidden lg:flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Supabase Online
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Hosting Activo
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg">
            WA: +{DEFAULT_WHATSAPP_PHONE.slice(0, 4)}...
          </span>
        </div>

        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
            {(user?.user_metadata?.full_name || user?.email || 'AD').slice(0, 2).toUpperCase()}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-slate-900 leading-tight">
              {user?.user_metadata?.full_name || 'Administrador'}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              {user?.email || 'admin@librepaq.com'}
            </p>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            title="Cerrar Sesión de Administrador"
            aria-label="Cerrar Sesión de Administrador"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition cursor-pointer shrink-0 ml-1"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
