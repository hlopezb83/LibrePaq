import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Loader2, LogOut, Sparkles } from 'lucide-react';
import { LibrePaqLogo } from '../../components/LibrePaqLogo';
import { useAuth } from '../../context/AuthContext';
import type { User } from '@supabase/supabase-js';

interface LandingNavbarProps {
  user: User | null;
  onOpenAuth: () => void;
  onOpenSignIn?: () => void;
}

export function LandingNavbar({ user, onOpenAuth, onOpenSignIn }: LandingNavbarProps) {
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="relative lg:sticky lg:top-0 z-40 w-full backdrop-blur-md bg-white/95 border-b border-slate-200/80 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-2 min-[420px]:px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-6 min-w-0 shrink">
          <Link
            to="/landing"
            aria-label="Inicio LibrePaq Pro"
            className="flex items-center group focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 rounded-xl p-0.5 shrink min-w-0"
          >
            <div className="min-[420px]:hidden">
              <LibrePaqLogo
                variant="horizontal"
                size="xs"
                theme="light"
                showSubtitle={false}
              />
            </div>
            <div className="hidden min-[420px]:block sm:hidden">
              <LibrePaqLogo
                variant="horizontal"
                size="xs"
                theme="light"
                badge="PRO"
                showSubtitle={false}
              />
            </div>
            <div className="hidden sm:block">
              <LibrePaqLogo variant="horizontal" size="md" theme="light" badge="PRO" />
            </div>
          </Link>

          {/* Menú de navegación desktop */}
          <nav aria-label="Navegación principal" className="hidden lg:flex items-center gap-5 xl:gap-6 text-sm font-semibold text-slate-700">
            <a href="#comparativa" className="hover:text-blue-600 transition-colors flex items-center gap-1.5 whitespace-nowrap">
              <span>vs. CONTPAQi®</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Alternativa
              </span>
            </a>
            <a href="#caracteristicas" className="hover:text-blue-600 transition-colors whitespace-nowrap">
              Módulos Fiscales
            </a>
            <a href="#calculadora" className="hover:text-blue-600 transition-colors flex items-center gap-1.5 whitespace-nowrap">
              <span>Calculadora</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Ahorro
              </span>
            </a>
            <a href="#precios" className="hover:text-blue-600 transition-colors flex items-center gap-1.5 whitespace-nowrap">
              <span>Planes</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                $0 MXN
              </span>
            </a>
            <a href="#faq" className="hover:text-blue-600 transition-colors whitespace-nowrap">
              FAQ
            </a>
          </nav>
        </div>

        {/* Botones claros de Iniciar Sesión vs Crear Cuenta Gratis */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <span className="hidden md:inline-block text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-semibold truncate max-w-[180px]">
                <span aria-hidden="true">●</span> Conectado: {user.email?.split('@')[0]}
              </span>
              <Link
                to="/"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 group cursor-pointer shrink-0"
              >
                <span className="hidden sm:inline">Ir a Mi Despacho</span>
                <span className="sm:hidden">Mi Despacho</span>
                <ArrowRight className="w-3.5 sm:w-4 h-3.5 sm:h-4 group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true" />
              </Link>
              <button
                type="button"
                disabled={isSigningOut}
                aria-busy={isSigningOut}
                onClick={() => void handleSignOut()}
                aria-label="Cerrar sesión"
                className="p-1.5 sm:px-3 sm:py-2 rounded-xl border border-slate-300 hover:border-red-400 bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 disabled:opacity-60 disabled:cursor-wait"
              >
                {isSigningOut ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                ) : (
                  <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                )}
                <span className="hidden md:inline">
                  {isSigningOut ? 'Saliendo...' : 'Cerrar Sesión'}
                </span>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onOpenSignIn ?? onOpenAuth}
                className="px-1.5 min-[420px]:px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 font-semibold text-xs sm:text-sm transition cursor-pointer shrink-0 whitespace-nowrap"
              >
                <span className="hidden min-[390px]:inline">Iniciar Sesión</span>
                <span className="min-[390px]:hidden">Ingresar</span>
              </button>
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-2 min-[420px]:px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-blue-600/20 flex items-center gap-1 sm:gap-1.5 cursor-pointer group shrink-0 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-300 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Crear Cuenta ($0 Gratis)</span>
                <span className="sm:hidden font-extrabold">Probar Gratis</span>
                <ArrowRight className="hidden min-[380px]:block w-3.5 sm:w-4 h-3.5 sm:h-4 group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cinta compacta de secciones en móvil / tablet */}
      <nav
        aria-label="Secciones de la página"
        className="lg:hidden border-t border-slate-100 bg-slate-50/80 pl-3 pr-6 py-1 overflow-x-auto erp-tab-scroller flex items-center gap-2 text-[11px] font-semibold text-slate-700"
      >
        <a href="#comparativa" className="snap-start hover:text-blue-700 whitespace-nowrap py-1.5 px-1.5 rounded-lg">vs. CONTPAQi®</a>
        <a href="#caracteristicas" className="snap-start hover:text-blue-700 whitespace-nowrap py-1.5 px-1.5 rounded-lg">Módulos</a>
        <a href="#calculadora" className="snap-start hover:text-blue-700 whitespace-nowrap py-1.5 px-1.5 rounded-lg">Calculadora</a>
        <a href="#precios" className="snap-start hover:text-blue-700 whitespace-nowrap py-1.5 px-1.5 rounded-lg">Planes ($0)</a>
        <a href="#faq" className="snap-start hover:text-blue-700 whitespace-nowrap py-1.5 px-1.5 rounded-lg">FAQ</a>
      </nav>
    </header>
  );
}
