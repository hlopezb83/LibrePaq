import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Link2, RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '../../components/ui';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { formatCurrency } from '../../lib/formatters';
import type { AccountWithBalance, BankReconciliationResponse, ReconciliationFormulaData } from '../../shared/types';
import { AddBankStatementLineModal } from './AddBankStatementLineModal';
import { BankBookMovementsTable } from './BankBookMovementsTable';
import { BankLinePolizaModal } from './BankLinePolizaModal';
import { BankPdfImportModal } from './BankPdfImportModal';
import { BankStatementTable } from './BankStatementTable';
import { ConciliacionArithmeticCard } from './ConciliacionArithmeticCard';
import { ConciliacionN1Panel } from './ConciliacionN1Panel';
import { ConciliacionToolbar } from './ConciliacionToolbar';
import { useConciliacionTabActions } from './useConciliacionTabActions';

export interface ConciliacionBancosTabProps {
  effectiveBankId: string;
  setSelectedBankId: (id: string) => void;
  bankAccounts: AccountWithBalance[];
  onOpenLedger: (id: string) => void;
  csvInputRef: React.RefObject<HTMLInputElement | null>;
  onCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isCsvUploading?: boolean;
  isPeriodLocked: boolean;
  isReadOnlyClient?: boolean;
  addBankModalRef: React.RefObject<HTMLDialogElement | null>;
  onAutoMatch: () => void;
  isAutoMatchPending: boolean;
  isLoadingRecon: boolean;
  isErrorRecon?: boolean;
  errorRecon?: unknown;
  onRetryRecon?: () => void;
  reconData: BankReconciliationResponse | null | undefined;
  reconFormula: ReconciliationFormulaData | null;
  onCreatePolizaFromBank: (lineId: string) => void;
  isCreatePolizaPending: boolean;
  onUnmatchBankLine: (lineId: string) => void;
  isUnmatchPending: boolean;
  activeBankLineId?: string | null;
  bFecha: string;
  setBFecha: (d: string) => void;
  bRef: string;
  setBRef: (r: string) => void;
  bDesc: string;
  setBDesc: (d: string) => void;
  bTipo: 'CARGO' | 'ABONO';
  setBTipo: (t: 'CARGO' | 'ABONO') => void;
  bMonto: number;
  setBMonto: (m: number) => void;
  onAddBankLineSubmit: (e: React.FormEvent) => void;
  isAddBankLinePending: boolean;
}

