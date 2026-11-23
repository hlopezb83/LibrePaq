import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import { downloadBlobFile, downloadCsvFile } from '../../lib/formatters';
import type { SatXmlType } from '../../shared/sat-anexo24';
import type { ReportTabId } from './ReportesHeaderBar';

const VALID_REPORT_TABS: readonly ReportTabId[] = ['BALANZA', 'RESULTADOS', 'BALANCE', 'ANEXO24', 'ENTREGABLES'];

function getInitialReportTab(): ReportTabId {
  if (typeof window !== 'undefined' && window.location.search) {
    const param = new URLSearchParams(window.location.search).get('tab')?.toUpperCase() as ReportTabId | undefined;
    if (param && VALID_REPORT_TABS.includes(param)) return param;
  }
  return 'BALANZA';
}

export function useReportesManager() {
  const { activeCompany, activeCompanyId } = useCompany();
  const toast = useToast();
  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;

  const [activeTab, setActiveTab] = useState<ReportTabId>(getInitialReportTab);
  const [satXmlType, setSatXmlType] = useState<SatXmlType>('balanza');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const param = new URLSearchParams(window.location.search).get('tab')?.toUpperCase() as ReportTabId | undefined;
      if (param && VALID_REPORT_TABS.includes(param)) setActiveTab(param);
    }
  }, []);

  const { data: periodLock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, currentYear ?? 2026, currentPeriod ?? 10),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });
  const isPeriodLocked = Boolean(periodLock?.isLocked);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getReports(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId)
  });

  const {
    data: satXmlData,
    isLoading: isLoadingXml,
    isError: isErrorXml,
    error: xmlError,
    refetch: refetchXml
  } = useQuery({
    queryKey: ['sat-xml', activeCompanyId, satXmlType, currentYear, currentPeriod],
    queryFn: () => apiClient.getSatXml(activeCompanyId, satXmlType, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId && activeTab === 'ANEXO24')
  });

  const handleDownloadXml = () => {
    if (!satXmlData) return;
    downloadBlobFile(satXmlData.filename, satXmlData.xml, 'application/xml;charset=utf-8');
    toast.success(`XML Anexo 24 descargado: ${satXmlData.filename}`);
  };

  const handleExportBalanzaCsv = () => {
    if (!data) return;
    const periodCode = `P${String(data.periodo).padStart(2, '0')}`;
    if (activeTab === 'RESULTADOS') {
      const base = data.incomeStatement.totalIngresos || 0;
      const pct = (val: number) => (base !== 0 ? `${((val / base) * 100).toFixed(1)}%` : '0.0%');
      downloadCsvFile(
        `Estado_Resultados_${data.company.rfc}_${data.ejercicio}_${periodCode}.csv`,
        ['Rubro Contable', 'Código', 'Nombre Cuenta', 'Importe MXN', '% s/Ventas'],
        [
          ...data.incomeStatement.ingresos.map((a) => ['INGRESOS', a.code, a.name, a.finalBalance, pct(a.finalBalance)]),
          ['TOTAL INGRESOS', '', 'Ventas Netas del Periodo', data.incomeStatement.totalIngresos, '100.0%'],
          ...data.incomeStatement.costos.map((a) => ['COSTOS', a.code, a.name, a.finalBalance, pct(a.finalBalance)]),
          ['UTILIDAD BRUTA', '', 'Utilidad Bruta Operativa', data.incomeStatement.utilidadBruta, pct(data.incomeStatement.utilidadBruta)],
          ...data.incomeStatement.gastos.map((a) => ['GASTOS', a.code, a.name, a.finalBalance, pct(a.finalBalance)]),
          ['UTILIDAD NETA', '', 'Resultado Neto del Periodo', data.incomeStatement.utilidadNeta, pct(data.incomeStatement.utilidadNeta)]
        ]
      );
      toast.success('Estado de Resultados exportado en CSV');
      return;
    }
    if (activeTab === 'BALANCE') {
      downloadCsvFile(
        `Balance_General_${data.company.rfc}_${data.ejercicio}_${periodCode}.csv`,
        ['Clasificación', 'Código', 'Nombre Cuenta', 'Saldo Final MXN'],
        [
          ...data.balanceSheet.activos.map((a) => ['ACTIVO', a.code, a.name, a.finalBalance]),
          ['TOTAL ACTIVO', '100', 'Total Activo', data.balanceSheet.totalActivo],
          ...data.balanceSheet.pasivos.map((a) => ['PASIVO', a.code, a.name, a.finalBalance]),
          ['TOTAL PASIVO', '200', 'Total Pasivo', data.balanceSheet.totalPasivo],
          ...data.balanceSheet.capital.map((a) => ['CAPITAL', a.code, a.name, a.finalBalance]),
          ['UTILIDAD EJERCICIO', '305', 'Resultado del Ejercicio Actual', data.balanceSheet.utilidadEjercicio],
          ['PASIVO + CAPITAL', '', 'Suma Pasivo y Capital Contable', data.balanceSheet.totalPasivoMasCapital]
        ]
      );
      toast.success('Balance General exportado en CSV');
      return;
    }
    const headers = [
      'Código Cuenta', 'Nombre de la Cuenta', 'Agrupador SAT', 'Naturaleza',
      'Nivel', 'Saldo Inicial', 'Cargos (Debe)', 'Abonos (Haber)', 'Saldo Final'
    ];
    const rows = data.trialBalance.map((r) => [
      r.code, r.name, r.satGroupCode, r.nature, r.level,
      r.initialBalanceComputed, r.periodCharges, r.periodCredits, r.finalBalance
    ]);
    downloadCsvFile(`Balanza_${data.company.rfc}_${data.ejercicio}_${periodCode}.csv`, headers, rows);
    toast.success('Balanza de Comprobación exportada en CSV');
  };

  return {
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
  };
}
