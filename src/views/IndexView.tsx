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
    <div className="min-h-screen bg-[#051124] flex flex-col items-center justify-center">
      <LibrePaqLogo variant="horizontal" size="lg" theme="dark" />
      <div className="mt-6 flex items-center gap-2.5 text-xs font-mono text-cyan-300">
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
        <span>Iniciando entorno fiscal seguro...</span>
      </div>
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
    <Suspense fallback={splashScreen}>
      <DashboardView />
    </Suspense>
  );
}
