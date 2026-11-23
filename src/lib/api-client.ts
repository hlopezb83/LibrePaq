import type { QueryClient } from '@tanstack/react-query';
import { handleResponse, buildPeriodQuery, getAuthHeaders, setApiAuthUser } from './api/api-helpers';
import { companiesAndAccountsApi } from './api/companies-and-accounts.api';
import { polizasAndCfdiApi } from './api/polizas-and-cfdi.api';
import { fiscalAndBankApi } from './api/fiscal-and-bank.api';
import { adminApi } from './api/admin.api';
import { isSupabaseConfigured } from './supabase';
import { supabaseCloudApi } from './supabase/supabase-client-facade';
import { isReadOnlyBlockedMethod, isReadOnlySupportMode } from './support-impersonation';

export { handleResponse, buildPeriodQuery, getAuthHeaders, setApiAuthUser };

export type AccountingQueryScope =
  | 'companies'
  | 'dashboard'
  | 'accounts'
  | 'account-ledger'
  | 'polizas'
  | 'cfdis'
  | 'reports'
  | 'diot'
  | 'bank-reconciliation'
  | 'fiel-status'
  | 'sat-requests'
  | 'period-lock'
  | 'third-parties'
  | 'fixed-assets'
  | 'fiscal-workpaper'
  | 'sat-xml';

const DEFAULT_ACCOUNTING_SCOPES: ReadonlyArray<AccountingQueryScope> = [
  'dashboard',
  'accounts',
  'account-ledger',
  'polizas',
  'cfdis',
  'reports',
  'diot',
  'bank-reconciliation',
  'period-lock',
  'third-parties',
  'fixed-assets',
  'fiscal-workpaper',
  'sat-xml'
];

/**
 * H-16 (NASA Power of 10 Regla 6):
 * Invalidación selectiva de llaves de caché contables en React Query, evitando
 * recargar catálogos de empresas o vistas no relacionadas.
 */
export function invalidateAccountingQueries(
  queryClient: QueryClient,
  scopesOrCompanyId?: ReadonlyArray<AccountingQueryScope> | string,
  companyId?: string
): void {
  const scopes = Array.isArray(scopesOrCompanyId) ? scopesOrCompanyId : DEFAULT_ACCOUNTING_SCOPES;
  const targetCompanyId = typeof scopesOrCompanyId === 'string' ? scopesOrCompanyId : companyId;

  for (const key of scopes) {
    void queryClient.invalidateQueries({
      queryKey: targetCompanyId ? [key, targetCompanyId] : [key],
      refetchType: 'active'
    });
  }
}

/**
 * En producción (librepaq.com) o cuando se active la nube, enruta las consultas
 * directamente a Supabase PostgreSQL Cloud. En entorno local offline o tests,
 * utiliza el servidor local de alta velocidad.
 */
const shouldUseSupabase =
  typeof window !== 'undefined' &&
  isSupabaseConfigured &&
  (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'));

export const localApiClient = {
  ...companiesAndAccountsApi,
  ...polizasAndCfdiApi,
  ...fiscalAndBankApi,
  ...adminApi
};

const rawApiClient = shouldUseSupabase
  ? {
      ...localApiClient,
      ...supabaseCloudApi
    }
  : localApiClient;

export const apiClient: typeof rawApiClient = new Proxy(rawApiClient, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof prop === 'string' && typeof value === 'function') {
      return (...args: unknown[]) => {
        if (isReadOnlySupportMode() && isReadOnlyBlockedMethod(prop)) {
          throw new Error(
            'Modo Soporte (solo lectura): las escrituras están bloqueadas para proteger los datos del cliente.'
          );
        }
        return (value as (...fnArgs: unknown[]) => unknown).apply(target, args);
      };
    }
    return value;
  }
});
