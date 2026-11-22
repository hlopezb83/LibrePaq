import { useUIModal } from '../context/UIModalContext';
import { AccountEditorModal } from './catalogo/AccountEditorModal';
import { CatalogoFilterBar } from './catalogo/CatalogoFilterBar';
import { CatalogoHeaderBar } from './catalogo/CatalogoHeaderBar';
import { CatalogoKeyboardShortcutsBar } from './catalogo/CatalogoKeyboardShortcutsBar';
import { CatalogoTable } from './catalogo/CatalogoTable';
import { useCatalogoKeyboardNavigation } from './catalogo/useCatalogoKeyboardNavigation';
import { useCatalogoManager } from './catalogo/useCatalogoManager';

export function CatalogoCuentasView() {
  const manager = useCatalogoManager();
  const { globalLedgerAccountId, openLedger } = useUIModal();
  const {
    activeCompany,
    currentYear,
    dialogRef,
    csvImportRef,
    accounts,
    isLoading,
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
    editingAccountId,
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
    initialBalance,
    setInitialBalance,
    suggestNextCodeForParent,
    openCreateModal,
    openEditModal,
    openCreateSubaccountModal,
    saveAccountMutation,
    deleteAccountMutation,
    handleExportCsv,
    handleImportAccountsCsv
  } = manager;

  useCatalogoKeyboardNavigation({
    dialogRef,
    ledgerAccountId: globalLedgerAccountId,
    filteredAccounts,
    selectedAccountId,
    selectedIndex,
    collapsedCodes,
    setSelectedAccountId,
    setCollapsedCodes: manager.setCollapsedCodes,
    openCreateModal,
    openEditModal,
    openCreateSubaccountModal
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

  return (
    <div className="space-y-4">
      {/* Encabezado del Catálogo */}
      <CatalogoHeaderBar
        csvImportRef={csvImportRef}
        onImportCsv={handleImportAccountsCsv}
        onExportCsv={handleExportCsv}
        onOpenCreateModal={openCreateModal}
      />

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
      />

      {/* Tabla del Catálogo de Cuentas */}
      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
        <CatalogoKeyboardShortcutsBar selectedAccount={selectedAccount} />

        <CatalogoTable
          filteredAccounts={filteredAccounts}
          isLoading={isLoading}
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
            navigator.clipboard?.writeText(c);
          }}
        />
      </div>

      {/* Modal para Crear o Editar Cuenta Contable */}
      <AccountEditorModal
        dialogRef={dialogRef}
        editingAccountId={editingAccountId}
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
        initialBalance={initialBalance}
        setInitialBalance={setInitialBalance}
        suggestNextCodeForParent={suggestNextCodeForParent}
        onClose={() => dialogRef.current?.close()}
        onSave={() => saveAccountMutation.mutate()}
        isSaving={saveAccountMutation.isPending}
      />
    </div>
  );
}
