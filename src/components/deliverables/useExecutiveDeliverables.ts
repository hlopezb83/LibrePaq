import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import {
  DEFAULT_DELIVERABLE_CONFIG,
  hasAnyDefaultSignature,
  loadDeliverableBranding,
  readLocalDeliverableBranding,
  saveDeliverableBranding
} from '../../lib/supabase/supabase-deliverables-branding';
import { MESES_SAT } from '../../shared/sat-constants';
import { calculateDia17Deadline, MEXICO_TIMEZONE } from '../../shared/date-utils';
import { computeExtendedFinancialStatements } from '../../shared/engine/extended-statements.engine';
import type { Company } from '../../shared/types';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { exportDeliverablesXlsx } from '../../lib/excel-export';
import { exportAllDeliverablesCsv } from './deliverableCsvExport';
import { generateDeliverableSummaryText } from './deliverableSummaryText';

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
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  const initialBranding = useMemo(() => readLocalDeliverableBranding(company.id), [company.id]);
  const [firmName, setFirmNameState] = useState(initialBranding.firmName);
  const [preparerName, setPreparerNameState] = useState(initialBranding.preparerName);
  const [auditorName, setAuditorNameState] = useState(initialBranding.auditorName);
  const [auditorCedula, setAuditorCedulaState] = useState(initialBranding.auditorCedula);
  const [legalRepName, setLegalRepNameState] = useState(initialBranding.legalRepName);
  const [legalRepTitle, setLegalRepTitleState] = useState(initialBranding.legalRepTitle);
  const [issuanceCity, setIssuanceCityState] = useState(initialBranding.issuanceCity);
  const [logoDataUrl, setLogoDataUrlState] = useState(initialBranding.logoDataUrl);
  const [accountantNotes, setAccountantNotesState] = useState(initialBranding.accountantNotes);

  const hasLoadedBrandingRef = useRef(false);
  const isUserDirtyRef = useRef(false);
  const lastPersistedJsonRef = useRef(JSON.stringify(initialBranding));

  const setFirmName = (v: string) => { isUserDirtyRef.current = true; setFirmNameState(v); };
  const setPreparerName = (v: string) => { isUserDirtyRef.current = true; setPreparerNameState(v); };
  const setAuditorName = (v: string) => { isUserDirtyRef.current = true; setAuditorNameState(v); };
  const setAuditorCedula = (v: string) => { isUserDirtyRef.current = true; setAuditorCedulaState(v); };
  const setLegalRepName = (v: string) => { isUserDirtyRef.current = true; setLegalRepNameState(v); };
  const setLegalRepTitle = (v: string) => { isUserDirtyRef.current = true; setLegalRepTitleState(v); };
  const setIssuanceCity = (v: string) => { isUserDirtyRef.current = true; setIssuanceCityState(v); };
  const setLogoDataUrl = (v: string) => { isUserDirtyRef.current = true; setLogoDataUrlState(v); };
  const setAccountantNotes = (v: string) => { isUserDirtyRef.current = true; setAccountantNotesState(v); };

  const [issuanceDate, setIssuanceDate] = useState(() =>
    new Date().toLocaleDateString('es-MX', {
      timeZone: MEXICO_TIMEZONE, year: 'numeric', month: 'long', day: 'numeric'
    })
  );

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

  useEffect(() => {
    let active = true;
    hasLoadedBrandingRef.current = false;
    isUserDirtyRef.current = false;
    const local = readLocalDeliverableBranding(company.id);
    lastPersistedJsonRef.current = JSON.stringify(local);
    setFirmNameState(local.firmName);
    setPreparerNameState(local.preparerName);
    setAuditorNameState(local.auditorName);
    setAuditorCedulaState(local.auditorCedula);
    setLegalRepNameState(local.legalRepName);
    setLegalRepTitleState(local.legalRepTitle);
    setIssuanceCityState(local.issuanceCity);
    setLogoDataUrlState(local.logoDataUrl);
    setAccountantNotesState(local.accountantNotes);

    void loadDeliverableBranding(company.id).then((cfg) => {
      if (!active) return;
      if (!isUserDirtyRef.current) {
        setFirmNameState(cfg.firmName);
        setPreparerNameState(cfg.preparerName);
        setAuditorNameState(cfg.auditorName);
        setAuditorCedulaState(cfg.auditorCedula);
        setLegalRepNameState(cfg.legalRepName);
        setLegalRepTitleState(cfg.legalRepTitle);
        setIssuanceCityState(cfg.issuanceCity);
        setLogoDataUrlState(cfg.logoDataUrl);
        setAccountantNotesState(cfg.accountantNotes);
        lastPersistedJsonRef.current = JSON.stringify(cfg);
      }
      hasLoadedBrandingRef.current = true;
    });
    return () => { active = false; };
  }, [company.id]);

  const currentBrandingPayload = useMemo(
    () => ({
      firmName, preparerName, auditorName, auditorCedula,
      legalRepName, legalRepTitle, issuanceCity, logoDataUrl, accountantNotes
    }),
    [firmName, preparerName, auditorName, auditorCedula, legalRepName, legalRepTitle, issuanceCity, logoDataUrl, accountantNotes]
  );

  useEffect(() => {
    if (isReadOnly || !hasLoadedBrandingRef.current || !isUserDirtyRef.current) return;
    const serialized = JSON.stringify(currentBrandingPayload);
    if (serialized === lastPersistedJsonRef.current) return;
    const timer = setTimeout(() => {
      void saveDeliverableBranding(company.id, currentBrandingPayload, {
        isReadOnly,
        organizationId: company.organizationId ?? null
      }).then(() => {
        lastPersistedJsonRef.current = serialized;
        isUserDirtyRef.current = false;
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [company.id, company.organizationId, currentBrandingPayload, isReadOnly]);

  const setActiveTab = (next: DeliverableTabId) => {
    setActiveTabState(next);
  };

  const handleSaveBranding = async () => {
    if (isReadOnly) return;
    try {
      setIsSavingBranding(true);
      const { savedToCloud } = await saveDeliverableBranding(company.id, currentBrandingPayload, {
        isReadOnly,
        organizationId: company.organizationId ?? null
      });
      lastPersistedJsonRef.current = JSON.stringify(currentBrandingPayload);
      isUserDirtyRef.current = false;
      toast.success(savedToCloud ? 'Membrete y notas guardados en la Nube.' : 'Membrete guardado localmente.');
    } finally {
      setIsSavingBranding(false);
    }
  };

  const {
    data: reportsData, isLoading: isLoadingReports, isError: isErrorReports,
    error: reportsError, refetch: refetchReports
  } = useQuery({
    queryKey: ['reports', company.id, year, period],
    queryFn: () => apiClient.getReports(company.id, year, period),
    enabled: isOpen
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
    const { isrCausado, pagosProvisionalesPrevios, isrRetenidoPeriodo } = fiscalData.isrProvisional;
    const ded = pagosProvisionalesPrevios + isrRetenidoPeriodo;
    return ded > isrCausado ? ded - isrCausado : 0;
  }, [fiscalData]);

  const fechaVencimientoDia17 = useMemo(
    () => calculateDia17Deadline(year, period).formattedSpanish,
    [year, period]
  );

  const isUsingDefaultSignatures = hasAnyDefaultSignature({ firmName, auditorName, auditorCedula, legalRepName });

  const handlePrint = () => window.print();

  const handleExportAllCsv = () => {
    if (!reportsData) return;
    exportAllDeliverablesCsv({
      reportsData, fiscalData, company, year, period, formatVerticalPct,
      hideZeroAccounts, includeBalanza, includeResultados, includeBalance, includeDia17
    });
    toast.success('¡Paquete .ZIP (CSV) de cédulas descargado exitosamente!');
  };

  const handleExportAllXlsx = async () => {
    if (!reportsData || isExporting) return;
    try {
      setIsExporting(true);
      await exportDeliverablesXlsx({
        reportsData, fiscalData, company, year, period, formatVerticalPct,
        extendedStatements, mesNombre, hideZeroAccounts,
        includeBalanza, includeResultados, includeBalance, includeDia17, includeNifAging
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
      company, year, mesNombre, issuanceCity, issuanceDate,
      firmName, auditorName, auditorCedula, legalRepName, legalRepTitle,
      reportsData, fiscalData, formatVerticalPct, accountantNotes
    });
    const copied = await copySummaryToClipboard(summary, 'summary');
    if (copied) toast.success('¡Resumen Ejecutivo formal copiado al portapapeles!');
    else toast.error('No se pudo copiar el resumen al portapapeles.');
  };

  return {
    dialogRef, activeTab, setActiveTab, isExporting, isReadOnly, isSavingBranding, handleSaveBranding,
    firmName, setFirmName, preparerName, setPreparerName,
    auditorName, setAuditorName, auditorCedula, setAuditorCedula,
    legalRepName, setLegalRepName, legalRepTitle, setLegalRepTitle,
    issuanceCity, setIssuanceCity, issuanceDate, setIssuanceDate,
    logoDataUrl, setLogoDataUrl, accountantNotes, setAccountantNotes,
    includeCoverRatios, setIncludeCoverRatios, includeBalanza, setIncludeBalanza,
    includeResultados, setIncludeResultados, includeBalance, setIncludeBalance,
    includeNifAging, setIncludeNifAging, includeDia17, setIncludeDia17,
    hideZeroAccounts, setHideZeroAccounts, selectedDocsCount, copiedSummary,
    reportsData, fiscalData, extendedStatements, agingData,
    isLoadingData, isErrorData, dataError, refetchData, mesNombre, formatVerticalPct,
    isrSaldoNoAplicado, fechaVencimientoDia17, isUsingDefaultSignatures,
    handlePrint, handleExportAllCsv, handleExportAllXlsx, handleCopyExecutiveSummary
  };
}
