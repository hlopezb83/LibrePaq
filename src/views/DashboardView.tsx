import { AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { DashboardHeaderBar } from './dashboard/DashboardHeaderBar';
import { DashboardAuditBar } from './dashboard/DashboardAuditBar';
import { DashboardKpisGrid } from './dashboard/DashboardKpisGrid';
import { DashboardOnboardingBanner } from './dashboard/DashboardOnboardingBanner';
import { DashboardClosingCycle } from './dashboard/DashboardClosingCycle';
import { DashboardAddAutomationSection } from './dashboard/DashboardAddAutomationSection';
import { DashboardTrendSection } from './dashboard/DashboardTrendSection';
import { DashboardRecentPolizasTable } from './dashboard/DashboardRecentPolizasTable';
import { useDashboardManager } from './dashboard/useDashboardManager';

export function DashboardView() {
  const navigate = useNavigate();
  const {
    activeCompanyId,
    updatePeriod,
    openDeliverables,
    handleOpenLedgerByCode,
    accountsCount,
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
  } = useDashboardManager();

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

  if (isLoading || !derived) {
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

  const {
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
    completedChecks
  } = derived;

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
        accountsCount={accountsCount}
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
