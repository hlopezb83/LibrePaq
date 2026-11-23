import type { User } from '@supabase/supabase-js';
import { ArrowRight, Loader2, LogOut, ShieldCheck } from 'lucide-react';

interface AuthActiveSessionPanelProps {
  user: User;
  loading: boolean;
  onNavigateToDashboard?: () => void;
  onSignOut: () => void;
}

export function AuthActiveSessionPanel({
  user,
  loading,
  onNavigateToDashboard,
  onSignOut
}: AuthActiveSessionPanelProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-[#111C35] border border-blue-900/50 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0">
            {user.email?.slice(0, 2).toUpperCase() || 'CP'}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">
              {user.user_metadata?.full_name || 'Contador Titular'}
            </div>
            <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Estado de Conexión:</span>
          <span className="font-mono text-cyan-300 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Nube Activa (Cifrado SAT)
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {onNavigateToDashboard && (
          <button
            type="button"
            onClick={onNavigateToDashboard}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Ir a Mi Despacho Contable</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={onSignOut}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-red-300 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Cerrar Sesión del Despacho</span>
        </button>
      </div>
    </div>
  );
}

interface AuthGoogleButtonProps {
  loading: boolean;
  mode: 'signin' | 'signup' | 'forgot';
  onClick: () => void;
}

export function AuthGoogleButton({ loading, mode, onClick }: AuthGoogleButtonProps) {
  return (
    <button
      type="button"
      disabled={loading}
      aria-busy={loading}
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-extrabold transition shadow-sm cursor-pointer disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-slate-700" aria-hidden="true" />
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        />
        </svg>
      )}
      <span>
        {mode === 'signup' ? 'Crear Cuenta en 1 clic con Google' : 'Continuar con Google'}
      </span>
    </button>
  );
}

interface AuthModeTabsProps {
  mode: 'signin' | 'signup' | 'forgot';
  onSelectMode: (next: 'signin' | 'signup') => void;
}

export function AuthModeTabs({ mode, onSelectMode }: AuthModeTabsProps) {
  return (
    <div
      role="group"
      aria-label="Modalidad de acceso"
      className="grid grid-cols-2 p-1 rounded-xl bg-[#111C35] border border-slate-800 text-xs font-semibold"
    >
      <button
        type="button"
        aria-pressed={mode === 'signup'}
        onClick={() => onSelectMode('signup')}
        className={`py-1.5 rounded-lg transition cursor-pointer text-center ${
          mode === 'signup'
            ? 'bg-blue-600 text-white shadow-xs font-bold'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        Crear Cuenta Gratis
      </button>
      <button
        type="button"
        aria-pressed={mode === 'signin'}
        onClick={() => onSelectMode('signin')}
        className={`py-1.5 rounded-lg transition cursor-pointer text-center ${
          mode === 'signin'
            ? 'bg-blue-600 text-white shadow-xs font-bold'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        Iniciar Sesión
      </button>
    </div>
  );
}

interface AuthForgotHeaderProps {
  onBackToSignIn: () => void;
}

export function AuthForgotHeader({ onBackToSignIn }: AuthForgotHeaderProps) {
  return (
    <div className="space-y-1.5 pt-0.5">
      <button
        type="button"
        onClick={onBackToSignIn}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition cursor-pointer"
      >
        <span>← Volver al inicio de sesión</span>
      </button>
      <h3 className="text-sm sm:text-base font-extrabold text-white">
        Recuperar Contraseña de tu Despacho
      </h3>
      <p className="text-xs text-slate-400 leading-relaxed">
        Ingresa tu correo registrado y te enviaremos de inmediato un enlace seguro para restablecer tu contraseña.
      </p>
    </div>
  );
}

export function AuthFooterTrust({ mode }: { mode: 'signin' | 'signup' | 'forgot' }) {
  const text =
    mode === 'signup'
      ? '⚡ Sin tarjeta de crédito • Acceso inmediato • Datos respaldados'
      : mode === 'signin'
      ? '🔒 Conexión segura y cifrada • Cumplimiento fiscal Anexo 24 SAT'
      : '🔒 Enlace temporal de un solo uso • Cifrado extremo a extremo';

  return (
    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[10px] text-slate-400">
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
      <span className="truncate">{text}</span>
    </div>
  );
}
