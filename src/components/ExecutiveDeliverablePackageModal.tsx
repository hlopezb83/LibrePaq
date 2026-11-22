import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../lib/api-client';
import { MESES_SAT } from '../shared/sat-catalog';
import { calculateDia17Deadline } from '../shared/date-utils';
import type { Company } from '../shared/types';
import { DeliverableConfigTab } from './deliverables/DeliverableConfigTab';
import { DeliverableBalanzaDoc } from './deliverables/DeliverableBalanzaDoc';
import { DeliverableResultadosDoc } from './deliverables/DeliverableResultadosDoc';
import { DeliverableBalanceDoc } from './deliverables/DeliverableBalanceDoc';
import { DeliverableDia17Doc } from './deliverables/DeliverableDia17Doc';
import { exportAllDeliverablesCsv } from './deliverables/deliverableCsvExport';
import { exportDeliverablesXlsx } from '../lib/excel-export';
import { generateDeliverableSummaryText } from './deliverables/deliverableSummaryText';
import { DeliverableModalHeader } from './deliverables/DeliverableModalHeader';
import { useDialogLightDismiss } from '../hooks/useDialogLightDismiss';

export interface ExecutiveDeliverablePackageModalProps {
  company: Company;
  year: number;
  period: number;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'DOSSIER' | 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'DIA17' | 'CONFIG';
}

export function ExecutiveDeliverablePackageModal({
  company,
  year,
  period,
  isOpen,
  onClose,
  initialTab = 'DOSSIER'
}: ExecutiveDeliverablePackageModalProps) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogLightDismiss(dialogRef, onClose);

  const [activeTab, setActiveTab] = useState<
    'DOSSIER' | 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'DIA17' | 'CONFIG'
  >(initialTab);
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

  const [firmName, setFirmName] = useState('Despacho Contable y Fiscal Integral S.C.');
  const [auditorName, setAuditorName] = useState('C.P.C. María Elena Gómez Garza');
  const [auditorCedula, setAuditorCedula] = useState('Céd. Prof. 4829103');
  const [legalRepName, setLegalRepName] = useState('Ing. Alejandro Garza Martínez');
  const [legalRepTitle, setLegalRepTitle] = useState('Representante Legal');
  const [issuanceCity, setIssuanceCity] = useState('Monterrey, Nuevo León');
  const [issuanceDate, setIssuanceDate] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  const [includeBalanza, setIncludeBalanza] = useState(true);
  const [includeResultados, setIncludeResultados] = useState(true);
  const [includeBalance, setIncludeBalance] = useState(true);
  const [includeDia17, setIncludeDia17] = useState(true);

  const [copiedSummary, setCopiedSummary] = useState(false);

  const { data: reportsData } = useQuery({
    queryKey: ['reports', company.id, year, period],
    queryFn: () => apiClient.getReports(company.id, year, period),
    enabled: isOpen
  });

  const { data: fiscalData } = useQuery({
    queryKey: ['fiscal-workpaper', company.id, year, period],
    queryFn: () => apiClient.getFiscalWorkpaper(company.id, year, period),
    enabled: isOpen
  });

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
    } catch {
      handleExportAllCsv();
    } finally {
      setIsExporting(false);
    }
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

    try {
      await navigator.clipboard.writeText(summary);
      setCopiedSummary(true);
      toast.success('¡Resumen Ejecutivo formal copiado al portapapeles!');
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch {
      toast.error('No se pudo copiar el resumen');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      id="executive-deliverable-modal"
      closedby="any"
      onClose={onClose}
      aria-labelledby="executive-deliverables-title"
      className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-6xl max-h-[92dvh] flex flex-col overflow-hidden backdrop:bg-slate-900/75 p-0 m-auto printable-modal-dialog"
    >
      <DeliverableModalHeader
        company={company}
        mesNombre={mesNombre}
        year={year}
        copiedSummary={copiedSummary}
        onCopySummary={handleCopyExecutiveSummary}
        onExportXlsx={handleExportAllXlsx}
        isExporting={isExporting}
        onExportCsv={handleExportAllCsv}
        onPrint={handlePrint}
        onClose={onClose}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60 scrollable-panel printable-dossier">
          {activeTab === 'CONFIG' && (
            <DeliverableConfigTab
              firmName={firmName}
              setFirmName={setFirmName}
              issuanceCity={issuanceCity}
              setIssuanceCity={setIssuanceCity}
              issuanceDate={issuanceDate}
              setIssuanceDate={setIssuanceDate}
              auditorName={auditorName}
              setAuditorName={setAuditorName}
              auditorCedula={auditorCedula}
              setAuditorCedula={setAuditorCedula}
              legalRepName={legalRepName}
              setLegalRepName={setLegalRepName}
              legalRepTitle={legalRepTitle}
              setLegalRepTitle={setLegalRepTitle}
              includeBalanza={includeBalanza}
              setIncludeBalanza={setIncludeBalanza}
              includeResultados={includeResultados}
              setIncludeResultados={setIncludeResultados}
              includeBalance={includeBalance}
              setIncludeBalance={setIncludeBalance}
              includeDia17={includeDia17}
              setIncludeDia17={setIncludeDia17}
              onPreviewDossier={() => setActiveTab('DOSSIER')}
            />
          )}

          {((activeTab === 'DOSSIER' && includeBalanza) || activeTab === 'BALANZA') && reportsData && (
            <DeliverableBalanzaDoc
              company={company}
              year={year}
              period={period}
              mesNombre={mesNombre}
              firmName={firmName}
              issuanceDate={issuanceDate}
              trialBalance={reportsData.trialBalance}
              totals={reportsData.totals}
              auditorName={auditorName}
              auditorCedula={auditorCedula}
              legalRepName={legalRepName}
              legalRepTitle={legalRepTitle}
            />
          )}

          {((activeTab === 'DOSSIER' && includeResultados) || activeTab === 'RESULTADOS') && reportsData && (
            <DeliverableResultadosDoc
              company={company}
              year={year}
              period={period}
              mesNombre={mesNombre}
              firmName={firmName}
              issuanceDate={issuanceDate}
              incomeStatement={reportsData.incomeStatement}
              auditorName={auditorName}
              auditorCedula={auditorCedula}
              legalRepName={legalRepName}
              legalRepTitle={legalRepTitle}
            />
          )}

          {((activeTab === 'DOSSIER' && includeBalance) || activeTab === 'BALANCE') && reportsData && (
            <DeliverableBalanceDoc
              company={company}
              year={year}
              period={period}
              mesNombre={mesNombre}
              firmName={firmName}
              issuanceDate={issuanceDate}
              balanceSheet={reportsData.balanceSheet}
              auditorName={auditorName}
              auditorCedula={auditorCedula}
              legalRepName={legalRepName}
              legalRepTitle={legalRepTitle}
            />
          )}

          {((activeTab === 'DOSSIER' && includeDia17) || activeTab === 'DIA17') && fiscalData && (
            <DeliverableDia17Doc
              company={company}
              year={year}
              period={period}
              mesNombre={mesNombre}
              firmName={firmName}
              issuanceDate={issuanceDate}
              fechaVencimientoDia17={fechaVencimientoDia17}
              fiscalData={fiscalData}
              isrSaldoNoAplicado={isrSaldoNoAplicado}
              auditorName={auditorName}
              auditorCedula={auditorCedula}
              legalRepName={legalRepName}
              legalRepTitle={legalRepTitle}
            />
          )}
        </div>
    </dialog>,
    document.body
  );
}
