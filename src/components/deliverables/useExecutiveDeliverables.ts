import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import { MESES_SAT } from '../../shared/sat-constants';
import { calculateDia17Deadline } from '../../shared/date-utils';
import type { Company } from '../../shared/types';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { exportDeliverablesXlsx } from '../../lib/excel-export';
import { exportAllDeliverablesCsv } from './deliverableCsvExport';
import { generateDeliverableSummaryText } from './deliverableSummaryText';

export type DeliverableTabId = 'DOSSIER' | 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'DIA17' | 'CONFIG';

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
  const readSavedConfig = () => {
    try {
      const raw = localStorage.getItem(configKey);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  };

  const [firmName, setFirmName] = useState(() => readSavedConfig().firmName || 'Despacho Contable y Fiscal Integral S.C.');
  const [auditorName, setAuditorName] = useState(() => readSavedConfig().auditorName || 'C.P.C. María Elena Gómez Garza');
  const [auditorCedula, setAuditorCedula] = useState(() => readSavedConfig().auditorCedula || 'Céd. Prof. 4829103');
  const [legalRepName, setLegalRepName] = useState(() => readSavedConfig().legalRepName || 'Ing. Alejandro Garza Martínez');
  const [legalRepTitle, setLegalRepTitle] = useState(() => readSavedConfig().legalRepTitle || 'Representante Legal');
  const [issuanceCity, setIssuanceCity] = useState(() => readSavedConfig().issuanceCity || 'Monterrey, Nuevo León');

  useEffect(() => {
    try {
      localStorage.setItem(
        configKey,
        JSON.stringify({ firmName, auditorName, auditorCedula, legalRepName, legalRepTitle, issuanceCity })
      );
    } catch {}
  }, [configKey, firmName, auditorName, auditorCedula, legalRepName, legalRepTitle, issuanceCity]);
  const [issuanceDate, setIssuanceDate] = useState(() =>
    new Date().toLocaleDateString('es-MX', {
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
    toast.success('¡Carpeta de Cédulas descargada exitosamente en Excel (.CSV)!');
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
      toast.warning('No se pudo generar el Excel (.XLSX); se descargó la versión .CSV.');
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
    handlePrint,
    handleExportAllCsv,
    handleExportAllXlsx,
    handleCopyExecutiveSummary
  };
}
