import { createPortal } from 'react-dom';
import type { Company } from '../shared/types';
import { DeliverableConfigTab } from './deliverables/DeliverableConfigTab';
import { DeliverableBalanzaDoc } from './deliverables/DeliverableBalanzaDoc';
import { DeliverableResultadosDoc } from './deliverables/DeliverableResultadosDoc';
import { DeliverableBalanceDoc } from './deliverables/DeliverableBalanceDoc';
import { DeliverableDia17Doc } from './deliverables/DeliverableDia17Doc';
import { DeliverableModalHeader } from './deliverables/DeliverableModalHeader';
import { useExecutiveDeliverables } from './deliverables/useExecutiveDeliverables';

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
  const {
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
    mesNombre,
    isrSaldoNoAplicado,
    fechaVencimientoDia17,
    handlePrint,
    handleExportAllCsv,
    handleExportAllXlsx,
    handleCopyExecutiveSummary
  } = useExecutiveDeliverables({ company, year, period, isOpen, onClose, initialTab });

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
