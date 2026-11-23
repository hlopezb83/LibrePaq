import { AlertCircle, FilePlus2, Lock, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useUIModal } from '../context/UIModalContext';
import { PedimentoEditorModal } from './polizas/PedimentoEditorModal';
import { PolizasFilterBar } from './polizas/PolizasFilterBar';
import { PolizaCardItem } from './polizas/PolizaCardItem';
import { PolizaEditorModal } from './polizas/PolizaEditorModal';
import { usePolizasManager } from './polizas/usePolizasManager';

export function PolizasView() {
  const m = usePolizasManager();
  const { openLedger } = useUIModal();

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

      {/* Barra de Filtros y Acciones */}
      <PolizasFilterBar
        polizas={m.polizas}
        filteredPolizas={m.filteredPolizas}
        filterTipo={m.filterTipo}
        setFilterTipo={m.setFilterTipo}
        originFilter={m.originFilter}
        setOriginFilter={m.setOriginFilter}
        searchQuery={m.searchQuery}
        setSearchQuery={m.setSearchQuery}
        compactMode={m.compactMode}
        setCompactMode={m.setCompactMode}
        filteredTotals={m.filteredPolizasTotals}
        isPeriodLocked={m.isPeriodLocked}
        onNewPoliza={m.openNewPolizaModal}
        onOpenPedimentoModal={() => m.setIsPedimentoModalOpen(true)}
        onExportCsv={m.handleExportPolizasCsv}
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
          className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-500"
        >
          Cargando pólizas del periodo...
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
            <p className="text-xs text-slate-500 leading-relaxed">
              {m.polizas.length > 0
                ? 'Ajusta o limpia los filtros de búsqueda, tipo o comprobante para ver todas las pólizas registradas.'
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
              disabled={m.isPeriodLocked}
              title={m.isPeriodLocked ? 'Periodo fiscal bloqueado ante el SAT' : undefined}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Capturar Nueva Póliza</span>
              <kbd className="font-mono text-[10px] bg-blue-900/80 px-1 py-0.5 rounded border border-blue-500/40 text-blue-200">
                Alt+N
              </kbd>
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
                copiedPolizaId={m.copiedPolizaId}
                confirmDeleteId={m.confirmDeleteId}
                onToggleExpand={(id) =>
                  m.setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }))
                }
                onCopyPoliza={m.handleCopyPoliza}
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
        isPeriodLocked={m.isPeriodLocked}
        predictedNextFolio={m.predictedNextFolio}
        tipo={m.tipo}
        setTipo={m.setTipo}
        fecha={m.fecha}
        setFecha={m.setFecha}
        concepto={m.concepto}
        setConcepto={m.setConcepto}
        cfdiUuid={m.cfdiUuid}
        pendingCfdis={m.pendingCfdis}
        handleSelectCfdiForForm={m.handleSelectCfdiForForm}
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
        isPendingSave={m.savePolizaMutation.isPending}
        onSave={() => m.savePolizaMutation.mutate()}
      />

      <PedimentoEditorModal
        isOpen={m.isPedimentoModalOpen}
        onClose={() => m.setIsPedimentoModalOpen(false)}
        currentYear={m.currentYear ?? 2026}
        currentPeriod={m.currentPeriod ?? 10}
        accounts={m.affectableAccounts}
        onSavePoliza={(data) => m.createPedimentoMutation.mutate(data)}
        isSaving={m.createPedimentoMutation.isPending}
      />
    </div>
  );
}
