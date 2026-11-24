import type { RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ExternalLink, FileCode2 } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import { fromCents, sumCents } from '../../shared/accounting-engine';
import type { AccountLedgerEntry, AccountLedgerResponse } from '../../shared/types';

interface AccountLedgerTableProps {
  data: AccountLedgerResponse;
  mesNombre: string;
  filteredEntries: AccountLedgerEntry[];
  ledgerSearch: string;
  scrollParentRef: RefObject<HTMLDivElement | null>;
  onGoToPoliza: (entry: Pick<AccountLedgerEntry, 'tipoPoliza' | 'folioPoliza' | 'periodo'>) => void;
}

function LedgerEntryRow({
  entry,
  onGoToPoliza,
  measureRef,
  dataIndex
}: {
  entry: AccountLedgerEntry;
  onGoToPoliza: (entry: Pick<AccountLedgerEntry, 'tipoPoliza' | 'folioPoliza' | 'periodo'>) => void;
  measureRef?: (el: HTMLTableRowElement | null) => void;
  dataIndex?: number;
}) {
  return (
    <tr ref={measureRef} data-index={dataIndex} className="hover:bg-blue-50/40">
      <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
        {formatShortDate(entry.fecha)}
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap">
        <button
          type="button"
          onClick={() => onGoToPoliza(entry)}
          title={`Abrir póliza ${entry.tipoPoliza} #${entry.folioPoliza} en Pólizas Contables`}
          className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer group"
        >
          <span>
            {entry.tipoPoliza} #{entry.folioPoliza}
          </span>
          <ExternalLink
            className="w-3 h-3 opacity-60 group-hover:opacity-100 text-blue-600"
            aria-hidden="true"
          />
        </button>
      </td>
      <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{entry.referencia}</td>
      <td className="py-2.5 px-3 text-slate-800">
        <div>{entry.concepto}</div>
        {entry.cfdiUuid && (
          <div className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-600">
            <FileCode2 className="w-3 h-3 text-blue-700" aria-hidden="true" />
            <span>Folio Fiscal (UUID): {entry.cfdiUuid.slice(0, 14)}...</span>
          </div>
        )}
      </td>
      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 font-medium whitespace-nowrap">
        {entry.cargo > 0 ? formatCurrency(entry.cargo) : '—'}
      </td>
      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 font-medium whitespace-nowrap">
        {entry.abono > 0 ? formatCurrency(entry.abono) : '—'}
      </td>
      <td
        className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold bg-slate-50/60 whitespace-nowrap ${
          entry.runningBalance < 0 ? 'text-red-700' : 'text-slate-900'
        }`}
      >
        {formatCurrency(entry.runningBalance)}
      </td>
    </tr>
  );
}

export function AccountLedgerTable({
  data,
  mesNombre,
  filteredEntries,
  ledgerSearch,
  scrollParentRef,
  onGoToPoliza
}: AccountLedgerTableProps) {
  const rowVirtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 44,
    overscan: 10
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  const isFiltered = Boolean(ledgerSearch.trim());
  const filteredCharges = isFiltered ? fromCents(sumCents(filteredEntries.map((e) => e.cargo))) : 0;
  const filteredCredits = isFiltered ? fromCents(sumCents(filteredEntries.map((e) => e.abono))) : 0;

  return (
    <div className="border border-slate-300 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="visually-hidden">
            Movimientos auxiliares de la cuenta {data.account.code} {data.account.name} en{' '}
            {mesNombre} {data.ejercicio}
          </caption>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <th scope="col" className="py-2.5 px-3 whitespace-nowrap">Fecha</th>
              <th scope="col" className="py-2.5 px-3 whitespace-nowrap">Póliza</th>
              <th scope="col" className="py-2.5 px-3 whitespace-nowrap">Referencia</th>
              <th scope="col" className="py-2.5 px-3 min-w-[200px]">Concepto / Folio Fiscal (UUID)</th>
              <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Cargo (Debe)</th>
              <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Abono (Haber)</th>
              <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Saldo Progresivo</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 text-xs print:hidden">
            <tr className="bg-slate-100/80 font-semibold text-slate-800">
              <td colSpan={6} className="py-2.5 px-3">
                Saldo Inicial Acumulado al inicio de {mesNombre} {data.ejercicio}
              </td>
              <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                {formatCurrency(data.initialBalance)}
              </td>
            </tr>
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  {isFiltered
                    ? 'No se encontraron movimientos con el filtro especificado.'
                    : 'Sin movimientos registrados en este periodo contable para esta cuenta.'}
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td colSpan={7} style={{ height: `${paddingTop}px` }} />
                  </tr>
                )}
                {virtualItems.map((virtualRow) => {
                  const entry = filteredEntries[virtualRow.index];
                  if (!entry) return null;
                  return (
                    <LedgerEntryRow
                      key={entry.movementId}
                      entry={entry}
                      onGoToPoliza={onGoToPoliza}
                      measureRef={rowVirtualizer.measureElement}
                      dataIndex={virtualRow.index}
                    />
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td colSpan={7} style={{ height: `${paddingBottom}px` }} />
                  </tr>
                )}
              </>
            )}
          </tbody>

          <tbody className="hidden print:table-row-group divide-y divide-slate-200 text-xs">
            <tr className="bg-slate-100/80 font-semibold text-slate-800">
              <td colSpan={6} className="py-2.5 px-3">
                Saldo Inicial Acumulado al inicio de {mesNombre} {data.ejercicio}
              </td>
              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                {formatCurrency(data.initialBalance)}
              </td>
            </tr>
            {filteredEntries.map((entry) => (
              <LedgerEntryRow
                key={`print_${entry.movementId}`}
                entry={entry}
                onGoToPoliza={onGoToPoliza}
              />
            ))}
          </tbody>

          <tfoot>
            {isFiltered && (
              <tr className="bg-blue-50/90 border-t border-blue-200 text-blue-950 font-mono text-xs font-bold">
                <td colSpan={4} className="py-2 px-3 text-right">
                  Subtotal filtrado ({filteredEntries.length} movimiento{filteredEntries.length === 1 ? '' : 's'}):
                </td>
                <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                  {formatCurrency(filteredCharges)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                  {formatCurrency(filteredCredits)}
                </td>
                <td className="py-2 px-3 text-right text-[11px] text-blue-800">—</td>
              </tr>
            )}
            <tr className="bg-[#0A1120] text-white font-mono text-xs font-bold">
              <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider">
                Sumas del Periodo y Saldo Final:
              </td>
              <td className="py-2.5 px-3 text-right text-slate-100 tabular-nums whitespace-nowrap">
                {formatCurrency(data.totalCharges)}
              </td>
              <td className="py-2.5 px-3 text-right text-slate-100 tabular-nums whitespace-nowrap">
                {formatCurrency(data.totalCredits)}
              </td>
              <td className="py-2.5 px-3 text-right text-blue-200 tabular-nums whitespace-nowrap">
                {formatCurrency(data.finalBalance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
