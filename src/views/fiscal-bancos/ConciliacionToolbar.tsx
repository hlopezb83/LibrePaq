import React from 'react';
import {
  BookOpen, FileSpreadsheet, Filter, GitMerge, Loader2, Lock, Plus, Printer, RefreshCw, Sparkles, UploadCloud
} from 'lucide-react';
import { Button, Select } from '../../components/ui';
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
  isCsvUploading?: boolean;
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
  showOnlyPending, onTogglePending, csvInputRef, onCsvUpload, isCsvUploading = false,
  onOpenPdfImport, onOpenAddLine, onExportExcel, onPrintPdf, canExport,
  onProposeN1, isSearchingN1, isApplyingN1, onAutoMatch, isAutoMatchPending,
  isWriteLocked, isReadOnly
}: ConciliacionToolbarProps) {
  const lockTitle = isReadOnly ? 'Modo solo lectura' : 'Periodo bloqueado ante el SAT';
  const hasBankAccounts = bankAccounts.length > 0 && Boolean(effectiveBankId);
  const csvDisabled = isWriteLocked || isCsvUploading || !hasBankAccounts;

  return (
    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-300/90 shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
        <label htmlFor="bank-acc-select" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
          Cuenta Bancaria:
        </label>
        <Select
          id="bank-acc-select"
          value={effectiveBankId}
          disabled={bankAccounts.length === 0}
          onChange={(e) => setSelectedBankId(e.target.value)}
          containerClassName="w-full min-w-0 sm:min-w-[240px] sm:flex-1"
          className="font-mono font-semibold"
        >
          {bankAccounts.length === 0 ? (
            <option value="">Sin cuentas bancarias 102-* configuradas en el catálogo</option>
          ) : (
            bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name} (Saldo: {formatCurrency(b.finalBalance)})
              </option>
            ))
          )}
        </Select>

        <Button
          variant="secondary"
          disabled={!hasBankAccounts}
          title={hasBankAccounts ? 'Abrir Libro Mayor de esta cuenta bancaria' : 'No hay cuentas bancarias 102-* configuradas'}
          onClick={() => onOpenLedger(effectiveBankId)}
          leftIcon={<BookOpen className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />}
        >
          Libro Mayor
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={showOnlyPending}
            onClick={onTogglePending}
            title="Mostrar únicamente partidas sin conciliar en estado de cuenta y libros"
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              showOnlyPending
                ? 'bg-amber-100 border-amber-300 text-amber-950 shadow-2xs'
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-2xs'
            }`}
          >
            <Filter className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Solo Pendientes</span>
          </button>

          <label
            htmlFor="bank-csv-upload"
            aria-busy={isCsvUploading}
            title={
              isWriteLocked
                ? lockTitle
                : !hasBankAccounts
                  ? 'Configura primero una cuenta bancaria 102-*'
                  : isCsvUploading
                    ? 'Subiendo movimientos bancarios...'
                    : 'Importar CSV o TXT Banco'
            }
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border shadow-2xs transition focus-within:outline-2 focus-within:outline-blue-600 focus-within:outline-offset-2 ${
              csvDisabled
                ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200'
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 cursor-pointer'
            }`}
          >
            <input
              id="bank-csv-upload"
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv,.txt,text/plain"
              disabled={csvDisabled}
              onChange={onCsvUpload}
              className="visually-hidden"
            />
            {isCsvUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" aria-hidden="true" />
            ) : (
              <UploadCloud className="w-4 h-4 text-slate-500" aria-hidden="true" />
            )}
            <span>{isCsvUploading ? 'Importando...' : 'Importar CSV / TXT'}</span>
          </label>

          <Button
            variant="secondary"
            disabled={isWriteLocked || !hasBankAccounts}
            title={isWriteLocked ? lockTitle : !hasBankAccounts ? 'Sin cuenta bancaria 102-*' : 'Importar movimientos desde estado de cuenta bancario PDF'}
            onClick={onOpenPdfImport}
            leftIcon={<Sparkles className="w-4 h-4 text-blue-700" aria-hidden="true" />}
            className="border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-800"
          >
            Importar PDF Bancario
          </Button>

          <Button
            variant="secondary"
            disabled={isWriteLocked || !hasBankAccounts}
            onClick={onOpenAddLine}
            title={isWriteLocked ? lockTitle : !hasBankAccounts ? 'Sin cuenta bancaria 102-*' : 'Agregar Línea Manual al Estado de Cuenta'}
            leftIcon={isWriteLocked ? <Lock className="w-4 h-4 text-slate-500" aria-hidden="true" /> : <Plus className="w-4 h-4 text-slate-500" aria-hidden="true" />}
          >
            Agregar Línea
          </Button>

          <Button
            variant="export-outline"
            disabled={!canExport}
            onClick={onExportExcel}
            title={!canExport ? 'Sin datos de conciliación para exportar' : 'Exportar Cédula de Conciliación Bancaria en Excel (.xlsx)'}
            leftIcon={<FileSpreadsheet className="w-4 h-4" aria-hidden="true" />}
          >
            Excel
          </Button>

          <Button
            variant="secondary"
            disabled={!canExport}
            onClick={onPrintPdf}
            title={!canExport ? 'Sin datos de conciliación para imprimir' : 'Imprimir / Guardar PDF Cédula Formal de Conciliación'}
            leftIcon={<Printer className="w-4 h-4 text-slate-600" aria-hidden="true" />}
          >
            PDF
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Button
            variant="export"
            loading={isSearchingN1}
            disabled={isApplyingN1 || isWriteLocked || !hasBankAccounts}
            title={isWriteLocked ? lockTitle : !hasBankAccounts ? 'Sin cuenta bancaria 102-*' : 'Buscar grupos de varias pólizas que sumen un solo movimiento bancario'}
            onClick={onProposeN1}
            leftIcon={isSearchingN1 ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <GitMerge className="w-4 h-4" aria-hidden="true" />}
          >
            {isSearchingN1 ? 'Buscando grupos...' : 'Conciliar Múltiples Pólizas'}
          </Button>

          <Button
            variant="primary"
            loading={isAutoMatchPending}
            disabled={isWriteLocked || !hasBankAccounts}
            onClick={onAutoMatch}
            title={isWriteLocked ? lockTitle : !hasBankAccounts ? 'Sin cuenta bancaria 102-*' : 'Emparejar automáticamente movimientos coincidentes'}
            leftIcon={<RefreshCw className={`w-4 h-4 ${isAutoMatchPending ? 'animate-spin' : ''}`} aria-hidden="true" />}
          >
            Conciliar Automáticamente
          </Button>
        </div>
      </div>
    </div>
  );
}
