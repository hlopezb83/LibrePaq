import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet
} from '@tanstack/react-router';
import { CompanyProvider } from './context/CompanyContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { UIModalProvider } from './context/UIModalContext';
import { AppShell } from './components/AppShell';
import { RootErrorFallback } from './components/RootErrorFallback';
import { TopLoadingBar } from './components/shell/TopLoadingBar';

const rootRoute = createRootRoute({
  component: () => (
    <AuthProvider>
      <CompanyProvider>
        <ToastProvider>
          <UIModalProvider>
            <TopLoadingBar />
            <AppShell>
              <Outlet />
            </AppShell>
          </UIModalProvider>
        </ToastProvider>
      </CompanyProvider>
    </AuthProvider>
  ),
  errorComponent: RootErrorFallback
});

// H-22: Carga diferida (Code-Splitting) por ruta con lazyRouteComponent
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(
    () => import('./views/IndexView'),
    'IndexView'
  )
});

const addRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/add',
  validateSearch: validateStringSearch,
  component: lazyRouteComponent(
    () => import('./views/AddCfdiView'),
    'AddCfdiView'
  )
});

export function validateStringSearch(search: Record<string, unknown>): Record<string, string> {
  const res: Record<string, string> = {};
  for (const [k, v] of Object.entries(search)) {
    if (typeof v === 'string') {
      const trimmed = v.trim();
      const unquoted =
        trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')
          ? trimmed.slice(1, -1)
          : v;
      res[k] = unquoted;
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      res[k] = String(v);
    }
  }
  return res;
}

const polizasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/polizas',
  validateSearch: validateStringSearch,
  component: lazyRouteComponent(
    () => import('./views/PolizasView'),
    'PolizasView'
  )
});

const cuentasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cuentas',
  validateSearch: validateStringSearch,
  component: lazyRouteComponent(
    () => import('./views/CatalogoCuentasView'),
    'CatalogoCuentasView'
  )
});

const fiscalBancosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/fiscal-bancos',
  validateSearch: validateStringSearch,
  component: lazyRouteComponent(
    () => import('./views/DiotBancosView'),
    'DiotBancosView'
  )
});

const reportesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reportes',
  validateSearch: validateStringSearch,
  component: lazyRouteComponent(
    () => import('./views/ReportesView'),
    'ReportesView'
  )
});

const ajustesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ajustes',
  validateSearch: validateStringSearch,
  component: lazyRouteComponent(
    () => import('./views/AjustesView'),
    'AjustesView'
  )
});

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/landing',
  component: lazyRouteComponent(
    () => import('./views/LandingPageView'),
    'LandingPageView'
  )
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: lazyRouteComponent(
    () => import('./views/PrivacyPolicyView'),
    'PrivacyPolicyView'
  )
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terms',
  component: lazyRouteComponent(
    () => import('./views/TermsOfServiceView'),
    'TermsOfServiceView'
  )
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  validateSearch: validateStringSearch,
  component: lazyRouteComponent(
    () => import('./views/SuperAdminView'),
    'SuperAdminView'
  )
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: lazyRouteComponent(
    () => import('./views/ResetPasswordView'),
    'ResetPasswordView'
  )
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  landingRoute,
  privacyRoute,
  termsRoute,
  addRoute,
  polizasRoute,
  cuentasRoute,
  fiscalBancosRoute,
  reportesRoute,
  ajustesRoute,
  adminRoute,
  resetPasswordRoute
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultErrorComponent: RootErrorFallback
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
