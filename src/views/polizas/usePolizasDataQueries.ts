import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { isCfdiPendingForPoliza } from '../cfdi/filterCfdis';

export function usePolizasDataQueries(
  activeCompanyId: string,
  currentYear?: number,
  currentPeriod?: number
) {
  const { data: polizas = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['polizas', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPolizas(activeCompanyId, currentYear ?? 2026, currentPeriod ?? 10),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });

  const { data: accounts = [], isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['accounts', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getAccounts(activeCompanyId, currentYear ?? 2026, currentPeriod ?? 10),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });

  const { data: cfdis = [] } = useQuery({
    queryKey: ['cfdis', activeCompanyId],
    queryFn: () => apiClient.getCfdis(activeCompanyId),
    enabled: Boolean(activeCompanyId)
  });

  const { data: periodLock, isLoading: isLoadingPeriodLock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, currentYear ?? 2026, currentPeriod ?? 10),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });

  const { data: period13Lock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, 13],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, currentYear ?? 2026, 13),
    enabled: Boolean(activeCompanyId && currentYear)
  });

  const isPeriodLocked = Boolean(periodLock?.isLocked);
  const isPeriod13Locked = currentPeriod === 13 ? isPeriodLocked : Boolean(period13Lock?.isLocked);
  const affectableAccounts = useMemo(() => accounts.filter((a) => a.isAffectable), [accounts]);
  const pendingCfdis = useMemo(() => cfdis.filter(isCfdiPendingForPoliza), [cfdis]);

  return {
    polizas,
    isLoading,
    isError,
    error,
    refetch,
    accounts,
    isLoadingAccounts,
    cfdis,
    isLoadingPeriodLock,
    isPeriodLocked,
    isPeriod13Locked,
    affectableAccounts,
    pendingCfdis
  };
}
