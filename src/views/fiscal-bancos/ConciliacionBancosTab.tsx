import React from 'react';
import {
  BookOpen,
  Lock,
  Plus,
  RefreshCw,
  UploadCloud
} from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { AccountWithBalance, BankReconciliationResponse, ReconciliationFormulaData } from '../../shared/types';
import { ConciliacionArithmeticCard } from './ConciliacionArithmeticCard';
import { BankStatementTable } from './BankStatementTable';
import { BankBookMovementsTable } from './BankBookMovementsTable';
import { AddBankStatementLineModal } from './AddBankStatementLineModal';

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
  reconData: BankReconciliationResponse | null | undefined;
  reconFormula: ReconciliationFormulaData | null;
  onCreatePolizaFromBank: (lineId: string) => void;
  isCreatePolizaPending: boolean;
  onUnmatchBankLine: (lineId: string) => void;
  isUnmatchPending: boolean;
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

export function ConciliacionBancosTab({
  effectiveBankId,
  setSelectedBankId,
  bankAccounts,
  onOpenLedger,
  csvInputRef,
  onCsvUpload,
  isPeriodLocked,
  addBankModalRef,
  onAutoMatch,
  isAutoMatchPending,
  isLoadingRecon,
  reconData,
  reconFormula,
  onCreatePolizaFromBank,
  isCreatePolizaPending,
  onUnmatchBankLine,
  isUnmatchPending,
  bFecha,
  setBFecha,
  bRef,
  setBRef,
  bDesc,
  setBDesc,
  bTipo,
  setBTipo,
  bMonto,
  setBMonto,
  onAddBankLineSubmit,
  isAddBankLinePending
}: ConciliacionBancosTabProps) {
  return (
    <div className="space-y-5">
      {/* Selector de Cuenta Bancaria y Botonera Simétrica de Conciliación */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-300/90 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <label
            htmlFor="bank-acc-select"
            className="text-xs font-bold text-slate-700 whitespace-nowrap"
          >
            Cuenta:
          </label>
          <select
            id="bank-acc-select"
            value={effectiveBankId}
            onChange={(e) => setSelectedBankId(e.target.value)}
            className="max-w-[280px] sm:max-w-[340px] truncate px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-semibold bg-white text-slate-800"
          >
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name} (Saldo: {formatCurrency(b.finalBalance)})
              </option>
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
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onCsvUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={isPeriodLocked}
            onClick={() => csvInputRef.current?.click()}
            title={isPeriodLocked ? 'Periodo bloqueado ante el SAT' : 'Importar CSV Banco'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              isPeriodLocked
                ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 cursor-pointer'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-slate-500" aria-hidden="true" />
            Importar CSV
          </button>

          <button
            type="button"
            disabled={isPeriodLocked}
            onClick={() => addBankModalRef.current?.showModal()}
            title={isPeriodLocked ? 'Periodo bloqueado ante el SAT' : 'Agregar Línea Manual al Estado de Cuenta'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              isPeriodLocked
                ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 cursor-pointer'
            }`}
          >
            {isPeriodLocked ? <Lock className="w-4 h-4 text-slate-400" aria-hidden="true" /> : <Plus className="w-4 h-4 text-slate-500" aria-hidden="true" />}
            Agregar Línea
          </button>

          <button
            type="button"
            disabled={isAutoMatchPending}
            onClick={onAutoMatch}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer transition shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 ${isAutoMatchPending ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Conciliar Automáticamente
          </button>
        </div>
      </div>

      {isLoadingRecon || !reconData || !reconFormula ? (
        <div className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-500">
          Cargando estado de cuenta bancario y movimientos contables...
        </div>
      ) : (
        <>
          {/* Cédula Aritmética de Conciliación Bancaria */}
          <ConciliacionArithmeticCard reconData={reconData} reconFormula={reconFormula} />

          {/* Tabla 1: Líneas del Estado de Cuenta Bancario */}
          <BankStatementTable
            reconData={reconData}
            isPeriodLocked={isPeriodLocked}
            isCreatePolizaPending={isCreatePolizaPending}
            onCreatePolizaFromBank={onCreatePolizaFromBank}
            isUnmatchPending={isUnmatchPending}
            onUnmatchBankLine={onUnmatchBankLine}
          />

          {/* Tabla 2: Movimientos Contables Registrados en Libros */}
          <BankBookMovementsTable reconData={reconData} />
        </>
      )}

      {/* Modal para Agregar Línea Manual al Estado de Cuenta */}
      <AddBankStatementLineModal
        addBankModalRef={addBankModalRef}
        bFecha={bFecha}
        setBFecha={setBFecha}
        bRef={bRef}
        setBRef={setBRef}
        bDesc={bDesc}
        setBDesc={setBDesc}
        bTipo={bTipo}
        setBTipo={setBTipo}
        bMonto={bMonto}
        setBMonto={setBMonto}
        onAddBankLineSubmit={onAddBankLineSubmit}
        isAddBankLinePending={isAddBankLinePending}
      />
    </div>
  );
}
