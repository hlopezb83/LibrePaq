import { ArrowRight, FlaskConical, LogOut, Sparkles } from 'lucide-react';

interface GuestDemoBannerProps {
  isGuest: boolean;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export function GuestDemoBanner({ isGuest, onOpenAuth, onSignOut }: GuestDemoBannerProps) {
  if (!isGuest) return null;

  return (
    <aside
      aria-label="Aviso de Modo Demostración en Vivo"
      className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-sm no-print z-30"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-5 h-5 rounded-full bg-slate-950 text-amber-300 flex items-center justify-center shrink-0">
          <FlaskConical className="w-3 h-3 animate-pulse" aria-hidden="true" />
        </div>
        <p className="truncate text-slate-950">
          <span>Modo Demo Interactivo</span>
          <span className="hidden sm:inline font-normal text-slate-900">
            {' '}— Explora módulos, pólizas y balanza con datos de ejemplo.
          </span>
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <button
          type="button"
          onClick={onOpenAuth}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-[11px] shadow-xs transition cursor-pointer"
        >
          <Sparkles className="w-3 h-3 text-yellow-300" aria-hidden="true" />
          <span>Crear Mi Cuenta Gratis ($0)</span>
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onSignOut}
          aria-label="Salir del modo demostración"
          title="Salir del modo demostración"
          className="inline-flex items-center gap-1 text-slate-900 hover:text-black font-semibold text-[11px] px-1.5 py-1 rounded hover:bg-black/5 transition cursor-pointer"
        >
          <LogOut className="w-3 h-3" aria-hidden="true" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </aside>
  );
}
