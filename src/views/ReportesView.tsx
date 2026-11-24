import { useEffect, useRef } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '../components/ui';
import { MESES_SAT } from '../shared/sat-constants';
import { useUIModal } from '../context/UIModalContext';
import { ReportesHeaderBar } from './reportes/ReportesHeaderBar';
import { BalanzaTab } from './reportes/BalanzaTab';
import { EstadoResultadosTab } from './reportes/EstadoResultadosTab';
import { BalanceGeneralTab } from './reportes/BalanceGeneralTab';
import { Anexo24Tab } from './reportes/Anexo24Tab';
import { DossierEntregablesTab } from './reportes/DossierEntregablesTab';
import { FlujosCapitalTab } from './reportes/FlujosCapitalTab';
import { DeclaracionAnualTab } from './reportes/DeclaracionAnualTab';
import { AuxiliaresDiarioTab } from './reportes/AuxiliaresDiarioTab';
import { useReportesManager } from './reportes/useReportesManager';

export function ReportesView() {
  const { openLedger, openDeliverables } = useUIModal();
  const {
    activeTab,
    setActiveTab,
    isDossierRequested,
    consumeDossierParam,
    satXmlType,
    setSatXmlType,
    anexo24Options,
    setAnexo24Options,
    data,
    prevReports,
    isLoadingPrevReports,
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

  const hasAutoOpenedDossierRef = useRef(false);
  useEffect(() => {
    if (!isDossierRequested) {
      hasAutoOpenedDossierRef.current = false;
      return;
    }
    if (hasAutoOpenedDossierRef.current) return;
    hasAutoOpenedDossierRef.current = true;
    setActiveTab('ENTREGABLES');
    openDeliverables('DOSSIER');
    consumeDossierParam();
  }, [isDossierRequested, setActiveTab, openDeliverables, consumeDossierParam]);

  const deliverableTabForActive =
    activeTab === 'BALANZA' || activeTab === 'RESULTADOS' || activeTab === 'BALANCE'
      ? activeTab
      : 'DOSSIER';

  if (isError) {
    return (
      <div role="alert" className="max-w-lg mx-auto my-12">
        <EmptyState
          variant="card"
          tone="red"
          icon={<AlertCircle className="w-6 h-6" aria-hidden="true" />}
          title="Error al generar Estados Financieros"
          description={
            error instanceof Error ? error.message : 'Error desconocido de conexión'
          }
          actions={
            <Button
              variant="primary"
              onClick={() => void refetch()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Reintentar cálculo
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="p-10 bg-white rounded-2xl border border-slate-300/90 shadow-2xs text-center text-xs text-slate-600 flex items-center justify-center gap-2"
      >
        <Loader2 className="w-4 h-4 animate-spin text-blue-700" aria-hidden="true" />
        <span>Calculando estados financieros y balanza de comprobación...</span>
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

      {/* PESTAÑA: AUXILIARES Y DIARIO GENERAL */}
      {activeTab === 'AUXILIARES' && (
        <div role="tabpanel" id="report-panel-AUXILIARES" aria-labelledby="report-tab-AUXILIARES">
          <AuxiliaresDiarioTab
            company={data.company}
            ejercicio={data.ejercicio}
            periodo={data.periodo}
            trialBalance={data.trialBalance}
            onSelectAccount={openLedger}
          />
        </div>
      )}

      {/* PESTAÑA 4: FLUJOS DE EFECTIVO NIF B-2 & CAMBIOS EN EL CAPITAL NIF B-4 */}
      {activeTab === 'FLUJOS_CAPITAL' && (
        <div role="tabpanel" id="report-panel-FLUJOS_CAPITAL" aria-labelledby="report-tab-FLUJOS_CAPITAL">
          <FlujosCapitalTab
            company={data.company}
            ejercicio={data.ejercicio}
            periodo={data.periodo}
            mesNombre={mesNombre}
            trialBalance={data.trialBalance}
            previousTrialBalance={prevReports?.trialBalance ?? null}
            isLoadingPrevReports={isLoadingPrevReports}
            onSelectAccount={openLedger}
          />
        </div>
      )}

      {/* PESTAÑA 5: DECLARACIÓN ANUAL, INFLACIÓN INPC, CUCA, CUFIN & PTU */}
      {activeTab === 'ANUAL' && (
        <div role="tabpanel" id="report-panel-ANUAL" aria-labelledby="report-tab-ANUAL">
          <DeclaracionAnualTab companyId={data.company.id} ejercicio={data.ejercicio} />
        </div>
      )}

      {/* PESTAÑA 6: EXPORTADOR XML CONTABILIDAD ELECTRÓNICA SAT ANEXO 24 */}
      {activeTab === 'ANEXO24' && (
        <div role="tabpanel" id="report-panel-ANEXO24" aria-labelledby="report-tab-ANEXO24">
          <Anexo24Tab
            companyRfc={data.company.rfc}
            ejercicio={data.ejercicio}
            periodo={data.periodo}
            satXmlType={satXmlType}
            setSatXmlType={setSatXmlType}
            anexo24Options={anexo24Options}
            setAnexo24Options={setAnexo24Options}
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
            periodo={data.periodo}
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
