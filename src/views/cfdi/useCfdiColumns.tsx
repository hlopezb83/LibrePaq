import { useMemo, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { createColumnHelper, tableFeatures } from '@tanstack/react-table';
import { CheckCircle2, Copy, ExternalLink, FileText, ShieldAlert } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import { checkRfc69BStatus } from '../../shared/sat-69b';
import type { CfdiDocument } from '../../shared/types';
import { CfdiActionsCell } from './CfdiActionsCell';

export const cfdiTableFeatures = tableFeatures({});
const columnHelper = createColumnHelper<typeof cfdiTableFeatures, CfdiDocument>();

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
  isPeriodLocked
}: UseCfdiColumnsProps) {
  const navigate = useNavigate();
  const shiftKeyRef = useRef(false);

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
        header: 'Fecha / Folio',
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <button
                type="button"
                onClick={() => onPreviewInvoice(row)}
                title="Ver Representación Impresa (PDF / Factura Oficial)"
                className="font-mono font-bold text-blue-900 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer text-left"
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
        cell: (info) => {
          const row = info.row.original;
          const tipoLabel =
            row.tipoComprobante === 'P'
              ? 'REP 2.0 (Pago)'
              : row.tipoComprobante === 'N'
              ? 'Nómina 1.2'
              : row.tipoComprobante === 'E'
              ? 'Egreso (Nota Créd.)'
              : row.tipoComprobante === 'T'
              ? 'Traslado (T)'
              : `Ingreso (${row.metodoPago})`;
          return (
            <div className="space-y-1">
              <span
                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                  row.tipoComprobante === 'P'
                    ? 'bg-slate-100 text-slate-800 border-slate-300'
                    : row.direction === 'EMITIDO'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}
              >
                {row.direction}
              </span>
              <div className="text-[11px] font-mono text-slate-700 font-semibold">
                {tipoLabel}
              </div>
            </div>
          );
        }
      }),
      columnHelper.display({
        id: 'tercero',
        header: 'Tercero (Emisor / Receptor) y Concepto',
        cell: (info) => {
          const row = info.row.original;
          const terceroNombre =
            row.direction === 'EMITIDO' ? row.receptorNombre : row.emisorNombre;
          const terceroRfc = row.direction === 'EMITIDO' ? row.receptorRfc : row.emisorRfc;
          const efosCheck = checkRfc69BStatus(terceroRfc);

          return (
            <div className="max-w-md">
              <div className="font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                <span className="truncate">{terceroNombre}</span>
                <span className="font-mono text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
                  {terceroRfc}
                </span>
                {efosCheck.isEfos && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-900 border border-red-300 shrink-0"
                    title="Contribuyente listado en Artículo 69-B del CFF (EFOS SAT). Comprobante presuntamente no deducible."
                  >
                    <ShieldAlert className="w-3 h-3 text-red-700" aria-hidden="true" />
                    69-B: {efosCheck.record?.situacion || 'EFOS'}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600 truncate mt-0.5">{row.conceptoPrincipal}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-slate-600 whitespace-nowrap" title={row.uuid}>
                  UUID: {row.uuid.slice(0, 8)}…{row.uuid.slice(-4)}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyUuid(row.uuid)}
                  aria-label={`Copiar UUID completo ${row.uuid}`}
                  title="Copiar UUID completo al portapapeles"
                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
                >
                  <Copy className="w-2.5 h-2.5" aria-hidden="true" />
                  {copiedUuid === row.uuid ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          );
        }
      }),
      columnHelper.accessor('subtotal', {
        header: () => <div className="text-right whitespace-nowrap">Base / Subtotal</div>,
        cell: (info) => (
          <div className="text-right font-mono text-slate-800 whitespace-nowrap tabular-nums">
            {formatCurrency(info.getValue())}
          </div>
        )
      }),
      columnHelper.accessor('ivaTrasladado', {
        header: () => <div className="text-right whitespace-nowrap">IVA 16%</div>,
        cell: (info) => (
          <div className="text-right font-mono text-slate-800 whitespace-nowrap tabular-nums">
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
        header: () => <div className="text-right whitespace-nowrap">Total Neto</div>,
        cell: (info) => (
          <div className="text-right font-mono font-bold text-slate-900 whitespace-nowrap tabular-nums">
            {formatCurrency(info.getValue())}
          </div>
        )
      }),
      columnHelper.accessor('polizaId', {
        header: 'Estado Contable',
        cell: (info) => {
          const row = info.row.original;
          if (row.polizaId) {
            return (
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
            );
          }
          return (
            <div className="flex flex-wrap items-center gap-1">
              {row.statusSat === 'CANCELADO' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900 border border-red-300">
                  Cancelado SAT
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                Sin Póliza
              </span>
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
      copiedUuid,
      confirmDeleteCfdiId,
      isDeletePending,
      isVerifySatPending,
      verifyingCfdiId,
      navigate,
      selectedCfdiIds,
      filteredCfdis,
      isPeriodLocked,
      handleCopyUuid,
      onConfirmDelete,
      onOpenContabilizarModal,
      onOpenXmlViewer,
      onPreviewInvoice,
      onVerifySat,
      setConfirmDeleteCfdiId,
      toggleSelectAll,
      toggleSelectOne
    ]
  );
}
