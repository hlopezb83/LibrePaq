import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { useCompany } from '../../context/CompanyContext';
import { apiClient } from '../../lib/api-client';
import { useToast } from '../../context/ToastContext';
import type { FiscalBancosTabId } from './FiscalBancosTabBar';
import { useBancosTabState } from './useBancosTabState';
import { useDiotTabState } from './useDiotTabState';

const TAB_ALIASES: Record<string, FiscalBancosTabId> = {
  CONCILIACION: 'CONCILIACION',
  BANCOS: 'CONCILIACION',
  DIOT: 'DIOT',
  PADRON_RFC: 'PADRON_RFC',
  PADRON: 'PADRON_RFC',
  '69B': 'PADRON_RFC',
  ACTIVOS_FIJOS: 'ACTIVOS_FIJOS',
  ACTIVOS: 'ACTIVOS_FIJOS',
  PAPEL_DIA_17: 'PAPEL_DIA_17',
  DIA17: 'PAPEL_DIA_17',
  CXC_CXP: 'CXC_CXP',
  CXC: 'CXC_CXP',
  NOMINA_IMSS: 'NOMINA_IMSS',
  NOMINA: 'NOMINA_IMSS',
  INVENTARIO_COSTO: 'INVENTARIO_COSTO',
  INVENTARIO: 'INVENTARIO_COSTO'
};

export function resolveFiscalBancosTab(raw: unknown): FiscalBancosTabId | null {
  if (typeof raw !== 'string') return null;
  return TAB_ALIASES[raw.trim().toUpperCase()] ?? null;
}

export function useDiotBancosManager() {
  const { activeCompany, activeCompanyId, isReadOnlyClient, isReadOnlySupportMode } = useCompany();
  const isReadOnly = isReadOnlyClient || isReadOnlySupportMode;
  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;
  const toast = useToast();

  const urlTab = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)?.tab
  });

  const [activeTab, setActiveTab] = useState<FiscalBancosTabId>(() => {
    const fromRouter = resolveFiscalBancosTab(urlTab);
    if (fromRouter) return fromRouter;
    if (typeof window !== 'undefined' && window.location.search) {
      const fromUrl = resolveFiscalBancosTab(new URLSearchParams(window.location.search).get('tab'));
      if (fromUrl) return fromUrl;
    }
    return 'CONCILIACION';
  });

  useEffect(() => {
    const next = resolveFiscalBancosTab(urlTab);
    if (next) setActiveTab(next);
  }, [urlTab]);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getAccounts(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId)
  });

  const { data: periodLock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });
  const isPeriodLocked = Boolean(periodLock?.isLocked);

  const bancos = useBancosTabState({
    activeCompanyId,
    currentYear,
    currentPeriod,
    accounts,
    isPeriodLocked,
    isReadOnlyClient: isReadOnly,
    enabled: activeTab === 'CONCILIACION'
  });

  const diot = useDiotTabState({
    activeCompanyId,
    currentYear,
    currentPeriod,
    enabled: activeTab === 'DIOT'
  });

  return {
    activeCompany,
    activeCompanyId,
    currentYear,
    currentPeriod,
    toast,
    activeTab,
    setActiveTab,
    accounts,
    isPeriodLocked,
    isReadOnlyClient: isReadOnly,
    isReadOnlySupportMode,
    ...bancos,
    ...diot
  };
}
