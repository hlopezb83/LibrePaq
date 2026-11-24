import { useMemo, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { createColumnHelper, tableFeatures } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ExternalLink, FileText } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { CfdiDocument } from '../../shared/types';
import { CfdiActionsCell } from './CfdiActionsCell';
import { CfdiTerceroCell, CfdiTipoCell } from './CfdiTableCells';

export const cfdiTableFeatures = tableFeatures({});
const columnHelper = createColumnHelper<typeof cfdiTableFeatures, CfdiDocument>();

export type CfdiSortField = 'fecha' | 'total';
export type CfdiSortDir = 'asc' | 'desc';

export interface UseCfdiColumnsProps {
  filteredCfdis: CfdiDocument[];
  selectedCfdiIds: Set<string>;
  toggleSelectAll: () => void;
  toggleSelectOne: (id: string, shiftKey?: boolean) => void;
  copiedUuid: string | null;
  handleCopyUuid: (uuid: string) => void;
  onPreviewInvoice: (cfdi: CfdiDocument) => void;
  onOpenContabilizarModal: (cfdi: CfdiDocument) => void;
  onOpenXmlViewer: (cfdi: CfdiDocument) => void;
  onVerifySat: (id: string) => void;
  isVerifySatPending: boolean;
  verifyingCfdiId?: string | null;
  confirmDeleteCfdiId: string | null;
  setConfirmDeleteCfdiId: (id: string | null) => void;
  onConfirmDelete: (id: string) => void;
  isDeletePending: boolean;
  isPeriodLocked: boolean;
  isReadOnlyClient?: boolean;
  sortField?: CfdiSortField | null;
  sortDir?: CfdiSortDir;
  onToggleSort?: (field: CfdiSortField) => void;
}

