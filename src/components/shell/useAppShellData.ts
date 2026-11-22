import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { getCurrentFiscalPeriod } from '../../shared/date-utils';
import type { ToastContextType } from '../../context/ToastContext';

interface UseAppShellDataParams {
  activeCompanyId: string;
  activeYear?: number;
  activePeriod?: number;
  isPublicPage: boolean;
  hasOpenedCmd: boolean;
  toast: ToastContextType;
}

export function useAppShellData({
  activeCompanyId,
  activeYear,
  activePeriod,
  isPublicPage,
  hasOpenedCmd,
  toast
}: UseAppShellDataParams) {
  const queryClient = useQueryClient();
  const fallback = getCurrentFiscalPeriod();
  const effectiveYear = activeYear ?? fallback.year;
  const effectivePeriod = activePeriod ?? fallback.period;

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', activeCompanyId, activeYear, activePeriod],
    queryFn: () => apiClient.getAccounts(activeCompanyId, activeYear, activePeriod),
    enabled: Boolean(activeCompanyId && !isPublicPage)
  });

  const { data: polizas = [] } = useQuery({
    queryKey: ['polizas', activeCompanyId, activeYear, activePeriod],
    queryFn: () => apiClient.getPolizas(activeCompanyId, activeYear, activePeriod),
    enabled: Boolean(activeCompanyId && !isPublicPage && hasOpenedCmd)
  });

  const { data: periodLock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, activeYear, activePeriod],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, effectiveYear, effectivePeriod),
    enabled: Boolean(activeCompanyId && activeYear && activePeriod && !isPublicPage)
  });

  const togglePeriodLockMutation = useMutation({
    mutationFn: (nextLocked: boolean) =>
      apiClient.setPeriodLock({
        companyId: activeCompanyId,
        ejercicio: effectiveYear,
        periodo: effectivePeriod,
        isLocked: nextLocked
      }),
    onSuccess: (_, nextLocked) => {
      queryClient.invalidateQueries({
        queryKey: ['period-lock', activeCompanyId, activeYear, activePeriod]
      });
      const label = `P${String(activePeriod ?? 1).padStart(2, '0')}`;
      if (nextLocked) {
        toast.warning(`Periodo ${label} bloqueado contra cambios fiscales`);
      } else {
        toast.success(`Periodo ${label} reabierto para captura contable`);
      }
    }
  });

  return {
    accounts,
    polizas,
    periodLock,
    togglePeriodLockMutation
  };
}
