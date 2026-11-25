import { AlertCircle, FilePlus2, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button, EmptyState, getButtonClasses } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useUIModal } from '../context/UIModalContext';
import { AsambleaTraspasoModal } from './polizas/AsambleaTraspasoModal';
import { PedimentoEditorModal } from './polizas/PedimentoEditorModal';
import { PolizasFilterBar } from './polizas/PolizasFilterBar';
import { PolizaCardItem } from './polizas/PolizaCardItem';
import { PolizaEditorModal } from './polizas/PolizaEditorModal';
import { PolizaImportModal } from './polizas/PolizaImportModal';
import { PolizaTemplatesModal } from './polizas/PolizaTemplatesModal';
import { printPolizasFormalPdf } from './polizas/polizaPrintDocument';
import { usePolizasManager } from './polizas/usePolizasManager';

export function PolizasView() {
  const m = usePolizasManager();
  const { openLedger } = useUIModal();
  const toast = useToast();

  const handlePrintPdf = (list: typeof m.filteredPolizas, title?: string) => {
    const ok = printPolizasFormalPdf(list, m.activeCompany, title);
    if (!ok) {
      toast.warning(
        'Ventana de impresión bloqueada',
        'Habilita las ventanas emergentes (pop-ups) para imprimir o guardar el PDF formal.'
      );
    }
  };

  const hasFiltersActive = m.polizas.length > 0 || m.hasAdvancedFilters;
  const blockedNewTitle = m.isReadOnlyClient
    ? 'Tu rol Cliente (Solo lectura) no permite capturar pólizas'
    : m.isPeriodLocked
    ? 'Periodo fiscal bloqueado ante el SAT'
    : undefined;

  return (
    <div className="space-y-4">
      {/* Cabecera, Filtros y Acciones */}
      <PolizasFilterBar
        currentYear={m.currentYear}
        currentPeriod={m.currentPeriod}
        polizas={m.polizas}
        filteredPolizas={m.filteredPolizas}
        filterTipo={m.filterTipo}
        setFilterTipo={m.setFilterTipo}
        originFilter={m.originFilter}
        setOriginFilter={m.setOriginFilter}
        searchQuery={m.searchQuery}
        setSearchQuery={m.setSearchQuery}
        periodScope={m.periodScope}
        setPeriodScope={m.setPeriodScope}
        periodFrom={m.periodFrom}
        setPeriodFrom={m.setPeriodFrom}
        periodTo={m.periodTo}
        setPeriodTo={m.setPeriodTo}
        minAmount={m.minAmount}
        setMinAmount={m.setMinAmount}
        maxAmount={m.maxAmount}
        setMaxAmount={m.setMaxAmount}
        hasAdvancedFilters={m.hasAdvancedFilters}
        onClearFilters={m.clearAllFilters}
        compactMode={m.compactMode}
        setCompactMode={(updater) => {
          m.setCompactMode((prev) => {
            const next = updater(prev);
            if (next) m.setExpandedIds({});
            return next;
          });
        }}
        filteredTotals={m.filteredPolizasTotals}
        isPeriodLocked={m.isPeriodLocked}
        isPeriod13Locked={m.isPeriod13Locked}
        isReadOnlyClient={m.isReadOnlyClient}
        hasPolizasToExport={m.filteredPolizas.length > 0}
        onNewPoliza={m.openNewPolizaModal}
        onOpenTemplatesModal={() => m.setIsTemplatesModalOpen(true)}
        onOpenImportModal={() => {
          if (!m.isReadOnlyClient) m.setIsImportModalOpen(true);
        }}
        onOpenAsambleaModal={() => {
          if (!m.isWriteBlocked) m.setIsAsambleaModalOpen(true);
        }}
        onOpenPedimentoModal={() => {
          if (!m.isWriteBlocked) m.setIsPedimentoModalOpen(true);
        }}
        onExportCsv={m.handleExportPolizasCsv}
        onPrintPdf={() => handlePrintPdf(m.filteredPolizas)}
        onCloseYear={() => m.closeYearMutation.mutate()}
        isCloseYearPending={m.closeYearMutation.isPending}
      />

      {/* Lista de Pólizas */}
      {m.isError ? (
        <div role="alert">
          <EmptyState
            variant="card"
            tone="red"
            icon={<AlertCircle className="w-6 h-6" aria-hidden="true" />}
            title="Error al cargar las pólizas del periodo"
            description={
              m.error instanceof Error
                ? m.error.message
                : 'Error de conexión con el servidor contable.'
            }
            actions={
              <Button
                variant="primary"
                size="md"
                onClick={() => void m.refetch()}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
              >
                Reintentar
              </Button>
            }
          />
        </div>
      ) : m.isLoading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="space-y-4"
        >
          <span className="visually-hidden">Cargando pólizas del periodo...</span>
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              aria-hidden="true"
              className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 animate-pulse shadow-2xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-6 w-24 rounded-lg bg-slate-200" />
                  <div className="h-4 w-20 rounded bg-slate-200" />
                  <div className="h-4 w-56 rounded bg-slate-200" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-28 rounded bg-slate-200" />
                  <div className="h-6 w-20 rounded-full bg-slate-200" />
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="h-4 w-full rounded bg-slate-100" />
                <div className="h-4 w-5/6 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : m.filteredPolizas.length === 0 ? (
        <EmptyState
          variant="card"
          tone="blue"
          icon={<FilePlus2 className="w-6 h-6" aria-hidden="true" />}
          title={
            hasFiltersActive
              ? 'Ninguna póliza coincide con los filtros actuales'
              : 'No se encontraron pólizas en este periodo'
          }
          description={
            hasFiltersActive
              ? 'Ajusta o limpia los filtros de búsqueda, tipo, periodo o monto para ver todas las pólizas registradas.'
              : m.isReadOnlyClient
              ? 'No hay pólizas registradas en este periodo. Tu rol Cliente (Solo lectura) permite consultar otros periodos desde el selector superior o revisar los comprobantes en la Bóveda ADD.'
              : 'Inicia capturando una póliza contable con cuadre automático, o genera pólizas en lote desde tus facturas CFDI 4.0.'
          }
          actions={
            hasFiltersActive ? (
              <>
                <Button variant="primary" size="lg" onClick={m.clearAllFilters}>
                  Limpiar filtros
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={m.isWriteBlocked}
                  title={blockedNewTitle}
                  onClick={m.openNewPolizaModal}
                  leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                >
                  Capturar Nueva Póliza
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={m.isWriteBlocked}
                  title={blockedNewTitle}
                  onClick={m.openNewPolizaModal}
                  leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                >
                  <span>Capturar Nueva Póliza</span>
                  {!m.isWriteBlocked && (
                    <kbd className="font-mono text-[10px] bg-blue-900/80 px-1 py-0.5 rounded border border-blue-500/40 text-blue-200">
                      Alt+N
                    </kbd>
                  )}
                </Button>
                <Link to="/add" className={getButtonClasses('secondary', 'lg')}>
                  <Sparkles className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  <span>Ir a Bóveda ADD</span>
                </Link>
              </>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {m.filteredPolizas.map((pol) => {
            const isExpanded = !m.compactMode || Boolean(m.expandedIds[pol.id]);
            const isExactMatch =
              Boolean(m.searchQuery.trim()) &&
              (String(pol.folio) === m.searchQuery.trim() ||
                `${pol.tipo} #${pol.folio}`.toLowerCase() === m.searchQuery.trim().toLowerCase());

            return (
              <PolizaCardItem
                key={pol.id}
                pol={pol}
                isExpanded={isExpanded}
                compactMode={m.compactMode}
                isExactMatch={isExactMatch}
                isPeriodLocked={m.isPeriodLocked}
                currentPeriod={m.currentPeriod}
                isReadOnlyClient={m.isReadOnlyClient}
                isDeleting={m.deletePolizaMutation.isPending && m.deletePolizaMutation.variables === pol.id}
                isReversing={m.reversePolizaMutation.isPending && m.reversePolizaMutation.variables?.id === pol.id}
                copiedPolizaId={m.copiedPolizaId}
                confirmDeleteId={m.confirmDeleteId}
                confirmReverseId={m.confirmReverseId}
                onToggleExpand={(id) =>
                  m.setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }))
                }
                onCopyPoliza={m.handleCopyPoliza}
                onPrintPoliza={(p) => handlePrintPdf([p], `${p.tipo} #${p.folio}`)}
                onDuplicate={m.openDuplicatePolizaModal}
                onConfirmReverse={(p) => m.reversePolizaMutation.mutate(p)}
                onCancelReverse={() => m.setConfirmReverseId(null)}
                onRequestReverse={(id) => {
                  m.setConfirmDeleteId(null);
                  m.setConfirmReverseId(id);
                }}
                onEdit={m.openEditPolizaModal}
                onConfirmDelete={(id) => m.deletePolizaMutation.mutate(id)}
                onCancelDelete={() => m.setConfirmDeleteId(null)}
                onRequestDelete={(id) => {
                  m.setConfirmReverseId(null);
                  m.setConfirmDeleteId(id);
                }}
                onOpenLedger={openLedger}
              />
            );
          })}
        </div>
      )}

      {/* Modal de Captura o Edición de Pólizas */}
      <PolizaEditorModal
        dialogRef={m.dialogRef}
        editingPolizaId={m.editingPolizaId}
        activeCompany={m.activeCompany}
        currentYear={m.currentYear}
        currentPeriod={m.currentPeriod}
        isPeriodLocked={m.isWriteBlocked}
        predictedNextFolio={m.predictedNextFolio}
        tipo={m.tipo}
        setTipo={m.setTipo}
        fecha={m.fecha}
        setFecha={m.setFecha}
        concepto={m.concepto}
        setConcepto={m.setConcepto}
        cfdiUuid={m.cfdiUuid}
        cfdiUuids={m.cfdiUuids}
        pendingCfdis={m.pendingCfdis}
        allCfdis={m.cfdis}
        handleSelectCfdiForForm={m.handleSelectCfdiForForm}
        handleAddCfdiUuid={m.handleAddCfdiUuid}
        handleRemoveCfdiUuid={m.handleRemoveCfdiUuid}
        formError={m.formError}
        setFormError={m.setFormError}
        movements={m.movements}
        setMovements={m.setMovements}
        accounts={m.accounts}
        affectableAccounts={m.affectableAccounts}
        businessSegments={m.businessSegments}
        polizaTemplates={m.polizaTemplates}
        applyQuickTemplate={m.applyQuickTemplate}
        applySavedTemplate={m.applySavedTemplate}
        onSaveAsTemplate={m.handleSaveAsTemplate}
        isSavingTemplate={m.isSavingTemplate}
        addIva16Line={m.addIva16Line}
        autoBalanceDifference={m.autoBalanceDifference}
        applyBalanceToRow={m.applyBalanceToRow}
        totalCargos={m.totalCargos}
        totalAbonos={m.totalAbonos}
        difference={m.difference}
        isBalanced={m.isBalanced}
        isDateDifferentPeriod={m.isDateDifferentPeriod}
        onUseActivePeriodDate={m.handleUseActivePeriodDate}
        editorSessionId={m.editorSessionId}
        initialSnapshot={m.initialSnapshot}
        isPendingSave={m.savePolizaMutation.isPending}
        onSave={() => m.savePolizaMutation.mutate()}
      />

      <PedimentoEditorModal
        isOpen={m.isPedimentoModalOpen} onClose={() => m.setIsPedimentoModalOpen(false)}
        currentYear={m.currentYear ?? 2026} currentPeriod={m.currentPeriod ?? 10}
        isPeriodLocked={m.isPeriodLocked} isReadOnlyClient={m.isReadOnlyClient}
        accounts={m.affectableAccounts} onSavePoliza={(data) => m.createPedimentoMutation.mutate(data)}
        isSaving={m.createPedimentoMutation.isPending}
      />
      <PolizaTemplatesModal
        isOpen={m.isTemplatesModalOpen} onClose={() => m.setIsTemplatesModalOpen(false)}
        companyId={m.activeCompanyId} isWriteBlocked={m.isWriteBlocked}
        templates={m.polizaTemplates} affectableAccounts={m.affectableAccounts}
        onApplyTemplate={m.openNewPolizaWithTemplate}
      />
      <PolizaImportModal
        isOpen={m.isImportModalOpen} onClose={() => m.setIsImportModalOpen(false)}
        companyId={m.activeCompanyId} currentYear={m.currentYear ?? 2026}
        affectableAccounts={m.affectableAccounts} isReadOnlyClient={m.isReadOnlyClient}
      />
      <AsambleaTraspasoModal
        isOpen={m.isAsambleaModalOpen} onClose={() => m.setIsAsambleaModalOpen(false)}
        companyId={m.activeCompanyId} currentYear={m.currentYear ?? 2026}
        currentPeriod={m.currentPeriod ?? 1} isPeriodLocked={m.isPeriodLocked}
        isReadOnlyClient={m.isReadOnlyClient} accounts={m.accounts}
      />
    </div>
  );
}
