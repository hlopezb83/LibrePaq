import { useMemo, useCallback } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCompany } from '../context/CompanyContext';
import { useToast } from '../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../lib/api-client';
import { formatCurrency } from '../lib/formatters';
import { sumCents } from '../shared/accounting-engine';
import { MESES_SAT } from '../shared/sat-catalog';
import { useUIModal } from '../context/UIModalContext';
import { DashboardHeaderBar } from './dashboard/DashboardHeaderBar';
import { DashboardAuditBar } from './dashboard/DashboardAuditBar';
import { DashboardKpisGrid } from './dashboard/DashboardKpisGrid';
import { DashboardOnboardingBanner } from './dashboard/DashboardOnboardingBanner';
import { DashboardClosingCycle } from './dashboard/DashboardClosingCycle';
import { DashboardAddAutomationSection } from './dashboard/DashboardAddAutomationSection';
import { DashboardTrendSection } from './dashboard/DashboardTrendSection';
import { DashboardRecentPolizasTable } from './dashboard/DashboardRecentPolizasTable';

export function DashboardView() {
  const { activeCompany, activeCompanyId, updatePeriod } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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

  const { data: periodLock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });
  const isPeriodLocked = Boolean(periodLock?.isLocked);

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

  const isTrialBalanced = trialBalanceSummary.isBalanced;

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

  if (isError) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-red-200 shadow-2xs space-y-4 max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">Error al cargar el Tablero Financiero</h3>
          <p className="text-xs text-slate-600 mt-1">
            {error instanceof Error ? error.message : 'Error de conexión o permisos'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reintentar consulta</span>
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 bg-slate-200/70 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200/70 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const { company, kpis, monthlyTrend, recentPolizas, pendingCfdis } = data;
  const mesActualNombre =
    MESES_SAT.find((m) => m.periodo === company.currentPeriod)?.nombre || 'Octubre';

  const maxBar = Math.max(
    1,
    ...monthlyTrend.map((m) => Math.max(m.ingresos, m.egresos, 100000))
  );

  const proporcionGastoIngreso =
    kpis.ingresosPeriodo > 0
      ? ((kpis.egresosPeriodo / kpis.ingresosPeriodo) * 100).toFixed(1)
      : '0.0';

  const margenOperativo =
    kpis.ingresosPeriodo > 0
      ? ((kpis.utilidadNeta / kpis.ingresosPeriodo) * 100).toFixed(1)
      : '0.0';

  const razonCoberturaBancos =
    kpis.cuentasPorPagar > 0
      ? (kpis.efectivoBancos / kpis.cuentasPorPagar).toFixed(2)
      : 'S/D';

  const isBankReconciled = bankRec
    ? bankRec.summary.movimientosPendientesBanco === 0 &&
      bankRec.summary.movimientosPendientesLibros === 0
    : false;

  const closingChecks = [
    {
      id: 'add',
      stepNum: '1',
      label: '1. Bóveda ADD & e.firma',
      detail:
        kpis.cfdisPendientesContabilizar === 0
          ? 'Todos los CFDIs al día'
          : `${kpis.cfdisPendientesContabilizar} CFDI(s) sin póliza`,
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
      detail: isBankReconciled
        ? 'Estado de cuenta conciliado 100%'
        : 'Revisión de partidas bancarias',
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
      detail: isTrialBalanced
        ? 'Anexo 24 listo para validación'
        : `Descuadre de ${formatCurrency(trialBalanceSummary.difference)}`,
      done: isTrialBalanced && kpis.cfdisPendientesContabilizar === 0,
      to: '/reportes'
    }
  ];

  const completedChecks = closingChecks.filter((c) => c.done).length;

  return (
    <div className="space-y-4">
      {/* Encabezado ejecutivo */}
      <DashboardHeaderBar
        company={company}
        mesActualNombre={mesActualNombre}
        cfdisPendientesCount={kpis.cfdisPendientesContabilizar}
        onOpenDeliverables={() => openDeliverables()}
      />

      {/* Ruta de Arranque Guiada: LO PRIMERO que se ve al dar de alta una nueva empresa */}
      <DashboardOnboardingBanner
        companyName={company.name}
        companyRfc={company.rfc}
        regimenFiscal={company.regimenFiscal}
        mesActualNombre={mesActualNombre}
        companyYear={company.currentYear}
        totalPolizasPeriodo={kpis.totalPolizasPeriodo}
        ingresosPeriodo={kpis.ingresosPeriodo}
        accountsCount={accounts.length}
        pendingCfdisCount={kpis.cfdisPendientesContabilizar}
      />

      {/* Centro de Acciones Rápidas y Auditoría de Pendientes */}
      <DashboardAuditBar
        mesActualNombre={mesActualNombre}
        companyYear={company.currentYear}
        kpis={kpis}
        isBankReconciled={isBankReconciled}
        bankRec={bankRec}
        isTrialBalanced={isTrialBalanced}
        trialBalanceSummary={trialBalanceSummary}
        pendingCfdis={pendingCfdis}
        isBatchAutoPolizaPending={batchAutoPolizaMutation.isPending}
        onBatchAutoPoliza={(ids) => batchAutoPolizaMutation.mutate(ids)}
        isPeriodLocked={isPeriodLocked}
      />

      {/* Tarjetas de KPIs Principales y Posición Financiera */}
      <DashboardKpisGrid
        kpis={kpis}
        mesActualNombre={mesActualNombre}
        activeCompanyId={activeCompanyId}
        proporcionGastoIngreso={proporcionGastoIngreso}
        margenOperativo={margenOperativo}
        razonCoberturaBancos={razonCoberturaBancos}
        onOpenLedger={handleOpenLedgerByCode}
        onNavigateReportes={() => navigate({ to: '/reportes' })}
      />

      {/* Ciclo Contable Mensual del Despacho (5 Etapas de Negocio) */}
      <DashboardClosingCycle
        mesActualNombre={mesActualNombre}
        companyYear={company.currentYear}
        closingChecks={closingChecks}
        completedChecks={completedChecks}
        onOpenDeliverables={() => openDeliverables()}
      />

      {/* Automatización ADD en 1 clic + Gráfica de Tendencia */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <DashboardAddAutomationSection
          pendingCfdis={pendingCfdis}
          cfdisTotalesPeriodo={kpis.cfdisTotalesPeriodo}
          isBatchPending={batchAutoPolizaMutation.isPending}
          onBatchAutoPoliza={(ids) => batchAutoPolizaMutation.mutate(ids)}
          isSinglePending={autoPolizaMutation.isPending}
          onSingleAutoPoliza={(id) => autoPolizaMutation.mutate(id)}
          isPeriodLocked={isPeriodLocked}
        />

        <DashboardTrendSection
          companyYear={company.currentYear}
          currentPeriod={company.currentPeriod}
          monthlyTrend={monthlyTrend}
          maxBar={maxBar}
          onUpdatePeriod={updatePeriod}
          cuentasPorCobrar={kpis.cuentasPorCobrar}
          cuentasPorPagar={kpis.cuentasPorPagar}
          onOpenLedger={handleOpenLedgerByCode}
          activeCompanyId={activeCompanyId}
        />
      </div>

      {/* Últimas Pólizas Contables del Periodo */}
      <DashboardRecentPolizasTable
        totalPolizasPeriodo={kpis.totalPolizasPeriodo}
        recentPolizas={recentPolizas}
      />
    </div>
  );
}
