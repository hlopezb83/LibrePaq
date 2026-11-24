import { lazy, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import { LibrePaqLogo } from '../components/LibrePaqLogo';

const LandingPageView = lazy(() =>
  import('./LandingPageView').then((m) => ({ default: m.LandingPageView }))
);
const DashboardView = lazy(() =>
  import('./DashboardView').then((m) => ({ default: m.DashboardView }))
);

export function IndexView() {
  const { user, loading } = useAuth();

  const splashScreen = (
    <main className="min-h-dvh bg-[#051124] flex flex-col items-center justify-center px-4 text-center">
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="flex flex-col items-center"
      >
        <LibrePaqLogo variant="horizontal" size="lg" theme="dark" />
        <div className="mt-6 flex items-center justify-center gap-2.5 text-xs font-mono text-cyan-300">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping motion-reduce:animate-none" aria-hidden="true" />
          <span>Iniciando entorno fiscal seguro...</span>
        </div>
      </div>
    </main>
  );

  const authenticatedFallback = (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="min-h-dvh bg-slate-50 p-4 sm:p-6 space-y-4 max-w-7xl mx-auto"
    >
      <span className="visually-hidden">Cargando tablero financiero...</span>
      <div className="h-20 bg-slate-200/80 rounded-2xl animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-slate-200/70 rounded-2xl" />
        ))}
      </div>
      <div className="h-24 bg-slate-200/60 rounded-2xl animate-pulse" />
    </div>
  );

  if (loading) {
    return splashScreen;
  }

  // Si el usuario no ha iniciado sesión, mostramos la Landing Page comercial
  if (!user) {
    return (
      <Suspense fallback={splashScreen}>
        <LandingPageView />
      </Suspense>
    );
  }

  // Si el usuario ya inició sesión, entra directamente al Tablero Contable
  return (
    <Suspense fallback={authenticatedFallback}>
      <DashboardView />
    </Suspense>
  );
}
