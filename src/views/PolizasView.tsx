import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, Lock, Plus, Sparkles } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useToast } from '../context/ToastContext';
import { useUIModal } from '../context/UIModalContext';
import { apiClient, invalidateAccountingQueries } from '../lib/api-client';
import { PedimentoEditorModal } from './polizas/PedimentoEditorModal';
import { PolizasFilterBar } from './polizas/PolizasFilterBar';
import { PolizaCardItem } from './polizas/PolizaCardItem';
import { PolizaEditorModal } from './polizas/PolizaEditorModal';
import { usePolizasManager } from './polizas/usePolizasManager';

export function PolizasView() {
  const m = usePolizasManager();
  const { openLedger } = useUIModal();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isPedimentoModalOpen, setIsPedimentoModalOpen] = useState(false);

  const createPedimentoMutation = useMutation({
    mutationFn: (pedimentoData: {
      tipo: 'EGRESO' | 'DIARIO';
      fecha: string;
      concepto: string;
      movements: Array<{
        accountCode: string;
        concepto: string;
        cargo: number;
        abono: number;
      }>;
    }) => {
      const mappedMovements = pedimentoData.movements.map((mov) => {
        const found = m.accounts.find((a) => a.code === mov.accountCode);
        return {
          accountId: found?.id ?? `acc_${mov.accountCode.replace(/-/g, '_')}`,
          concepto: mov.concepto,
          cargo: mov.cargo,
          abono: mov.abono
        };
      });

      return apiClient.createPoliza({
        companyId: m.activeCompanyId,
        tipo: pedimentoData.tipo,
        fecha: pedimentoData.fecha,
        concepto: pedimentoData.concepto,
        movements: mappedMovements
      });
    },
    onSuccess: () => {
      invalidateAccountingQueries(queryClient, ['polizas', 'accounts', 'account-ledger', 'reports', 'dashboard']);
      setIsPedimentoModalOpen(false);
      toast.success('Pedimento Registrado', 'La póliza de importación aduanal se generó y cuadró con éxito.');
    },
    onError: (err: Error) => {
      toast.error('Error al registrar pedimento', err.message);
    }
  });

  return (
    <div className="space-y-4">
      {/* Alerta de Periodo Bloqueado cuando aplica */}
      {m.isPeriodLocked && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs shadow-2xs">
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
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
        onOpenPedimentoModal={() => setIsPedimentoModalOpen(true)}
        onExportCsv={m.handleExportPolizasCsv}
        onCloseYear={() => m.closeYearMutation.mutate()}
        isCloseYearPending={m.closeYearMutation.isPending}
      />

      {/* Lista de Pólizas */}
      {m.isLoading ? (
        <div className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-500">
          Cargando pólizas del periodo...
        </div>
      ) : m.filteredPolizas.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-300 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
            <FilePlus2 className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <p className="text-base font-bold text-slate-800">
              No se encontraron pólizas en este periodo
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Inicia capturando una póliza contable con cuadre automático, o genera pólizas en lote desde tus facturas CFDI 4.0.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={m.openNewPolizaModal}
              disabled={m.isPeriodLocked}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Capturar Nueva Póliza</span>
              <kbd className="font-mono text-[10px] bg-blue-900/80 px-1 py-0.5 rounded border border-blue-500/40 text-blue-200">
                Alt+N
              </kbd>
            </button>
            <Link
              to="/add"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
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
        isOpen={isPedimentoModalOpen}
        onClose={() => setIsPedimentoModalOpen(false)}
        currentYear={m.currentYear ?? 2026}
        currentPeriod={m.currentPeriod ?? 10}
        accounts={m.affectableAccounts}
        onSavePoliza={(data) => createPedimentoMutation.mutate(data)}
        isSaving={createPedimentoMutation.isPending}
      />
    </div>
  );
}
