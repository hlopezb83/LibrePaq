import { useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../context/CompanyContext';
import { apiClient } from '../lib/api-client';
import { downloadCsvFile } from '../lib/formatters';
import { MESES_SAT } from '../shared/sat-catalog';
import { useUIModal } from '../context/UIModalContext';
import { ReportesHeaderBar, type ReportTabId } from './reportes/ReportesHeaderBar';
import { BalanzaTab } from './reportes/BalanzaTab';
import { EstadoResultadosTab } from './reportes/EstadoResultadosTab';
import { BalanceGeneralTab } from './reportes/BalanceGeneralTab';
import { Anexo24Tab } from './reportes/Anexo24Tab';
import { DossierEntregablesTab } from './reportes/DossierEntregablesTab';
import type { SatXmlType } from '../shared/sat-anexo24';

export function ReportesView() {
  const { activeCompany, activeCompanyId } = useCompany();
  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;

  const [activeTab, setActiveTab] = useState<ReportTabId>('BALANZA');
  const [satXmlType, setSatXmlType] = useState<SatXmlType>('balanza');
  const { openLedger, openDeliverables } = useUIModal();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getReports(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId)
  });

  const { data: satXmlData, isLoading: isLoadingXml } = useQuery({
    queryKey: ['sat-xml', activeCompanyId, satXmlType, currentYear, currentPeriod],
    queryFn: () => apiClient.getSatXml(activeCompanyId, satXmlType, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId && activeTab === 'ANEXO24')
  });

  const handleDownloadXml = () => {
    if (!satXmlData) return;
    const blob = new Blob([satXmlData.xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = satXmlData.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBalanzaCsv = () => {
    if (!data) return;
    const headers = [
      'Código Cuenta',
      'Nombre de la Cuenta',
      'Agrupador SAT',
      'Naturaleza',
      'Nivel',
      'Saldo Inicial',
      'Cargos (Debe)',
      'Abonos (Haber)',
      'Saldo Final'
    ];
    const rows = data.trialBalance.map((r) => [
      r.code,
      r.name,
      r.satGroupCode,
      r.nature,
      r.level,
      r.initialBalanceComputed,
      r.periodCharges,
      r.periodCredits,
      r.finalBalance
    ]);
    downloadCsvFile(
      `Balanza_${data.company.rfc}_${data.ejercicio}_P${String(data.periodo).padStart(2, '0')}.csv`,
      headers,
      rows
    );
  };

  if (isError) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-red-200 shadow-2xs space-y-4 max-w-lg mx-auto my-12">
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
      <div className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-500">
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
        onTabChange={setActiveTab}
        onOpenDeliverables={() => openDeliverables()}
        onExportCsv={handleExportBalanzaCsv}
      />

      {/* PESTAÑA 1: BALANZA DE COMPROBACIÓN */}
      {activeTab === 'BALANZA' && (
        <BalanzaTab
          trialBalance={data.trialBalance}
          company={data.company}
          ejercicio={data.ejercicio}
          mesNombre={mesNombre}
          onSelectAccount={openLedger}
        />
      )}

      {/* PESTAÑA 2: ESTADO DE RESULTADOS CON ANÁLISIS VERTICAL (%) */}
      {activeTab === 'RESULTADOS' && (
        <EstadoResultadosTab
          company={data.company}
          ejercicio={data.ejercicio}
          mesNombre={mesNombre}
          incomeStatement={data.incomeStatement}
          onSelectAccount={openLedger}
        />
      )}

      {/* PESTAÑA 3: BALANCE GENERAL CON ANÁLISIS VERTICAL (%) */}
      {activeTab === 'BALANCE' && (
        <BalanceGeneralTab
          company={data.company}
          ejercicio={data.ejercicio}
          mesNombre={mesNombre}
          balanceSheet={data.balanceSheet}
          onSelectAccount={openLedger}
        />
      )}

      {/* PESTAÑA 4: EXPORTADOR XML CONTABILIDAD ELECTRÓNICA SAT ANEXO 24 */}
      {activeTab === 'ANEXO24' && (
        <Anexo24Tab
          satXmlType={satXmlType}
          setSatXmlType={setSatXmlType}
          satXmlData={satXmlData}
          isLoadingXml={isLoadingXml}
          onDownloadXml={handleDownloadXml}
        />
      )}

      {/* PESTAÑA 5: DOSSIER DE ENTREGABLES Y CARPETA DE CIERRE */}
      {activeTab === 'ENTREGABLES' && (
        <DossierEntregablesTab
          mesNombre={mesNombre}
          ejercicio={data.ejercicio}
          totals={data.totals}
          incomeStatement={data.incomeStatement}
          balanceSheet={data.balanceSheet}
          onOpenDeliverablesModal={() => openDeliverables('DOSSIER')}
        />
      )}
    </div>
  );
}
