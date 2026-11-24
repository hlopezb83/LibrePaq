import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Link2, RefreshCw } from 'lucide-react';
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
  const selectedBookMov =
    reconData?.bookMovements.find((b) => b.movementId === actions.selectedBookMovId && !b.isMatched) || null;
  const highlightAmount = selectedLine ? (selectedLine.cargoBanco > 0 ? selectedLine.cargoBanco : selectedLine.abonoBanco) : null;

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

      {selectedLine && selectedBookMov && !isWriteLocked && (
        <div role="region" aria-label="Emparejamiento manual 1 a 1" className="bg-blue-50 border border-blue-300 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-blue-950">
            <strong>Emparejamiento Manual 1-a-1:</strong> Banco <span className="font-mono">{selectedLine.referencia}</span> ({formatCurrency(selectedLine.cargoBanco || selectedLine.abonoBanco)}) ↔ Libros <span className="font-mono">{selectedBookMov.polizaFolio}</span> ({formatCurrency(selectedBookMov.cargoContable || selectedBookMov.abonoContable)})
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => { actions.setSelectedLineId(null); actions.setSelectedBookMovId(null); }} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold cursor-pointer">
              Limpiar Selección
            </button>
            <button
              type="button"
              disabled={actions.manualMatchMutation.isPending}
              onClick={() => actions.manualMatchMutation.mutate({ lineId: selectedLine.id, movementId: selectedBookMov.movementId })}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold cursor-pointer disabled:opacity-50"
            >
              <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
              {actions.manualMatchMutation.isPending ? 'Conciliando...' : 'Conciliar Seleccionados'}
            </button>
          </div>
        </div>
      )}

      {isErrorRecon ? (
        <div role="alert" className="p-8 bg-white rounded-2xl border border-red-200 text-center space-y-3 shadow-2xs">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-900">Error al cargar la conciliación bancaria</p>
          <p className="text-xs text-slate-600">{errorRecon instanceof Error ? errorRecon.message : 'Error de conexión al servidor contable.'}</p>
          {onRetryRecon && (
            <button type="button" onClick={onRetryRecon} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Reintentar
            </button>
          )}
        </div>
      ) : isLoadingRecon || !reconData || !reconFormula ? (
        <div role="status" aria-live="polite" aria-busy="true" className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-500">
          Cargando estado de cuenta bancario y movimientos contables...
        </div>
      ) : (
        <>
          <ConciliacionArithmeticCard
            reconData={reconData}
            reconFormula={reconFormula}
            bankStatementFinalBalance={actions.bankStatementBalance}
            onBankStatementFinalBalanceChange={actions.handleBankBalanceChange}
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
            activeBankLineId={activeBankLineId}
          />
          <BankBookMovementsTable
            reconData={reconData}
            showOnlyPending={showOnlyPending}
            highlightAmount={highlightAmount}
            selectedBookMovementId={actions.selectedBookMovId}
            onSelectBookMovement={(id) => actions.setSelectedBookMovId((prev) => (prev === id ? null : id))}
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
