import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { getCurrentFiscalPeriod } from '../../shared/date-utils';
import { MESES_SAT } from '../../shared/sat-constants';
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
      const targetPeriod = activePeriod ?? 1;
      const mesNombre = MESES_SAT.find((m) => m.periodo === targetPeriod)?.nombre ?? '';
      const label = `P${String(targetPeriod).padStart(2, '0')}`;
      const descPeriodo = mesNombre ? `${mesNombre} ${effectiveYear} (${label})` : `${label} ${effectiveYear}`;
      if (nextLocked) {
        toast.warning(`Periodo ${descPeriodo} bloqueado contra cambios fiscales`);
      } else {
        toast.success(`Periodo ${descPeriodo} reabierto para captura contable`);
      }
    },
    onError: (err: Error) => {
      toast.error('No se pudo actualizar el candado del periodo', err.message);
    }
  });

  return {
    accounts,
    polizas,
    periodLock,
    togglePeriodLockMutation
  };
}
