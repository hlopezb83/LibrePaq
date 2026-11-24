import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '../components/ui';
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
import {
  collectCancelledWithPolizaTargets,
  reverseCancelledCfdiPolizas
} from './cfdi/reverseCancelledCfdiPoliza';
import { useAddCfdiManager } from './cfdi/useAddCfdiManager';
import { useToast } from '../context/ToastContext';

export function AddCfdiView() {
  const manager = useAddCfdiManager();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isReversingCancelled, setIsReversingCancelled] = useState(false);
  const [dismissedCancelledIds, setDismissedCancelledIds] = useState<Set<string>>(() => new Set());

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
    cfdis, countInCurrentPeriod, countInCurrentYear, accounts, affectableAccounts, pendingCfdis,
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
      const tag = (el?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return;

      if (e.key === '/' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.getElementById('add-search')?.focus();
      } else if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'u' && !isReadOnlyClient) {
          e.preventDefault();
          fileInputRef.current?.click();
        } else if (key === 's' && !isReadOnlyClient) {
          e.preventDefault();
          if (simModalRef.current && !simModalRef.current.open) simModalRef.current.showModal();
        } else if (key === 'f') {
          e.preventDefault();
          document.getElementById('add-search')?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fileInputRef, simModalRef, isReadOnlyClient]);

  useEffect(() => {
    setDismissedCancelledIds(new Set());
  }, [activeCompanyId]);

  const cancelledWithPolizaCfdis = collectCancelledWithPolizaTargets({
    scopedCfdis,
    allCfdis: cfdis,
    satBatchAlerts: satBatchAlert?.alerts,
    dismissedIds: dismissedCancelledIds
  });

  const handleDismissCancelledAlert = () => {
    setDismissedCancelledIds((prev) => {
      const next = new Set(prev);
      for (const c of cancelledWithPolizaCfdis) next.add(c.id);
      return next;
    });
    dismissSatBatchAlert();
  };

  const handleReverseCancelledPoliza = async () => {
    if (isReversingCancelled || cancelledWithPolizaCfdis.length === 0) return;
    setIsReversingCancelled(true);
    try {
      await reverseCancelledCfdiPolizas({
        companyId: activeCompanyId, currentYear, currentPeriod, isPeriodLocked, isReadOnlyClient,
        targetCfdis: cancelledWithPolizaCfdis, queryClient, toast
      });
      handleDismissCancelledAlert();
    } catch (err: unknown) {
      toast.error('Error al revertir póliza', err instanceof Error ? err.message : String(err));
    } finally {
      setIsReversingCancelled(false);
    }
  };

  const handleLocateCancelled = (alert: NonNullable<typeof satBatchAlert>) => {
    const firstCancelled = alert.alerts[0];
    if (!firstCancelled) return;
    resetFilters();
    setPeriodScope('ALL');
    setStatusSatFilter('CANCELADO_CON_POLIZA');
    setSearchQuery(alert.cancelledWithPolizaCount === 1 ? firstCancelled.uuid : '');
    requestAnimationFrame(() => {
      document.getElementById('cfdi-table-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="space-y-4">
      <CfdiAlertsBanners
        isReadOnlyClient={isReadOnlyClient}
        isPeriodLocked={isPeriodLocked}
        currentPeriod={currentPeriod}
        currentYear={currentYear}
        satBatchAlert={satBatchAlert}
        cancelledWithPolizaCount={cancelledWithPolizaCfdis.length}
        isReversingCancelled={isReversingCancelled}
        onReverseCancelledPoliza={() => void handleReverseCancelledPoliza()}
        onDismissCancelledAlert={handleDismissCancelledAlert}
        onLocateCancelled={handleLocateCancelled}
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
        tab={tab}
        setTab={setTab}
        totalCfdisCount={scopedCfdis.length}
        emitidosCount={emitidosCount}
        recibidosCount={recibidosCount}
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
          <div role="alert">
            <EmptyState
              tone="red"
              icon={<AlertCircle className="w-6 h-6" aria-hidden="true" />}
              title="Error al cargar la Bóveda Digital ADD"
              description={error instanceof Error ? error.message : 'Error de conexión con el servidor contable.'}
              actions={
                <Button variant="primary" onClick={() => void refetch()} leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}>
                  Reintentar
                </Button>
              }
            />
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
            periodScope={periodScope}
            currentYear={currentYear}
            countInCurrentYear={countInCurrentYear}
            onViewAllYear={() => setPeriodScope('ALL')}
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
