import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { ronda11Client } from '../../lib/supabase/supabase-ronda11';
import { isCfdiPendingForPoliza } from '../cfdi/filterCfdis';
import type { PolizaPeriodScope } from './filterPolizas';

export function usePolizasDataQueries(
  activeCompanyId: string,
  currentYear?: number,
  currentPeriod?: number,
  periodScope: PolizaPeriodScope = 'CURRENT',
  periodFrom: number = 1,
  periodTo: number = 12
) {
  const effectiveYear = currentYear ?? 2026;
  const effectivePeriod = currentPeriod ?? 10;
  const queryPeriodParam: number | 'ALL' =
    periodScope === 'CURRENT' ? effectivePeriod : 'ALL';

  const { data: rawPolizas = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['polizas', activeCompanyId, effectiveYear, queryPeriodParam],
    queryFn: () => apiClient.getPolizas(activeCompanyId, effectiveYear, queryPeriodParam),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });

  const polizas = useMemo(() => {
    if (periodScope === 'CURRENT') return rawPolizas;
    const fromP = periodScope === 'YTD' ? 1 : Math.max(1, Math.min(13, periodFrom));
    const toP =
      periodScope === 'YTD'
        ? effectivePeriod
        : Math.max(fromP, Math.min(13, periodTo));
    return rawPolizas.filter((p) => p.periodo >= fromP && p.periodo <= toP);
  }, [rawPolizas, periodScope, periodFrom, periodTo, effectivePeriod]);

  const { data: accounts = [], isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['accounts', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getAccounts(activeCompanyId, effectiveYear, effectivePeriod),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });

  const { data: cfdis = [] } = useQuery({
    queryKey: ['cfdis', activeCompanyId],
    queryFn: () => apiClient.getCfdis(activeCompanyId),
    enabled: Boolean(activeCompanyId)
  });

  const { data: periodLock, isLoading: isLoadingPeriodLock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, effectiveYear, effectivePeriod),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });

  const { data: period13Lock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, 13],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, effectiveYear, 13),
    enabled: Boolean(activeCompanyId && currentYear)
  });

  const { data: businessSegments = [] } = useQuery({
    queryKey: ['business-segments', activeCompanyId],
    queryFn: () => ronda11Client.listBusinessSegments(activeCompanyId),
    enabled: Boolean(activeCompanyId)
  });

  const { data: polizaTemplates = [] } = useQuery({
    queryKey: ['poliza-templates', activeCompanyId],
    queryFn: () => ronda11Client.listPolizaTemplates(activeCompanyId),
    enabled: Boolean(activeCompanyId)
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
    pendingCfdis,
    businessSegments,
    polizaTemplates
  };
}
