import React from 'react';
import {
  BookOpen, FileSpreadsheet, Filter, GitMerge, Loader2, Lock, Plus, Printer, RefreshCw, Sparkles, UploadCloud
} from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { AccountWithBalance } from '../../shared/types';

interface ConciliacionToolbarProps {
  effectiveBankId: string;
  setSelectedBankId: (id: string) => void;
  bankAccounts: AccountWithBalance[];
  onOpenLedger: (id: string) => void;
  showOnlyPending: boolean;
  onTogglePending: () => void;
  csvInputRef: React.RefObject<HTMLInputElement | null>;
  onCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenPdfImport: () => void;
  onOpenAddLine: () => void;
  onExportExcel: () => void;
  onPrintPdf: () => void;
  canExport: boolean;
  onProposeN1: () => void;
  isSearchingN1: boolean;
  isApplyingN1: boolean;
  onAutoMatch: () => void;
  isAutoMatchPending: boolean;
  isWriteLocked: boolean;
  isReadOnly: boolean;
}

export function ConciliacionToolbar({
  effectiveBankId, setSelectedBankId, bankAccounts, onOpenLedger,
  showOnlyPending, onTogglePending, csvInputRef, onCsvUpload,
  onOpenPdfImport, onOpenAddLine, onExportExcel, onPrintPdf, canExport,
  onProposeN1, isSearchingN1, isApplyingN1, onAutoMatch, isAutoMatchPending,
  isWriteLocked, isReadOnly
}: ConciliacionToolbarProps) {
  const lockTitle = isReadOnly ? 'Modo solo lectura' : 'Periodo bloqueado ante el SAT';

  return (
    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-300/90 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
        <label htmlFor="bank-acc-select" className="text-xs font-bold text-slate-700 whitespace-nowrap">Cuenta:</label>
        <select
          id="bank-acc-select"
          value={effectiveBankId}
          onChange={(e) => setSelectedBankId(e.target.value)}
          className="max-w-full sm:max-w-[340px] truncate px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-semibold bg-white text-slate-800"
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
          onClick={onTogglePending}
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
          title={isWriteLocked ? lockTitle : 'Importar CSV Banco'}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition focus-within:outline-2 focus-within:outline-blue-600 focus-within:outline-offset-2 ${
            isWriteLocked ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 cursor-pointer'
          }`}
        >
          <input id="bank-csv-upload" ref={csvInputRef} type="file" accept=".csv,text/csv" disabled={isWriteLocked} onChange={onCsvUpload} className="visually-hidden" />
          <UploadCloud className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <span>Importar CSV</span>
        </label>

        <button
          type="button"
          disabled={isWriteLocked}
          title={isWriteLocked ? lockTitle : 'Importar movimientos desde estado de cuenta bancario PDF'}
          onClick={onOpenPdfImport}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
        >
          <Sparkles className="w-4 h-4 text-indigo-600" aria-hidden="true" />
          <span>Importar PDF Bancario</span>
        </button>

        <button
          type="button"
          disabled={isWriteLocked}
          onClick={onOpenAddLine}
          title={isWriteLocked ? lockTitle : 'Agregar Línea Manual al Estado de Cuenta'}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
            isWriteLocked ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 cursor-pointer'
          }`}
        >
          {isWriteLocked ? <Lock className="w-4 h-4 text-slate-500" aria-hidden="true" /> : <Plus className="w-4 h-4 text-slate-500" aria-hidden="true" />}
          Agregar Línea
        </button>

        <button
          type="button"
          disabled={!canExport}
          onClick={onExportExcel}
          title="Exportar Cédula de Conciliación Bancaria en Excel (.xlsx)"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 disabled:opacity-50 cursor-pointer transition"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" aria-hidden="true" />
          <span>Excel</span>
        </button>

        <button
          type="button"
          disabled={!canExport}
          onClick={onPrintPdf}
          title="Imprimir / Guardar PDF Cédula Formal de Conciliación"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 disabled:opacity-50 cursor-pointer transition"
        >
          <Printer className="w-4 h-4 text-slate-600" aria-hidden="true" />
          <span>PDF</span>
        </button>

        <button
          type="button"
          disabled={isSearchingN1 || isApplyingN1 || isWriteLocked}
          title={isWriteLocked ? lockTitle : 'Buscar grupos de varias pólizas que sumen un solo movimiento bancario'}
          onClick={onProposeN1}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs cursor-pointer transition shrink-0"
        >
          {isSearchingN1 ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <GitMerge className="w-4 h-4" aria-hidden="true" />}
          {isSearchingN1 ? 'Buscando grupos...' : 'Conciliar Múltiples Pólizas'}
        </button>

        <button
          type="button"
          disabled={isAutoMatchPending || isWriteLocked}
          onClick={onAutoMatch}
          title={isWriteLocked ? lockTitle : 'Emparejar automáticamente movimientos coincidentes'}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs cursor-pointer transition shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isAutoMatchPending ? 'animate-spin' : ''}`} aria-hidden="true" />
          Conciliar Automáticamente
        </button>
      </div>
    </div>
  );
}
