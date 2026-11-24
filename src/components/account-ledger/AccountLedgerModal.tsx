import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, BookOpen, Download, Loader2, Printer, RefreshCw, Search, X } from 'lucide-react';
import { MESES_SAT } from '../../shared/sat-constants';
import { AccountLedgerKpiGrid } from './AccountLedgerKpiGrid';
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const {
    dialogRef,
    data,
    isLoading,
    isError,
    error,
    refetch,
    currentPeriod,
    mesNombre,
    periodFrom,
    setPeriodFrom,
    periodTo,
    setPeriodTo,
    effectiveFrom,
    effectiveTo,
    applyRangePreset,
    ledgerSearch,
    setLedgerSearch,
    filteredEntries,
    isExporting,
    requestDialogClose,
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
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-5xl max-h-[92dvh] open:flex open:flex-col overflow-hidden backdrop:bg-slate-900/60 p-0 m-auto"
    >
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
                <span className="font-mono">{data.account.satGroupCode || 'Sin SAT'}</span> • Periodo:{' '}
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
                aria-label="Exportar libro mayor en formato Excel (.XLSX)"
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
                title="Descargar datos en texto plano (.csv) con Folio Fiscal (UUID)"
                aria-label="Exportar auxiliar de movimientos en CSV con Folio Fiscal (UUID)"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                aria-label="Imprimir tarjeta auxiliar de movimientos"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                Imprimir
              </button>
            </>
          )}
          <button
            type="button"
            onClick={requestDialogClose}
            aria-label="Cerrar auxiliar de cuenta"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollable-panel p-4 sm:p-5 space-y-4"
      >
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
            <AccountLedgerKpiGrid data={data} mesNombre={mesNombre} />

            <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs no-print">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search
                    className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    aria-label="Filtrar por concepto, referencia o Folio Fiscal (UUID) en el auxiliar"
                    placeholder="Filtrar concepto, ref. o UUID..."
                    className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  {ledgerSearch && (
                    <button
                      type="button"
                      onClick={() => setLedgerSearch('')}
                      aria-label="Limpiar búsqueda en auxiliar"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <label htmlFor="ledger-period-from" className="font-semibold text-slate-600">De:</label>
                  <select
                    id="ledger-period-from"
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                  >
                    {MESES_SAT.map((m) => (
                      <option key={m.periodo} value={m.periodo}>{m.corto}</option>
                    ))}
                  </select>
                  <label htmlFor="ledger-period-to" className="font-semibold text-slate-600">A:</label>
                  <select
                    id="ledger-period-to"
                    value={periodTo}
                    onChange={(e) => setPeriodTo(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                  >
                    {MESES_SAT.map((m) => (
                      <option key={m.periodo} value={m.periodo}>{m.corto}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Atajos de rango de periodos">
                  {[
                    { id: 'CURRENT' as const, label: 'Mes actual', active: effectiveFrom === currentPeriod && effectiveTo === currentPeriod },
                    { id: 'YTD' as const, label: 'Ene–Actual', active: effectiveFrom === 1 && effectiveTo === currentPeriod },
                    { id: 'FULL_YEAR' as const, label: 'Todo el año', active: effectiveFrom === 1 && effectiveTo === 13 }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={p.active}
                      onClick={() => applyRangePreset(p.id)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition ${
                        p.active
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
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

            <AccountLedgerTable
              data={data}
              mesNombre={mesNombre}
              filteredEntries={filteredEntries}
              ledgerSearch={ledgerSearch}
              scrollParentRef={scrollContainerRef}
              onGoToPoliza={handleGoToPoliza}
            />
          </>
        )}
      </div>
    </dialog>,
    document.body
  );
}
