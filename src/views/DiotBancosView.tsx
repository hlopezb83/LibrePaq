import { Lock } from 'lucide-react';
import { useUIModal } from '../context/UIModalContext';
import { FiscalBancosTabBar } from './fiscal-bancos/FiscalBancosTabBar';
import { ConciliacionBancosTab } from './fiscal-bancos/ConciliacionBancosTab';
import { DiotDeclaracionTab } from './fiscal-bancos/DiotDeclaracionTab';
import { PadronProveedoresTab } from './fiscal-bancos/PadronProveedoresTab';
import { ActivosFijosTab } from './fiscal-bancos/ActivosFijosTab';
import { PapelDia17Tab } from './fiscal-bancos/PapelDia17Tab';
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
    diotData,
    isLoadingDiot,
    isErrorDiot,
    refetchDiot,
    isPeriodLocked,
    autoMatchMutation,
    createPolizaFromBankMutation,
    unmatchBankLineMutation,
    addBankLineMutation,
    handleCsvUpload,
    handleDownloadDiotTxt,
    handleExportDiotCsv,
    reconFormula,
    handleAddBankLineSubmit
  } = useDiotBancosManager();

  return (
    <div className="space-y-4">
      {/* Alerta de Periodo Bloqueado cuando aplica */}
      {isPeriodLocked && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs shadow-2xs">
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="font-bold text-sm block text-amber-950">
              Periodo Fiscal P{String(currentPeriod).padStart(2, '0')}/{currentYear} Bloqueado ante el SAT
            </span>
            <p className="text-amber-800 leading-relaxed">
              El registro de movimientos bancarios y la generación de pólizas contables desde estado de cuenta se encuentran inhabilitados en este periodo cerrado.
            </p>
          </div>
        </div>
      )}

      {/* Encabezado del Módulo y Pestañas */}
      <FiscalBancosTabBar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* PESTAÑA 1: CONCILIACIÓN BANCARIA */}
      {activeTab === 'CONCILIACION' && (
        <ConciliacionBancosTab
          effectiveBankId={effectiveBankId}
          setSelectedBankId={setSelectedBankId}
          bankAccounts={bankAccounts}
          onOpenLedger={openLedger}
          csvInputRef={csvInputRef}
          onCsvUpload={handleCsvUpload}
          isPeriodLocked={isPeriodLocked}
          addBankModalRef={addBankModalRef}
          onAutoMatch={() => autoMatchMutation.mutate()}
          isAutoMatchPending={autoMatchMutation.isPending}
          isLoadingRecon={isLoadingRecon}
          reconData={reconData}
          reconFormula={reconFormula}
          onCreatePolizaFromBank={(id) => createPolizaFromBankMutation.mutate(id)}
          isCreatePolizaPending={createPolizaFromBankMutation.isPending}
          onUnmatchBankLine={(id) => unmatchBankLineMutation.mutate(id)}
          isUnmatchPending={unmatchBankLineMutation.isPending}
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
      )}

      {/* PESTAÑA 2: DECLARACIÓN DIOT */}
      {activeTab === 'DIOT' && (
        <DiotDeclaracionTab
          isLoadingDiot={isLoadingDiot}
          diotData={diotData}
          isErrorDiot={isErrorDiot}
          onRetryDiot={() => void refetchDiot()}
          onExportDiotCsv={handleExportDiotCsv}
          onDownloadDiotTxt={handleDownloadDiotTxt}
          copiedBatch={copiedBatch}
          setCopiedBatch={setCopiedBatch}
        />
      )}

      {/* PESTAÑA 3: PADRÓN PROVEEDORES RFC & 69-B */}
      {activeTab === 'PADRON_RFC' && (
        <PadronProveedoresTab
          companyId={activeCompanyId}
          accounts={accounts}
          onFeedback={(msg) => toast.success(msg)}
        />
      )}

      {/* PESTAÑA 4: ACTIVOS FIJOS + INPC */}
      {activeTab === 'ACTIVOS_FIJOS' && (
        <ActivosFijosTab
          companyId={activeCompanyId}
          year={currentYear ?? 2026}
          accounts={accounts}
          onFeedback={(msg) => toast.success(msg)}
        />
      )}

      {/* PESTAÑA 5: PAPEL DE TRABAJO DÍA 17 */}
      {activeTab === 'PAPEL_DIA_17' && (
        <PapelDia17Tab
          companyId={activeCompanyId}
          year={currentYear ?? 2026}
          period={currentPeriod ?? 10}
          onFeedback={(msg) => toast.success(msg)}
          onOpenDeliverable={(tab) => openDeliverables(tab)}
        />
      )}
    </div>
  );
}
