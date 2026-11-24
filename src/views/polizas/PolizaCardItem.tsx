import React from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileCode2,
  Sparkles
} from 'lucide-react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { Poliza } from '../../shared/types';
import { PolizaCardActions } from './PolizaCardActions';
import { PolizaCardMovementsTable } from './PolizaCardMovementsTable';
import { collectPolizaUniqueUuids } from './filterPolizas';

export interface PolizaCardItemProps {
  pol: Poliza;
  isExpanded: boolean;
  compactMode: boolean;
  isExactMatch: boolean;
  isPeriodLocked: boolean;
  isReadOnlyClient?: boolean;
  isDeleting?: boolean;
  isReversing?: boolean;
  copiedPolizaId: string | null;
  confirmDeleteId: string | null;
  onToggleExpand: (id: string) => void;
  onCopyPoliza: (pol: Poliza) => void;
  onPrintPoliza?: (pol: Poliza) => void;
  onDuplicate: (pol: Poliza) => void;
  onReverse?: (pol: Poliza) => void;
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
  isDeleting = false,
  isReversing = false,
  copiedPolizaId,
  confirmDeleteId,
  onToggleExpand,
  onCopyPoliza,
  onPrintPoliza,
  onDuplicate,
  onReverse,
  onEdit,
  onConfirmDelete,
  onCancelDelete,
  onRequestDelete,
  onOpenLedger
}: PolizaCardItemProps) {
  const { copiedKey: copiedUuid, copy } = useCopyToClipboard<string>(2000);
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;
  const allUuids = collectPolizaUniqueUuids(pol);
  const discrepancyAmount = Math.abs(pol.totalCargos - pol.totalAbonos);

  return (
    <article
      className={`bg-white rounded-2xl border shadow-2xs overflow-hidden transition avoid-page-break ${
        isExactMatch ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-300/90'
      }`}
    >
      <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          {compactMode && (
            <button
              type="button"
              onClick={() => onToggleExpand(pol.id)}
              aria-expanded={isExpanded}
              aria-label={`Mostrar u ocultar partidas de póliza ${pol.tipo} #${pol.folio}`}
              className="min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center p-1 rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          )}
          <span
            className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold border shrink-0 ${
              pol.tipo === 'INGRESO'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : pol.tipo === 'EGRESO'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {pol.tipo} #{pol.folio}
          </span>
          <span className="font-mono text-xs text-slate-600 shrink-0">
            {formatShortDate(pol.fecha)}
          </span>
          <h2
            title={pol.concepto}
            className="text-sm font-bold text-slate-900 min-w-0 max-w-full line-clamp-2 sm:truncate sm:max-w-sm lg:max-w-md 2xl:max-w-2xl"
          >
            {pol.concepto}
          </h2>
          {compactMode && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {pol.movements.length} partida{pol.movements.length === 1 ? '' : 's'}
            </span>
          )}
          {pol.origin === 'ADD_AUTO' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              Auto ADD
            </span>
          )}
          {allUuids.length > 0 && (
            <div className="inline-flex flex-wrap items-center gap-1">
              {allUuids.length > 1 && (
                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold">
                  {allUuids.length} CFDIs
                </span>
              )}
              {allUuids.slice(0, 3).map((uuid) => (
                <button
                  key={uuid}
                  type="button"
                  onClick={() => void copy(uuid, uuid)}
                  title={`Copiar UUID fiscal completo: ${uuid}`}
                  aria-label={`Copiar UUID fiscal ${uuid}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 hover:border-blue-300 transition cursor-pointer group"
                >
                  {copiedUuid === uuid ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                      <span className="text-emerald-700 font-semibold">Copiado</span>
                    </>
                  ) : (
                    <>
                      <FileCode2 className="w-3 h-3 text-slate-500 group-hover:text-blue-600" aria-hidden="true" />
                      <span>UUID: {uuid.slice(0, 10)}...</span>
                      <Copy className="w-2.5 h-2.5 text-slate-500 group-hover:text-blue-600 opacity-75 group-hover:opacity-100" aria-hidden="true" />
                    </>
                  )}
                </button>
              ))}
              {allUuids.length > 3 && (
                <span className="text-[10px] font-mono text-slate-500">+{allUuids.length - 3}</span>
              )}
              <span className="visually-hidden" aria-live="polite">
                {copiedUuid ? `UUID ${copiedUuid} copiado al portapapeles` : ''}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 shrink-0">
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

          {pol.isBalanced ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Cuadrada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-800 border border-red-200 font-mono">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
              Descuadrada ({formatCurrency(discrepancyAmount)})
            </span>
          )}

          <PolizaCardActions
            pol={pol}
            isWriteBlocked={isWriteBlocked}
            isReadOnlyClient={isReadOnlyClient}
            isPeriodLocked={isPeriodLocked}
            isDeleting={isDeleting}
            isReversing={isReversing}
            copiedPolizaId={copiedPolizaId}
            confirmDeleteId={confirmDeleteId}
            onCopyPoliza={onCopyPoliza}
            onPrintPoliza={onPrintPoliza}
            onDuplicate={onDuplicate}
            onReverse={onReverse}
            onEdit={onEdit}
            onConfirmDelete={onConfirmDelete}
            onCancelDelete={onCancelDelete}
            onRequestDelete={onRequestDelete}
          />
        </div>
      </div>

      {isExpanded && <PolizaCardMovementsTable pol={pol} onOpenLedger={onOpenLedger} />}
    </article>
  );
}

export const PolizaCardItem = React.memo(PolizaCardItemBase);
