import { useEffect, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';

let hasPrefetchedPublicAssets = false;
let hasPrefetchedErpModules = false;

/**
 * Barra superior de progreso estilo Linear/GitHub (3px) + Precarga silenciosa (Idle Prefetch)
 * de todos los módulos del ERP en segundo plano sin bloquear el render inicial.
 */
export function TopLoadingBar() {
  const isRouteLoading = useRouterState({ select: (s) => s.isLoading });
  const activeFetches = useIsFetching();
  const activeMutations = useIsMutating();
  const { user, loading: authLoading } = useAuth();

  const isBusy = isRouteLoading || activeFetches > 0 || activeMutations > 0;
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  // Control de animación suave de la barra de progreso superior
  useEffect(() => {
    if (isBusy) {
      setVisible(true);
      setProgress((prev) => (prev === 0 || prev >= 100 ? 25 : prev));

      const interval = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          const step = prev < 50 ? 15 : prev < 75 ? 7 : 2;
          return Math.min(90, prev + step);
        });
      }, 180);

      return () => window.clearInterval(interval);
    } else if (visible) {
      setProgress(100);
      const timeout = window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 240);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [isBusy, visible]);

  // Precarga silenciosa en segundo plano (Idle Prefetching)
  useEffect(() => {
    if (authLoading) return undefined;

    const scheduleIdle = (cb: () => void, delayMs: number) => {
      const timer = window.setTimeout(() => {
        if ('requestIdleCallback' in window) {
          (window as Window & { requestIdleCallback: (fn: () => void) => void }).requestIdleCallback(cb);
        } else {
          cb();
        }
      }, delayMs);
      return () => window.clearTimeout(timer);
    };

    if (!user && !hasPrefetchedPublicAssets) {
      // Usuario en Landing Page: precargar modal de Auth, Demo Seeder y Tablero para clic instantáneo
      return scheduleIdle(() => {
        hasPrefetchedPublicAssets = true;
        void import('../AuthModal');
        void import('../../views/DashboardView');
        void import('../../lib/sandbox-demo-seeder');
      }, 1000);
    }

    if (user && !hasPrefetchedErpModules) {
      // Usuario dentro del ERP: precargar silenciosamente todas las vistas contables en memoria
      return scheduleIdle(() => {
        hasPrefetchedErpModules = true;
        void import('../../views/DashboardView');
        void import('../../views/PolizasView');
        void import('../../views/AddCfdiView');
        void import('../../views/CatalogoCuentasView');
        void import('../../views/DiotBancosView');
        void import('../../views/ReportesView');
        void import('../../views/AjustesView');
        void import('../CompanyOnboardingWizardModal');
        void import('../AccountLedgerModal');
      }, 600);
    }

    return undefined;
  }, [user, authLoading]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[3px] z-[9999] pointer-events-none overflow-hidden bg-transparent"
      role="progressbar"
      aria-label="Cargando datos contables"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-600 shadow-[0_0_10px_rgba(56,189,248,0.8)] transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1
        }}
      />
    </div>
  );
}
