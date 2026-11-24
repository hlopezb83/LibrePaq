import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { useUIModal } from '../../context/UIModalContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { formatCurrency } from '../../lib/formatters';
import { sumCents } from '../../shared/accounting-engine';
import { MESES_SAT } from '../../shared/sat-constants';
import { computeEfosDashboardSummary, resolveLedgerAccountId } from './dashboardHelpers';

export function useDashboardManager() {
  const { activeCompany, activeCompanyId, updatePeriod, isReadOnlyClient, isReadOnlySupportMode } = useCompany();
  const isReadOnly = isReadOnlyClient || isReadOnlySupportMode;
  const queryClient = useQueryClient();
  const toast = useToast();
  const { openLedger, openDeliverables } = useUIModal();

  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;

  const {
    data,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
    isFetching: isDashboardFetching,
    error: dashboardError,
    refetch: refetchDashboard
  } = useQuery({
    queryKey: ['dashboard', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getDashboard(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId)
  });

  const {
    data: accounts = [],
    isLoading: isAccountsLoading,
    isError: isAccountsError,
    isFetching: isAccountsFetching,
    error: accountsError,
    refetch: refetchAccounts
  } = useQuery({
    queryKey: ['accounts', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getAccounts(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId)
  });

  const { data: thirdParties = [] } = useQuery({
    queryKey: ['third-parties', activeCompanyId],
    queryFn: () => apiClient.getThirdParties(activeCompanyId),
    enabled: Boolean(activeCompanyId)
  });

  const primaryBankAccountId = useMemo(() => {
    const found = accounts.find((a) => a.code === '102-01-001' || a.code.startsWith('102'));
    return found ? found.id : `${activeCompanyId}_102-01-001`;
  }, [accounts, activeCompanyId]);

  const {
    data: bankRec,
    isLoading: isBankRecLoading,
    isError: isBankRecError,
    isFetching: isBankRecFetching,
    refetch: refetchBankRec
  } = useQuery({
    queryKey: ['bank-reconciliation', activeCompanyId, primaryBankAccountId, currentYear, currentPeriod],
    queryFn: () =>
      apiClient.getBankReconciliation(
        activeCompanyId,
        primaryBankAccountId,
        currentYear,
        currentPeriod
      ),
    enabled: Boolean(activeCompanyId && primaryBankAccountId)
  });

  const { data: periodLock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });
  const isPeriodLocked = Boolean(periodLock?.isLocked);

  const isLoading = isDashboardLoading || isAccountsLoading;
  const isError = isDashboardError || isAccountsError;
  const error = dashboardError ?? accountsError;
  const isFetching = isDashboardFetching || isAccountsFetching || isBankRecFetching;

  const refetch = useCallback(async () => {
    await Promise.all([refetchDashboard(), refetchAccounts(), refetchBankRec()]);
  }, [refetchDashboard, refetchAccounts, refetchBankRec]);

  const handleOpenLedgerByCode = useCallback(
    (codeOrId: string) => {
      openLedger(resolveLedgerAccountId(codeOrId, accounts));
    },
    [accounts, openLedger]
  );

  const trialBalanceSummary = useMemo(() => {
    const affectable = accounts.filter((a) => a.isAffectable);
    const totalCargosCents = sumCents(affectable.map((a) => a.periodCharges));
    const totalAbonosCents = sumCents(affectable.map((a) => a.periodCredits));
    const isBalanced = totalCargosCents === totalAbonosCents;
    const difference = Math.abs(totalCargosCents - totalAbonosCents) / 100;
    return {
      isBalanced,
      totalCargos: totalCargosCents / 100,
      totalAbonos: totalAbonosCents / 100,
      difference
    };
  }, [accounts]);

  const autoPolizaMutation = useMutation({
    mutationFn: (cfdiId: string) => {
      if (isReadOnly) {
        throw new Error('Modo solo lectura: no tienes permisos para generar pólizas.');
      }
      if (isPeriodLocked) {
        throw new Error('El periodo contable actual está cerrado con candado fiscal.');
      }
      return apiClient.autoPolizaFromCfdi(cfdiId);
    },
    onSuccess: (poliza) => {
      invalidateAccountingQueries(queryClient, ['cfdis', 'polizas', 'accounts', 'account-ledger', 'reports', 'dashboard']);
      toast.success(
        `Póliza ${poliza.tipo} #${poliza.folio} generada y cuadrada por ${formatCurrency(
          poliza.totalCargos
        )}`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const batchAutoPolizaMutation = useMutation({
    mutationFn: async (cfdiIds: string[]) => {
      if (isReadOnly) {
        throw new Error('Modo solo lectura: no tienes permisos para generar pólizas.');
      }
      if (isPeriodLocked) {
        throw new Error('El periodo contable actual está cerrado con candado fiscal.');
      }
      const res = await apiClient.batchAutoPolizaFromCfdis(cfdiIds);
      return res.count;
    },
    onSuccess: (count) => {
      invalidateAccountingQueries(queryClient, ['cfdis', 'polizas', 'accounts', 'account-ledger', 'reports', 'dashboard']);
      toast.success(
        `¡Contabilización en lote completada! Se generaron ${count} pólizas cuadradas automáticamente`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const derived = useMemo(() => {
    if (!data) return null;
    const { company, kpis, monthlyTrend, recentPolizas, pendingCfdis } = data;
    const mesActualNombre =
      MESES_SAT.find((m) => m.periodo === company.currentPeriod)?.nombre || `P${company.currentPeriod}`;
    const maxBar = Math.max(
      1,
      ...monthlyTrend.map((m) => Math.max(m.ingresos, m.egresos))
    );
    const proporcionGastoIngreso =
      kpis.ingresosPeriodo > 0 ? ((kpis.egresosPeriodo / kpis.ingresosPeriodo) * 100).toFixed(1) : '0.0';
    const margenOperativo =
      kpis.ingresosPeriodo > 0 ? ((kpis.utilidadNeta / kpis.ingresosPeriodo) * 100).toFixed(1) : '0.0';
    const razonCoberturaBancos =
      kpis.cuentasPorPagar > 0 ? (kpis.efectivoBancos / kpis.cuentasPorPagar).toFixed(2) : 'S/D';
    const hasActivity = kpis.totalPolizasPeriodo > 0 || kpis.cfdisTotalesPeriodo > 0;
    const hasBankData = Boolean(
      bankRec && (bankRec.statementLines.length > 0 || bankRec.bookMovements.length > 0)
    );
    const isBankReconciled = hasBankData
      ? bankRec!.summary.movimientosPendientesBanco === 0 && bankRec!.summary.movimientosPendientesLibros === 0
      : false;
    const isTrialBalanced = trialBalanceSummary.isBalanced;

    const closingChecks = [
      {
        id: 'add',
        stepNum: '1',
        label: '1. Bóveda ADD & e.firma',
        detail:
          kpis.cfdisTotalesPeriodo === 0
            ? 'Sin CFDIs XML en el periodo'
            : kpis.cfdisPendientesContabilizar === 0
            ? 'Todos los CFDIs al día'
            : `${kpis.cfdisPendientesContabilizar} CFDI(s) sin póliza`,
        done: kpis.cfdisTotalesPeriodo > 0 && kpis.cfdisPendientesContabilizar === 0,
        to: '/add'
      },
      {
        id: 'polizas',
        stepNum: '2',
        label: '2. Pólizas y Partida Doble',
        detail:
          kpis.totalPolizasPeriodo === 0
            ? `0 pólizas en ${mesActualNombre}`
            : isTrialBalanced
            ? `${kpis.totalPolizasPeriodo} pólizas cuadradas en ${mesActualNombre}`
            : `${kpis.totalPolizasPeriodo} pólizas • Descuadre de ${formatCurrency(trialBalanceSummary.difference)}`,
        done: kpis.totalPolizasPeriodo > 0 && isTrialBalanced,
        to: '/polizas'
      },
      {
        id: 'bancos',
        stepNum: '3',
        label: '3. Conciliación Bancaria',
        detail: isBankReconciled
          ? 'Estado de cuenta conciliado 100%'
          : hasBankData
          ? 'Revisión de partidas bancarias'
          : 'Sin movimientos bancarios',
        done: isBankReconciled,
        to: '/fiscal-bancos'
      },
      {
        id: 'fiscal',
        stepNum: '4',
        label: '4. Cédula Fiscal Día 17',
        detail: hasActivity ? `IVA Neto: ${formatCurrency(kpis.ivaPorPagarNeto)}` : 'Pendiente de pólizas o CFDIs',
        done: hasActivity && isTrialBalanced,
        to: '/fiscal-bancos?tab=DIA17'
      },
      {
        id: 'sat',
        stepNum: '5',
        label: '5. Balanza y Cierre SAT',
        detail: !hasActivity
          ? 'Sin movimientos en el periodo'
          : isTrialBalanced
          ? 'Anexo 24 listo para validación'
          : `Descuadre de ${formatCurrency(trialBalanceSummary.difference)}`,
        done: hasActivity && isTrialBalanced && kpis.cfdisPendientesContabilizar === 0,
        to: '/reportes'
      }
    ];

    const efosSummary = computeEfosDashboardSummary(thirdParties, pendingCfdis);

    return {
      company,
      kpis,
      monthlyTrend,
      recentPolizas,
      pendingCfdis,
      mesActualNombre,
      maxBar,
      proporcionGastoIngreso,
      margenOperativo,
      razonCoberturaBancos,
      isBankReconciled,
      isTrialBalanced,
      closingChecks,
      completedChecks: closingChecks.filter((c) => c.done).length,
      efosSummary
    };
  }, [data, bankRec, trialBalanceSummary, thirdParties]);

  return {
    activeCompanyId,
    updatePeriod,
    toast,
    openDeliverables,
    handleOpenLedgerByCode,
    accountsCount: accounts.length,
    bankRec,
    isBankRecLoading,
    isBankRecError,
    isLoading,
    isError,
    isFetching,
    error,
    refetch,
    isPeriodLocked,
    isReadOnly,
    trialBalanceSummary,
    autoPolizaMutation,
    batchAutoPolizaMutation,
    derived
  };
}
