import { Eye, Lock } from 'lucide-react';
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
      {/* Alerta de Periodo Bloqueado o Modo Solo Lectura */}
      {isPeriodLocked && (
        <div role="status" className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs shadow-2xs">
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="font-bold text-sm block text-amber-950">
              Periodo Fiscal P{String(currentPeriod).padStart(2, '0')}/{currentYear} Bloqueado ante el SAT
            </span>
            <p className="text-amber-800 leading-relaxed">
              El registro de movimientos bancarios, edición de parámetros Día 17, inventario y costo de ventas, provisión SUA/ISN, depreciación de activos y generación de pólizas contables se encuentran inhabilitados en este periodo cerrado.
            </p>
          </div>
        </div>
      )}

      {isReadOnlyClient && !isPeriodLocked && (
        <div role="status" className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 text-blue-950 text-xs shadow-2xs">
          <Eye className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="font-bold text-sm block text-blue-950">
              Modo Solo Lectura Activado
            </span>
            <p className="text-blue-900 leading-relaxed">
              Puedes consultar conciliaciones, DIOT, cédula Día 17, antigüedad de saldos CxC/CxP y cálculos fiscales. La edición de parámetros, guardado de inventarios y generación de pólizas están deshabilitados.
            </p>
          </div>
        </div>
      )}

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
          <CxcCxpTab activeCompanyId={activeCompanyId} />
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
