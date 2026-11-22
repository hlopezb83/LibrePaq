import { Link } from '@tanstack/react-router';
import { ArrowRight, LogOut, Sparkles } from 'lucide-react';
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
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/95 border-b border-slate-200/80 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-14 sm:h-16 xl:h-20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-6 min-w-0">
          <Link
            to="/landing"
            className="flex items-center group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl p-0.5 shrink-0"
          >
            <div className="sm:hidden">
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
          <nav className="hidden lg:flex items-center gap-5 xl:gap-6 text-sm font-semibold text-slate-600">
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
                ● Conectado: {user.email?.split('@')[0]}
              </span>
              <Link
                to="/"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 group cursor-pointer shrink-0"
              >
                <span className="hidden sm:inline">Ir a Mi Despacho</span>
                <span className="sm:hidden">Mi Despacho</span>
                <ArrowRight className="w-3.5 sm:w-4 h-3.5 sm:h-4 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                aria-label="Cerrar sesión"
                className="p-1.5 sm:px-3 sm:py-2 rounded-xl border border-slate-300 hover:border-red-400 bg-white hover:bg-red-50 text-slate-600 hover:text-red-700 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                title="Cerrar Sesión (Sign Out)"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">Cerrar Sesión</span>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onOpenSignIn ?? onOpenAuth}
                className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 font-semibold text-xs sm:text-sm transition cursor-pointer shrink-0 whitespace-nowrap"
              >
                <span className="hidden min-[390px]:inline">Iniciar Sesión</span>
                <span className="min-[390px]:hidden">Ingresar</span>
              </button>
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-blue-600/20 flex items-center gap-1 sm:gap-1.5 cursor-pointer group shrink-0 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
                <span className="hidden sm:inline">Crear Cuenta ($0 Gratis)</span>
                <span className="sm:hidden font-extrabold">Probar Gratis</span>
                <ArrowRight className="hidden min-[380px]:block w-3.5 sm:w-4 h-3.5 sm:h-4 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
