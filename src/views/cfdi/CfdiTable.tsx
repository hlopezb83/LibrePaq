import { useRef } from 'react';
import {
  flexRender,
  useTable
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CloudDownload, UploadCloud } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { cfdiTableFeatures, useCfdiColumns, type UseCfdiColumnsProps } from './useCfdiColumns';

export interface CfdiTableProps extends UseCfdiColumnsProps {
  isLoading: boolean;
  filteredTotals: {
    subtotal: number;
    iva: number;
    retenciones: number;
    total: number;
  };
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

  const columns = useCfdiColumns({
    filteredCfdis,
    ...columnProps
  });

  const table = useTable({
    features: cfdiTableFeatures,
    data: filteredCfdis,
    columns
  });

  const rows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
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
    <div ref={parentRef} className="overflow-auto max-h-[calc(100vh-280px)]">
      <table className="w-full text-left border-collapse erp-sticky-table">
        <caption className="visually-hidden">
          Comprobantes fiscales digitales en Bóveda ADD
        </caption>
        <thead className="sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600 shadow-2xs"
            >
              {headerGroup.headers.map((header) => (
                <th key={header.id} scope="col" className="py-2.5 px-3">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                Cargando comprobantes fiscales de la Bóveda Digital...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-500">
                <div className="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto p-6 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 shadow-2xs">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200 shadow-2xs">
                    <CloudDownload className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">Bóveda sin comprobantes en este periodo</p>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                    Descarga tus facturas directamente del SAT con tu e.firma o sube tus archivos XML en 2 segundos.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1.5">
                    {props.onOpenSatDownload && (
                      <button
                        type="button"
                        onClick={props.onOpenSatDownload}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                      >
                        <CloudDownload className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Descargar del SAT (e.firma)</span>
                      </button>
                    )}
                    {props.onUploadXmlClick && (
                      <button
                        type="button"
                        onClick={props.onUploadXmlClick}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-300 shadow-2xs transition cursor-pointer"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                        <span>Subir XMLs o ZIP</span>
                      </button>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            <>
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                const doc = row.original;
                const isSelected = props.selectedCfdiIds.has(doc.id);
                return (
                  <tr
                    key={row.id}
                    className={`transition ${
                      isSelected
                        ? 'bg-blue-50/70 hover:bg-blue-50'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id} className="py-2.5 px-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
                </tr>
              )}
            </>
          )}
        </tbody>
        {filteredCfdis.length > 0 && (
          <tfoot className="sticky bottom-0 z-10 bg-slate-100">
            <tr className="border-t-2 border-slate-300 font-mono text-xs font-bold text-slate-900 shadow-xs">
              <td colSpan={4} className="py-3 px-3 font-sans text-right uppercase tracking-wider text-slate-700">
                Totales Visibles ({filteredCfdis.length} CFDIs):
              </td>
              <td className="py-3 px-3 text-right">{formatCurrency(filteredTotals.subtotal)}</td>
              <td className="py-3 px-3 text-right">{formatCurrency(filteredTotals.iva)}</td>
              <td className="py-3 px-3 text-right text-red-700">
                -{formatCurrency(filteredTotals.retenciones)}
              </td>
              <td className="py-3 px-3 text-right text-blue-900 font-extrabold text-sm">
                {formatCurrency(filteredTotals.total)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
