import { useMemo, useRef, useState } from 'react';
import {
  flexRender,
  useTable
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CloudDownload, SearchX, UploadCloud } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import {
  cfdiTableFeatures,
  useCfdiColumns,
  type CfdiSortDir,
  type CfdiSortField,
  type UseCfdiColumnsProps
} from './useCfdiColumns';

export interface CfdiTableProps extends UseCfdiColumnsProps {
  isLoading: boolean;
  filteredTotals: {
    subtotal: number;
    iva: number;
    retenciones: number;
    total: number;
  };
  hasActiveFilters?: boolean;
  periodScope?: 'CURRENT' | 'ALL';
  currentYear?: number;
  countInCurrentYear?: number;
  onViewAllYear?: () => void;
  onResetFilters?: () => void;
  onOpenSatDownload?: () => void;
  onUploadXmlClick?: () => void;
}

export function CfdiTable(props: CfdiTableProps) {
  const {
    filteredCfdis,
    isLoading,
    filteredTotals,
    ...columnProps
  } = props;

  const parentRef = useRef<HTMLDivElement>(null);
  const [sortField, setSortField] = useState<CfdiSortField | null>(null);
  const [sortDir, setSortDir] = useState<CfdiSortDir>('desc');

  const handleToggleSort = (field: CfdiSortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir('desc');
      return;
    }
    if (sortDir === 'desc') {
      setSortDir('asc');
    } else {
      setSortField(null);
    }
  };

  const sortedCfdis = useMemo(() => {
    if (!sortField) return filteredCfdis;
    const copy = [...filteredCfdis];
    copy.sort((a, b) => {
      const cmp =
        sortField === 'fecha'
          ? a.fecha.localeCompare(b.fecha)
          : a.total - b.total;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filteredCfdis, sortField, sortDir]);

  const columns = useCfdiColumns({
    filteredCfdis: sortedCfdis,
    ...columnProps,
    sortField,
    sortDir,
    onToggleSort: handleToggleSort
  });

  const table = useTable({
    features: cfdiTableFeatures,
    data: sortedCfdis,
    columns
  });

  const rows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  return (
    <div ref={parentRef} className="overflow-x-auto overflow-y-auto min-h-[320px] max-h-[min(68dvh,calc(100dvh-260px))]">
      <span className="sr-only" aria-live="polite">
        {props.copiedUuid ? `UUID ${props.copiedUuid} copiado al portapapeles` : ''}
      </span>
      <table className="w-full text-left border-collapse erp-sticky-table">
        <caption className="visually-hidden">
          Comprobantes fiscales digitales en Bóveda ADD
        </caption>
        <thead className="sticky top-0 z-20">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600 shadow-2xs"
            >
              {headerGroup.headers.map((header) => {
                const colId = header.column.id;
                const isActions = colId === 'actions';
                const ariaSort =
                  colId === 'fecha' || colId === 'total'
                    ? sortField === colId
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                    : undefined;
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={ariaSort}
                    className={`py-2 px-2.5 ${
                      isActions
                        ? 'sticky right-0 z-20 bg-slate-50 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.12)]'
                        : ''
                    }`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-600 font-medium">
                <div role="status" aria-live="polite">
                  Cargando comprobantes fiscales de la Bóveda Digital...
                </div>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-600">
                {props.hasActiveFilters ? (
                  <div className="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto p-6 rounded-2xl border border-slate-200 bg-slate-50/70 shadow-2xs">
                    <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-300">
                      <SearchX className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Ningún comprobante coincide con los filtros</p>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-xs">
                      Ajusta la búsqueda, cambia el alcance de periodo o limpia los filtros activos para ver tus CFDIs.
                    </p>
                    {props.onResetFilters && (
                      <button
                        type="button"
                        onClick={props.onResetFilters}
                        className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto p-6 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 shadow-2xs">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200 shadow-2xs">
                      <CloudDownload className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">Bóveda sin comprobantes en este periodo</p>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-xs">
                      {props.periodScope === 'CURRENT' && (props.countInCurrentYear ?? 0) > 0
                        ? `Hay ${props.countInCurrentYear} comprobante(s) registrados en otros meses de ${props.currentYear ?? 2026}.`
                        : props.isReadOnlyClient
                        ? 'No hay comprobantes fiscales cargados en este periodo. Puedes consultar otros meses o ejercicios desde los filtros superiores.'
                        : 'Descarga tus facturas directamente del SAT con tu e.firma o sube tus archivos XML en 2 segundos.'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1.5">
                      {props.periodScope === 'CURRENT' && (props.countInCurrentYear ?? 0) > 0 && props.onViewAllYear && (
                        <button
                          type="button"
                          onClick={props.onViewAllYear}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                        >
                          <span>Ver comprobantes de {props.currentYear ?? 2026}</span>
                        </button>
                      )}
                      {props.onOpenSatDownload && !props.isReadOnlyClient && (
                        <button
                          type="button"
                          onClick={props.onOpenSatDownload}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                        >
                          <CloudDownload className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Descargar del SAT (e.firma)</span>
                        </button>
                      )}
                      {props.onUploadXmlClick && !props.isReadOnlyClient && (
                        <button
                          type="button"
                          onClick={props.onUploadXmlClick}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-300 shadow-2xs transition cursor-pointer"
                        >
                          <UploadCloud className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                          <span>Subir XMLs o ZIP</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </td>
            </tr>
          ) : (
            <>
              {paddingTop > 0 && (
                <tr aria-hidden="true">
                  <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                const doc = row.original;
                const isSelected = props.selectedCfdiIds.has(doc.id);
                const isCancelled = doc.statusSat === 'CANCELADO';
                const stickyBg = isSelected
                  ? 'bg-blue-50'
                  : isCancelled
                  ? 'bg-red-50/40'
                  : 'bg-white';
                return (
                  <tr
                    key={row.id}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    className={`transition ${
                      isSelected
                        ? 'bg-blue-50/70 hover:bg-blue-50'
                        : isCancelled
                        ? 'opacity-70 bg-red-50/30 hover:bg-red-50/50'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {row.getAllCells().map((cell) => {
                      const isActions = cell.column.id === 'actions';
                      return (
                        <td
                          key={cell.id}
                          className={`py-2 px-2.5 ${
                            isActions
                              ? `sticky right-0 z-10 ${stickyBg} shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.12)]`
                              : ''
                          }`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr aria-hidden="true">
                  <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
                </tr>
              )}
            </>
          )}
        </tbody>
        {filteredCfdis.length > 0 && (
          <tfoot className="sticky bottom-0 z-20 bg-slate-100 [&_td]:bg-slate-100">
            <tr className="border-t-2 border-slate-300 font-mono text-xs font-bold text-slate-900 shadow-xs">
              <td colSpan={4} className="py-2.5 px-2.5 font-sans text-right uppercase tracking-wider text-slate-700">
                <div>Totales Visibles ({filteredCfdis.length} CFDIs):</div>
                <span className="block text-[10px] font-normal normal-case tracking-normal text-slate-600">
                  Vigente MXN; excluye Cancelados, Tipo P y T
                </span>
              </td>
              <td className="py-2.5 px-2.5 text-right whitespace-nowrap tabular-nums">
                {formatCurrency(filteredTotals.subtotal)}
              </td>
              <td className="py-2.5 px-2.5 text-right whitespace-nowrap tabular-nums">
                {formatCurrency(filteredTotals.iva)}
              </td>
              <td
                className={`py-2.5 px-2.5 text-right whitespace-nowrap tabular-nums ${
                  filteredTotals.retenciones > 0 ? 'text-red-700' : 'text-slate-600'
                }`}
              >
                {filteredTotals.retenciones > 0
                  ? `-${formatCurrency(filteredTotals.retenciones)}`
                  : formatCurrency(0)}
              </td>
              <td className="py-2.5 px-2.5 text-right text-blue-900 font-extrabold text-sm whitespace-nowrap tabular-nums">
                {formatCurrency(filteredTotals.total)}
              </td>
              <td />
              <td className="sticky right-0 z-20 bg-slate-100 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.12)]" />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
