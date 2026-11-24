import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { CfdiInvoicePreviewModal } from './cfdi/preview/CfdiInvoicePreviewModal';
import { CfdiAlertsBanners } from './cfdi/CfdiAlertsBanners';
import { CfdiBatchActionBar } from './cfdi/CfdiBatchActionBar';
import { CfdiContabilizarModal } from './cfdi/CfdiContabilizarModal';
import { CfdiDropzoneBar } from './cfdi/CfdiDropzoneBar';
import { CfdiFilterBar } from './cfdi/CfdiFilterBar';
import { CfdiSimulatorModal } from './cfdi/CfdiSimulatorModal';
import { CfdiTable } from './cfdi/CfdiTable';
import { CfdiXmlViewerModal } from './cfdi/CfdiXmlViewerModal';
import { downloadCfdiXmlFile } from './cfdi/cfdiXmlUploadHelpers';
import { useAddCfdiManager } from './cfdi/useAddCfdiManager';
import { useToast } from '../context/ToastContext';

export function AddCfdiView() {
  const manager = useAddCfdiManager();
  const toast = useToast();

  const {
    activeCompany, activeCompanyId, currentYear, currentPeriod,
    isPeriodLocked, isReadOnlyClient,
    xmlModalRef, contabilizarModalRef, simModalRef, fileInputRef,
    tab, setTab, tipoFilter, setTipoFilter, metodoFilter, setMetodoFilter,
    statusSatFilter, setStatusSatFilter, formaPagoFilter, setFormaPagoFilter,
    searchQuery, setSearchQuery, selectedCfdi,
    operationAccountCode, setOperationAccountCode, counterAccountCode, setCounterAccountCode,
    selectedCfdiIds, setSelectedCfdiIds, previewInvoiceCfdi, setPreviewInvoiceCfdi,
    isDragging, setIsDragging, isUploadingFiles, uploadBatchProgress, isExportingZip, copiedUuid,
    confirmDeleteCfdiId, setConfirmDeleteCfdiId, hasActiveFilters, resetFilters,
    showSoapFielPanel, setShowSoapFielPanel, periodScope, setPeriodScope,
    countInCurrentPeriod, countInCurrentYear, accounts, affectableAccounts, pendingCfdis,
    isLoading, isError, error, refetch, verifyingCfdiId,
    uploadXmlMutation, autoPolizaMutation, deleteCfdiMutation,
    batchContabilizarMutation, batchDeleteMutation, verifySatMutation,
    verifySatBatchMutation, satBatchAlert, dismissSatBatchAlert,
    batchPartialAlert, dismissBatchPartialAlert,
    handleFileUpload, handleDrop, openContabilizarModal, openXmlViewer,
    handleCopyUuid, handleDownloadSelectedXml, previewMovements,
    filteredCfdis, filteredTotals, toggleSelectAll, toggleSelectOne,
    handleExportCsv, handleExportZipSelected, handleSimulateSubmit, onSoapDownloadSuccess, batchProgress,
    scopedCfdis, emitidosCount, recibidosCount
  } = manager;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const el = document.activeElement as HTMLElement | null;
      const activeTag = (el?.tagName || '').toLowerCase();
      const isEditable =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeTag === 'select' ||
        Boolean(el?.isContentEditable);
      if (isEditable) return;

      if (e.key === '/' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.getElementById('add-search')?.focus();
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'u' && !isReadOnlyClient) {
          e.preventDefault();
          fileInputRef.current?.click();
        } else if (key === 's' && !isReadOnlyClient) {
          e.preventDefault();
          if (simModalRef.current && !simModalRef.current.open) {
            simModalRef.current.showModal();
          }
        } else if (key === 'f') {
          e.preventDefault();
          document.getElementById('add-search')?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fileInputRef, simModalRef, isReadOnlyClient]);

  return (
    <div className="space-y-4">
      <CfdiAlertsBanners
        isReadOnlyClient={isReadOnlyClient}
        isPeriodLocked={isPeriodLocked}
        currentPeriod={currentPeriod}
        currentYear={currentYear}
        satBatchAlert={satBatchAlert}
        onLocateCancelled={(alert) => {
          const firstCancelled = alert.alerts[0];
          if (!firstCancelled) return;
          setTab('ALL');
          setPeriodScope('ALL');
          setTipoFilter('ALL');
          setMetodoFilter('ALL');
          setFormaPagoFilter('ALL');
          setStatusSatFilter('CANCELADO_CON_POLIZA');
          setSearchQuery(alert.cancelledWithPolizaCount === 1 ? firstCancelled.uuid : '');
          requestAnimationFrame(() => {
            document.getElementById('cfdi-table-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }}
        onDismissSatBatchAlert={dismissSatBatchAlert}
        batchPartialAlert={batchPartialAlert}
        onDismissBatchPartialAlert={dismissBatchPartialAlert}
      />

      <CfdiDropzoneBar
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        isUploadingFiles={isUploadingFiles}
        uploadBatchProgress={uploadBatchProgress}
        handleDrop={handleDrop}
        fileInputRef={fileInputRef}
        handleFileUpload={handleFileUpload}
        pendingCfdisCount={pendingCfdis.length}
        isPeriodLocked={isPeriodLocked}
        isReadOnlyClient={isReadOnlyClient}
        isBatchContabilizarPending={batchContabilizarMutation.isPending}
        batchProgress={batchProgress}
        onBatchContabilizarPending={() => batchContabilizarMutation.mutate(pendingCfdis.map((c) => c.id))}
        showSoapFielPanel={showSoapFielPanel}
        setShowSoapFielPanel={setShowSoapFielPanel}
        onExportCsv={handleExportCsv}
        onExportZip={() => void handleExportZipSelected()}
        isExportingZip={isExportingZip}
        hasVisibleCfdis={filteredCfdis.length > 0}
        onOpenSimulator={() => {
          if (simModalRef.current && !simModalRef.current.open) {
            simModalRef.current.showModal();
          }
        }}
        activeCompany={activeCompany}
        activeCompanyId={activeCompanyId}
        currentYear={currentYear}
        currentPeriod={currentPeriod}
        onSoapDownloadSuccess={onSoapDownloadSuccess}
      />

      <CfdiBatchActionBar
        selectedCfdiIds={selectedCfdiIds}
        onClearSelection={() => setSelectedCfdiIds(new Set())}
        isBatchContabilizarPending={batchContabilizarMutation.isPending}
        batchProgress={batchProgress}
        onBatchContabilizarSelected={() => batchContabilizarMutation.mutate(Array.from(selectedCfdiIds))}
        isVerifySatBatchPending={verifySatBatchMutation.isPending}
        onVerifySatBatchSelected={() => verifySatBatchMutation.mutate(Array.from(selectedCfdiIds))}
        isExportZipPending={isExportingZip}
        onExportZipSelected={() => void handleExportZipSelected()}
        isBatchDeletePending={batchDeleteMutation.isPending}
        onBatchDeleteSelected={() => batchDeleteMutation.mutate(Array.from(selectedCfdiIds))}
        isPeriodLocked={isPeriodLocked}
        isReadOnlyClient={isReadOnlyClient}
      />

      <CfdiFilterBar
        periodScope={periodScope}
        setPeriodScope={setPeriodScope}
        currentPeriod={currentPeriod}
        currentYear={currentYear}
        countInCurrentPeriod={countInCurrentPeriod}
        totalCfdisCount={scopedCfdis.length}
        allYearCount={countInCurrentYear}
        tab={tab}
        setTab={setTab}
        pendingCount={pendingCfdis.length}
        emitidosCount={emitidosCount}
        recibidosCount={recibidosCount}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        tipoFilter={tipoFilter}
        setTipoFilter={setTipoFilter}
        metodoFilter={metodoFilter}
        setMetodoFilter={setMetodoFilter}
        statusSatFilter={statusSatFilter}
        setStatusSatFilter={setStatusSatFilter}
        formaPagoFilter={formaPagoFilter}
        setFormaPagoFilter={setFormaPagoFilter}
        filteredCount={filteredCfdis.length}
        onResetFilters={resetFilters}
      />

      <div id="cfdi-table-wrapper" className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
        {isError ? (
          <div role="alert" className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto" aria-hidden="true" />
            <p className="text-sm font-bold text-slate-900">Error al cargar la Bóveda Digital ADD</p>
            <p className="text-xs text-slate-600">
              {error instanceof Error ? error.message : 'Error de conexión con el servidor contable.'}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        ) : (
          <CfdiTable
            filteredCfdis={filteredCfdis}
            isLoading={isLoading}
            selectedCfdiIds={selectedCfdiIds}
            toggleSelectAll={toggleSelectAll}
            toggleSelectOne={toggleSelectOne}
            copiedUuid={copiedUuid}
            handleCopyUuid={handleCopyUuid}
            onPreviewInvoice={(cfdi) => setPreviewInvoiceCfdi(cfdi)}
            onOpenContabilizarModal={openContabilizarModal}
            onOpenXmlViewer={openXmlViewer}
            onVerifySat={(id) => verifySatMutation.mutate(id)}
            isVerifySatPending={verifySatMutation.isPending}
            verifyingCfdiId={verifyingCfdiId}
            confirmDeleteCfdiId={confirmDeleteCfdiId}
            setConfirmDeleteCfdiId={setConfirmDeleteCfdiId}
            onConfirmDelete={(id) => deleteCfdiMutation.mutate(id)}
            isDeletePending={deleteCfdiMutation.isPending}
            isPeriodLocked={isPeriodLocked}
            isReadOnlyClient={isReadOnlyClient}
            filteredTotals={filteredTotals}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={resetFilters}
            onOpenSatDownload={() => {
              setShowSoapFielPanel(true);
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  document.getElementById('sat-soap-fiel-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
              });
            }}
            onUploadXmlClick={() => fileInputRef.current?.click()}
          />
        )}
      </div>

      <CfdiInvoicePreviewModal
        cfdi={previewInvoiceCfdi}
        accounts={accounts}
        isPeriodLocked={isPeriodLocked}
        isReadOnlyClient={isReadOnlyClient}
        onClose={() => setPreviewInvoiceCfdi(null)}
        onContabilizar={(cfdi) => openContabilizarModal(cfdi)}
        onDownloadXml={(cfdi) => void downloadCfdiXmlFile(cfdi, toast)}
      />

      <CfdiContabilizarModal
        dialogRef={contabilizarModalRef}
        selectedCfdi={selectedCfdi}
        operationAccountCode={operationAccountCode}
        setOperationAccountCode={setOperationAccountCode}
        counterAccountCode={counterAccountCode}
        setCounterAccountCode={setCounterAccountCode}
        affectableAccounts={affectableAccounts}
        previewMovements={previewMovements}
        isPending={autoPolizaMutation.isPending}
        isPeriodLocked={isPeriodLocked}
        isReadOnlyClient={isReadOnlyClient}
        onClose={() => contabilizarModalRef.current?.close()}
        onConfirm={(opts) => {
          if (selectedCfdi) {
            autoPolizaMutation.mutate({
              cfdiId: selectedCfdi.id,
              operationAccountCode: operationAccountCode || undefined,
              counterAccountCode: counterAccountCode || undefined,
              deductiblePct: opts?.deductiblePct
            });
          }
        }}
      />

      <CfdiXmlViewerModal
        dialogRef={xmlModalRef}
        selectedCfdi={selectedCfdi}
        onDownloadXml={handleDownloadSelectedXml}
        onClose={() => xmlModalRef.current?.close()}
      />

      <CfdiSimulatorModal
        dialogRef={simModalRef}
        activeCompany={activeCompany}
        activeCompanyId={activeCompanyId}
        currentYear={currentYear}
        currentPeriod={currentPeriod}
        onSubmit={handleSimulateSubmit}
        isPending={uploadXmlMutation.isPending}
        onClose={() => simModalRef.current?.close()}
      />
    </div>
  );
}
