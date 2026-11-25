import { useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '../components/ui';
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
    isAffectable,
    setIsAffectable,
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
    handleConfirmImportCsv,
    hasPolizas,
    bnBalanceField,
    handleChangeBnBalanceField,
    replaceBaseCatalog,
    handleChangeReplaceBaseCatalog
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
    { id: 'GASTOS', label: '600 Gastos' },
    { id: 'ORDEN', label: '800 Orden' }
  ];

  const resetFilters = () => {
    setGlobalFilter('');
    setSelectedType('ALL');
    setQuickFilter('ALL');
    setLevelFilter('ALL');
  };

  return (
    <div className="space-y-4">
      <CatalogoHeaderBar
        csvImportRef={csvImportRef}
        isPeriodLocked={isPeriodLocked}
        isReadOnlyClient={isReadOnlyClient}
        onImportCsv={handleImportAccountsCsv}
        onExportCsv={handleExportCsv}
        onOpenReclassify={() => setIsReclassifyOpen(true)}
        onOpenCreateModal={openCreateModal}
      />

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

      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
        <CatalogoKeyboardShortcutsBar selectedAccount={selectedAccount} isWriteBlocked={isWriteBlocked} />

        {isError ? (
          <div role="alert">
            <EmptyState
              tone="red"
              icon={<AlertCircle className="w-6 h-6" aria-hidden="true" />}
              title="Error al cargar el catálogo de cuentas"
              description={
                error instanceof Error ? error.message : 'Error de conexión con el servidor contable.'
              }
              actions={
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void refetch()}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
                >
                  Reintentar
                </Button>
              }
            />
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

      <AccountEditorModal
        dialogRef={dialogRef}
        editingAccountId={editingAccountId}
        editingIsAffectable={editingIsAffectable}
        isAffectable={isAffectable}
        setIsAffectable={setIsAffectable}
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
        hasPolizas={hasPolizas}
        bnBalanceField={bnBalanceField}
        onChangeBnBalanceField={handleChangeBnBalanceField}
        replaceBaseCatalog={replaceBaseCatalog}
        onChangeReplaceBaseCatalog={handleChangeReplaceBaseCatalog}
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
