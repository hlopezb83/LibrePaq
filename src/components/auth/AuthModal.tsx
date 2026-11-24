import React, { useEffect, useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, X, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { trackAnalyticsEvent, trackDirectGoogleAdsSignupConversion } from '../../lib/analytics';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { LibrePaqLogo } from '../LibrePaqLogo';
import {
  AuthActiveSessionPanel,
  AuthGoogleButton,
  AuthModeTabs,
  AuthForgotHeader,
  AuthFooterTrust
} from './AuthModalSubcomponents';
import { translateAuthError } from './authErrorTranslator';

export interface AuthModalProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  initialMode?: 'signin' | 'signup';
  onClose?: () => void;
}

export function AuthModal({ dialogRef, initialMode = 'signup', onClose }: AuthModalProps) {
  const { user, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, resetPassword } =
    useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setMessage(null);
  }, [initialMode]);

  const resetModalState = () => {
    setMode(initialMode);
    setMessage(null);
  };

  const handleClose = () => {
    resetModalState();
    dialogRef.current?.close();
    onClose?.();
  };

  useDialogLightDismiss(dialogRef, () => {
    resetModalState();
    onClose?.();
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signInWithEmail(email, password);
        if (error) {
          setMessage({ type: 'error', text: translateAuthError(error.message) });
        } else {
          trackAnalyticsEvent('login', { method: 'email' });
          setMessage({ type: 'success', text: 'Sesión iniciada con éxito. Abriendo tu despacho...' });
          setTimeout(() => {
            handleClose();
            if (window.location.pathname === '/landing') window.location.assign('/');
          }, 350);
        }
      } else if (mode === 'signup') {
        const { data, error } = await signUpWithEmail(email, password, fullName);
        if (error) {
          setMessage({ type: 'error', text: translateAuthError(error.message) });
        } else if (data?.session) {
          trackAnalyticsEvent('sign_up_submitted', { method: 'email', auto_confirmed: true });
          trackDirectGoogleAdsSignupConversion('email_signup');
          setMessage({ type: 'success', text: '¡Cuenta creada con éxito! Abriendo tu despacho...' });
          setTimeout(() => {
            handleClose();
            if (window.location.pathname === '/landing') window.location.assign('/');
          }, 350);
        } else {
          trackAnalyticsEvent('sign_up_submitted', { method: 'email', auto_confirmed: false });
          trackDirectGoogleAdsSignupConversion('email_pending_confirm');
          setMessage({
            type: 'success',
            text: 'Cuenta creada. Revisa tu bandeja de entrada o spam para confirmar tu correo.'
          });
        }
      } else if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) {
          setMessage({ type: 'error', text: translateAuthError(error.message) });
        } else {
          trackAnalyticsEvent('reset_password_request', { method: 'email' });
          setMessage({
            type: 'success',
            text: 'Enlace enviado. Revisa tu bandeja de entrada o spam para restablecer tu contraseña.'
          });
        }
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Error al procesar la solicitud';
      setMessage({ type: 'error', text: translateAuthError(raw) });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setMessage(null);
    setLoading(true);
    trackAnalyticsEvent('auth_oauth_start', { method: 'google_oauth', intent: mode });
    try {
      const { error } = await signInWithGoogle();
      if (error) setMessage({ type: 'error', text: translateAuthError(error.message) });
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Error al conectar con Google';
      setMessage({ type: 'error', text: translateAuthError(raw) });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await signOut();
    setLoading(false);
    handleClose();
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onCancel={handleClose}
      onClose={resetModalState}
      aria-labelledby="auth-modal-title"
      className="dark-surface p-0 rounded-2xl sm:rounded-3xl backdrop:bg-slate-950/75 backdrop:backdrop-blur-sm shadow-2xl border border-slate-700/60 w-full max-w-md max-h-[92dvh] bg-[#0A1120] text-white overflow-hidden m-auto"
    >
      <div className="flex flex-col max-h-[92dvh]">
        <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-3.5 border-b border-slate-800/80 flex items-start justify-between gap-2 shrink-0">
          <div>
            <LibrePaqLogo variant="horizontal" size="sm" theme="dark" badge="PRO" />
            <h2 id="auth-modal-title" className="sr-only">
              {mode === 'signup'
                ? 'Crear Cuenta Gratis en LibrePaq Pro'
                : mode === 'signin'
                ? 'Iniciar Sesión en LibrePaq Pro'
                : 'Recuperar Contraseña de tu Despacho'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Cerrar ventana de autenticación"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-3.5 sm:space-y-4">
        {user ? (
          <AuthActiveSessionPanel
            user={user}
            loading={loading}
            onNavigateToDashboard={() => {
              handleClose();
              if (window.location.pathname === '/landing') window.location.assign('/');
            }}
            onSignOut={handleSignOut}
          />
        ) : (
          <div className="space-y-3 sm:space-y-3.5">
            {mode === 'forgot' ? (
              <AuthForgotHeader onBackToSignIn={() => { setMode('signin'); setMessage(null); }} />
            ) : (
              <>
                <AuthModeTabs
                  mode={mode}
                  onSelectMode={(next) => { setMode(next); setMessage(null); }}
                />
                <AuthGoogleButton loading={loading} mode={mode} onClick={handleGoogleSignIn} />
                <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span>o con correo electrónico</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>
              </>
            )}

            {message && (
              <div
                id="auth-alert-msg"
                role="alert"
                className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  message.type === 'success'
                    ? 'bg-emerald-950/60 text-emerald-200 border-emerald-800'
                    : 'bg-red-950/60 text-red-200 border-red-800'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
                )}
                <span className="leading-tight">{message.text}</span>
              </div>
            )}

            <form
              id={mode === 'signup' ? 'signup-form' : mode === 'signin' ? 'signin-form' : 'recovery-form'}
              method="post"
              onSubmit={handleSubmit}
              className="space-y-3"
            >
              {mode === 'signup' && (
                <div className="space-y-1">
                  <label htmlFor="auth-fullname" className="block text-[11px] font-semibold text-slate-300">
                    Tu Nombre o Despacho Contable
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-300" aria-hidden="true" />
                    <input
                      id="auth-fullname"
                      name="name"
                      type="text"
                      autoComplete="name"
                      enterKeyHint="next"
                      required
                      aria-invalid={message?.type === 'error'}
                      aria-describedby={message ? 'auth-alert-msg' : undefined}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ej. C.P. Héctor López o Despacho Fiscal"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#111C35] border border-slate-700/80 text-xs text-white placeholder-slate-400 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="auth-email" className="block text-[11px] font-semibold text-slate-300">
                  {mode === 'forgot' ? 'Correo Electrónico Registrado' : 'Correo Electrónico'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-300" aria-hidden="true" />
                  <input
                    id="auth-email"
                    name={mode === 'signin' ? 'username' : 'email'}
                    type="email"
                    autoComplete={mode === 'signin' ? 'username' : 'email'}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint={mode === 'forgot' ? 'done' : 'next'}
                    required
                    aria-invalid={message?.type === 'error'}
                    aria-describedby={message ? 'auth-alert-msg' : undefined}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contador@despacho.mx"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#111C35] border border-slate-700/80 text-xs text-white placeholder-slate-400 focus:border-blue-500"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="auth-password" className="block text-[11px] font-semibold text-slate-300">
                      Contraseña
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => { setMode('forgot'); setMessage(null); }}
                        className="text-[10px] text-blue-300 hover:text-blue-200 cursor-pointer"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-300" aria-hidden="true" />
                    <input
                      id="auth-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      enterKeyHint="done"
                      required
                      minLength={6}
                      aria-invalid={message?.type === 'error'}
                      aria-describedby={message ? 'auth-alert-msg' : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : 'Tu contraseña de acceso'}
                      className="w-full pl-9 pr-10 py-2 rounded-xl bg-[#111C35] border border-slate-700/80 text-xs text-white placeholder-slate-400 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 min-h-[28px] min-w-[28px] inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/70 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                <span>
                  {loading
                    ? 'Procesando...'
                    : mode === 'signin'
                    ? 'Ingresar a Mi Despacho'
                    : mode === 'signup'
                    ? 'Crear Mi Cuenta Gratis ($0 MXN)'
                    : 'Enviar Enlace de Recuperación'}
                </span>
                {!loading && <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}
              </button>
            </form>

            <AuthFooterTrust mode={mode} onNavigateLegal={handleClose} />
          </div>
        )}
        </div>
      </div>
    </dialog>
  );
}

export default AuthModal;
