import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import { MESES_SAT } from '../../shared/sat-constants';
import { calculateDia17Deadline, MEXICO_TIMEZONE } from '../../shared/date-utils';
import type { Company } from '../../shared/types';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { exportDeliverablesXlsx } from '../../lib/excel-export';
import { exportAllDeliverablesCsv } from './deliverableCsvExport';
import { generateDeliverableSummaryText } from './deliverableSummaryText';

export type DeliverableTabId = 'DOSSIER' | 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'DIA17' | 'CONFIG';

const DEFAULT_DELIVERABLE_CONFIG = {
  firmName: 'Despacho Contable y Fiscal Integral S.C.',
  auditorName: 'C.P.C. María Elena Gómez Garza',
  auditorCedula: 'Céd. Prof. 4829103',
  legalRepName: 'Ing. Alejandro Garza Martínez',
  legalRepTitle: 'Representante Legal',
  issuanceCity: 'Monterrey, Nuevo León'
} as const;

function readSavedConfigForKey(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

interface UseExecutiveDeliverablesParams {
  company: Company;
  year: number;
  period: number;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: DeliverableTabId;
}

export function useExecutiveDeliverables({
  company,
  year,
  period,
  isOpen,
  onClose,
  initialTab = 'DOSSIER'
}: UseExecutiveDeliverablesParams) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogLightDismiss(dialogRef, onClose, { isOpen });

  const [activeTab, setActiveTab] = useState<DeliverableTabId>(initialTab);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const configKey = `librepaq_deliverable_config_${company.id}`;
  const loadedConfigKeyRef = useRef<string>(configKey);

  const [firmName, setFirmName] = useState(
    () => readSavedConfigForKey(configKey).firmName || DEFAULT_DELIVERABLE_CONFIG.firmName
  );
  const [auditorName, setAuditorName] = useState(
    () => readSavedConfigForKey(configKey).auditorName || DEFAULT_DELIVERABLE_CONFIG.auditorName
  );
  const [auditorCedula, setAuditorCedula] = useState(
    () => readSavedConfigForKey(configKey).auditorCedula || DEFAULT_DELIVERABLE_CONFIG.auditorCedula
  );
  const [legalRepName, setLegalRepName] = useState(
    () => readSavedConfigForKey(configKey).legalRepName || DEFAULT_DELIVERABLE_CONFIG.legalRepName
  );
  const [legalRepTitle, setLegalRepTitle] = useState(
    () => readSavedConfigForKey(configKey).legalRepTitle || DEFAULT_DELIVERABLE_CONFIG.legalRepTitle
  );
  const [issuanceCity, setIssuanceCity] = useState(
    () => readSavedConfigForKey(configKey).issuanceCity || DEFAULT_DELIVERABLE_CONFIG.issuanceCity
  );

  useEffect(() => {
    if (loadedConfigKeyRef.current !== configKey) {
      const saved = readSavedConfigForKey(configKey);
      setFirmName(saved.firmName || DEFAULT_DELIVERABLE_CONFIG.firmName);
      setAuditorName(saved.auditorName || DEFAULT_DELIVERABLE_CONFIG.auditorName);
      setAuditorCedula(saved.auditorCedula || DEFAULT_DELIVERABLE_CONFIG.auditorCedula);
      setLegalRepName(saved.legalRepName || DEFAULT_DELIVERABLE_CONFIG.legalRepName);
      setLegalRepTitle(saved.legalRepTitle || DEFAULT_DELIVERABLE_CONFIG.legalRepTitle);
      setIssuanceCity(saved.issuanceCity || DEFAULT_DELIVERABLE_CONFIG.issuanceCity);
      loadedConfigKeyRef.current = configKey;
      return;
    }

    try {
      localStorage.setItem(
        configKey,
        JSON.stringify({ firmName, auditorName, auditorCedula, legalRepName, legalRepTitle, issuanceCity })
      );
    } catch {}
  }, [configKey, firmName, auditorName, auditorCedula, legalRepName, legalRepTitle, issuanceCity]);
  const [issuanceDate, setIssuanceDate] = useState(() =>
    new Date().toLocaleDateString('es-MX', {
      timeZone: MEXICO_TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  );

  const [includeBalanza, setIncludeBalanza] = useState(true);
  const [includeResultados, setIncludeResultados] = useState(true);
  const [includeBalance, setIncludeBalance] = useState(true);
  const [includeDia17, setIncludeDia17] = useState(true);
  const { copiedKey, copy: copySummaryToClipboard } = useCopyToClipboard<'summary'>(3000);
  const copiedSummary = copiedKey === 'summary';

  const {
    data: reportsData,
    isLoading: isLoadingReports,
    isError: isErrorReports,
    error: reportsError,
    refetch: refetchReports
  } = useQuery({
    queryKey: ['reports', company.id, year, period],
    queryFn: () => apiClient.getReports(company.id, year, period),
    enabled: isOpen
  });

  const {
    data: fiscalData,
    isLoading: isLoadingFiscal,
    isError: isErrorFiscal,
    error: fiscalError,
    refetch: refetchFiscal
  } = useQuery({
    queryKey: ['fiscal-workpaper', company.id, year, period],
    queryFn: () => apiClient.getFiscalWorkpaper(company.id, year, period),
    enabled: isOpen
  });

  const isLoadingData = isLoadingReports || isLoadingFiscal;
  const isErrorData = isErrorReports || isErrorFiscal;
  const dataError = reportsError || fiscalError;
  const refetchData = () => {
    void refetchReports();
    void refetchFiscal();
  };

  const mesNombre = useMemo(
    () => MESES_SAT.find((m) => m.periodo === period)?.nombre || `Periodo ${period}`,
    [period]
  );

  const formatVerticalPct = (amount: number, base: number) => {
    if (!base || Math.abs(base) < 0.01) return '0.0%';
    return `${((amount / base) * 100).toFixed(1)}%`;
  };

  const isrSaldoNoAplicado = useMemo(() => {
    if (!fiscalData?.isrProvisional) return 0;
    const { isrCausado, pagosProvisionalesPrevios, isrRetenidoPeriodo } = fiscalData.isrProvisional;
    const deduccionDirecta = pagosProvisionalesPrevios + isrRetenidoPeriodo;
    return deduccionDirecta > isrCausado ? deduccionDirecta - isrCausado : 0;
  }, [fiscalData]);

  const fechaVencimientoDia17 = useMemo(
    () => calculateDia17Deadline(year, period).formattedSpanish,
    [year, period]
  );

  const isUsingDefaultSignatures =
    auditorName.includes('María Elena Gómez Garza') || auditorCedula.includes('4829103');

  const handlePrint = () => {
    window.print();
  };

  const handleExportAllCsv = () => {
    if (!reportsData) return;
    exportAllDeliverablesCsv({
      reportsData,
      fiscalData,
      company,
      year,
      period,
      formatVerticalPct
    });
    toast.success('¡Paquete .ZIP (CSV) de cédulas descargado exitosamente!');
  };

  const handleExportAllXlsx = async () => {
    if (!reportsData || isExporting) return;
    try {
      setIsExporting(true);
      await exportDeliverablesXlsx({
        reportsData,
        fiscalData,
        company,
        year,
        period,
        formatVerticalPct
      });
      toast.success('¡Dossier Ejecutivo descargado exitosamente en Excel (.XLSX)!');
    } catch (err) {
      console.warn('[Deliverables] Falló exportación XLSX, usando respaldo CSV:', err);
      toast.warning('No se pudo generar el Excel (.XLSX); se descargó el Paquete .ZIP (CSV).');
      handleExportAllCsv();
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyExecutiveSummary = async () => {
    if (!reportsData) return;
    const summary = generateDeliverableSummaryText({
      company,
      year,
      mesNombre,
      issuanceCity,
      issuanceDate,
      firmName,
      auditorName,
      auditorCedula,
      legalRepName,
      legalRepTitle,
      reportsData,
      fiscalData,
      formatVerticalPct
    });
    const copied = await copySummaryToClipboard(summary, 'summary');
    if (copied) {
      toast.success('¡Resumen Ejecutivo formal copiado al portapapeles!');
    } else {
      toast.error('No se pudo copiar el resumen al portapapeles.');
    }
  };

  return {
    dialogRef,
    activeTab,
    setActiveTab,
    isExporting,
    firmName,
    setFirmName,
    auditorName,
    setAuditorName,
    auditorCedula,
    setAuditorCedula,
    legalRepName,
    setLegalRepName,
    legalRepTitle,
    setLegalRepTitle,
    issuanceCity,
    setIssuanceCity,
    issuanceDate,
    setIssuanceDate,
    includeBalanza,
    setIncludeBalanza,
    includeResultados,
    setIncludeResultados,
    includeBalance,
    setIncludeBalance,
    includeDia17,
    setIncludeDia17,
    copiedSummary,
    reportsData,
    fiscalData,
    isLoadingData,
    isErrorData,
    dataError,
    refetchData,
    mesNombre,
    formatVerticalPct,
    isrSaldoNoAplicado,
    fechaVencimientoDia17,
    isUsingDefaultSignatures,
    handlePrint,
    handleExportAllCsv,
    handleExportAllXlsx,
    handleCopyExecutiveSummary
  };
}
