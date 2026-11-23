import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, BookOpen, CheckCircle2, Filter, GitMerge, Lock, Plus, RefreshCw, Sparkles, UploadCloud, X
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { invalidateAccountingQueries } from '../../lib/api-client';
import { bankN1Client } from '../../lib/bank-n1-client';
import { formatCurrency } from '../../lib/formatters';
import type { AccountWithBalance, BankReconciliationResponse, ReconciliationFormulaData } from '../../shared/types';
import type { BankN1MatchProposal } from '../../shared/types/bank-n1.types';
import { ConciliacionArithmeticCard } from './ConciliacionArithmeticCard';
import { BankStatementTable } from './BankStatementTable';
import { BankBookMovementsTable } from './BankBookMovementsTable';
import { AddBankStatementLineModal } from './AddBankStatementLineModal';
import { BankPdfImportModal } from './BankPdfImportModal';

export interface ConciliacionBancosTabProps {
  effectiveBankId: string;
  setSelectedBankId: (id: string) => void;
  bankAccounts: AccountWithBalance[];
  onOpenLedger: (id: string) => void;
  csvInputRef: React.RefObject<HTMLInputElement | null>;
  onCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isPeriodLocked: boolean;
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
    csvInputRef, onCsvUpload, isPeriodLocked, addBankModalRef,
    onAutoMatch, isAutoMatchPending, isLoadingRecon, isErrorRecon,
    errorRecon, onRetryRecon, reconData, reconFormula,
    onCreatePolizaFromBank, isCreatePolizaPending, onUnmatchBankLine,
    isUnmatchPending, activeBankLineId = null
  } = props;

  const { activeCompanyId, activeCompany } = useCompany();
  const queryClient = useQueryClient();
  const toast = useToast();
  const bankPdfModalRef = useRef<HTMLDialogElement | null>(null);

  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [n1Proposals, setN1Proposals] = useState<BankN1MatchProposal[]>([]);
  const [isSearchingN1, setIsSearchingN1] = useState(false);
  const [isApplyingN1, setIsApplyingN1] = useState(false);

  const companyId = reconData?.account.companyId || activeCompanyId;
  const year = reconData?.ejercicio ?? activeCompany?.currentYear;
  const period = reconData?.periodo ?? activeCompany?.currentPeriod;

  const selectedLine = reconData?.statementLines.find((l) => l.id === selectedLineId) || null;
  const highlightAmount = selectedLine
    ? selectedLine.cargoBanco > 0 ? selectedLine.cargoBanco : selectedLine.abonoBanco
    : null;

  const handleProposeN1 = async () => {
    if (!companyId || !effectiveBankId) return;
    setIsSearchingN1(true);
    try {
      const res = await bankN1Client.proposeBankN1Matches(companyId, effectiveBankId, year, period);
      if (res.proposals.length === 0) {
        setN1Proposals([]);
        toast.info('No se detectaron grupos N-a-1 pendientes dentro de la tolerancia.');
      } else {
        setN1Proposals(res.proposals);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error buscando coincidencias N-a-1.');
    } finally {
      setIsSearchingN1(false);
    }
  };

  const handleApplyN1 = async () => {
    if (!companyId || !effectiveBankId || n1Proposals.length === 0) return;
    setIsApplyingN1(true);
    try {
      const res = await bankN1Client.applyBankN1Matches(companyId, effectiveBankId, n1Proposals, year, period);
      invalidateAccountingQueries(queryClient, ['bank-reconciliation', 'dashboard']);
      setN1Proposals([]);
      toast.success(`Conciliación N-a-1 aplicada: ${res.appliedCount} partidas bancarias cruzadas.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error aplicando conciliación N-a-1.');
    } finally {
      setIsApplyingN1(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-300/90 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <label htmlFor="bank-acc-select" className="text-xs font-bold text-slate-700 whitespace-nowrap">Cuenta:</label>
          <select
            id="bank-acc-select"
            value={effectiveBankId}
            onChange={(e) => setSelectedBankId(e.target.value)}
            className="max-w-[280px] sm:max-w-[340px] truncate px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-semibold bg-white text-slate-800"
          >
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>{b.code} — {b.name} (Saldo: {formatCurrency(b.finalBalance)})</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onOpenLedger(effectiveBankId)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer transition shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            Libro Mayor
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            aria-pressed={showOnlyPending}
            onClick={() => setShowOnlyPending((p) => !p)}
            title="Mostrar únicamente partidas sin conciliar en estado de cuenta y libros"
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              showOnlyPending ? 'bg-amber-100 border-amber-300 text-amber-950 shadow-2xs' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Solo Pendientes</span>
          </button>

          <label
            htmlFor="bank-csv-upload"
            title={isPeriodLocked ? 'Periodo bloqueado ante el SAT' : 'Importar CSV Banco'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition focus-within:outline-2 focus-within:outline-blue-600 focus-within:outline-offset-2 ${
              isPeriodLocked ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 cursor-pointer'
            }`}
          >
            <input id="bank-csv-upload" ref={csvInputRef} type="file" accept=".csv,text/csv" disabled={isPeriodLocked} onChange={onCsvUpload} className="visually-hidden" />
            <UploadCloud className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span>Importar CSV</span>
          </label>

          <button
            type="button"
            disabled={isPeriodLocked}
            onClick={() => { if (bankPdfModalRef.current && !bankPdfModalRef.current.open) bankPdfModalRef.current.showModal(); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" aria-hidden="true" />
            <span>Importar PDF Bancario (IA)</span>
          </button>

          <button
            type="button"
            disabled={isPeriodLocked}
            onClick={() => { if (addBankModalRef.current && !addBankModalRef.current.open) addBankModalRef.current.showModal(); }}
            title={isPeriodLocked ? 'Periodo bloqueado ante el SAT' : 'Agregar Línea Manual al Estado de Cuenta'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              isPeriodLocked ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 cursor-pointer'
            }`}
          >
            {isPeriodLocked ? <Lock className="w-4 h-4 text-slate-500" aria-hidden="true" /> : <Plus className="w-4 h-4 text-slate-500" aria-hidden="true" />}
            Agregar Línea
          </button>

          <button
            type="button"
            disabled={isSearchingN1 || isApplyingN1 || isPeriodLocked}
            onClick={() => void handleProposeN1()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs cursor-pointer transition shrink-0"
          >
            <GitMerge className="w-4 h-4" aria-hidden="true" />
            {isSearchingN1 ? 'Buscando N-a-1...' : 'Auto-Conciliar N-a-1'}
          </button>

          <button
            type="button"
            disabled={isAutoMatchPending || isPeriodLocked}
            onClick={onAutoMatch}
            title={isPeriodLocked ? 'Periodo bloqueado ante el SAT' : 'Emparejar automáticamente movimientos coincidentes'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs cursor-pointer transition shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isAutoMatchPending ? 'animate-spin' : ''}`} aria-hidden="true" />
            Conciliar Automáticamente
          </button>
        </div>
      </div>

      {n1Proposals.length > 0 && (
        <section aria-label="Propuestas de conciliación muchos a uno" className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-4 space-y-3 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-emerald-950">Propuestas N-a-1 Detectadas ({n1Proposals.length})</h3>
              <p className="text-xs text-emerald-800">Revisa los grupos de pólizas que suman cada movimiento bancario antes de aplicar</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setN1Proposals([])} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 cursor-pointer">
                Descartar
              </button>
              <button type="button" disabled={isApplyingN1 || isPeriodLocked} onClick={() => void handleApplyN1()} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 cursor-pointer">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                {isApplyingN1 ? 'Aplicando...' : `Aplicar N-a-1 (${n1Proposals.length})`}
              </button>
            </div>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {n1Proposals.map((p) => (
              <div key={p.bankLineId} className="bg-white rounded-xl border border-emerald-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-1 min-w-0">
                  <div className="font-semibold text-slate-900">
                    {p.bankFecha} · {p.bankReferencia} — {p.bankDescripcion}{' '}
                    <span className="font-mono font-bold text-emerald-800 tabular-nums">({formatCurrency(p.bankAmount)})</span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex flex-wrap gap-1.5">
                    {p.movements.map((m) => (
                      <span key={m.movementId} className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono">
                        {m.polizaFolio}: {formatCurrency(m.amount)}
                      </span>
                    ))}
                    {p.diffCents > 0 && <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono">Dif: {(p.diffCents / 100).toFixed(2)}</span>}
                  </div>
                </div>
                <button type="button" aria-label={`Quitar propuesta ${p.bankReferencia}`} onClick={() => setN1Proposals((prev) => prev.filter((item) => item.bankLineId !== p.bankLineId))} className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 self-end sm:self-center cursor-pointer">
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {isErrorRecon ? (
        <div role="alert" className="p-8 bg-white rounded-2xl border border-red-200 text-center space-y-3 shadow-2xs">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-900">Error al cargar la conciliación bancaria</p>
          <p className="text-xs text-slate-600">{errorRecon instanceof Error ? errorRecon.message : 'Error de conexión al servidor contable.'}</p>
          {onRetryRecon && (
            <button type="button" onClick={onRetryRecon} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Reintentar
            </button>
          )}
        </div>
      ) : isLoadingRecon || !reconData || !reconFormula ? (
        <div role="status" aria-live="polite" aria-busy="true" className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-500">
          Cargando estado de cuenta bancario y movimientos contables...
        </div>
      ) : (
        <>
          <ConciliacionArithmeticCard reconData={reconData} reconFormula={reconFormula} />
          <BankStatementTable
            reconData={reconData}
            isPeriodLocked={isPeriodLocked}
            isCreatePolizaPending={isCreatePolizaPending}
            onCreatePolizaFromBank={onCreatePolizaFromBank}
            isUnmatchPending={isUnmatchPending}
            onUnmatchBankLine={onUnmatchBankLine}
            showOnlyPending={showOnlyPending}
            selectedLineId={selectedLineId}
            onSelectLine={(id) => setSelectedLineId((prev) => (prev === id ? null : id))}
            activeBankLineId={activeBankLineId}
          />
          <BankBookMovementsTable reconData={reconData} showOnlyPending={showOnlyPending} highlightAmount={highlightAmount} />
        </>
      )}

      <AddBankStatementLineModal
        addBankModalRef={addBankModalRef}
        bFecha={props.bFecha}
        setBFecha={props.setBFecha}
        bRef={props.bRef}
        setBRef={props.setBRef}
        bDesc={props.bDesc}
        setBDesc={props.setBDesc}
        bTipo={props.bTipo}
        setBTipo={props.setBTipo}
        bMonto={props.bMonto}
        setBMonto={props.setBMonto}
        onAddBankLineSubmit={props.onAddBankLineSubmit}
        isAddBankLinePending={props.isAddBankLinePending}
      />

      <BankPdfImportModal
        dialogRef={bankPdfModalRef}
        companyId={companyId}
        accountId={effectiveBankId}
        isPeriodLocked={isPeriodLocked}
        onImported={() => invalidateAccountingQueries(queryClient, ['bank-reconciliation', 'dashboard'])}
        onFeedback={(msg, type) => (type === 'error' ? toast.error(msg) : toast.success(msg))}
      />
    </div>
  );
}
