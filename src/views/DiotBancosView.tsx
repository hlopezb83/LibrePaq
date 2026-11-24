import { useUIModal } from '../context/UIModalContext';
import { FiscalBancosTabBar } from './fiscal-bancos/FiscalBancosTabBar';
import { ConciliacionBancosTab } from './fiscal-bancos/ConciliacionBancosTab';
import { DiotDeclaracionTab } from './fiscal-bancos/DiotDeclaracionTab';
import { PadronProveedoresTab } from './fiscal-bancos/PadronProveedoresTab';
import { ActivosFijosTab } from './fiscal-bancos/ActivosFijosTab';
import { PapelDia17Tab } from './fiscal-bancos/PapelDia17Tab';
import { CxcCxpTab } from './fiscal-bancos/CxcCxpTab';
import { NominaImssTab } from './fiscal-bancos/NominaImssTab';
import { InventarioCostoTab } from './fiscal-bancos/InventarioCostoTab';
import { useDiotBancosManager } from './fiscal-bancos/useDiotBancosManager';

export function DiotBancosView() {
  const { openLedger, openDeliverables } = useUIModal();
  const {
    activeCompanyId,
    currentYear,
    currentPeriod,
    addBankModalRef,
    csvInputRef,
    toast,
    activeTab,
    setActiveTab,
    classifySupplierRequest,
    setClassifySupplierRequest,
    setSelectedBankId,
    copiedBatch,
    setCopiedBatch,
    bFecha,
    setBFecha,
    bRef,
    setBRef,
    bDesc,
    setBDesc,
    bTipo,
    setBTipo,
    bMonto,
    setBMonto,
    accounts,
    bankAccounts,
    effectiveBankId,
    reconData,
    isLoadingRecon,
    isErrorRecon,
    errorRecon,
    refetchRecon,
    diotData,
    isLoadingDiot,
    isErrorDiot,
    refetchDiot,
    isPeriodLocked,
    isReadOnlyClient,
    autoMatchMutation,
    createPolizaFromBankMutation,
    unmatchBankLineMutation,
    addBankLineMutation,
    activeBankLineId,
    isCsvUploading,
    handleCsvUpload,
    handleDownloadDiotTxt,
    handleExportDiotCsv,
    reconFormula,
    handleAddBankLineSubmit
  } = useDiotBancosManager();

  const handleFeedback = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'error') toast.error(msg);
    else toast.success(msg);
  };

  return (
    <div className="space-y-4">
      {/* Encabezado del Módulo y Pestañas */}
      <div className="fb-tabbar-shell">
        <FiscalBancosTabBar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* PESTAÑA 1: CONCILIACIÓN BANCARIA */}
      {activeTab === 'CONCILIACION' && (
        <div role="tabpanel" id="fb-panel-CONCILIACION" aria-labelledby="fb-tab-CONCILIACION">
          <ConciliacionBancosTab
            effectiveBankId={effectiveBankId}
            setSelectedBankId={setSelectedBankId}
            bankAccounts={bankAccounts}
            onOpenLedger={openLedger}
            csvInputRef={csvInputRef}
            onCsvUpload={handleCsvUpload}
            isCsvUploading={isCsvUploading}
            isPeriodLocked={isPeriodLocked}
            isReadOnlyClient={isReadOnlyClient}
            addBankModalRef={addBankModalRef}
            onAutoMatch={() => autoMatchMutation.mutate()}
            isAutoMatchPending={autoMatchMutation.isPending}
            isLoadingRecon={isLoadingRecon}
            isErrorRecon={isErrorRecon}
            errorRecon={errorRecon}
            onRetryRecon={() => void refetchRecon()}
            reconData={reconData}
            reconFormula={reconFormula}
            onCreatePolizaFromBank={(id) => createPolizaFromBankMutation.mutate(id)}
            isCreatePolizaPending={createPolizaFromBankMutation.isPending}
            onUnmatchBankLine={(id) => unmatchBankLineMutation.mutate(id)}
            isUnmatchPending={unmatchBankLineMutation.isPending}
            activeBankLineId={activeBankLineId}
            bFecha={bFecha}
            setBFecha={setBFecha}
            bRef={bRef}
            setBRef={setBRef}
            bDesc={bDesc}
            setBDesc={setBDesc}
            bTipo={bTipo}
            setBTipo={setBTipo}
            bMonto={bMonto}
            setBMonto={setBMonto}
            onAddBankLineSubmit={handleAddBankLineSubmit}
            isAddBankLinePending={addBankLineMutation.isPending}
          />
        </div>
      )}

      {/* PESTAÑA 2: DECLARACIÓN DIOT */}
      {activeTab === 'DIOT' && (
        <div role="tabpanel" id="fb-panel-DIOT" aria-labelledby="fb-tab-DIOT">
          <DiotDeclaracionTab
            isLoadingDiot={isLoadingDiot}
            diotData={diotData}
            isErrorDiot={isErrorDiot}
            onRetryDiot={() => void refetchDiot()}
            onExportDiotCsv={handleExportDiotCsv}
            onDownloadDiotTxt={handleDownloadDiotTxt}
            copiedBatch={copiedBatch}
            setCopiedBatch={setCopiedBatch}
            onClassifySupplier={(row) => {
              setClassifySupplierRequest({
                rfc: row.rfc,
                nombre: row.nombre,
                tipoTercero: row.tipoTercero === '05' || row.tipoTercero === '15' ? row.tipoTercero : '04',
                tipoOperacion: row.tipoOperacion === '06' || row.tipoOperacion === '85' ? row.tipoOperacion : '03'
              });
              setActiveTab('PADRON_RFC');
            }}
          />
        </div>
      )}

      {/* PESTAÑA 3: PADRÓN PROVEEDORES RFC & 69-B */}
      {activeTab === 'PADRON_RFC' && (
        <div role="tabpanel" id="fb-panel-PADRON_RFC" aria-labelledby="fb-tab-PADRON_RFC">
          <PadronProveedoresTab
            companyId={activeCompanyId}
            accounts={accounts}
            isReadOnlyClient={isReadOnlyClient}
            onFeedback={handleFeedback}
            initialRfcToClassify={classifySupplierRequest}
            onClearInitialClassify={() => setClassifySupplierRequest(null)}
          />
        </div>
      )}

      {/* PESTAÑA 4: ACTIVOS FIJOS + INPC */}
      {activeTab === 'ACTIVOS_FIJOS' && (
        <div role="tabpanel" id="fb-panel-ACTIVOS_FIJOS" aria-labelledby="fb-tab-ACTIVOS_FIJOS">
          <ActivosFijosTab
            companyId={activeCompanyId}
            year={currentYear ?? 2026}
            accounts={accounts}
            isPeriodLocked={isPeriodLocked}
            isReadOnlyClient={isReadOnlyClient}
            onFeedback={handleFeedback}
          />
        </div>
      )}

      {/* PESTAÑA 5: PAPEL DE TRABAJO DÍA 17 */}
      {activeTab === 'PAPEL_DIA_17' && (
        <div role="tabpanel" id="fb-panel-PAPEL_DIA_17" aria-labelledby="fb-tab-PAPEL_DIA_17">
          <PapelDia17Tab
            companyId={activeCompanyId}
            year={currentYear ?? 2026}
            period={currentPeriod ?? 10}
            isPeriodLocked={isPeriodLocked}
            isReadOnlyClient={isReadOnlyClient}
            onFeedback={handleFeedback}
            onOpenDeliverable={(tab) => openDeliverables(tab)}
          />
        </div>
      )}

      {/* PESTAÑA 6: CXC / CXP (PPD) */}
      {activeTab === 'CXC_CXP' && (
        <div role="tabpanel" id="fb-panel-CXC_CXP" aria-labelledby="fb-tab-CXC_CXP">
          <CxcCxpTab
            activeCompanyId={activeCompanyId}
            currentYear={currentYear}
            currentPeriod={currentPeriod}
          />
        </div>
      )}

      {/* PESTAÑA 7: AMARRE NÓMINA 1.2, SUA IMSS E ISN ESTATAL */}
      {activeTab === 'NOMINA_IMSS' && (
        <div role="tabpanel" id="fb-panel-NOMINA_IMSS" aria-labelledby="fb-tab-NOMINA_IMSS">
          <NominaImssTab
            activeCompanyId={activeCompanyId}
            currentYear={currentYear ?? 2026}
            currentPeriod={currentPeriod ?? 10}
            isPeriodLocked={isPeriodLocked}
            isReadOnlyClient={isReadOnlyClient}
            accounts={accounts}
            onFeedback={handleFeedback}
          />
        </div>
      )}

      {/* PESTAÑA 8: INVENTARIO PERIÓDICO Y COSTO DE VENTAS */}
      {activeTab === 'INVENTARIO_COSTO' && (
        <div role="tabpanel" id="fb-panel-INVENTARIO_COSTO" aria-labelledby="fb-tab-INVENTARIO_COSTO">
          <InventarioCostoTab
            companyId={activeCompanyId}
            year={currentYear ?? 2026}
            period={currentPeriod ?? 10}
            accounts={accounts}
            isPeriodLocked={isPeriodLocked}
            isReadOnlyClient={isReadOnlyClient}
            onFeedback={handleFeedback}
          />
        </div>
      )}
    </div>
  );
}
