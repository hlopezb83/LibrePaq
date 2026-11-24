import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import type { Company } from '../../shared/types';
import { DeliverableConfigTab } from './DeliverableConfigTab';
import { DeliverableCoverAndRatiosDoc } from './DeliverableCoverAndRatiosDoc';
import { DeliverableBalanzaDoc } from './DeliverableBalanzaDoc';
import { DeliverableResultadosDoc } from './DeliverableResultadosDoc';
import { DeliverableBalanceDoc } from './DeliverableBalanceDoc';
import { DeliverableNifSummaryDoc } from './DeliverableNifSummaryDoc';
import { DeliverableDia17Doc } from './DeliverableDia17Doc';
import { DeliverableModalHeader } from './DeliverableModalHeader';
import { DEFAULT_DELIVERABLE_CONFIG, useExecutiveDeliverables } from './useExecutiveDeliverables';

export interface ExecutiveDeliverablePackageModalProps {
  company: Company;
  year: number;
  period: number;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'DOSSIER' | 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'DIA17' | 'CONFIG';
}

export function ExecutiveDeliverablePackageModal({
  company, year, period, isOpen, onClose, initialTab = 'DOSSIER'
}: ExecutiveDeliverablePackageModalProps) {
  const d = useExecutiveDeliverables({ company, year, period, isOpen, onClose, initialTab });

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const defaultFields: string[] = [];
  if (d.firmName === DEFAULT_DELIVERABLE_CONFIG.firmName) defaultFields.push('Firma Contable');
  if (d.auditorName.includes('María Elena Gómez Garza')) defaultFields.push('Contador/Auditor');
  if (d.auditorCedula.includes('4829103')) defaultFields.push('Cédula Profesional');
  if (d.legalRepName.includes('Alejandro Garza Martínez')) defaultFields.push('Representante Legal');

  const sigProps = {
    firmName: d.firmName,
    preparerName: d.preparerName,
    logoDataUrl: d.logoDataUrl,
    issuanceCity: d.issuanceCity,
    issuanceDate: d.issuanceDate,
    auditorName: d.auditorName,
    auditorCedula: d.auditorCedula,
    legalRepName: d.legalRepName,
    legalRepTitle: d.legalRepTitle
  };

  const quickToggles = [
    { id: 'quick-cover', label: 'Portada / Razones Financieras', checked: d.includeCoverRatios, set: d.setIncludeCoverRatios },
    { id: 'quick-balanza', label: 'Balanza', checked: d.includeBalanza, set: d.setIncludeBalanza },
    { id: 'quick-resultados', label: 'Resultados', checked: d.includeResultados, set: d.setIncludeResultados },
    { id: 'quick-balance', label: 'Balance', checked: d.includeBalance, set: d.setIncludeBalance },
    { id: 'quick-nif', label: 'NIF B-2/B-4 y Antigüedad', checked: d.includeNifAging, set: d.setIncludeNifAging },
    { id: 'quick-dia17', label: 'Día 17', checked: d.includeDia17, set: d.setIncludeDia17 }
  ];

  return createPortal(
    <dialog
      ref={d.dialogRef}
      id="executive-deliverable-modal"
      closedby="any"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      aria-labelledby="executive-deliverables-title"
      className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] max-w-6xl max-h-[92dvh] flex flex-col overflow-hidden backdrop:bg-slate-900/75 p-0 inset-0 mx-auto my-auto printable-modal-dialog"
    >
      <DeliverableModalHeader
        company={company}
        mesNombre={d.mesNombre}
        year={year}
        copiedSummary={d.copiedSummary}
        isDataReady={Boolean(d.reportsData)}
        selectedDocsCount={d.selectedDocsCount}
        onCopySummary={d.handleCopyExecutiveSummary}
        onExportXlsx={d.handleExportAllXlsx}
        isExporting={d.isExporting}
        onExportCsv={d.handleExportAllCsv}
        onPrint={d.handlePrint}
        onClose={onClose}
        activeTab={d.activeTab}
        setActiveTab={d.setActiveTab}
      />

      <div
        role="tabpanel"
        id={`deliv-panel-${d.activeTab}`}
        aria-labelledby={`deliv-tab-${d.activeTab}`}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 bg-slate-100/60 scrollable-panel printable-dossier"
      >
        {d.isUsingDefaultSignatures && d.activeTab !== 'CONFIG' && (
          <div role="status" className="max-w-5xl mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 shadow-2xs no-print">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
              <span>
                Los entregables aún usan valores de ejemplo en:{' '}
                <strong>{defaultFields.length > 0 ? defaultFields.join(', ') : d.auditorName}</strong>.
                {!d.isReadOnly && ' Personalízalos antes de imprimir o enviar al cliente.'}
              </span>
            </div>
            {!d.isReadOnly && (
              <button type="button" onClick={() => d.setActiveTab('CONFIG')} className="px-3 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition cursor-pointer shrink-0">
                Personalizar firmas
              </button>
            )}
          </div>
        )}

        {d.isErrorData && d.activeTab !== 'CONFIG' && (
          <div role="alert" className="max-w-lg mx-auto my-8 p-6 bg-white rounded-2xl border border-red-200 text-center space-y-3 shadow-xs">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">No se pudieron calcular los entregables del periodo</h2>
            <p className="text-xs text-slate-600">{d.dataError instanceof Error ? d.dataError.message : 'Error de conexión al servidor contable.'}</p>
            <button type="button" onClick={d.refetchData} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Reintentar
            </button>
          </div>
        )}

        {!d.isErrorData && d.isLoadingData && d.activeTab !== 'CONFIG' && (
          <div role="status" aria-live="polite" aria-busy="true" className="max-w-lg mx-auto my-8 p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-500 shadow-xs">
            Calculando estados financieros y cédula Día 17 para impresión...
          </div>
        )}

        {d.activeTab === 'DOSSIER' && !d.isErrorData && !d.isLoadingData && (
          <div className="max-w-5xl mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs shadow-2xs no-print">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-slate-800">Secciones ({d.selectedDocsCount}/6):</span>
              {quickToggles.map((doc) => (
                <label key={doc.id} htmlFor={doc.id} className="inline-flex items-center gap-1.5 cursor-pointer select-none text-slate-700">
                  <input id={doc.id} type="checkbox" checked={doc.checked} onChange={(e) => doc.set(e.target.checked)} className="rounded text-blue-700" />
                  <span>{doc.label}</span>
                </label>
              ))}
            </div>
            <label htmlFor="quick-hide-zero" className="inline-flex items-center gap-1.5 cursor-pointer select-none text-slate-700 font-medium">
              <input id="quick-hide-zero" type="checkbox" checked={d.hideZeroAccounts} onChange={(e) => d.setHideZeroAccounts(e.target.checked)} className="rounded text-blue-700" />
              <span>Ocultar $0.00</span>
            </label>
          </div>
        )}

        {d.activeTab === 'DOSSIER' && !d.isErrorData && !d.isLoadingData && d.selectedDocsCount === 0 && (
          <div className="max-w-lg mx-auto my-8 p-6 bg-white rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
            <p className="text-xs text-slate-600">No hay documentos seleccionados para el dossier de cierre.</p>
            <button type="button" onClick={() => d.setActiveTab('CONFIG')} className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer">
              Ir a Firmas y Membrete
            </button>
          </div>
        )}

        {d.activeTab === 'CONFIG' && (
          <DeliverableConfigTab
            firmName={d.firmName} setFirmName={d.setFirmName}
            preparerName={d.preparerName} setPreparerName={d.setPreparerName}
            issuanceCity={d.issuanceCity} setIssuanceCity={d.setIssuanceCity}
            issuanceDate={d.issuanceDate} setIssuanceDate={d.setIssuanceDate}
            auditorName={d.auditorName} setAuditorName={d.setAuditorName}
            auditorCedula={d.auditorCedula} setAuditorCedula={d.setAuditorCedula}
            legalRepName={d.legalRepName} setLegalRepName={d.setLegalRepName}
            legalRepTitle={d.legalRepTitle} setLegalRepTitle={d.setLegalRepTitle}
            logoDataUrl={d.logoDataUrl} setLogoDataUrl={d.setLogoDataUrl}
            accountantNotes={d.accountantNotes} setAccountantNotes={d.setAccountantNotes}
            includeCoverRatios={d.includeCoverRatios} setIncludeCoverRatios={d.setIncludeCoverRatios}
            includeBalanza={d.includeBalanza} setIncludeBalanza={d.setIncludeBalanza}
            includeResultados={d.includeResultados} setIncludeResultados={d.setIncludeResultados}
            includeBalance={d.includeBalance} setIncludeBalance={d.setIncludeBalance}
            includeNifAging={d.includeNifAging} setIncludeNifAging={d.setIncludeNifAging}
            includeDia17={d.includeDia17} setIncludeDia17={d.setIncludeDia17}
            hideZeroAccounts={d.hideZeroAccounts} setHideZeroAccounts={d.setHideZeroAccounts}
            isReadOnly={d.isReadOnly} isSavingBranding={d.isSavingBranding}
            onSaveBranding={d.handleSaveBranding}
            onPreviewDossier={() => d.setActiveTab('DOSSIER')}
          />
        )}

        {d.activeTab === 'DOSSIER' && d.includeCoverRatios && d.reportsData && (
          <DeliverableCoverAndRatiosDoc
            company={company} year={year} period={period} mesNombre={d.mesNombre}
            accountantNotes={d.accountantNotes}
            reportsData={d.reportsData} fiscalData={d.fiscalData}
            {...sigProps}
          />
        )}

        {((d.activeTab === 'DOSSIER' && d.includeBalanza) || d.activeTab === 'BALANZA') && d.reportsData && (
          <DeliverableBalanzaDoc
            company={company} year={year} period={period} mesNombre={d.mesNombre}
            hideZeroAccounts={d.hideZeroAccounts}
            trialBalance={d.reportsData.trialBalance} totals={d.reportsData.totals}
            {...sigProps}
          />
        )}

        {((d.activeTab === 'DOSSIER' && d.includeResultados) || d.activeTab === 'RESULTADOS') && d.reportsData && (
          <DeliverableResultadosDoc
            company={company} year={year} period={period} mesNombre={d.mesNombre}
            hideZeroAccounts={d.hideZeroAccounts}
            incomeStatement={d.reportsData.incomeStatement}
            {...sigProps}
          />
        )}

        {((d.activeTab === 'DOSSIER' && d.includeBalance) || d.activeTab === 'BALANCE') && d.reportsData && (
          <DeliverableBalanceDoc
            company={company} year={year} period={period} mesNombre={d.mesNombre}
            hideZeroAccounts={d.hideZeroAccounts}
            balanceSheet={d.reportsData.balanceSheet}
            {...sigProps}
          />
        )}

        {d.activeTab === 'DOSSIER' && d.includeNifAging && d.extendedStatements && (
          <DeliverableNifSummaryDoc
            company={company} year={year} period={period} mesNombre={d.mesNombre}
            extendedStatements={d.extendedStatements} agingData={d.agingData}
            {...sigProps}
          />
        )}

        {((d.activeTab === 'DOSSIER' && d.includeDia17) || d.activeTab === 'DIA17') && d.fiscalData && (
          <DeliverableDia17Doc
            company={company} year={year} period={period} mesNombre={d.mesNombre}
            fechaVencimientoDia17={d.fechaVencimientoDia17}
            fiscalData={d.fiscalData} isrSaldoNoAplicado={d.isrSaldoNoAplicado}
            {...sigProps}
          />
        )}
      </div>
    </dialog>,
    document.body
  );
}
