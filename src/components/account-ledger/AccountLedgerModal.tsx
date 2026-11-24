import { useRef } from 'react';
import { AlertTriangle, BookOpen, Download, Loader2, Printer, RefreshCw } from 'lucide-react';
import { MESES_SAT } from '../../shared/sat-constants';
import { Button, EmptyState, ModalShell, SearchInput, Select } from '../ui';
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
    isFetching,
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

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={Boolean(accountId)}
      onClose={requestDialogClose}
      usePortal
      maxWidth="5xl"
      titleId="ledger-modal-title"
      closeLabel="Cerrar auxiliar de cuenta"
      icon={<BookOpen className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      title="Tarjeta Auxiliar de Movimientos (Libro Mayor)"
      subtitle={
        data ? (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="font-mono font-bold text-blue-800">{data.account.code}</span>
            <strong className="text-slate-900">{data.account.name}</strong>
            <span aria-hidden="true">•</span>
            <span>
              SAT: <span className="font-mono">{data.account.satGroupCode || 'Sin SAT'}</span>
            </span>
            <span aria-hidden="true">•</span>
            <span>
              Periodo: {mesNombre} {data.ejercicio}
            </span>
          </span>
        ) : undefined
      }
      headerExtra={
        data ? (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 no-print">
            <Button
              variant="export"
              size="sm"
              loading={isExporting}
              onClick={handleExportXlsx}
              title="Descargar libro mayor en formato nativo Excel (.xlsx)"
              aria-label="Exportar libro mayor en formato Excel (.XLSX)"
              leftIcon={
                !isExporting ? <Download className="w-3.5 h-3.5" aria-hidden="true" /> : undefined
              }
            >
              {isExporting ? 'Generando...' : 'Excel (.XLSX)'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              title="Descargar datos en texto plano (.csv) con Folio Fiscal (UUID)"
              aria-label="Exportar auxiliar de movimientos en CSV con Folio Fiscal (UUID)"
            >
              CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
              aria-label="Imprimir tarjeta auxiliar de movimientos"
              leftIcon={<Printer className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Imprimir
            </Button>
          </div>
        ) : undefined
      }
      bodyClassName="scrollable-panel space-y-4"
    >
      <div ref={scrollContainerRef} className="space-y-4">
        {!isError && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs no-print">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <SearchInput
                size="sm"
                value={ledgerSearch}
                onChange={setLedgerSearch}
                containerClassName="flex-1 min-w-[180px] max-w-xs"
                aria-label="Filtrar por concepto, referencia o Folio Fiscal (UUID) en el auxiliar"
                clearLabel="Limpiar búsqueda en auxiliar"
                placeholder="Filtrar concepto, ref. o UUID..."
              />

              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <label htmlFor="ledger-period-from" className="font-semibold text-slate-600">
                  De:
                </label>
                <Select
                  id="ledger-period-from"
                  size="sm"
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(Number(e.target.value))}
                  className="font-mono"
                >
                  {MESES_SAT.map((m) => (
                    <option key={m.periodo} value={m.periodo}>
                      {m.corto}
                    </option>
                  ))}
                </Select>
                <label htmlFor="ledger-period-to" className="font-semibold text-slate-600">
                  A:
                </label>
                <Select
                  id="ledger-period-to"
                  size="sm"
                  value={periodTo}
                  onChange={(e) => setPeriodTo(Number(e.target.value))}
                  className="font-mono"
                >
                  {MESES_SAT.map((m) => (
                    <option key={m.periodo} value={m.periodo}>
                      {m.corto}
                    </option>
                  ))}
                </Select>
              </div>

              <div
                className="flex flex-wrap items-center gap-1"
                role="group"
                aria-label="Atajos de rango de periodos"
              >
                {[
                  {
                    id: 'CURRENT' as const,
                    label: 'Mes actual',
                    active: effectiveFrom === currentPeriod && effectiveTo === currentPeriod
                  },
                  {
                    id: 'YTD' as const,
                    label: 'Ene–Actual',
                    active: effectiveFrom === 1 && effectiveTo === currentPeriod
                  },
                  {
                    id: 'FULL_YEAR' as const,
                    label: 'Todo el año',
                    active: effectiveFrom === 1 && effectiveTo === 13
                  }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={p.active}
                    onClick={() => applyRangePreset(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition ${
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

            <div
              aria-live="polite"
              className="text-slate-600 text-[11px] font-medium inline-flex items-center gap-1.5"
            >
              {isFetching && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" aria-hidden="true" />
              )}
              {data ? (
                ledgerSearch.trim() ? (
                  <span>
                    Mostrando <strong>{filteredEntries.length}</strong> de {data.entries.length}{' '}
                    movimientos
                  </span>
                ) : (
                  <span>
                    Total de movimientos: <strong>{data.entries.length}</strong>
                  </span>
                )
              ) : (
                <span>Consultando periodo...</span>
              )}
            </div>
          </div>
        )}

        {isError ? (
          <EmptyState
            variant="card"
            tone="red"
            icon={<AlertTriangle className="w-6 h-6" aria-hidden="true" />}
            title="No fue posible consultar el auxiliar de la cuenta"
            description={
              error instanceof Error
                ? error.message
                : 'Verifica tu conexión e intenta nuevamente.'
            }
            actions={
              <Button
                variant="danger"
                leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
                onClick={() => void refetch()}
              >
                Reintentar
              </Button>
            }
          />
        ) : isLoading || !data ? (
          <div
            role="status"
            aria-live="polite"
            className="p-10 text-center text-xs text-slate-600 flex items-center justify-center gap-2"
          >
            <Loader2 className="w-4 h-4 animate-spin text-blue-700" aria-hidden="true" />
            <span>Consultando movimientos auxiliares y calculando saldo progresivo...</span>
          </div>
        ) : (
          <>
            <AccountLedgerKpiGrid data={data} mesNombre={mesNombre} />

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
    </ModalShell>
  );
}
