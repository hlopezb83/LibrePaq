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
  component: lazyRouteComponent(
    () => import('./views/AddCfdiView'),
    'AddCfdiView'
  )
});

const polizasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/polizas',
  validateSearch: (search: Record<string, unknown>): Record<string, string> => {
    const res: Record<string, string> = {};
    for (const [k, v] of Object.entries(search)) {
      if (typeof v === 'string') res[k] = v;
      else if (typeof v === 'number' || typeof v === 'boolean') res[k] = String(v);
    }
    return res;
  },
  component: lazyRouteComponent(
    () => import('./views/PolizasView'),
    'PolizasView'
  )
});

const cuentasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cuentas',
  component: lazyRouteComponent(
    () => import('./views/CatalogoCuentasView'),
    'CatalogoCuentasView'
  )
});

const fiscalBancosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/fiscal-bancos',
  component: lazyRouteComponent(
    () => import('./views/DiotBancosView'),
    'DiotBancosView'
  )
});

const reportesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reportes',
  component: lazyRouteComponent(
    () => import('./views/ReportesView'),
    'ReportesView'
  )
});

const ajustesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ajustes',
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
  component: lazyRouteComponent(
    () => import('./views/SuperAdminView'),
    'SuperAdminView'
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
  adminRoute
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
