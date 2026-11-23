let hasPrefetchedPublicAssets = false;
let hasPrefetchedErpModules = false;

function scheduleIdlePrefetch(cb: () => void, delayMs: number): () => void {
  const timer = window.setTimeout(() => {
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (fn: () => void) => void }).requestIdleCallback(
        cb
      );
    } else {
      cb();
    }
  }, delayMs);
  return () => window.clearTimeout(timer);
}

/**
 * Prefetches high-probability route/modal chunks during browser idle time
 * without blocking initial hydration.
 */
export function scheduleRouteAndModalPrefetch(isAuthenticated: boolean): (() => void) | undefined {
  if (!isAuthenticated && !hasPrefetchedPublicAssets) {
    return scheduleIdlePrefetch(() => {
      hasPrefetchedPublicAssets = true;
      void import('../components/auth/AuthModal');
      void import('../views/DashboardView');
      void import('./sandbox-demo-seeder');
    }, 1000);
  }

  if (isAuthenticated && !hasPrefetchedErpModules) {
    return scheduleIdlePrefetch(() => {
      hasPrefetchedErpModules = true;
      void import('../views/DashboardView');
      void import('../views/PolizasView');
      void import('../views/AddCfdiView');
      void import('../views/CatalogoCuentasView');
      void import('../views/DiotBancosView');
      void import('../views/ReportesView');
      void import('../views/AjustesView');
      void import('../components/onboarding/CompanyOnboardingWizardModal');
      void import('../components/account-ledger/AccountLedgerModal');
    }, 600);
  }

  return undefined;
}
