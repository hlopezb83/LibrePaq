import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import { MESES_SAT } from '../../shared/sat-constants';
import { calculateDia17Deadline } from '../../shared/date-utils';
import { computeExtendedFinancialStatements } from '../../shared/engine/extended-statements.engine';
import type { Company } from '../../shared/types';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { exportDeliverablesXlsx } from '../../lib/excel-export';
import { exportAllDeliverablesCsv } from './deliverableCsvExport';
import { generateDeliverableSummaryText } from './deliverableSummaryText';
import {
  DEFAULT_DELIVERABLE_CONFIG,
  hasAnyDefaultSignature,
  useDeliverableBranding
} from './useDeliverableBranding';

export type DeliverableTabId = 'DOSSIER' | 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'DIA17' | 'CONFIG';
export { DEFAULT_DELIVERABLE_CONFIG, hasAnyDefaultSignature };

interface UseExecutiveDeliverablesParams {
  company: Company;
  year: number;
  period: number;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: DeliverableTabId;
}

export function useExecutiveDeliverables({
  company, year, period, isOpen, onClose, initialTab = 'DOSSIER'
}: UseExecutiveDeliverablesParams) {
  const toast = useToast();
  const { isReadOnlyClient, isReadOnlySupportMode } = useCompany();
  const isReadOnly = isReadOnlyClient || isReadOnlySupportMode;
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogLightDismiss(dialogRef, onClose, { isOpen });

  const [activeTab, setActiveTabState] = useState<DeliverableTabId>(initialTab);
  const [isExporting, setIsExporting] = useState(false);
  const branding = useDeliverableBranding(company, isReadOnly);

  const [includeCoverRatios, setIncludeCoverRatios] = useState(true);
  const [includeBalanza, setIncludeBalanza] = useState(true);
  const [includeResultados, setIncludeResultados] = useState(true);
  const [includeBalance, setIncludeBalance] = useState(true);
  const [includeNifAging, setIncludeNifAging] = useState(true);
  const [includeDia17, setIncludeDia17] = useState(true);
  const [hideZeroAccounts, setHideZeroAccounts] = useState(false);

  const selectedDocsCount = [
    includeCoverRatios, includeBalanza, includeResultados, includeBalance, includeNifAging, includeDia17
  ].filter(Boolean).length;
  const { copiedKey, copy: copySummaryToClipboard } = useCopyToClipboard<'summary'>(3000);
  const copiedSummary = copiedKey === 'summary';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) { if (!dialog.open) dialog.showModal(); }
    else if (dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialTab) setActiveTabState(initialTab);
  }, [isOpen, initialTab]);

  const setActiveTab = (next: DeliverableTabId) => setActiveTabState(next);

  const {
    data: reportsData, isLoading: isLoadingReports, isError: isErrorReports,
    error: reportsError, refetch: refetchReports
  } = useQuery({
    queryKey: ['reports', company.id, year, period],
    queryFn: () => apiClient.getReports(company.id, year, period),
    enabled: isOpen
  });

  const prevMonthTarget = useMemo(
    () => (period === 1 ? { year: year - 1, period: 12 } : { year, period: Math.min(period - 1, 12) }),
    [year, period]
  );

  const { data: prevMonthReportsData } = useQuery({
    queryKey: ['reports', company.id, prevMonthTarget.year, prevMonthTarget.period],
    queryFn: () => apiClient.getReports(company.id, prevMonthTarget.year, prevMonthTarget.period),
    enabled: isOpen && prevMonthTarget.year > 2000
  });

  const { data: prevReportsData } = useQuery({
    queryKey: ['reports', company.id, year - 1, 13],
    queryFn: () => apiClient.getReports(company.id, year - 1, 13),
    enabled: isOpen && year > 2000
  });

  const { data: agingData } = useQuery({
    queryKey: ['cxc-cxp', company.id],
    queryFn: () => apiClient.getCxcCxpAging(company.id),
    enabled: isOpen
  });

  const bankAccountIds = useMemo(
    () =>
      (reportsData?.trialBalance ?? [])
        .filter((a) => a.isAffectable && (a.code.startsWith('102') || a.satGroupCode?.startsWith('102')))
        .slice(0, 5)
        .map((a) => a.id),
    [reportsData]
  );

  const { data: bankReconciliations = [] } = useQuery({
    queryKey: ['deliverables-bank-recon', company.id, year, period, bankAccountIds.join(',')],
    queryFn: () =>
      Promise.all(
        bankAccountIds.map((id) =>
          apiClient.getBankReconciliation(company.id, id, year, period).catch(() => null)
        )
      ).then((rows) => rows.filter((r): r is NonNullable<typeof r> => r !== null)),
    enabled: isOpen && bankAccountIds.length > 0
  });

  const extendedStatements = useMemo(() => {
    if (!reportsData) return null;
    return computeExtendedFinancialStatements({
      company, ejercicio: year, periodo: period,
      currentTrialBalance: reportsData.trialBalance,
      previousTrialBalance: prevReportsData?.trialBalance ?? null
    });
  }, [company, year, period, reportsData, prevReportsData]);

  const {
    data: fiscalData, isLoading: isLoadingFiscal, isError: isErrorFiscal,
    error: fiscalError, refetch: refetchFiscal
  } = useQuery({
    queryKey: ['fiscal-workpaper', company.id, year, period],
    queryFn: () => apiClient.getFiscalWorkpaper(company.id, year, period),
    enabled: isOpen
  });

  const isLoadingData = isLoadingReports || isLoadingFiscal;
  const isErrorData = isErrorReports || isErrorFiscal;
  const dataError = reportsError || fiscalError;
  const refetchData = () => { void refetchReports(); void refetchFiscal(); };

  const mesNombre = useMemo(
    () => MESES_SAT.find((m) => m.periodo === period)?.nombre || `Periodo ${period}`,
    [period]
  );

  const formatVerticalPct = (amount: number, base: number) =>
    !base || Math.abs(base) < 0.01 ? '0.0%' : `${((amount / base) * 100).toFixed(1)}%`;

  const isrSaldoNoAplicado = useMemo(() => {
    if (!fiscalData?.isrProvisional) return 0;
    const { esResico, isrCausado, pagosProvisionalesPrevios, isrRetenidoPeriodo } = fiscalData.isrProvisional;
    const isResicoPf = Boolean(esResico) && company.rfc.trim().length === 13;
    const ded = (isResicoPf ? 0 : pagosProvisionalesPrevios) + isrRetenidoPeriodo;
    return ded > isrCausado ? ded - isrCausado : 0;
  }, [company.rfc, fiscalData]);

  const fechaVencimientoDia17 = useMemo(
    () => calculateDia17Deadline(year, period).formattedSpanish,
    [year, period]
  );

  const handlePrint = () => window.print();

  const handleExportAllCsv = () => {
    if (!reportsData) return;
    const exported = exportAllDeliverablesCsv({
      reportsData,
      prevMonthIncomeStatement: prevMonthReportsData?.incomeStatement,
      fiscalData,
      agingData,
      bankReconciliations,
      company,
      year,
      period,
      formatVerticalPct,
      hideZeroAccounts,
      includeBalanza,
      includeResultados,
      includeBalance,
      includeDia17,
      includeNifAging
    });
    if (exported) toast.success('¡Paquete .ZIP (CSV) de cédulas descargado exitosamente!');
    else toast.warning('No hay cédulas con datos seleccionadas para exportar.');
  };

  const handleExportAllXlsx = async () => {
    if (!reportsData || isExporting) return;
    try {
      setIsExporting(true);
      const exported = await exportDeliverablesXlsx({
        reportsData,
        prevMonthIncomeStatement: prevMonthReportsData?.incomeStatement,
        fiscalData,
        company,
        year,
        period,
        formatVerticalPct,
        extendedStatements,
        bankReconciliations,
        agingData,
        mesNombre,
        hideZeroAccounts,
        includeBalanza,
        includeResultados,
        includeBalance,
        includeDia17,
        includeNifAging
      });
      if (exported) toast.success('¡Dossier Ejecutivo descargado exitosamente en Excel (.XLSX)!');
      else toast.warning('No hay cédulas con datos seleccionadas para descargar.');
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
      company, year, mesNombre,
      issuanceCity: branding.issuanceCity,
      issuanceDate: branding.issuanceDate,
      firmName: branding.firmName,
      auditorName: branding.auditorName,
      auditorCedula: branding.auditorCedula,
      legalRepName: branding.legalRepName,
      legalRepTitle: branding.legalRepTitle,
      reportsData, fiscalData, formatVerticalPct,
      accountantNotes: branding.accountantNotes
    });
    const copied = await copySummaryToClipboard(summary, 'summary');
    if (copied) toast.success('¡Resumen Ejecutivo formal copiado al portapapeles!');
    else toast.error('No se pudo copiar el resumen al portapapeles.');
  };

  return {
    dialogRef, activeTab, setActiveTab, isExporting, isReadOnly,
    ...branding,
    includeCoverRatios, setIncludeCoverRatios, includeBalanza, setIncludeBalanza,
    includeResultados, setIncludeResultados, includeBalance, setIncludeBalance,
    includeNifAging, setIncludeNifAging, includeDia17, setIncludeDia17,
    hideZeroAccounts, setHideZeroAccounts, selectedDocsCount, copiedSummary,
    reportsData, prevMonthReportsData, fiscalData, extendedStatements, agingData, bankReconciliations,
    isLoadingData, isErrorData, dataError, refetchData, mesNombre, formatVerticalPct,
    isrSaldoNoAplicado, fechaVencimientoDia17,
    handlePrint, handleExportAllCsv, handleExportAllXlsx, handleCopyExecutiveSummary
  };
}
