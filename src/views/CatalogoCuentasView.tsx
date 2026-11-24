import { useState } from 'react';
import { AlertCircle, Eye, Lock, RefreshCw } from 'lucide-react';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { useUIModal } from '../context/UIModalContext';
import { AccountEditorModal } from './catalogo/AccountEditorModal';
import { CatalogoCsvImportPreviewModal } from './catalogo/CatalogoCsvImportPreviewModal';
import { CatalogoFilterBar } from './catalogo/CatalogoFilterBar';
import { CatalogoHeaderBar } from './catalogo/CatalogoHeaderBar';
import { CatalogoKeyboardShortcutsBar } from './catalogo/CatalogoKeyboardShortcutsBar';
import { CatalogoTable } from './catalogo/CatalogoTable';
import { ReclassifyAccountModal } from './catalogo/ReclassifyAccountModal';
import { useCatalogoKeyboardNavigation } from './catalogo/useCatalogoKeyboardNavigation';
import { useCatalogoManager } from './catalogo/useCatalogoManager';

export function CatalogoCuentasView() {
  const manager = useCatalogoManager();
  const [isReclassifyOpen, setIsReclassifyOpen] = useState(false);
  const { globalLedgerAccountId, openLedger } = useUIModal();
  const { copiedKey: copiedCode, copy: copyAccountCode } = useCopyToClipboard<string>(1800);
  const {
    activeCompany,
    currentYear,
    isPeriodLocked,
    isJanLocked,
    isReadOnlyClient,
    isWriteBlocked,
    dialogRef,
    csvImportRef,
    accounts,
    isLoading,
    isError,
    error,
    refetch,
    parentAccounts,
    globalFilter,
    setGlobalFilter,
    selectedType,
    setSelectedType,
    quickFilter,
    setQuickFilter,
    quickFilterCounts,
    levelFilter,
    setLevelFilter,
    collapsedCodes,
    toggleNodeCollapse,
    collapseToMayor,
    expandAllNodes,
    selectedAccountId,
    setSelectedAccountId,
    selectedAccount,
    selectedIndex,
    filteredAccounts,
    filteredSummaryTotals,
    formError,
    confirmDeleteId,
    setConfirmDeleteId,
    deletingAccountId,
    editingAccountId,
    editingIsAffectable,
    code,
    setCode,
    name,
    setName,
    parentCode,
    setParentCode,
    satGroupCode,
    setSatGroupCode,
    type,
    setType,
    nature,
    setNature,
    setLevel,
    initialBalanceRaw,
    setInitialBalanceRaw,
    suggestNextCodeForParent,
    openCreateModal,
    openEditModal,
    openCreateSubaccountModal,
    closeEditorModal,
    saveAccountMutation,
    deleteAccountMutation,
    handleExportCsv,
    handleImportAccountsCsv,
    csvPreview,
    setCsvPreview,
    isImportingCsv,
    handleConfirmImportCsv
  } = manager;

  useCatalogoKeyboardNavigation({
    dialogRef,
    ledgerAccountId: globalLedgerAccountId,
    isPeriodLocked: isWriteBlocked,
    filteredAccounts,
    selectedAccountId,
    selectedIndex,
    collapsedCodes,
    setSelectedAccountId,
    setCollapsedCodes: manager.setCollapsedCodes,
    openCreateModal,
    openEditModal,
    openCreateSubaccountModal,
    onOpenLedger: openLedger
  });

  const typeFilters = [
    { id: 'ALL', label: 'Todas las Cuentas' },
    { id: 'ACTIVO', label: '100 Activo' },
    { id: 'PASIVO', label: '200 Pasivo' },
    { id: 'CAPITAL', label: '300 Capital' },
    { id: 'INGRESOS', label: '400 Ingresos' },
    { id: 'COSTOS', label: '500 Costos' },
    { id: 'GASTOS', label: '600 Gastos' }
  ];

  const resetFilters = () => {
    setGlobalFilter('');
    setSelectedType('ALL');
    setQuickFilter('ALL');
    setLevelFilter('ALL');
  };

  return (
    <div className="space-y-4">
      {/* Encabezado del Catálogo */}
      <CatalogoHeaderBar
        csvImportRef={csvImportRef}
        isPeriodLocked={isPeriodLocked}
        isReadOnlyClient={isReadOnlyClient}
        onImportCsv={handleImportAccountsCsv}
        onExportCsv={handleExportCsv}
        onOpenReclassify={() => setIsReclassifyOpen(true)}
        onOpenCreateModal={openCreateModal}
      />

      {isPeriodLocked && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center gap-2 shadow-2xs"
        >
          <Lock className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
          <span>
            <strong>Periodo {String(activeCompany?.currentPeriod ?? 1).padStart(2, '0')}/{currentYear} bloqueado ante el SAT:</strong>{' '}
            El catálogo se encuentra en modo de consulta y auditoría de Libro Mayor (altas, ediciones y bajas deshabilitadas).
          </span>
        </div>
      )}

      {isReadOnlyClient && !isPeriodLocked && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 text-xs flex items-center gap-2 shadow-2xs"
        >
          <Eye className="w-4 h-4 text-sky-700 shrink-0" aria-hidden="true" />
          <span>
            <strong>Modo Solo lectura:</strong> Puedes consultar el catálogo contable, abrir el Libro Mayor de cada cuenta y exportar a Excel, pero no crear, editar ni eliminar cuentas.
          </span>
        </div>
      )}

      {/* Barra de Búsqueda, Expansión Jerárquica y Filtros */}
      <CatalogoFilterBar
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        expandAllNodes={expandAllNodes}
        collapseToMayor={collapseToMayor}
        levelFilter={levelFilter}
        setLevelFilter={setLevelFilter}
        filteredCount={filteredAccounts.length}
        totalCount={accounts.length}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        typeFilters={typeFilters}
        quickFilter={quickFilter}
        setQuickFilter={setQuickFilter}
        quickFilterCounts={quickFilterCounts}
        filteredSummaryTotals={filteredSummaryTotals}
        onResetFilters={resetFilters}
      />

      {/* Tabla del Catálogo de Cuentas */}
      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
        <CatalogoKeyboardShortcutsBar selectedAccount={selectedAccount} isWriteBlocked={isWriteBlocked} />

        {isError ? (
          <div role="alert" className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto" aria-hidden="true" />
            <p className="text-sm font-bold text-slate-900">
              Error al cargar el catálogo de cuentas
            </p>
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
          <CatalogoTable
            filteredAccounts={filteredAccounts}
            isLoading={isLoading}
            isPeriodLocked={isPeriodLocked}
            isReadOnlyClient={isReadOnlyClient}
            deletingAccountId={deletingAccountId}
            copiedCode={copiedCode}
            selectedAccountId={selectedAccountId}
            onSelectAccount={(id) => setSelectedAccountId(id)}
            collapsedCodes={collapsedCodes}
            onToggleNodeCollapse={toggleNodeCollapse}
            onOpenLedger={openLedger}
            onOpenCreateSubaccount={openCreateSubaccountModal}
            onOpenEditModal={openEditModal}
            confirmDeleteId={confirmDeleteId}
            setConfirmDeleteId={setConfirmDeleteId}
            onConfirmDelete={(id) => deleteAccountMutation.mutate(id)}
            onCopyCode={(c) => {
              void copyAccountCode(c, c);
            }}
            onResetFilters={resetFilters}
          />
        )}
      </div>

      {/* Modal para Crear o Editar Cuenta Contable */}
      <AccountEditorModal
        dialogRef={dialogRef}
        editingAccountId={editingAccountId}
        editingIsAffectable={editingIsAffectable}
        isJanLocked={isJanLocked}
        activeCompany={activeCompany}
        currentYear={currentYear}
        formError={formError}
        parentCode={parentCode}
        setParentCode={setParentCode}
        parentAccounts={parentAccounts}
        accounts={accounts}
        code={code}
        setCode={setCode}
        name={name}
        setName={setName}
        satGroupCode={satGroupCode}
        setSatGroupCode={setSatGroupCode}
        type={type}
        setType={setType}
        nature={nature}
        setNature={setNature}
        setLevel={setLevel}
        initialBalanceRaw={initialBalanceRaw}
        setInitialBalanceRaw={setInitialBalanceRaw}
        suggestNextCodeForParent={suggestNextCodeForParent}
        onClose={closeEditorModal}
        onSave={() => saveAccountMutation.mutate()}
        isSaving={saveAccountMutation.isPending}
        isWriteBlocked={isWriteBlocked}
      />

      <CatalogoCsvImportPreviewModal
        preview={csvPreview}
        isImporting={isImportingCsv}
        onClose={() => setCsvPreview(null)}
        onConfirm={() => void handleConfirmImportCsv()}
      />

      <ReclassifyAccountModal
        isOpen={isReclassifyOpen}
        companyId={manager.activeCompanyId}
        currentYear={currentYear ?? 2026}
        currentPeriod={activeCompany?.currentPeriod ?? 1}
        isPeriodLocked={isPeriodLocked}
        isReadOnlyClient={isReadOnlyClient}
        accounts={accounts}
        onClose={() => setIsReclassifyOpen(false)}
      />
    </div>
  );
}
