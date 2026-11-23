import { useEffect } from 'react';
import { AlertCircle, Lock, RefreshCw } from 'lucide-react';
import { CfdiInvoicePreviewModal } from './cfdi/preview/CfdiInvoicePreviewModal';
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
    searchQuery, setSearchQuery, selectedCfdi,
    operationAccountCode, setOperationAccountCode, counterAccountCode, setCounterAccountCode,
    selectedCfdiIds, setSelectedCfdiIds, previewInvoiceCfdi, setPreviewInvoiceCfdi,
    isDragging, setIsDragging, isUploadingFiles, copiedUuid,
    confirmDeleteCfdiId, setConfirmDeleteCfdiId, hasActiveFilters, resetFilters,
    showSoapFielPanel, setShowSoapFielPanel, periodScope, setPeriodScope,
    cfdis, countInCurrentPeriod, accounts, affectableAccounts, pendingCfdis,
    isLoading, isError, error, refetch, verifyingCfdiId,
    uploadXmlMutation, autoPolizaMutation, deleteCfdiMutation,
    batchContabilizarMutation, batchDeleteMutation, verifySatMutation,
    verifySatBatchMutation, satBatchAlert, dismissSatBatchAlert,
    handleFileUpload, handleDrop, openContabilizarModal, openXmlViewer,
    handleCopyUuid, handleDownloadSelectedXml, previewMovements,
    filteredCfdis, filteredTotals, toggleSelectAll, toggleSelectOne,
    handleExportCsv, handleSimulateSubmit, onSoapDownloadSuccess, batchProgress,
    scopedCfdis, emitidosCount, recibidosCount
  } = manager;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
      {isPeriodLocked && (
        <div
          role="status"
          className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs shadow-2xs"
        >
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="font-bold text-sm block text-amber-950">
              Periodo Fiscal P{String(currentPeriod).padStart(2, '0')}/{currentYear} Bloqueado ante el SAT
            </span>
            <p className="text-amber-800 leading-relaxed">
              La contabilización y eliminación de comprobantes CFDI en este mes se encuentran deshabilitadas para proteger la declaración presentada ante el SAT.
            </p>
          </div>
        </div>
      )}

      <CfdiDropzoneBar
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        isUploadingFiles={isUploadingFiles}
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
        isBatchDeletePending={batchDeleteMutation.isPending}
        onBatchDeleteSelected={() => batchDeleteMutation.mutate(Array.from(selectedCfdiIds))}
        isPeriodLocked={isPeriodLocked}
        isReadOnlyClient={isReadOnlyClient}
      />

      {satBatchAlert && satBatchAlert.cancelledWithPolizaCount > 0 && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 rounded-2xl p-4 flex items-start justify-between gap-3 text-red-950 text-xs shadow-2xs"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5">
              <span className="font-bold text-sm block text-red-950">
                Alerta SAT: {satBatchAlert.cancelledWithPolizaCount}{' '}
                {satBatchAlert.cancelledWithPolizaCount === 1
                  ? 'factura cancelada aún tiene póliza contable registrada'
                  : 'facturas canceladas aún tienen póliza contable registrada'}
              </span>
              <p className="text-red-800 leading-relaxed">
                De {satBatchAlert.checkedCount} comprobantes validados ante el SAT,{' '}
                <strong>{satBatchAlert.cancelledWithPolizaCount}</strong> están cancelados y mantienen póliza contable activa. Revísalos y revierte las pólizas afectadas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissSatBatchAlert}
            aria-label="Ocultar alerta de facturas canceladas con póliza"
            className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 font-semibold cursor-pointer shrink-0 transition"
          >
            Ocultar
          </button>
        </div>
      )}

      <CfdiFilterBar
        periodScope={periodScope}
        setPeriodScope={setPeriodScope}
        currentPeriod={currentPeriod}
        currentYear={currentYear}
        countInCurrentPeriod={countInCurrentPeriod}
        totalCfdisCount={scopedCfdis.length}
        allYearCount={cfdis.length}
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
        filteredCount={filteredCfdis.length}
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
              const el = document.getElementById('sat-soap-fiel-section');
              if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
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
        onConfirm={() => {
          if (selectedCfdi) {
            autoPolizaMutation.mutate({
              cfdiId: selectedCfdi.id,
              operationAccountCode: operationAccountCode || undefined,
              counterAccountCode: counterAccountCode || undefined
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
