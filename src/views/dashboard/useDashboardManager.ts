import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { useUIModal } from '../../context/UIModalContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { formatCurrency } from '../../lib/formatters';
import { sumCents } from '../../shared/accounting-engine';
import { MESES_SAT } from '../../shared/sat-catalog';

export function useDashboardManager() {
  const { activeCompany, activeCompanyId, updatePeriod } = useCompany();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { openLedger, openDeliverables } = useUIModal();

  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getDashboard(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId)
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getAccounts(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId)
  });

  const primaryBankAccountId = useMemo(() => {
    const found = accounts.find((a) => a.code === '102-01-001' || a.code.startsWith('102'));
    return found ? found.id : `${activeCompanyId}_102-01-001`;
  }, [accounts, activeCompanyId]);

  const { data: bankRec } = useQuery({
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

  const handleOpenLedgerByCode = useCallback(
    (codeOrId: string) => {
      const codeMatch = codeOrId.match(/\b(\d{3}-\d{2}-\d{3}|\d{3}-\d{2}|\d{3})\b/);
      if (codeMatch && codeMatch[1]) {
        const targetCode = codeMatch[1];
        const match = accounts.find((a) => a.code === targetCode || a.code.startsWith(targetCode.slice(0, 3)));
        if (match) {
          openLedger(match.id);
          return;
        }
      }
      openLedger(codeOrId);
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
      ...monthlyTrend.map((m) => Math.max(m.ingresos, m.egresos, 100000))
    );
    const proporcionGastoIngreso =
      kpis.ingresosPeriodo > 0 ? ((kpis.egresosPeriodo / kpis.ingresosPeriodo) * 100).toFixed(1) : '0.0';
    const margenOperativo =
      kpis.ingresosPeriodo > 0 ? ((kpis.utilidadNeta / kpis.ingresosPeriodo) * 100).toFixed(1) : '0.0';
    const razonCoberturaBancos =
      kpis.cuentasPorPagar > 0 ? (kpis.efectivoBancos / kpis.cuentasPorPagar).toFixed(2) : 'S/D';
    const isBankReconciled = bankRec
      ? bankRec.summary.movimientosPendientesBanco === 0 && bankRec.summary.movimientosPendientesLibros === 0
      : false;
    const isTrialBalanced = trialBalanceSummary.isBalanced;

    const closingChecks = [
      {
        id: 'add',
        stepNum: '1',
        label: '1. Bóveda ADD & e.firma',
        detail: kpis.cfdisPendientesContabilizar === 0 ? 'Todos los CFDIs al día' : `${kpis.cfdisPendientesContabilizar} CFDI(s) sin póliza`,
        done: kpis.cfdisPendientesContabilizar === 0,
        to: '/add'
      },
      {
        id: 'polizas',
        stepNum: '2',
        label: '2. Pólizas y Partida Doble',
        detail: `${kpis.totalPolizasPeriodo} pólizas en ${mesActualNombre}`,
        done: kpis.totalPolizasPeriodo > 0,
        to: '/polizas'
      },
      {
        id: 'bancos',
        stepNum: '3',
        label: '3. Conciliación Bancaria',
        detail: isBankReconciled ? 'Estado de cuenta conciliado 100%' : 'Revisión de partidas bancarias',
        done: isBankReconciled,
        to: '/fiscal-bancos'
      },
      {
        id: 'fiscal',
        stepNum: '4',
        label: '4. Cédula Fiscal Día 17',
        detail: `IVA Neto: ${formatCurrency(kpis.ivaPorPagarNeto)}`,
        done: true,
        to: '/fiscal-bancos'
      },
      {
        id: 'sat',
        stepNum: '5',
        label: '5. Balanza y Cierre SAT',
        detail: isTrialBalanced ? 'Anexo 24 listo para validación' : `Descuadre de ${formatCurrency(trialBalanceSummary.difference)}`,
        done: isTrialBalanced && kpis.cfdisPendientesContabilizar === 0,
        to: '/reportes'
      }
    ];

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
      completedChecks: closingChecks.filter((c) => c.done).length
    };
  }, [data, bankRec, trialBalanceSummary]);

  return {
    activeCompanyId,
    updatePeriod,
    toast,
    openDeliverables,
    handleOpenLedgerByCode,
    accountsCount: accounts.length,
    bankRec,
    isLoading,
    isError,
    error,
    refetch,
    isPeriodLocked,
    trialBalanceSummary,
    autoPolizaMutation,
    batchAutoPolizaMutation,
    derived
  };
}
