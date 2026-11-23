import { createPortal } from 'react-dom';
import { AlertTriangle, BookOpen, Download, Loader2, Printer, RefreshCw, Search, X } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { AccountLedgerTable } from './AccountLedgerTable';
import { useAccountLedger } from './useAccountLedger';

interface AccountLedgerModalProps {
  companyId: string;
  accountId: string | null;
  onClose: () => void;
}

export function AccountLedgerModal({
  companyId,
  accountId,
  onClose
}: AccountLedgerModalProps) {
  const {
    dialogRef,
    data,
    isLoading,
    isError,
    error,
    refetch,
    mesNombre,
    ledgerSearch,
    setLedgerSearch,
    filteredEntries,
    isExporting,
    handleGoToPoliza,
    handleExportCsv,
    handleExportXlsx
  } = useAccountLedger(companyId, accountId, onClose);

  return createPortal(
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="ledger-modal-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-5xl max-h-[92dvh] overflow-hidden backdrop:bg-slate-900/60"
    >
      <div className="flex flex-col max-h-[92dvh]">
        <header className="p-4 sm:p-5 shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="ledger-modal-title" className="text-base font-bold text-slate-900 truncate">
                Tarjeta Auxiliar de Movimientos (Libro Mayor)
              </h2>
              {data && (
                <p className="text-xs text-slate-600 truncate">
                  <span className="font-mono font-bold text-blue-800 mr-1.5">
                    {data.account.code}
                  </span>
                  <strong className="text-slate-900">{data.account.name}</strong> • SAT:{' '}
                  <span className="font-mono">{data.account.satGroupCode}</span> • Periodo:{' '}
                  {mesNombre} {data.ejercicio}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            {data && (
              <>
                <button
                  type="button"
                  disabled={isExporting}
                  aria-busy={isExporting}
                  onClick={handleExportXlsx}
                  title="Descargar libro mayor en formato nativo Excel (.xlsx)"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition cursor-pointer"
                >
                  {isExporting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{isExporting ? 'Generando...' : 'Excel (.XLSX)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  title="Descargar datos en texto plano (.csv)"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  Imprimir
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar auxiliar de cuenta"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
          {isError ? (
            <div role="alert" className="p-8 text-center space-y-3 bg-red-50/60 border border-red-200 rounded-2xl">
              <AlertTriangle className="w-7 h-7 text-red-700 mx-auto" aria-hidden="true" />
              <p className="text-sm font-bold text-red-900">
                No fue posible consultar el auxiliar de la cuenta
              </p>
              <p className="text-xs text-red-800">
                {error instanceof Error ? error.message : 'Verifica tu conexión e intenta nuevamente.'}
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reintentar</span>
              </button>
            </div>
          ) : isLoading || !data ? (
            <div role="status" aria-live="polite" className="p-10 text-center text-xs text-slate-600 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-700" aria-hidden="true" />
              <span>Consultando movimientos auxiliares y calculando saldo progresivo...</span>
            </div>
          ) : (
          <>
            {/* Resumen del Auxiliar con Arrastre de Saldos */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
                <div className="text-[11px] font-bold text-slate-600 uppercase truncate">
                  Saldo Inicial ({mesNombre})
                </div>
                <div
                  className="mt-1 text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900 truncate"
                  title={formatCurrency(data.initialBalance)}
                >
                  {formatCurrency(data.initialBalance)}
                </div>
                <div className="text-[10px] text-slate-600">
                  Incluye arrastre de meses previos
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
                <div className="text-[11px] font-bold text-slate-600 uppercase truncate">
                  (+) Cargos del Periodo
                </div>
                <div
                  className="mt-1 text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900 truncate"
                  title={formatCurrency(data.totalCharges)}
                >
                  {formatCurrency(data.totalCharges)}
                </div>
                <div className="text-[10px] text-slate-600">Movimientos en el Debe</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
                <div className="text-[11px] font-bold text-slate-600 uppercase truncate">
                  (-) Abonos del Periodo
                </div>
                <div
                  className="mt-1 text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900 truncate"
                  title={formatCurrency(data.totalCredits)}
                >
                  {formatCurrency(data.totalCredits)}
                </div>
                <div className="text-[10px] text-slate-600">Movimientos en el Haber</div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 min-w-0">
                <div className="text-[11px] font-bold text-blue-900 uppercase truncate">
                  (=) Saldo Final Acumulado
                </div>
                <div
                  className="mt-1 text-sm sm:text-base font-bold font-mono tabular-nums text-blue-950 truncate"
                  title={formatCurrency(data.finalBalance)}
                >
                  {formatCurrency(data.finalBalance)}
                </div>
                <div className="text-[10px] text-blue-800">
                  Naturaleza {data.account.nature}
                </div>
              </div>
            </div>

            {/* Barra de Filtro en Vivo dentro del Auxiliar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs no-print">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search
                  className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  aria-label="Filtrar por concepto, referencia o UUID en el auxiliar"
                  placeholder="Filtrar por concepto, referencia o UUID..."
                  className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                {ledgerSearch && (
                  <button
                    type="button"
                    onClick={() => setLedgerSearch('')}
                    aria-label="Limpiar búsqueda en auxiliar"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <div aria-live="polite" className="text-slate-600 text-[11px] font-medium">
                {ledgerSearch.trim() ? (
                  <span>
                    Mostrando <strong>{filteredEntries.length}</strong> de {data.entries.length} movimientos
                  </span>
                ) : (
                  <span>
                    Total de movimientos: <strong>{data.entries.length}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Tabla Cronológica de Movimientos */}
            <AccountLedgerTable
              data={data}
              mesNombre={mesNombre}
              filteredEntries={filteredEntries}
              ledgerSearch={ledgerSearch}
              onGoToPoliza={handleGoToPoliza}
            />
          </>
        )}
        </div>
      </div>
    </dialog>,
    document.body
  );
}
