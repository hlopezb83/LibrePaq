import React from 'react';
import {
  Code2,
  FileText,
  Lock,
  ShieldCheck,
  Sparkles,
  Trash2
} from 'lucide-react';
import { Button, InlineConfirm } from '../../components/ui';
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
      <div className="flex justify-end">
        <InlineConfirm
          tone="danger"
          busy={isDeletePending}
          confirmLabel={isDeletePending ? 'Eliminando...' : 'Confirmar'}
          cancelLabel="No"
          ariaLabel={`Confirmar eliminación de ${row.serie}-${row.folio}`}
          onConfirm={() => onConfirmDelete(row.id)}
          onCancel={() => setConfirmDeleteCfdiId(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
      {!row.polizaId && (
        <Button
          variant="primary"
          size="sm"
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
          leftIcon={
            isWriteBlocked ? (
              <Lock className="w-3 h-3" aria-hidden="true" />
            ) : (
              <Sparkles className="w-3 h-3" aria-hidden="true" />
            )
          }
        >
          Contabilizar
        </Button>
      )}
      <Button
        variant="secondary"
        size="sm"
        loading={isVerifyingThisRow}
        disabled={isVerifySatPending || isReadOnlyClient}
        onClick={() => onVerifySat(row.id)}
        title={
          isReadOnlyClient
            ? 'Modo solo lectura: consulta SAT deshabilitada'
            : 'Consultar vigencia fiscal y Lista 69-B directamente en el SAT'
        }
        aria-label={`Verificar estatus SAT de ${row.serie}-${row.folio}`}
        leftIcon={<ShieldCheck className="w-3 h-3 text-emerald-700" aria-hidden="true" />}
      >
        {isVerifyingThisRow ? 'Consultando...' : 'SAT'}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPreviewInvoice(row)}
        title="Ver Representación Impresa CFDI 4.0"
        aria-label={`Ver factura impresa ${row.serie}-${row.folio}`}
        leftIcon={<FileText className="w-3 h-3 text-blue-700" aria-hidden="true" />}
      >
        Factura
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onOpenXmlViewer(row)}
        title="Ver estructura XML del CFDI"
        aria-label={`Ver XML de ${row.serie}-${row.folio}`}
        leftIcon={<Code2 className="w-3 h-3" aria-hidden="true" />}
      >
        XML
      </Button>
      {!row.polizaId && (
        <Button
          variant="ghost"
          size="sm"
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
          className={
            isWriteBlocked
              ? 'p-1.5 text-slate-400'
              : 'p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50'
          }
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

export const CfdiActionsCell = React.memo(CfdiActionsCellBase);
