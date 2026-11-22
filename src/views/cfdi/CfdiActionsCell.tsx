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
  onOpenContabilizarModal: (cfdi: CfdiDocument) => void;
  onVerifySat: (id: string) => void;
  isVerifySatPending: boolean;
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
  onOpenContabilizarModal,
  onVerifySat,
  isVerifySatPending,
  onPreviewInvoice,
  onOpenXmlViewer
}: CfdiActionsCellProps) {
  const isConfirmingDelete = confirmDeleteCfdiId === row.id;

  if (isConfirmingDelete) {
    return (
      <div className="flex items-center justify-end gap-1">
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
          onClick={() => setConfirmDeleteCfdiId(null)}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {!row.polizaId && (
        <button
          type="button"
          disabled={isPeriodLocked}
          onClick={() => onOpenContabilizarModal(row)}
          title={
            isPeriodLocked
              ? 'Periodo bloqueado ante el SAT. No se pueden generar pólizas.'
              : 'Contabilizar CFDI y generar póliza cuadrada'
          }
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white shadow-2xs transition ${
            isPeriodLocked
              ? 'opacity-40 cursor-not-allowed bg-slate-400'
              : 'bg-blue-700 hover:bg-blue-800 cursor-pointer'
          }`}
        >
          {isPeriodLocked ? (
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          Contabilizar
        </button>
      )}
      <button
        type="button"
        disabled={isVerifySatPending}
        onClick={() => onVerifySat(row.id)}
        title="Consultar vigencia fiscal y Lista 69-B directamente en el SAT"
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
      >
        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
        SAT
      </button>
      <button
        type="button"
        onClick={() => onPreviewInvoice(row)}
        title="Ver Representación Impresa CFDI 4.0"
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer"
      >
        <FileText className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
        Factura
      </button>
      <button
        type="button"
        onClick={() => onOpenXmlViewer(row)}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer"
      >
        <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
        XML
      </button>
      {!row.polizaId && (
        <button
          type="button"
          disabled={isPeriodLocked}
          onClick={() => {
            if (isPeriodLocked) return;
            setConfirmDeleteCfdiId(row.id);
          }}
          title={
            isPeriodLocked
              ? 'Periodo bloqueado ante el SAT'
              : 'Eliminar CFDI no contabilizado del ADD'
          }
          aria-label={`Eliminar CFDI ${row.serie}-${row.folio}`}
          className={`p-1.5 rounded-lg transition ${
            isPeriodLocked
              ? 'opacity-30 cursor-not-allowed text-slate-300'
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
