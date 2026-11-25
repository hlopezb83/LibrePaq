import { useEffect, useState } from 'react';
import { FileArchive, Loader2, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { Button, InlineConfirm, Select, StatusBadge } from '../../components/ui';
import type { BatchPolizaGroupingMode } from '../../shared/engine/auto-poliza-types';

export interface CfdiBatchActionBarProps {
  selectedCfdiIds: Set<string>;
  onClearSelection: () => void;
  isBatchContabilizarPending: boolean;
  batchProgress?: { current: number; total: number } | null;
  batchGroupingMode?: BatchPolizaGroupingMode;
  onChangeBatchGroupingMode?: (mode: BatchPolizaGroupingMode) => void;
  onBatchContabilizarSelected: () => void;
  isVerifySatBatchPending?: boolean;
  onVerifySatBatchSelected?: () => void;
  isExportZipPending?: boolean;
  onExportZipSelected?: () => void;
  isBatchDeletePending: boolean;
  onBatchDeleteSelected: () => void;
  isPeriodLocked: boolean;
  isReadOnlyClient?: boolean;
}

export function CfdiBatchActionBar({
  selectedCfdiIds,
  onClearSelection,
  isBatchContabilizarPending,
  batchProgress,
  batchGroupingMode = 'PER_CFDI',
  onChangeBatchGroupingMode,
  onBatchContabilizarSelected,
  isVerifySatBatchPending = false,
  onVerifySatBatchSelected,
  isExportZipPending = false,
  onExportZipSelected,
  isBatchDeletePending,
  onBatchDeleteSelected,
  isPeriodLocked,
  isReadOnlyClient = false
}: CfdiBatchActionBarProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;

  useEffect(() => {
    setConfirmDelete(false);
  }, [selectedCfdiIds]);

  if (selectedCfdiIds.size === 0) return null;

  return (
    <div
      role="region"
      aria-label="Acciones en lote para comprobantes seleccionados"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (confirmDelete) {
            setConfirmDelete(false);
          } else {
            onClearSelection();
          }
        }
      }}
      className="p-3.5 rounded-2xl bg-white border border-blue-300 text-slate-900 flex flex-wrap items-center justify-between gap-3 shadow-sm"
    >
      <div className="flex items-center gap-2.5" aria-live="polite">
        <StatusBadge tone="blue" className="font-mono tabular-nums">
          {selectedCfdiIds.size}
        </StatusBadge>
        <span className="text-xs font-semibold text-slate-800">
          {selectedCfdiIds.size === 1
            ? '1 comprobante CFDI seleccionado'
            : `${selectedCfdiIds.size} comprobantes CFDI seleccionados`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!isReadOnlyClient && onChangeBatchGroupingMode && (
          <Select
            aria-label="Modo de agrupación de pólizas en lote"
            size="sm"
            value={batchGroupingMode}
            disabled={isBatchContabilizarPending || isWriteBlocked}
            onChange={(e) => onChangeBatchGroupingMode(e.target.value as BatchPolizaGroupingMode)}
            containerClassName="w-auto min-w-[168px]"
            title="Elige entre 1 póliza por CFDI o póliza concentrada"
          >
            <option value="PER_CFDI">1 póliza por CFDI</option>
            <option value="BY_DAY">Concentrada por día</option>
            <option value="BY_RFC">Concentrada por RFC</option>
            <option value="BY_NOMINA">Concentrada nómina</option>
          </Select>
        )}
        {!isReadOnlyClient && (
          <Button
            variant="primary"
            size="sm"
            loading={isBatchContabilizarPending}
            disabled={isBatchContabilizarPending || isWriteBlocked}
            onClick={onBatchContabilizarSelected}
            title={
              isPeriodLocked
                ? 'Periodo bloqueado ante el SAT. No se pueden generar pólizas.'
                : 'Contabilizar los comprobantes seleccionados en lote'
            }
            leftIcon={
              isBatchContabilizarPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              )
            }
          >
            {isBatchContabilizarPending
              ? batchProgress
                ? `Contabilizando (${batchProgress.current}/${batchProgress.total})...`
                : 'Contabilizando...'
              : 'Contabilizar Seleccionados'}
          </Button>
        )}

        {onVerifySatBatchSelected && !isReadOnlyClient && (
          <Button
            variant="secondary"
            size="sm"
            loading={isVerifySatBatchPending}
            disabled={
              isVerifySatBatchPending || isBatchContabilizarPending || isBatchDeletePending
            }
            onClick={onVerifySatBatchSelected}
            title="Consultar estatus vigente o cancelado ante el SAT y lista 69-B para los CFDIs seleccionados"
            leftIcon={
              isVerifySatBatchPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              )
            }
          >
            {isVerifySatBatchPending ? 'Validando SAT...' : 'Validar SAT en Lote'}
          </Button>
        )}

        {onExportZipSelected && (
          <Button
            variant="export"
            size="sm"
            loading={isExportZipPending}
            disabled={isExportZipPending || isBatchDeletePending}
            onClick={onExportZipSelected}
            title="Descargar los XML originales seleccionados empaquetados en archivo .ZIP"
            leftIcon={
              isExportZipPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <FileArchive className="w-3.5 h-3.5" aria-hidden="true" />
              )
            }
          >
            {isExportZipPending ? 'Empaquetando...' : 'Descargar XML (.zip)'}
          </Button>
        )}

        {!isReadOnlyClient &&
          (confirmDelete ? (
            <InlineConfirm
              tone="danger"
              busy={isBatchDeletePending}
              message="¿Eliminar del ADD?"
              confirmLabel={isBatchDeletePending ? 'Eliminando...' : 'Confirmar'}
              cancelLabel="Cancelar"
              ariaLabel="Confirmar eliminación en bloque de comprobantes"
              onConfirm={() => {
                onBatchDeleteSelected();
                setConfirmDelete(false);
              }}
              onCancel={() => setConfirmDelete(false)}
            />
          ) : (
            <Button
              variant="danger-outline"
              size="sm"
              disabled={isBatchDeletePending || isWriteBlocked}
              onClick={() => {
                if (isWriteBlocked) return;
                setConfirmDelete(true);
              }}
              title={isPeriodLocked ? 'Periodo bloqueado ante el SAT' : 'Eliminar del ADD'}
              leftIcon={<Trash2 className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Eliminar del ADD
            </Button>
          ))}

        <Button
          variant="ghost"
          size="sm"
          title="Limpiar selección actual (Esc)"
          onClick={() => {
            setConfirmDelete(false);
            onClearSelection();
          }}
        >
          Deseleccionar
        </Button>
      </div>
    </div>
  );
}