export function ConciliacionBancosTab(props: ConciliacionBancosTabProps) {
  const {
    effectiveBankId, setSelectedBankId, bankAccounts, onOpenLedger,
    csvInputRef, onCsvUpload, isPeriodLocked, isReadOnlyClient: isReadOnlyClientProp = false, addBankModalRef,
    onAutoMatch, isAutoMatchPending, isLoadingRecon, isErrorRecon,
    errorRecon, onRetryRecon, reconData, reconFormula,
    isCreatePolizaPending, onUnmatchBankLine, isUnmatchPending, activeBankLineId = null
  } = props;

  const { activeCompanyId, activeCompany, isReadOnlyClient, isReadOnlySupportMode } = useCompany();
  const isReadOnly = Boolean(isReadOnlyClientProp) || isReadOnlyClient || isReadOnlySupportMode;
  const isWriteLocked = isPeriodLocked || isReadOnly;
  const queryClient = useQueryClient();
  const toast = useToast();
  const bankPdfModalRef = useRef<HTMLDialogElement | null>(null);
  const [showOnlyPending, setShowOnlyPending] = useState(false);

  const companyId = reconData?.account.companyId || activeCompanyId;
  const year = reconData?.ejercicio ?? activeCompany?.currentYear;
  const period = reconData?.periodo ?? activeCompany?.currentPeriod;

  useEffect(() => {
    setShowOnlyPending(false);
  }, [companyId, effectiveBankId, year, period]);

  const { data: allAccounts = [] } = useQuery({
    queryKey: ['accounts', companyId, year, period],
    queryFn: () => apiClient.getAccounts(companyId, year, period),
    enabled: Boolean(companyId)
  });

  const actions = useConciliacionTabActions({
    companyId,
    companyName: activeCompany?.name ?? 'Empresa',
    companyRfc: activeCompany?.rfc ?? 'XAXX010101000',
    effectiveBankId,
    year,
    period,
    isWriteLocked,
    reconData,
    reconFormula
  });

  const selectedLine =
    reconData?.statementLines.find((l) => l.id === actions.selectedLineId && !l.matchedMovementId) || null;
  const selectedBookIdSet = new Set(actions.selectedBookMovIds);
  const selectedBookMovs =
    reconData?.bookMovements.filter((b) => selectedBookIdSet.has(b.movementId) && !b.isMatched) ?? [];
  const selectedBookMov = selectedBookMovs[0] ?? null;
  const isDepositLine = Boolean(selectedLine && selectedLine.abonoBanco > 0 && selectedLine.cargoBanco === 0);
  const selectedBooksSum = selectedBookMovs.reduce(
    (sum, b) => sum + (selectedLine ? (isDepositLine ? b.cargoContable : b.abonoContable) : (b.cargoContable || b.abonoContable)),
    0
  );
  const highlightAmount = selectedLine ? (selectedLine.cargoBanco > 0 ? selectedLine.cargoBanco : selectedLine.abonoBanco) : null;
  const manualDiff = highlightAmount !== null ? Math.abs(selectedBooksSum - highlightAmount) : 0;

  useEffect(() => {
    if (!selectedLine && selectedBookMovs.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      actions.setSelectedLineId(null);
      actions.clearBookMovIds();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedLine, selectedBookMovs.length, actions.setSelectedLineId, actions.clearBookMovIds]);

  return (
    <div className="space-y-5">
      <ConciliacionToolbar
        effectiveBankId={effectiveBankId}
        setSelectedBankId={setSelectedBankId}
        bankAccounts={bankAccounts}
        onOpenLedger={onOpenLedger}
        showOnlyPending={showOnlyPending}
        onTogglePending={() => setShowOnlyPending((p) => !p)}
        csvInputRef={csvInputRef}
        onCsvUpload={onCsvUpload}
        isCsvUploading={props.isCsvUploading}
        onOpenPdfImport={() => { if (bankPdfModalRef.current && !bankPdfModalRef.current.open) bankPdfModalRef.current.showModal(); }}
        onOpenAddLine={() => { if (addBankModalRef.current && !addBankModalRef.current.open) addBankModalRef.current.showModal(); }}
        onExportExcel={actions.handleExportExcel}
        onPrintPdf={actions.handlePrintPdf}
        canExport={Boolean(reconData && reconFormula)}
        onProposeN1={() => void actions.handleProposeN1()}
        isSearchingN1={actions.isSearchingN1}
        isApplyingN1={actions.isApplyingN1}
        onAutoMatch={onAutoMatch}
        isAutoMatchPending={isAutoMatchPending}
        isWriteLocked={isWriteLocked}
        isReadOnly={isReadOnly}
      />

      <ConciliacionN1Panel
        proposals={actions.n1Proposals}
        isApplying={actions.isApplyingN1}
        isLocked={isWriteLocked}
        onDiscardAll={() => actions.setN1Proposals([])}
        onRemoveProposal={(bankLineId) => actions.setN1Proposals((prev) => prev.filter((item) => item.bankLineId !== bankLineId))}
        onApplyAll={() => void actions.handleApplyN1()}
      />

      {(selectedLine || selectedBookMovs.length > 0) && !isWriteLocked && (
        <div
          role="region"
          aria-live="polite"
          aria-label="Emparejamiento manual 1 a 1 y N a 1"
          className="bg-blue-50 border border-blue-300 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div className="text-blue-950">
            {selectedLine && selectedBookMovs.length > 0 ? (
              <>
                <strong>Paso 2 — Cruce Manual {selectedBookMovs.length > 1 ? `N:1 (${selectedBookMovs.length} partidas)` : '1:1'}:</strong> Banco{' '}
                <span className="font-mono">{selectedLine.referencia}</span> ({formatCurrency(highlightAmount ?? 0)}) ↔ Libros{' '}
                <span className="font-mono">
                  {selectedBookMovs.length === 1 ? selectedBookMov?.polizaFolio : `${selectedBookMovs.length} pólizas`}
                </span>{' '}
                ({formatCurrency(selectedBooksSum)})
                {manualDiff > 0.05 && (
                  <span className="ml-2 font-semibold text-red-700">
                    · Diferencia: {formatCurrency(manualDiff)} (máx. ±$0.05)
                  </span>
                )}
              </>
            ) : selectedLine ? (
              <>
                <strong>Paso 1 de 2:</strong> Partida bancaria <span className="font-mono">{selectedLine.referencia}</span> ({formatCurrency(highlightAmount ?? 0)}) seleccionada. Ahora selecciona una o varias partidas en <strong>2. Movimientos Contables en Libros</strong>.
              </>
            ) : (
              <>
                <strong>Paso 1 de 2:</strong> {selectedBookMovs.length === 1 ? `Movimiento ${selectedBookMov?.polizaFolio}` : `${selectedBookMovs.length} movimientos en libros`} ({formatCurrency(selectedBooksSum)}) seleccionado(s). Ahora haz clic en la partida bancaria correspondiente en <strong>1. Estado de Cuenta Bancario</strong>.
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { actions.setSelectedLineId(null); actions.clearBookMovIds(); }}
              title="Cancelar selección actual (Esc)"
            >
              <span>Limpiar Selección</span>
              <kbd className="hidden sm:inline-block px-1 py-0.2 rounded border border-slate-300 bg-slate-100 text-[10px] font-mono text-slate-600">Esc</kbd>
            </Button>
            {selectedLine && selectedBookMovs.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                loading={actions.manualMatchMutation.isPending}
                disabled={manualDiff > 0.05}
                onClick={() =>
                  actions.manualMatchMutation.mutate({
                    lineId: selectedLine.id,
                    movementIds: selectedBookMovs.map((b) => b.movementId)
                  })
                }
                leftIcon={<Link2 className="w-3.5 h-3.5" aria-hidden="true" />}
              >
                {actions.manualMatchMutation.isPending
                  ? 'Conciliando...'
                  : selectedBookMovs.length > 1
                    ? `Conciliar N:1 (${selectedBookMovs.length})`
                    : 'Conciliar Seleccionados'}
              </Button>
            )}
          </div>
        </div>
      )}

      {isErrorRecon ? (
        <div role="alert">
          <EmptyState
            variant="card"
            tone="red"
            icon={<AlertCircle className="w-6 h-6" aria-hidden="true" />}
            title="Error al cargar la conciliación bancaria"
            description={errorRecon instanceof Error ? errorRecon.message : 'Error de conexión al servidor contable.'}
            actions={
              onRetryRecon && (
                <Button variant="primary" onClick={onRetryRecon} leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}>
                  Reintentar
                </Button>
              )
            }
          />
        </div>
      ) : isLoadingRecon || !reconData || !reconFormula ? (
        <div role="status" aria-live="polite" aria-busy="true" className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-600">
          Cargando estado de cuenta bancario y movimientos contables...
        </div>
      ) : (
        <>
          <ConciliacionArithmeticCard
            reconData={reconData}
            reconFormula={reconFormula}
            bankStatementFinalBalance={actions.bankStatementBalance}
            bankBalanceDraft={actions.bankBalanceDraft}
            hasCapturedBankBalance={actions.hasCapturedBankBalance}
            closureSaveStatus={actions.closureSaveStatus}
            onBankBalanceDraftChange={actions.handleBankBalanceChange}
            isLocked={isWriteLocked}
          />
          <BankStatementTable
            reconData={reconData}
            isPeriodLocked={isPeriodLocked}
            isReadOnlyClient={isReadOnly}
            isCreatePolizaPending={isCreatePolizaPending || actions.customCreatePolizaMutation.isPending}
            onCreatePolizaFromBank={(lineId) => actions.setPolizaModalLine(reconData.statementLines.find((l) => l.id === lineId) ?? null)}
            isUnmatchPending={isUnmatchPending}
            onUnmatchBankLine={onUnmatchBankLine}
            onDeleteBankLine={(lineId) => actions.deleteBankLineMutation.mutate(lineId)}
            isDeletePending={actions.deleteBankLineMutation.isPending}
            showOnlyPending={showOnlyPending}
            selectedLineId={actions.selectedLineId}
            onSelectLine={(id) => actions.setSelectedLineId((prev) => (prev === id ? null : id))}
            activeBankLineId={
              actions.customCreatePolizaMutation.isPending
                ? (actions.customCreatePolizaMutation.variables?.lineId ?? null)
                : activeBankLineId
            }
            onTriggerCsvImport={() => csvInputRef.current?.click()}
            onOpenAddLine={() => { if (addBankModalRef.current && !addBankModalRef.current.open) addBankModalRef.current.showModal(); }}
            onClearPendingFilter={() => setShowOnlyPending(false)}
          />
          <BankBookMovementsTable
            reconData={reconData}
            showOnlyPending={showOnlyPending}
            highlightAmount={highlightAmount}
            selectedBookMovementIds={selectedBookIdSet}
            onToggleBookMovement={actions.toggleBookMovId}
          />
        </>
      )}

      <BankLinePolizaModal
        line={actions.polizaModalLine}
        accounts={allAccounts.length > 0 ? allAccounts : bankAccounts}
        currentBankAccountId={effectiveBankId}
        isSubmitting={actions.customCreatePolizaMutation.isPending}
        onClose={() => actions.setPolizaModalLine(null)}
        onSubmit={(lineId, options) => actions.customCreatePolizaMutation.mutate({ lineId, options })}
      />

      <AddBankStatementLineModal
        addBankModalRef={addBankModalRef}
        bFecha={props.bFecha} setBFecha={props.setBFecha} bRef={props.bRef} setBRef={props.setBRef}
        bDesc={props.bDesc} setBDesc={props.setBDesc} bTipo={props.bTipo} setBTipo={props.setBTipo}
        bMonto={props.bMonto} setBMonto={props.setBMonto} onAddBankLineSubmit={props.onAddBankLineSubmit}
        isAddBankLinePending={props.isAddBankLinePending} isWriteLocked={isWriteLocked}
      />

      <BankPdfImportModal
        dialogRef={bankPdfModalRef} companyId={companyId} accountId={effectiveBankId}
        isPeriodLocked={isPeriodLocked} isReadOnlyClient={isReadOnly}
        onImported={(importedCompanyId) => invalidateAccountingQueries(queryClient, ['bank-reconciliation', 'dashboard'], importedCompanyId)}
        onFeedback={(msg, type) => (type === 'error' ? toast.error(msg) : toast.success(msg))}
      />
    </div>
  );
}
