import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { apiClient } from '../../lib/api-client';
import { useToast } from '../../context/ToastContext';
import type { FiscalBancosTabId } from './FiscalBancosTabBar';
import { useBancosTabState } from './useBancosTabState';
import { useDiotTabState } from './useDiotTabState';

export function useDiotBancosManager() {
  const { activeCompany, activeCompanyId } = useCompany();
  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<FiscalBancosTabId>('CONCILIACION');

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
    ...bancos,
    ...diot
  };
}
