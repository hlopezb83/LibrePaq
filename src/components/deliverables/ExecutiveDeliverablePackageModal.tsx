import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import type { Company } from '../../shared/types';
import { DeliverableConfigTab } from './DeliverableConfigTab';
import { DeliverableBalanzaDoc } from './DeliverableBalanzaDoc';
import { DeliverableResultadosDoc } from './DeliverableResultadosDoc';
import { DeliverableBalanceDoc } from './DeliverableBalanceDoc';
import { DeliverableDia17Doc } from './DeliverableDia17Doc';
import { DeliverableModalHeader } from './DeliverableModalHeader';
import { useExecutiveDeliverables } from './useExecutiveDeliverables';

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
    isLoadingData,
    isErrorData,
    dataError,
    refetchData,
    mesNombre,
    isrSaldoNoAplicado,
    fechaVencimientoDia17,
    isUsingDefaultSignatures,
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
      className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] max-w-6xl max-h-[92dvh] flex flex-col overflow-hidden backdrop:bg-slate-900/75 p-0 inset-0 mx-auto my-auto printable-modal-dialog"
    >
      <DeliverableModalHeader
        company={company}
        mesNombre={mesNombre}
        year={year}
        copiedSummary={copiedSummary}
        isDataReady={Boolean(reportsData)}
        onCopySummary={handleCopyExecutiveSummary}
        onExportXlsx={handleExportAllXlsx}
        isExporting={isExporting}
        onExportCsv={handleExportAllCsv}
        onPrint={handlePrint}
        onClose={onClose}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <div
        role="tabpanel"
        id={`deliv-panel-${activeTab}`}
        aria-labelledby={`deliv-tab-${activeTab}`}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 bg-slate-100/60 scrollable-panel printable-dossier"
      >
        {isUsingDefaultSignatures && activeTab !== 'CONFIG' && (
          <div
            role="status"
            className="max-w-5xl mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 shadow-2xs no-print"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
              <span>
                Los entregables muestran firmas y cédula profesional de ejemplo (
                <strong>{auditorName}</strong>). Personalízalas antes de imprimir o enviar al cliente.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('CONFIG')}
              className="px-3 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition cursor-pointer shrink-0"
            >
              Personalizar firmas
            </button>
          </div>
        )}

        {isErrorData && activeTab !== 'CONFIG' && (
          <div
            role="alert"
            className="max-w-lg mx-auto my-8 p-6 bg-white rounded-2xl border border-red-200 text-center space-y-3 shadow-xs"
          >
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">
              No se pudieron calcular los entregables del periodo
            </h2>
            <p className="text-xs text-slate-600">
              {dataError instanceof Error ? dataError.message : 'Error de conexión al servidor contable.'}
            </p>
            <button
              type="button"
              onClick={refetchData}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        )}

        {!isErrorData && isLoadingData && activeTab !== 'CONFIG' && (
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="max-w-lg mx-auto my-8 p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-500 shadow-xs"
          >
            Calculando estados financieros y cédula Día 17 para impresión...
          </div>
        )}

        {activeTab === 'DOSSIER' &&
          !isErrorData &&
          !isLoadingData &&
          !includeBalanza &&
          !includeResultados &&
          !includeBalance &&
          !includeDia17 && (
            <div className="max-w-lg mx-auto my-8 p-6 bg-white rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
              <p className="text-xs text-slate-600">
                No hay documentos seleccionados para el dossier de cierre.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('CONFIG')}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Ir a Firmas y Membrete
              </button>
            </div>
          )}
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
