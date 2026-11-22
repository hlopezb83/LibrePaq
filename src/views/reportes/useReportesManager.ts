import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { apiClient } from '../../lib/api-client';
import { downloadBlobFile, downloadCsvFile } from '../../lib/formatters';
import type { SatXmlType } from '../../shared/sat-anexo24';
import type { ReportTabId } from './ReportesHeaderBar';

export function useReportesManager() {
  const { activeCompany, activeCompanyId } = useCompany();
  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;

  const [activeTab, setActiveTab] = useState<ReportTabId>('BALANZA');
  const [satXmlType, setSatXmlType] = useState<SatXmlType>('balanza');

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
    downloadBlobFile(satXmlData.filename, satXmlData.xml, 'application/xml;charset=utf-8');
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
    satXmlData,
    isLoadingXml,
    handleDownloadXml,
    handleExportBalanzaCsv
  };
}
