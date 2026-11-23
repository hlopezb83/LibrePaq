import { AlertCircle, RefreshCw } from 'lucide-react';
import { MESES_SAT } from '../shared/sat-constants';
import { useUIModal } from '../context/UIModalContext';
import { ReportesHeaderBar } from './reportes/ReportesHeaderBar';
import { BalanzaTab } from './reportes/BalanzaTab';
import { EstadoResultadosTab } from './reportes/EstadoResultadosTab';
import { BalanceGeneralTab } from './reportes/BalanceGeneralTab';
import { Anexo24Tab } from './reportes/Anexo24Tab';
import { DossierEntregablesTab } from './reportes/DossierEntregablesTab';
import { useReportesManager } from './reportes/useReportesManager';

export function ReportesView() {
  const { openLedger, openDeliverables } = useUIModal();
  const {
    activeTab,
    setActiveTab,
    satXmlType,
    setSatXmlType,
    data,
    isLoading,
    isError,
    error,
    refetch,
    isPeriodLocked,
    satXmlData,
    isLoadingXml,
    isErrorXml,
    xmlError,
    refetchXml,
    handleDownloadXml,
    handleExportBalanzaCsv
  } = useReportesManager();

  const deliverableTabForActive =
    activeTab === 'BALANZA' || activeTab === 'RESULTADOS' || activeTab === 'BALANCE'
      ? activeTab
      : 'DOSSIER';

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
          <h3 className="font-bold text-slate-900 text-base">Error al generar Estados Financieros</h3>
          <p className="text-xs text-slate-600 mt-1">
            {error instanceof Error ? error.message : 'Error desconocido de conexión'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reintentar cálculo</span>
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-500"
      >
        Calculando estados financieros y balanza de comprobación...
      </div>
    );
  }

  const mesNombre =
    MESES_SAT.find((m) => m.periodo === data.periodo)?.nombre || 'Octubre';

  return (
    <div className="space-y-4">
      {/* Encabezado de Reportes y Navegación entre Pestañas */}
      <ReportesHeaderBar
        company={data.company}
        mesNombre={mesNombre}
        ejercicio={data.ejercicio}
        activeTab={activeTab}
        isPeriodLocked={isPeriodLocked}
        onTabChange={setActiveTab}
        onOpenDeliverables={() => openDeliverables(deliverableTabForActive)}
        onExportCsv={handleExportBalanzaCsv}
      />

      {/* PESTAÑA 1: BALANZA DE COMPROBACIÓN */}
      {activeTab === 'BALANZA' && (
        <div role="tabpanel" id="report-panel-BALANZA" aria-labelledby="report-tab-BALANZA">
          <BalanzaTab
            trialBalance={data.trialBalance}
            company={data.company}
            ejercicio={data.ejercicio}
            mesNombre={mesNombre}
            onSelectAccount={openLedger}
          />
        </div>
      )}

      {/* PESTAÑA 2: ESTADO DE RESULTADOS CON ANÁLISIS VERTICAL (%) */}
      {activeTab === 'RESULTADOS' && (
        <div role="tabpanel" id="report-panel-RESULTADOS" aria-labelledby="report-tab-RESULTADOS">
          <EstadoResultadosTab
            company={data.company}
            ejercicio={data.ejercicio}
            periodo={data.periodo}
            mesNombre={mesNombre}
            incomeStatement={data.incomeStatement}
            onSelectAccount={openLedger}
          />
        </div>
      )}

      {/* PESTAÑA 3: BALANCE GENERAL CON ANÁLISIS VERTICAL (%) */}
      {activeTab === 'BALANCE' && (
        <div role="tabpanel" id="report-panel-BALANCE" aria-labelledby="report-tab-BALANCE">
          <BalanceGeneralTab
            company={data.company}
            ejercicio={data.ejercicio}
            periodo={data.periodo}
            mesNombre={mesNombre}
            balanceSheet={data.balanceSheet}
            onSelectAccount={openLedger}
            onViewIncomeStatement={() => setActiveTab('RESULTADOS')}
          />
        </div>
      )}

      {/* PESTAÑA 4: EXPORTADOR XML CONTABILIDAD ELECTRÓNICA SAT ANEXO 24 */}
      {activeTab === 'ANEXO24' && (
        <div role="tabpanel" id="report-panel-ANEXO24" aria-labelledby="report-tab-ANEXO24">
          <Anexo24Tab
            satXmlType={satXmlType}
            setSatXmlType={setSatXmlType}
            satXmlData={satXmlData}
            isLoadingXml={isLoadingXml}
            isErrorXml={isErrorXml}
            xmlError={xmlError}
            onRetryXml={() => void refetchXml()}
            onDownloadXml={handleDownloadXml}
          />
        </div>
      )}

      {/* PESTAÑA 5: DOSSIER DE ENTREGABLES Y CARPETA DE CIERRE */}
      {activeTab === 'ENTREGABLES' && (
        <div role="tabpanel" id="report-panel-ENTREGABLES" aria-labelledby="report-tab-ENTREGABLES">
          <DossierEntregablesTab
            mesNombre={mesNombre}
            ejercicio={data.ejercicio}
            totals={data.totals}
            incomeStatement={data.incomeStatement}
            balanceSheet={data.balanceSheet}
            onOpenDeliverablesModal={(tab) => openDeliverables(tab ?? 'DOSSIER')}
          />
        </div>
      )}
    </div>
  );
}
