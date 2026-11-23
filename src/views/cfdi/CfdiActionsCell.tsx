import React from 'react';
import {
  Code2,
  FileText,
  Lock,
  ShieldCheck,
  Sparkles,
  Trash2
} from 'lucide-react';
import type { CfdiDocument } from '../../shared/types';

interface CfdiActionsCellProps {
  row: CfdiDocument;
  confirmDeleteCfdiId: string | null;
  setConfirmDeleteCfdiId: (id: string | null) => void;
  onConfirmDelete: (id: string) => void;
  isDeletePending: boolean;
  isPeriodLocked: boolean;
  isReadOnlyClient?: boolean;
  onOpenContabilizarModal: (cfdi: CfdiDocument) => void;
  onVerifySat: (id: string) => void;
  isVerifySatPending: boolean;
  isVerifyingThisRow?: boolean;
  onPreviewInvoice: (cfdi: CfdiDocument) => void;
  onOpenXmlViewer: (cfdi: CfdiDocument) => void;
}

function CfdiActionsCellBase({
  row,
  confirmDeleteCfdiId,
  setConfirmDeleteCfdiId,
  onConfirmDelete,
  isDeletePending,
  isPeriodLocked,
  isReadOnlyClient = false,
  onOpenContabilizarModal,
  onVerifySat,
  isVerifySatPending,
  isVerifyingThisRow = false,
  onPreviewInvoice,
  onOpenXmlViewer
}: CfdiActionsCellProps) {
  const isConfirmingDelete = confirmDeleteCfdiId === row.id;
  const isCancelledSat = row.statusSat === 'CANCELADO';
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;
  const isContabilizarDisabled = isWriteBlocked || isCancelledSat || row.tipoComprobante === 'T';

  if (isConfirmingDelete) {
    return (
      <div
        role="alertdialog"
        aria-label={`Confirmar eliminación de ${row.serie}-${row.folio}`}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setConfirmDeleteCfdiId(null);
          }
        }}
        className="flex items-center justify-end gap-1"
      >
        <button
          type="button"
          disabled={isDeletePending}
          onClick={() => onConfirmDelete(row.id)}
          className="px-2 py-1 rounded-lg text-[11px] font-bold bg-red-700 hover:bg-red-800 text-white cursor-pointer"
        >
          Confirmar
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => setConfirmDeleteCfdiId(null)}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
      {!row.polizaId && (
        <button
          type="button"
          disabled={isContabilizarDisabled}
          onClick={() => onOpenContabilizarModal(row)}
          aria-label={`Contabilizar ${row.serie}-${row.folio}`}
          title={
            isReadOnlyClient
              ? 'Modo solo lectura: no se pueden generar pólizas.'
              : isPeriodLocked
              ? 'Periodo bloqueado ante el SAT. No se pueden generar pólizas.'
              : isCancelledSat
              ? 'CFDI cancelado ante el SAT — no deducible ni contabilizable'
              : row.tipoComprobante === 'T'
              ? 'CFDI de Traslado (T) — sin efectos contables de ingreso/gasto'
              : 'Contabilizar CFDI y generar póliza cuadrada'
          }
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white shadow-2xs transition ${
            isContabilizarDisabled
              ? 'opacity-50 cursor-not-allowed bg-slate-500'
              : 'bg-blue-700 hover:bg-blue-800 cursor-pointer'
          }`}
        >
          {isWriteBlocked ? (
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          Contabilizar
        </button>
      )}
      <button
        type="button"
        disabled={isVerifySatPending || isReadOnlyClient}
        aria-busy={isVerifyingThisRow}
        onClick={() => onVerifySat(row.id)}
        title={
          isReadOnlyClient
            ? 'Modo solo lectura: consulta SAT deshabilitada'
            : 'Consultar vigencia fiscal y Lista 69-B directamente en el SAT'
        }
        aria-label={`Verificar estatus SAT de ${row.serie}-${row.folio}`}
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
        {isVerifyingThisRow ? 'Consultando...' : 'SAT'}
      </button>
      <button
        type="button"
        onClick={() => onPreviewInvoice(row)}
        title="Ver Representación Impresa CFDI 4.0"
        aria-label={`Ver factura impresa ${row.serie}-${row.folio}`}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer"
      >
        <FileText className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
        Factura
      </button>
      <button
        type="button"
        onClick={() => onOpenXmlViewer(row)}
        aria-label={`Ver XML de ${row.serie}-${row.folio}`}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer"
      >
        <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
        XML
      </button>
      {!row.polizaId && (
        <button
          type="button"
          disabled={isWriteBlocked}
          onClick={() => {
            if (isWriteBlocked) return;
            setConfirmDeleteCfdiId(row.id);
          }}
          title={
            isReadOnlyClient
              ? 'Modo solo lectura'
              : isPeriodLocked
              ? 'Periodo bloqueado ante el SAT'
              : 'Eliminar CFDI no contabilizado del ADD'
          }
          aria-label={`Eliminar CFDI ${row.serie}-${row.folio}`}
          className={`p-1.5 rounded-lg transition ${
            isWriteBlocked
              ? 'opacity-40 cursor-not-allowed text-slate-400'
              : 'text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export const CfdiActionsCell = React.memo(CfdiActionsCellBase);
