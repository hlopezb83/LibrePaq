import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, KeyRound, Lock, ArrowLeft, AlertCircle, Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { translateAuthError } from '../components/auth/authErrorTranslator';
import { LibrePaqLogo } from '../components/LibrePaqLogo';

export function ResetPasswordView() {
  const navigate = useNavigate();
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(true);
  const [showRecoveryRequest, setShowRecoveryRequest] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!supabase) {
      setCheckingSession(false);
      setHasSession(false);
      return;
    }

    const hasAuthParams =
      typeof window !== 'undefined' &&
      (window.location.search.includes('code=') ||
        window.location.hash.includes('access_token=') ||
        window.location.hash.includes('type=recovery'));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && nextSession) {
        setHasSession(true);
        setCheckingSession(false);
        setErrorMsg(null);
      } else if (event === 'SIGNED_OUT') {
        setHasSession(false);
      }
    });

    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setHasSession(true);
        setCheckingSession(false);
      } else if (hasAuthParams) {
        fallbackTimer = setTimeout(() => {
          if (!mounted || !supabase) return;
          void supabase.auth.getSession().then(({ data: retryData }) => {
            if (!mounted) return;
            setHasSession(Boolean(retryData.session));
            setCheckingSession(false);
          });
        }, 2500);
      } else {
        setHasSession(false);
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      subscription.unsubscribe();
    };
  }, []);

  const handleRequestNewLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !recoveryEmail.trim()) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) {
        setErrorMsg(translateAuthError(error.message));
        return;
      }
      setRecoverySent(true);
    } catch (err: unknown) {
      setErrorMsg(translateAuthError(err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }
    if (!supabase) {
      setErrorMsg('El servicio de acceso en la nube no está disponible en este momento.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(translateAuthError(error.message));
        return;
      }
      setSuccess(true);
      redirectTimerRef.current = setTimeout(() => {
        void navigate({ to: '/' });
      }, 1800);
    } catch (err: unknown) {
      setErrorMsg(translateAuthError(err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-5">
        <div className="pb-3 border-b border-slate-100">
          <LibrePaqLogo variant="horizontal" size="sm" theme="light" badge="PRO" />
        </div>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
            <KeyRound className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Restablecer Contraseña</h1>
            <p className="text-xs text-slate-600">
              Define una nueva contraseña segura para tu cuenta de LibrePaq Pro.
            </p>
          </div>
        </div>

        {checkingSession ? (
          <div role="status" className="py-6 flex items-center justify-center gap-2 text-xs text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" aria-hidden="true" />
            <span>Verificando enlace de recuperación...</span>
          </div>
        ) : !hasSession && !success ? (
          <div className="space-y-4">
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-bold">Tu enlace de recuperación expiró o ya fue utilizado.</p>
                <p className="text-amber-900">
                  Solicita un nuevo enlace para recibir las instrucciones en tu correo electrónico.
                </p>
              </div>
            </div>

            {recoverySent ? (
              <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>Enlace enviado. Revisa tu bandeja de entrada o carpeta de Spam.</span>
              </div>
            ) : showRecoveryRequest ? (
              <form onSubmit={handleRequestNewLink} className="space-y-3">
                {errorMsg && (
                  <div
                    id="recovery-email-error"
                    role="alert"
                    className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                <div>
                  <label htmlFor="recovery-email" className="block text-xs font-semibold text-slate-700 mb-1">
                    Correo Electrónico Registrado
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                      id="recovery-email"
                      type="email"
                      required
                      autoComplete="email"
                      aria-invalid={Boolean(errorMsg)}
                      aria-describedby={errorMsg ? 'recovery-email-error' : undefined}
                      value={recoveryEmail}
                      onChange={(e) => {
                        setRecoveryEmail(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="contador@despacho.mx"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm transition cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  <span>{isSubmitting ? 'Enviando enlace...' : 'Enviar nuevo enlace'}</span>
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowRecoveryRequest(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition cursor-pointer"
              >
                Solicitar nuevo enlace
              </button>
            )}
          </div>
        ) : success ? (
          <div
            role="status"
            className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold">¡Contraseña actualizada!</p>
              <p className="text-xs text-emerald-800 mt-1">
                Tu nueva contraseña quedó guardada. Redirigiendo al panel principal...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div
                id="reset-password-error"
                role="alert"
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Nueva Contraseña (mínimo 6 caracteres)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errorMsg)}
                  aria-describedby={errorMsg ? 'reset-password-error' : undefined}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full pl-9 pr-11 py-2.5 rounded-xl border border-slate-300 text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 min-h-[28px] min-w-[28px] inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Confirmar Nueva Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errorMsg)}
                  aria-describedby={errorMsg ? 'reset-password-error' : undefined}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm transition cursor-pointer inline-flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              <span>{isSubmitting ? 'Guardando...' : 'Actualizar Contraseña'}</span>
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-slate-100">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
