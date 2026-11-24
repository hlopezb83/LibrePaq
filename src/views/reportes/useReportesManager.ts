import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { annualTaxClient } from '../../lib/annual-tax-client';
import { apiClient } from '../../lib/api-client';
import { downloadBlobFile } from '../../lib/formatters';
import { exportActiveReportCsv } from './reportesCsvExport';
import { getTodayLocalIso } from '../../shared/date-utils';
import {
  isValidSatNumOrden,
  isValidSatNumTramite,
  type SatXmlType
} from '../../shared/sat-anexo24';
import type { Anexo24UiOptions } from './Anexo24OptionsBar';
import type { ReportTabId } from './ReportesHeaderBar';

const VALID_REPORT_TABS: readonly ReportTabId[] = [
  'BALANZA',
  'RESULTADOS',
  'BALANCE',
  'AUXILIARES',
  'FLUJOS_CAPITAL',
  'ANUAL',
  'ANEXO24',
  'ENTREGABLES'
];

function resolveReportTab(raw: unknown): ReportTabId | null {
  if (typeof raw !== 'string') return null;
  const param = raw.toUpperCase();
  if (param === 'DOSSIER') return 'ENTREGABLES';
  return VALID_REPORT_TABS.includes(param as ReportTabId) ? (param as ReportTabId) : null;
}

export function useReportesManager() {
  const { activeCompany, activeCompanyId } = useCompany();
  const toast = useToast();
  const navigate = useNavigate();
  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;

  const urlTab: unknown = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)?.tab
  });
  const urlDossier: unknown = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)?.dossier
  });
  const isDossierRequested = urlDossier === true || urlDossier === 'true';

  const [activeTab, setActiveTabState] = useState<ReportTabId>(
    () => (isDossierRequested ? 'ENTREGABLES' : resolveReportTab(urlTab) ?? 'BALANZA')
  );
  const [satXmlType, setSatXmlType] = useState<SatXmlType>('balanza');
  const [anexo24Options, setAnexo24Options] = useState<Anexo24UiOptions>({
    tipoEnvio: 'N',
    fechaModBal: getTodayLocalIso(),
    tipoSolicitud: 'AF',
    numOrden: '',
    numTramite: ''
  });

  useEffect(() => {
    if (isDossierRequested) {
      setActiveTabState('ENTREGABLES');
      return;
    }
    const next = resolveReportTab(urlTab);
    if (next) setActiveTabState(next);
  }, [urlTab, isDossierRequested]);

  const setActiveTab = useCallback(
    (nextTab: ReportTabId) => {
      setActiveTabState(nextTab);
      void navigate({
        to: '/reportes',
        search: ((prev: Record<string, unknown>) => ({ ...prev, tab: nextTab, dossier: undefined })) as unknown as Record<string, string>,
        replace: true
      });
    },
    [navigate]
  );

  const consumeDossierParam = useCallback(() => {
    void navigate({
      to: '/reportes',
      search: ((prev: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...prev, tab: 'ENTREGABLES' };
        delete next.dossier;
        return next;
      }) as unknown as Record<string, string>,
      replace: true
    });
  }, [navigate]);

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

  const { data: prevReports, isLoading: isLoadingPrevReports } = useQuery({
    queryKey: ['reports', activeCompanyId, currentYear ? currentYear - 1 : undefined, 13],
    queryFn: () => apiClient.getReports(activeCompanyId, (currentYear ?? 2026) - 1, 13),
    enabled: Boolean(
      activeCompanyId && activeTab === 'FLUJOS_CAPITAL' && currentYear && currentYear > 2000
    )
  });

  const { data: annualTaxData } = useQuery({
    queryKey: ['annual-tax', activeCompanyId, currentYear ?? 2026],
    queryFn: () => annualTaxClient.getAnnualTaxSummary(activeCompanyId, currentYear ?? 2026),
    enabled: Boolean(activeCompanyId && activeTab === 'ANUAL')
  });

  const validOrdenQuery =
    !anexo24Options.numOrden.trim() || isValidSatNumOrden(anexo24Options.numOrden)
      ? anexo24Options.numOrden.trim().toUpperCase() || undefined
      : undefined;
  const validTramiteQuery =
    !anexo24Options.numTramite.trim() || isValidSatNumTramite(anexo24Options.numTramite)
      ? anexo24Options.numTramite.trim().toUpperCase() || undefined
      : undefined;

  const {
    data: satXmlData,
    isLoading: isLoadingXml,
    isError: isErrorXml,
    error: xmlError,
    refetch: refetchXml
  } = useQuery({
    queryKey: [
      'sat-xml',
      activeCompanyId,
      satXmlType,
      currentYear,
      currentPeriod,
      anexo24Options.tipoEnvio,
      anexo24Options.fechaModBal,
      anexo24Options.tipoSolicitud,
      validOrdenQuery,
      validTramiteQuery
    ],
    queryFn: () =>
      apiClient.getSatXml(activeCompanyId, satXmlType, currentYear, currentPeriod, {
        tipoEnvio: anexo24Options.tipoEnvio,
        fechaModBal: anexo24Options.fechaModBal,
        tipoSolicitud: anexo24Options.tipoSolicitud,
        numOrden: validOrdenQuery,
        numTramite: validTramiteQuery
      }),
    enabled: Boolean(activeCompanyId && activeTab === 'ANEXO24')
  });

  const handleDownloadXml = () => {
    if (!satXmlData) return;
    downloadBlobFile(satXmlData.filename, satXmlData.xml, 'application/xml;charset=utf-8');
    toast.success(`XML Anexo 24 descargado: ${satXmlData.filename}`);
  };

  const handleExportBalanzaCsv = () => {
    if (!data) return;
    if (activeTab === 'ANUAL' && !annualTaxData) {
      toast.info('Calculando resumen de Declaración Anual, intenta nuevamente en un segundo.');
      return;
    }
    const msg = exportActiveReportCsv({ activeTab, data, annualTaxData });
    toast.success(msg);
  };

  return {
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
  };
}
