import { useMemo, useRef, useState } from 'react';
import { flexRender, useTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CloudDownload, SearchX, UploadCloud } from 'lucide-react';
import { Button, EmptyState } from '../../components/ui';
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
  const { filteredCfdis, isLoading, filteredTotals, ...columnProps } = props;

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
        sortField === 'fecha' ? a.fecha.localeCompare(b.fecha) : a.total - b.total;
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
    <div
      ref={parentRef}
      className="overflow-x-auto overflow-y-auto min-h-[320px] max-h-[min(68dvh,calc(100dvh-260px))]"
    >
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
              <td colSpan={columns.length} className="py-8 px-4">
                {props.hasActiveFilters ? (
                  <EmptyState
                    variant="dashed"
                    tone="slate"
                    icon={<SearchX className="w-5 h-5" aria-hidden="true" />}
                    title="Ningún comprobante coincide con los filtros"
                    description="Ajusta la búsqueda, cambia el alcance de periodo o limpia los filtros activos para ver tus CFDIs."
                    className="max-w-md mx-auto"
                    actions={
                      props.onResetFilters ? (
                        <Button variant="primary" size="md" onClick={props.onResetFilters}>
                          Limpiar filtros
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <EmptyState
                    variant="dashed"
                    tone="blue"
                    icon={<CloudDownload className="w-6 h-6" aria-hidden="true" />}
                    title="Bóveda sin comprobantes en este periodo"
                    description={
                      props.periodScope === 'CURRENT' && (props.countInCurrentYear ?? 0) > 0
                        ? `Hay ${props.countInCurrentYear} comprobante(s) registrados en otros meses de ${props.currentYear ?? 2026}.`
                        : props.isReadOnlyClient
                        ? 'No hay comprobantes fiscales cargados en este periodo. Puedes consultar otros meses o ejercicios desde los filtros superiores.'
                        : 'Descarga tus facturas directamente del SAT con tu e.firma o sube tus archivos XML en 2 segundos.'
                    }
                    className="max-w-md mx-auto"
                    actions={
                      <>
                        {props.periodScope === 'CURRENT' &&
                          (props.countInCurrentYear ?? 0) > 0 &&
                          props.onViewAllYear && (
                            <Button variant="primary" size="md" onClick={props.onViewAllYear}>
                              Ver comprobantes de {props.currentYear ?? 2026}
                            </Button>
                          )}
                        {props.onOpenSatDownload && !props.isReadOnlyClient && (
                          <Button
                            variant="primary"
                            size="md"
                            onClick={props.onOpenSatDownload}
                            leftIcon={<CloudDownload className="w-3.5 h-3.5" aria-hidden="true" />}
                          >
                            Descargar del SAT (e.firma)
                          </Button>
                        )}
                        {props.onUploadXmlClick && !props.isReadOnlyClient && (
                          <Button
                            variant="secondary"
                            size="md"
                            onClick={props.onUploadXmlClick}
                            leftIcon={
                              <UploadCloud className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                            }
                          >
                            Subir XMLs o ZIP
                          </Button>
                        )}
                      </>
                    }
                  />
                )}
              </td>
            </tr>
          ) : (
            <>
              {paddingTop > 0 && (
                <tr aria-hidden="true">
                  <td
                    data-spacer="true"
                    style={{ height: `${paddingTop}px` }}
                    colSpan={columns.length}
                  />
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
                  <td
                    data-spacer="true"
                    style={{ height: `${paddingBottom}px` }}
                    colSpan={columns.length}
                  />
                </tr>
              )}
            </>
          )}
        </tbody>
        {filteredCfdis.length > 0 && (
          <tfoot className="sticky bottom-0 z-20 bg-slate-100 [&_td]:bg-slate-100">
            <tr className="border-t-2 border-slate-300 font-mono text-xs font-bold text-slate-900 shadow-xs">
              <td
                colSpan={4}
                className="py-2.5 px-2.5 font-sans text-right uppercase tracking-wider text-slate-700"
              >
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