export function useCfdiColumns({
  filteredCfdis,
  selectedCfdiIds,
  toggleSelectAll,
  toggleSelectOne,
  copiedUuid,
  handleCopyUuid,
  onPreviewInvoice,
  onOpenContabilizarModal,
  onOpenXmlViewer,
  onVerifySat,
  isVerifySatPending,
  verifyingCfdiId = null,
  confirmDeleteCfdiId,
  setConfirmDeleteCfdiId,
  onConfirmDelete,
  isDeletePending,
  isPeriodLocked,
  isReadOnlyClient = false,
  sortField = null,
  sortDir = 'desc',
  onToggleSort
}: UseCfdiColumnsProps) {
  const navigate = useNavigate();
  const shiftKeyRef = useRef(false);

  const renderSortIcon = (field: CfdiSortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-400" aria-hidden="true" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-700" aria-hidden="true" />
      : <ArrowDown className="w-3 h-3 text-blue-700" aria-hidden="true" />;
  };

  return useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
        id: 'select',
        header: () => {
          const allSelected =
            filteredCfdis.length > 0 &&
            filteredCfdis.every((c) => selectedCfdiIds.has(c.id));
          const someSelected = filteredCfdis.some((c) => selectedCfdiIds.has(c.id));
          return (
            <div className="flex items-center justify-center">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = !allSelected && someSelected;
                    }
                  }}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded text-blue-700 border-slate-300 focus:ring-blue-600 cursor-pointer"
                  aria-label="Seleccionar todos los comprobantes visibles"
                />
              </label>
            </div>
          );
        },
        cell: (info) => {
          const row = info.row.original;
          const isSelected = selectedCfdiIds.has(row.id);
          return (
            <div className="flex items-center justify-center">
              <label
                className="inline-flex items-center justify-center min-w-[32px] min-h-[32px] cursor-pointer rounded-lg hover:bg-slate-100"
                title="Clic para seleccionar (Shift+Clic para rango)"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onClick={(e) => {
                    shiftKeyRef.current = e.shiftKey;
                  }}
                  onChange={() => {
                    const useRange = shiftKeyRef.current;
                    shiftKeyRef.current = false;
                    toggleSelectOne(row.id, useRange);
                  }}
                  className="w-4 h-4 rounded text-blue-700 border-slate-300 focus:ring-blue-600 cursor-pointer"
                  aria-label={`Seleccionar CFDI ${row.serie}-${row.folio}`}
                />
              </label>
            </div>
          );
        }
      }),
      columnHelper.accessor('fecha', {
        header: () => (
          <button
            type="button"
            onClick={() => onToggleSort?.('fecha')}
            className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-slate-700 hover:text-blue-800 cursor-pointer whitespace-nowrap"
            title="Ordenar por fecha"
          >
            <span>Fecha / Folio</span>
            {renderSortIcon('fecha')}
          </button>
        ),
        cell: (info) => {
          const row = info.row.original;
          const isCancelled = row.statusSat === 'CANCELADO';
          return (
            <div>
              <button
                type="button"
                onClick={() => onPreviewInvoice(row)}
                title="Ver Representación Impresa (PDF / Factura Oficial)"
                className={`font-mono font-bold hover:underline flex items-center gap-1 cursor-pointer text-left ${
                  isCancelled ? 'line-through text-slate-500' : 'text-blue-900 hover:text-blue-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                <span>
                  {row.serie}-{row.folio}
                </span>
              </button>
              <div className="text-[11px] font-mono text-slate-600 pl-4.5 whitespace-nowrap">
                {formatShortDate(row.fecha)}
              </div>
            </div>
          );
        }
      }),
      columnHelper.accessor('direction', {
        header: 'Tipo CFDI',
        cell: (info) => <CfdiTipoCell row={info.row.original} />
      }),
      columnHelper.display({
        id: 'tercero',
        header: 'Tercero (Emisor / Receptor) y Concepto',
        cell: (info) => (
          <CfdiTerceroCell
            row={info.row.original}
            copiedUuid={copiedUuid}
            handleCopyUuid={handleCopyUuid}
          />
        )
      }),
      columnHelper.accessor('subtotal', {
        header: () => <div className="text-right whitespace-nowrap">Base / Subtotal</div>,
        cell: (info) => (
          <div className={`text-right font-mono whitespace-nowrap tabular-nums ${info.row.original.statusSat === 'CANCELADO' ? 'line-through text-slate-500' : 'text-slate-800'}`}>
            {formatCurrency(info.getValue())}
          </div>
        )
      }),
      columnHelper.accessor('ivaTrasladado', {
        header: () => <div className="text-right whitespace-nowrap">IVA Trasladado</div>,
        cell: (info) => (
          <div className={`text-right font-mono whitespace-nowrap tabular-nums ${info.row.original.statusSat === 'CANCELADO' ? 'line-through text-slate-500' : 'text-slate-800'}`}>
            {formatCurrency(info.getValue())}
          </div>
        )
      }),
      columnHelper.display({
        id: 'retenciones',
        header: () => <div className="text-right whitespace-nowrap">Retenciones</div>,
        cell: (info) => {
          const row = info.row.original;
          const totalRet = row.isrRetenido + row.ivaRetenido;
          if (totalRet <= 0) {
            return <div className="text-right font-mono text-slate-500 whitespace-nowrap tabular-nums">$0.00</div>;
          }
          return (
            <div className="text-right font-mono text-red-700 font-semibold whitespace-nowrap tabular-nums">
              <div>-{formatCurrency(totalRet)}</div>
              <div className="text-[10px] text-slate-600 font-normal">
                ISR: {formatCurrency(row.isrRetenido)} | IVA: {formatCurrency(row.ivaRetenido)}
              </div>
            </div>
          );
        }
      }),
      columnHelper.accessor('total', {
        header: () => (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onToggleSort?.('total')}
              className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-slate-700 hover:text-blue-800 cursor-pointer whitespace-nowrap"
              title="Ordenar por Total Neto"
            >
              <span>Total Neto</span>
              {renderSortIcon('total')}
            </button>
          </div>
        ),
        cell: (info) => (
          <div className={`text-right font-mono font-bold whitespace-nowrap tabular-nums ${info.row.original.statusSat === 'CANCELADO' ? 'line-through text-slate-500' : 'text-slate-900'}`}>
            {formatCurrency(info.getValue())}
          </div>
        )
      }),
      columnHelper.accessor('polizaId', {
        header: 'Estado Contable',
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex flex-wrap items-center gap-1">
              {row.statusSat === 'CANCELADO' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900 border border-red-300">
                  Cancelado SAT
                </span>
              )}
              {row.polizaId ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/polizas',
                      search: { search: row.polizaFolio || row.uuid.slice(0, 8) } as unknown as Record<string, string>
                    })
                  }
                  title="Ir a Pólizas Contables para consultar el asiento"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{row.polizaFolio || 'Contabilizado'}</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-75" aria-hidden="true" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                  Sin Póliza
                </span>
              )}
            </div>
          );
        }
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-right whitespace-nowrap pr-1">Acciones</div>,
        cell: (info) => (
          <CfdiActionsCell
            row={info.row.original}
            confirmDeleteCfdiId={confirmDeleteCfdiId}
            setConfirmDeleteCfdiId={setConfirmDeleteCfdiId}
            onConfirmDelete={onConfirmDelete}
            isDeletePending={isDeletePending}
            isPeriodLocked={isPeriodLocked}
            isReadOnlyClient={isReadOnlyClient}
            onOpenContabilizarModal={onOpenContabilizarModal}
            onVerifySat={onVerifySat}
            isVerifySatPending={isVerifySatPending}
            isVerifyingThisRow={verifyingCfdiId === info.row.original.id}
            onPreviewInvoice={onPreviewInvoice}
            onOpenXmlViewer={onOpenXmlViewer}
          />
        )
      })
    ]),
    [
      copiedUuid, confirmDeleteCfdiId, isDeletePending, isVerifySatPending,
      verifyingCfdiId, navigate, selectedCfdiIds, filteredCfdis, isPeriodLocked,
      isReadOnlyClient, handleCopyUuid, onConfirmDelete, onOpenContabilizarModal,
      onOpenXmlViewer, onPreviewInvoice, onVerifySat, setConfirmDeleteCfdiId,
      toggleSelectAll, toggleSelectOne, sortField, sortDir, onToggleSort
    ]
  );
}
