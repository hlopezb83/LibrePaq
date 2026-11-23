import React from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  CopyPlus,
  FileCode2,
  Pencil,
  Sparkles,
  Trash2
} from 'lucide-react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { Poliza } from '../../shared/types';
import { PolizaCardMovementsTable } from './PolizaCardMovementsTable';

export interface PolizaCardItemProps {
  pol: Poliza;
  isExpanded: boolean;
  compactMode: boolean;
  isExactMatch: boolean;
  isPeriodLocked: boolean;
  isReadOnlyClient?: boolean;
  copiedPolizaId: string | null;
  confirmDeleteId: string | null;
  onToggleExpand: (id: string) => void;
  onCopyPoliza: (pol: Poliza) => void;
  onDuplicate: (pol: Poliza) => void;
  onEdit: (pol: Poliza) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  onRequestDelete: (id: string) => void;
  onOpenLedger: (accountId: string) => void;
}

function PolizaCardItemBase({
  pol,
  isExpanded,
  compactMode,
  isExactMatch,
  isPeriodLocked,
  isReadOnlyClient = false,
  copiedPolizaId,
  confirmDeleteId,
  onToggleExpand,
  onCopyPoliza,
  onDuplicate,
  onEdit,
  onConfirmDelete,
  onCancelDelete,
  onRequestDelete,
  onOpenLedger
}: PolizaCardItemProps) {
  const { copiedKey, copy } = useCopyToClipboard<string>(2000);
  const copiedUuid = copiedKey;
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;

  function handleCopyUuid(uuid: string) {
    void copy(uuid, uuid);
  }

  return (
    <article
      className={`bg-white rounded-2xl border shadow-2xs overflow-hidden transition avoid-page-break ${
        isExactMatch ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-300/90'
      }`}
    >
      <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {compactMode && (
            <button
              type="button"
              onClick={() => onToggleExpand(pol.id)}
              aria-expanded={isExpanded}
              aria-label="Mostrar u ocultar partidas de la póliza"
              className="p-1 rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          )}
          <span
            className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold border ${
              pol.tipo === 'INGRESO'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : pol.tipo === 'EGRESO'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {pol.tipo} #{pol.folio}
          </span>
          <span className="font-mono text-xs text-slate-600">
            {formatShortDate(pol.fecha)}
          </span>
          <h2
            title={pol.concepto}
            className="text-sm font-bold text-slate-900 max-w-xs sm:max-w-sm lg:max-w-md 2xl:max-w-2xl truncate"
          >
            {pol.concepto}
          </h2>
          {pol.origin === 'ADD_AUTO' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              Auto ADD
            </span>
          )}
          {pol.cfdiUuid && (
            <button
              type="button"
              onClick={() => handleCopyUuid(pol.cfdiUuid!)}
              title={`Copiar UUID fiscal completo: ${pol.cfdiUuid}`}
              aria-label={`Copiar UUID fiscal ${pol.cfdiUuid}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 hover:border-blue-300 transition cursor-pointer group"
            >
              {copiedUuid === pol.cfdiUuid ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                  <span className="text-emerald-700 font-semibold">UUID Copiado</span>
                </>
              ) : (
                <>
                  <FileCode2 className="w-3 h-3 text-slate-500 group-hover:text-blue-600" aria-hidden="true" />
                  <span>UUID: {pol.cfdiUuid.slice(0, 11)}...</span>
                  <Copy className="w-2.5 h-2.5 text-slate-500 group-hover:text-blue-600 opacity-75 group-hover:opacity-100" aria-hidden="true" />
                </>
              )}
              <span className="visually-hidden" aria-live="polite">
                {copiedUuid === pol.cfdiUuid ? 'UUID fiscal copiado al portapapeles' : ''}
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5">
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <div>
              <span className="text-slate-500 mr-1">Cargos:</span>
              <strong className="text-slate-900">{formatCurrency(pol.totalCargos)}</strong>
            </div>
            <div>
              <span className="text-slate-500 mr-1">Abonos:</span>
              <strong className="text-slate-900">{formatCurrency(pol.totalAbonos)}</strong>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            Cuadrada
          </span>

          <div className="flex flex-wrap items-center gap-1.5 no-print">
            <button
              type="button"
              onClick={() => onCopyPoliza(pol)}
              title="Copiar asiento contable al portapapeles (texto formal con sumas iguales)"
              aria-label={`Copiar asiento de póliza ${pol.tipo} ${pol.folio}`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
            >
              {copiedPolizaId === pol.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span className="text-emerald-700 font-semibold">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  <span className="hidden sm:inline">Copiar Asiento</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isWriteBlocked}
              onClick={() => onDuplicate(pol)}
              title={
                isReadOnlyClient
                  ? 'Tu rol Cliente (Solo lectura) no permite duplicar pólizas'
                  : isPeriodLocked
                  ? 'Periodo bloqueado ante el SAT'
                  : 'Duplicar esta póliza como plantilla para un nuevo registro'
              }
              aria-label={`Duplicar póliza ${pol.tipo} ${pol.folio}`}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                isWriteBlocked
                  ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                  : 'text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 cursor-pointer'
              }`}
            >
              <CopyPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Duplicar</span>
            </button>

            <button
              type="button"
              disabled={isWriteBlocked}
              onClick={() => onEdit(pol)}
              title={
                isReadOnlyClient
                  ? 'Tu rol Cliente (Solo lectura) no permite editar pólizas'
                  : isPeriodLocked
                  ? 'Periodo bloqueado ante el SAT'
                  : 'Editar póliza'
              }
              aria-label={`Editar póliza ${pol.tipo} ${pol.folio}`}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                isWriteBlocked
                  ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                  : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 cursor-pointer'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              Editar
            </button>

            {confirmDeleteId === pol.id ? (
              <div
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    onCancelDelete();
                  }
                }}
                className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1"
              >
                <button
                  type="button"
                  disabled={isWriteBlocked}
                  onClick={() => onConfirmDelete(pol.id)}
                  className="px-2 py-0.5 rounded text-[11px] font-bold text-red-800 hover:bg-red-100 cursor-pointer disabled:opacity-50"
                >
                  Confirmar
                </button>
                <span className="text-red-300" aria-hidden="true">|</span>
                <button
                  type="button"
                  autoFocus
                  onClick={onCancelDelete}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 hover:bg-white cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isWriteBlocked}
                onClick={() => {
                  if (!isWriteBlocked) onRequestDelete(pol.id);
                }}
                title={
                  isReadOnlyClient
                    ? 'Tu rol Cliente (Solo lectura) no permite eliminar pólizas'
                    : isPeriodLocked
                    ? 'Periodo bloqueado ante el SAT'
                    : 'Eliminar póliza'
                }
                aria-label={`Eliminar póliza ${pol.tipo} ${pol.folio}`}
                className={`p-1.5 rounded-lg transition ${
                  isWriteBlocked
                    ? 'opacity-40 cursor-not-allowed text-slate-400'
                    : 'text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer'
                }`}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabla de movimientos de la póliza */}
      {isExpanded && <PolizaCardMovementsTable pol={pol} onOpenLedger={onOpenLedger} />}
    </article>
  );
}

export const PolizaCardItem = React.memo(PolizaCardItemBase);
