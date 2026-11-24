import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ExternalLink, FileCode2 } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { AccountLedgerEntry, AccountLedgerResponse } from '../../shared/types';

interface AccountLedgerTableProps {
  data: AccountLedgerResponse;
  mesNombre: string;
  filteredEntries: AccountLedgerEntry[];
  ledgerSearch: string;
  onGoToPoliza: (folio: number) => void;
}

function LedgerEntryRow({
  entry,
  onGoToPoliza,
  measureRef,
  dataIndex
}: {
  entry: AccountLedgerEntry;
  onGoToPoliza: (folio: number) => void;
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
          onClick={() => onGoToPoliza(entry.folioPoliza)}
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
      <td className="py-2.5 px-3 font-mono text-blue-800 font-semibold whitespace-nowrap">
        {entry.accountCode}
      </td>
      <td className="py-2.5 px-3 font-mono text-slate-600">{entry.referencia}</td>
      <td className="py-2.5 px-3 text-slate-800">
        <div>{entry.concepto}</div>
        {entry.cfdiUuid && (
          <div className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500">
            <FileCode2 className="w-3 h-3" aria-hidden="true" />
            UUID: {entry.cfdiUuid.slice(0, 14)}...
          </div>
        )}
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-medium">
        {entry.cargo > 0 ? formatCurrency(entry.cargo) : '—'}
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-medium">
        {entry.abono > 0 ? formatCurrency(entry.abono) : '—'}
      </td>
      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/60">
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
  onGoToPoliza
}: AccountLedgerTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  return (
    <div className="border border-slate-300 rounded-xl overflow-hidden">
      <div ref={parentRef} className="max-h-96 scrollable-panel overflow-x-auto">
        <table className="w-full text-left border-collapse erp-sticky-table">
          <caption className="visually-hidden">
            Movimientos auxiliares de la cuenta {data.account.code} {data.account.name} en{' '}
            {mesNombre} {data.ejercicio}
          </caption>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <th scope="col" className="py-2.5 px-3">Fecha</th>
              <th scope="col" className="py-2.5 px-3">Póliza</th>
              <th scope="col" className="py-2.5 px-3">Cuenta Afectada</th>
              <th scope="col" className="py-2.5 px-3">Referencia</th>
              <th scope="col" className="py-2.5 px-3">Concepto / CFDI</th>
              <th scope="col" className="py-2.5 px-3 text-right">Cargo (Debe)</th>
              <th scope="col" className="py-2.5 px-3 text-right">Abono (Haber)</th>
              <th scope="col" className="py-2.5 px-3 text-right">Saldo Progresivo</th>
            </tr>
          </thead>

          {/* Cuerpo virtualizado para pantalla */}
          <tbody className="divide-y divide-slate-200 text-xs print:hidden">
            <tr className="bg-slate-100/80 font-semibold text-slate-800">
              <td colSpan={7} className="py-2.5 px-3">
                Saldo Inicial Acumulado al inicio de {mesNombre} {data.ejercicio}
              </td>
              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                {formatCurrency(data.initialBalance)}
              </td>
            </tr>
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  {ledgerSearch.trim()
                    ? 'No se encontraron movimientos con el filtro especificado.'
                    : 'Sin movimientos registrados en este periodo contable para esta cuenta.'}
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td colSpan={8} style={{ height: `${paddingTop}px` }} />
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
                    <td colSpan={8} style={{ height: `${paddingBottom}px` }} />
                  </tr>
                )}
              </>
            )}
          </tbody>

          {/* Cuerpo completo sin recorte virtualizado para impresión/PDF */}
          <tbody className="hidden print:table-row-group divide-y divide-slate-200 text-xs">
            <tr className="bg-slate-100/80 font-semibold text-slate-800">
              <td colSpan={7} className="py-2.5 px-3">
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
            <tr className="bg-[#0A1120] text-white font-mono text-xs font-bold">
              <td colSpan={5} className="py-2.5 px-3 text-right uppercase tracking-wider">
                Sumas del Periodo y Saldo Final:
              </td>
              <td className="py-2.5 px-3 text-right text-slate-100">
                {formatCurrency(data.totalCharges)}
              </td>
              <td className="py-2.5 px-3 text-right text-slate-100">
                {formatCurrency(data.totalCredits)}
              </td>
              <td className="py-2.5 px-3 text-right text-blue-200">
                {formatCurrency(data.finalBalance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
