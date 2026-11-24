import { AlertCircle, RefreshCw } from 'lucide-react';
import { DashboardHeaderBar } from './dashboard/DashboardHeaderBar';
import { DashboardAuditBar } from './dashboard/DashboardAuditBar';
import { DashboardKpisGrid } from './dashboard/DashboardKpisGrid';
import { DashboardOnboardingBanner } from './dashboard/DashboardOnboardingBanner';
import { DashboardClosingCycle } from './dashboard/DashboardClosingCycle';
import { DashboardAddAutomationSection } from './dashboard/DashboardAddAutomationSection';
import { DashboardTrendSection } from './dashboard/DashboardTrendSection';
import { DashboardRecentPolizasTable } from './dashboard/DashboardRecentPolizasTable';
import { DashboardTieoutCard } from './dashboard/DashboardTieoutCard';
import { useDashboardManager } from './dashboard/useDashboardManager';

export function DashboardView() {
  const {
    activeCompanyId,
    updatePeriod,
    openDeliverables,
    handleOpenLedgerByCode,
    accountsCount,
    bankRec,
    isBankRecLoading,
    isBankRecError,
    isLoading,
    isError,
    isFetching,
    refetch,
    isPeriodLocked,
    isReadOnly,
    trialBalanceSummary,
    autoPolizaMutation,
    batchAutoPolizaMutation,
    derived
  } = useDashboardManager();

  if (isError) {
    return (
      <div
        role="alert"
        className="p-8 text-center bg-white rounded-2xl border border-red-200 shadow-2xs space-y-4 max-w-lg mx-auto my-12"
      >
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-bold text-slate-900 text-base">Error al cargar el Tablero Financiero</h1>
          <p className="text-xs text-slate-600 mt-1">
            No pudimos consultar la información contable del periodo. Verifica tu conexión e intenta nuevamente.
          </p>
        </div>
        <button
          type="button"
          disabled={isFetching}
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{isFetching ? 'Consultando...' : 'Reintentar consulta'}</span>
        </button>
      </div>
    );
  }

  if (isLoading || !derived) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="space-y-4 animate-pulse"
      >
        <span className="visually-hidden">Cargando tablero financiero del periodo...</span>
        <div className="h-24 bg-slate-200/70 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200/70 rounded-2xl" />
          ))}
        </div>
        <div className="h-20 bg-slate-200/60 rounded-2xl" />
        <div className="h-44 bg-slate-200/60 rounded-2xl" />
        <div className="h-36 bg-slate-200/60 rounded-2xl" />
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
    completedChecks,
    efosSummary
  } = derived;

  return (
    <div className="space-y-4">
      {/* Encabezado ejecutivo */}
      <DashboardHeaderBar
        company={company}
        mesActualNombre={mesActualNombre}
        cfdisPendientesCount={kpis.cfdisPendientesContabilizar}
        efosAlertCount={efosSummary.efosCount}
        isPeriodLocked={isPeriodLocked}
        isReadOnly={isReadOnly}
        onOpenDeliverables={() => openDeliverables()}
      />

      {/* Ruta de Arranque Guiada para nuevas empresas sin operaciones */}
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
        isPeriodLocked={isPeriodLocked}
        isReadOnly={isReadOnly}
      />

      {/* Tarjetas de KPIs Principales y Posición Financiera (visible arriba del pliegue a 1280×800) */}
      <DashboardKpisGrid
        kpis={kpis}
        mesActualNombre={mesActualNombre}
        activeCompanyId={activeCompanyId}
        proporcionGastoIngreso={proporcionGastoIngreso}
        margenOperativo={margenOperativo}
        razonCoberturaBancos={razonCoberturaBancos}
        onOpenLedger={handleOpenLedgerByCode}
      />

      {/* Centro de Acciones Rápidas y Auditoría de Pendientes */}
      <DashboardAuditBar
        mesActualNombre={mesActualNombre}
        companyYear={company.currentYear}
        kpis={kpis}
        isBankReconciled={isBankReconciled}
        bankRec={bankRec}
        isBankRecLoading={isBankRecLoading}
        isBankRecError={isBankRecError}
        isTrialBalanced={isTrialBalanced}
        trialBalanceSummary={trialBalanceSummary}
        pendingCfdis={pendingCfdis}
        efosSummary={efosSummary}
        isBatchAutoPolizaPending={batchAutoPolizaMutation.isPending}
        isSingleAutoPolizaPending={autoPolizaMutation.isPending}
        onBatchAutoPoliza={(ids) => batchAutoPolizaMutation.mutate(ids)}
        isPeriodLocked={isPeriodLocked}
        isReadOnly={isReadOnly}
      />

      {/* Ciclo Contable Mensual del Despacho (5 Etapas de Negocio) */}
      <DashboardClosingCycle
        mesActualNombre={mesActualNombre}
        companyYear={company.currentYear}
        closingChecks={closingChecks}
        completedChecks={completedChecks}
        hasActivity={kpis.totalPolizasPeriodo > 0 || kpis.cfdisTotalesPeriodo > 0}
        onOpenDeliverables={() => openDeliverables()}
      />

      {/* Amarre Integral 3-Vías (SAT ADD ↔ Contabilidad ↔ DIOT) */}
      <DashboardTieoutCard company={company} mesActualNombre={mesActualNombre} />

      {/* Automatización ADD en 1 clic + Gráfica de Tendencia */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <DashboardAddAutomationSection
          pendingCfdis={pendingCfdis}
          cfdisPendientesContabilizar={kpis.cfdisPendientesContabilizar}
          cfdisTotalesPeriodo={kpis.cfdisTotalesPeriodo}
          isBatchPending={batchAutoPolizaMutation.isPending}
          onBatchAutoPoliza={(ids) => batchAutoPolizaMutation.mutate(ids)}
          isSinglePending={autoPolizaMutation.isPending}
          pendingCfdiId={autoPolizaMutation.isPending ? autoPolizaMutation.variables : null}
          onSingleAutoPoliza={(id) => autoPolizaMutation.mutate(id)}
          isPeriodLocked={isPeriodLocked}
          isReadOnly={isReadOnly}
        />

        <DashboardTrendSection
          companyYear={company.currentYear}
          currentPeriod={company.currentPeriod}
          monthlyTrend={monthlyTrend}
          maxBar={maxBar}
          onUpdatePeriod={updatePeriod}
        />
      </div>

      {/* Últimas Pólizas Contables del Periodo */}
      <DashboardRecentPolizasTable
        totalPolizasPeriodo={kpis.totalPolizasPeriodo}
        recentPolizas={recentPolizas}
        isPeriodLocked={isPeriodLocked}
        isReadOnly={isReadOnly}
      />
    </div>
  );
}
