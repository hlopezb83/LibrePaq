import { useEffect } from 'react';
import { Lock } from 'lucide-react';
import { CfdiInvoicePreviewModal } from './cfdi/preview/CfdiInvoicePreviewModal';
import { CfdiBatchActionBar } from './cfdi/CfdiBatchActionBar';
import { CfdiContabilizarModal } from './cfdi/CfdiContabilizarModal';
import { CfdiDropzoneBar } from './cfdi/CfdiDropzoneBar';
import { CfdiFilterBar } from './cfdi/CfdiFilterBar';
import { CfdiSimulatorModal } from './cfdi/CfdiSimulatorModal';
import { CfdiTable } from './cfdi/CfdiTable';
import { CfdiXmlViewerModal } from './cfdi/CfdiXmlViewerModal';
import { useAddCfdiManager } from './cfdi/useAddCfdiManager';

export function AddCfdiView() {
  const manager = useAddCfdiManager();

  const {
    activeCompany,
    activeCompanyId,
    currentYear,
    currentPeriod,
    isPeriodLocked,
    xmlModalRef,
    contabilizarModalRef,
    simModalRef,
    fileInputRef,
    tab,
    setTab,
    tipoFilter,
    setTipoFilter,
    metodoFilter,
    setMetodoFilter,
    searchQuery,
    setSearchQuery,
    selectedCfdi,
    operationAccountCode,
    setOperationAccountCode,
    counterAccountCode,
    setCounterAccountCode,
    selectedCfdiIds,
    setSelectedCfdiIds,
    previewInvoiceCfdi,
    setPreviewInvoiceCfdi,
    isDragging,
    setIsDragging,
    copiedUuid,
    confirmDeleteCfdiId,
    setConfirmDeleteCfdiId,
    showSoapFielPanel,
    setShowSoapFielPanel,
    periodScope,
    setPeriodScope,
    cfdis,
    countInCurrentPeriod,
    accounts,
    affectableAccounts,
    pendingCfdis,
    isLoading,
    uploadXmlMutation,
    autoPolizaMutation,
    deleteCfdiMutation,
    batchContabilizarMutation,
    batchDeleteMutation,
    verifySatMutation,
    handleFileUpload,
    handleDrop,
    openContabilizarModal,
    openXmlViewer,
    handleCopyUuid,
    handleDownloadSelectedXml,
    previewMovements,
    filteredCfdis,
    filteredTotals,
    toggleSelectAll,
    toggleSelectOne,
    handleExportCsv,
    handleSimulateSubmit,
    onSoapDownloadSuccess,
    batchProgress,
    scopedCfdis,
    emitidosCount,
    recibidosCount
  } = manager;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          if (key === 'u') {
            e.preventDefault();
            fileInputRef.current?.click();
          } else if (key === 's') {
            e.preventDefault();
            simModalRef.current?.showModal();
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fileInputRef, simModalRef]);

  return (
    <div className="space-y-4">
      {isPeriodLocked && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs shadow-2xs">
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
        handleDrop={handleDrop}
        fileInputRef={fileInputRef}
        handleFileUpload={handleFileUpload}
        pendingCfdisCount={pendingCfdis.length}
        isPeriodLocked={isPeriodLocked}
        isBatchContabilizarPending={batchContabilizarMutation.isPending}
        batchProgress={batchProgress}
        onBatchContabilizarPending={() => batchContabilizarMutation.mutate(pendingCfdis.map((c) => c.id))}
        showSoapFielPanel={showSoapFielPanel}
        setShowSoapFielPanel={setShowSoapFielPanel}
        onExportCsv={handleExportCsv}
        onOpenSimulator={() => simModalRef.current?.showModal()}
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
        isBatchDeletePending={batchDeleteMutation.isPending}
        onBatchDeleteSelected={() => batchDeleteMutation.mutate(Array.from(selectedCfdiIds))}
        isPeriodLocked={isPeriodLocked}
      />

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

      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
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
          confirmDeleteCfdiId={confirmDeleteCfdiId}
          setConfirmDeleteCfdiId={setConfirmDeleteCfdiId}
          onConfirmDelete={(id) => deleteCfdiMutation.mutate(id)}
          isDeletePending={deleteCfdiMutation.isPending}
          isPeriodLocked={isPeriodLocked}
          filteredTotals={filteredTotals}
          onOpenSatDownload={() => {
            setShowSoapFielPanel(true);
            const el = document.getElementById('sat-soap-fiel-section');
            if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
          }}
          onUploadXmlClick={() => fileInputRef.current?.click()}
        />
      </div>

      <CfdiInvoicePreviewModal
        cfdi={previewInvoiceCfdi}
        accounts={accounts}
        onClose={() => setPreviewInvoiceCfdi(null)}
        onContabilizar={(cfdi) => openContabilizarModal(cfdi)}
        onDownloadXml={(cfdi) => {
          const blob = new Blob([cfdi.xmlRaw], { type: 'application/xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `CFDI_${cfdi.serie}_${cfdi.folio}_${cfdi.uuid.slice(0, 8)}.xml`;
          a.click();
          URL.revokeObjectURL(url);
        }}
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
