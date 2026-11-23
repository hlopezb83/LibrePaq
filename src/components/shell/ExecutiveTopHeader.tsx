import { Crown, LogOut, CheckCircle2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { DEFAULT_WHATSAPP_PHONE } from '../WhatsAppSupportButton';
import { useAuth } from '../../context/AuthContext';
import type { PlatformRole } from '../../shared/admin-types';

interface ExecutiveTopHeaderProps {
  user: User | null;
  onSignOut: () => void;
}

function getExecutiveRoleMeta(role: PlatformRole): {
  shortTitle: string;
  badgeLabel: string;
  badgeClass: string;
} {
  if (role === 'SUPERADMIN') {
    return {
      shortTitle: 'Consola del Propietario',
      badgeLabel: 'SUPERADMIN',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300'
    };
  }
  if (role === 'BILLING_OPS') {
    return {
      shortTitle: 'Operaciones y Cuotas',
      badgeLabel: 'OPERACIONES',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    };
  }
  return {
    shortTitle: 'Soporte de Plataforma',
    badgeLabel: 'SOPORTE',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300'
  };
}

export function ExecutiveTopHeader({ user, onSignOut }: ExecutiveTopHeaderProps) {
  const { platformRole } = useAuth();
  const roleMeta = getExecutiveRoleMeta(platformRole);

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-300/80 px-2.5 sm:px-5 py-1.5 sticky top-0 z-20 shadow-2xs no-print min-h-[42px] flex items-center justify-between gap-2">
      {/* Lado Izquierdo: Identidad de Dueño */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-50 border border-amber-300 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
          <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-black text-slate-900 tracking-tight truncate">
              <span className="hidden sm:inline">LibrePaq Pro • </span>{roleMeta.shortTitle}
            </span>
            <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.2 rounded-full border font-mono shrink-0 ${roleMeta.badgeClass}`}>
              {roleMeta.badgeLabel}
            </span>
          </div>
          <p className="hidden md:block text-[10px] text-slate-600 truncate">
            Gobernanza global, clientes y monitoreo de producción librepaq.com
          </p>
        </div>
      </div>

      {/* Lado Derecho: Estado del Sistema y Perfil */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="hidden lg:flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
            Nube Producción
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
            <CheckCircle2 className="w-3 h-3 text-blue-600" aria-hidden="true" />
            Hosting Web
          </span>
          <span
            title={`Soporte WhatsApp: +${DEFAULT_WHATSAPP_PHONE}`}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg"
          >
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
            <p className="text-[10px] text-slate-600 font-mono">
              {user?.email || 'admin@librepaq.com'}
            </p>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            title="Cerrar Sesión de Administrador"
            aria-label="Cerrar Sesión de Administrador"
            className="p-1.5 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition cursor-pointer shrink-0 ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
