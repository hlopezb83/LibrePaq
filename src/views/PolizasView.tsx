import { AlertCircle, Eye, FilePlus2, Lock, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useToast } from '../context/ToastContext';
import { useUIModal } from '../context/UIModalContext';
import { PedimentoEditorModal } from './polizas/PedimentoEditorModal';
import { PolizasFilterBar } from './polizas/PolizasFilterBar';
import { PolizaCardItem } from './polizas/PolizaCardItem';
import { PolizaEditorModal } from './polizas/PolizaEditorModal';
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

  return (
    <div className="space-y-4">
      {/* Alerta de Periodo Bloqueado cuando aplica */}
      {m.isPeriodLocked && (
        <div
          role="status"
          className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs shadow-2xs"
        >
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="font-bold text-sm block text-amber-950">
              Periodo Fiscal P{String(m.currentPeriod).padStart(2, '0')}/{m.currentYear} Bloqueado ante el SAT
            </span>
            <p className="text-amber-800 leading-relaxed">
              Este periodo mensual se encuentra protegido contra modificaciones involuntarias para salvaguardar la contabilidad declarada.
            </p>
          </div>
        </div>
      )}

      {m.isReadOnlyClient && !m.isPeriodLocked && (
        <div
          role="status"
          className="bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3 flex items-start gap-3 text-sky-950 text-xs shadow-2xs"
        >
          <Eye className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong>Modo Solo lectura:</strong> Puedes consultar pólizas, partidas, Libro Mayor y exportar CSV, pero no capturar, duplicar, editar ni eliminar pólizas.
          </span>
        </div>
      )}

      {/* Barra de Filtros y Acciones */}
      <PolizasFilterBar
        currentYear={m.currentYear}
        polizas={m.polizas}
        filteredPolizas={m.filteredPolizas}
        filterTipo={m.filterTipo}
        setFilterTipo={m.setFilterTipo}
        originFilter={m.originFilter}
        setOriginFilter={m.setOriginFilter}
        searchQuery={m.searchQuery}
        setSearchQuery={m.setSearchQuery}
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
        <div
          role="alert"
          className="p-8 bg-white rounded-2xl border border-red-200 text-center space-y-3 shadow-2xs"
        >
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-900">Error al cargar las pólizas del periodo</p>
          <p className="text-xs text-slate-600">
            {m.error instanceof Error ? m.error.message : 'Error de conexión con el servidor contable.'}
          </p>
          <button
            type="button"
            onClick={() => void m.refetch()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Reintentar
          </button>
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
        <div className="p-12 bg-white rounded-2xl border border-slate-300 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
            <FilePlus2 className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <p className="text-base font-bold text-slate-800">
              {m.polizas.length > 0
                ? 'Ninguna póliza coincide con los filtros actuales'
                : 'No se encontraron pólizas en este periodo'}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              {m.polizas.length > 0
                ? 'Ajusta o limpia los filtros de búsqueda, tipo o comprobante para ver todas las pólizas registradas.'
                : m.isReadOnlyClient
                ? 'No hay pólizas registradas en este periodo. Tu rol Cliente (Solo lectura) permite consultar otros periodos desde el selector superior o revisar los comprobantes en la Bóveda ADD.'
                : 'Inicia capturando una póliza contable con cuadre automático, o genera pólizas en lote desde tus facturas CFDI 4.0.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {m.polizas.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  m.setFilterTipo('ALL');
                  m.setOriginFilter('ALL');
                  m.setSearchQuery('');
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
            <button
              type="button"
              onClick={m.openNewPolizaModal}
              disabled={m.isWriteBlocked}
              title={
                m.isReadOnlyClient
                  ? 'Tu rol Cliente (Solo lectura) no permite capturar pólizas'
                  : m.isPeriodLocked
                  ? 'Periodo fiscal bloqueado ante el SAT'
                  : undefined
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Capturar Nueva Póliza</span>
              {!m.isWriteBlocked && (
                <kbd className="font-mono text-[10px] bg-blue-900/80 px-1 py-0.5 rounded border border-blue-500/40 text-blue-200">
                  Alt+N
                </kbd>
              )}
            </button>
            <Link
              to="/add"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              <span>Ir a Bóveda ADD</span>
            </Link>
          </div>
        </div>
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
                isReadOnlyClient={m.isReadOnlyClient}
                isDeleting={m.deletePolizaMutation.isPending && m.deletePolizaMutation.variables === pol.id}
                copiedPolizaId={m.copiedPolizaId}
                confirmDeleteId={m.confirmDeleteId}
                onToggleExpand={(id) =>
                  m.setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }))
                }
                onCopyPoliza={m.handleCopyPoliza}
                onPrintPoliza={(p) => handlePrintPdf([p], `${p.tipo} #${p.folio}`)}
                onDuplicate={m.openDuplicatePolizaModal}
                onEdit={m.openEditPolizaModal}
                onConfirmDelete={(id) => m.deletePolizaMutation.mutate(id)}
                onCancelDelete={() => m.setConfirmDeleteId(null)}
                onRequestDelete={(id) => m.setConfirmDeleteId(id)}
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
        applyQuickTemplate={m.applyQuickTemplate}
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
        isOpen={m.isPedimentoModalOpen}
        onClose={() => m.setIsPedimentoModalOpen(false)}
        currentYear={m.currentYear ?? 2026}
        currentPeriod={m.currentPeriod ?? 10}
        isPeriodLocked={m.isPeriodLocked}
        isReadOnlyClient={m.isReadOnlyClient}
        accounts={m.affectableAccounts}
        onSavePoliza={(data) => m.createPedimentoMutation.mutate(data)}
        isSaving={m.createPedimentoMutation.isPending}
      />
    </div>
  );
}
