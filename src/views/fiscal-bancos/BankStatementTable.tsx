import { useState } from 'react';
import { CheckCircle2, Landmark, Lock, Plus, Sparkles, Trash2, Unlink, UploadCloud } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { BankReconciliationResponse } from '../../shared/types';

interface BankStatementTableProps {
  reconData: BankReconciliationResponse;
  isPeriodLocked: boolean;
  isReadOnlyClient?: boolean;
  isCreatePolizaPending: boolean;
  onCreatePolizaFromBank: (lineId: string) => void;
  isUnmatchPending: boolean;
  onUnmatchBankLine: (lineId: string) => void;
  onDeleteBankLine?: (lineId: string) => void;
  isDeletePending?: boolean;
  showOnlyPending?: boolean;
  selectedLineId?: string | null;
  onSelectLine?: (lineId: string) => void;
  activeBankLineId?: string | null;
  onTriggerCsvImport?: () => void;
  onOpenAddLine?: () => void;
  onClearPendingFilter?: () => void;
}

export function BankStatementTable({
  reconData,
  isPeriodLocked,
  isReadOnlyClient = false,
  isCreatePolizaPending,
  onCreatePolizaFromBank,
  isUnmatchPending,
  onUnmatchBankLine,
  onDeleteBankLine,
  isDeletePending = false,
  showOnlyPending = false,
  selectedLineId = null,
  onSelectLine,
  activeBankLineId = null,
  onTriggerCsvImport,
  onOpenAddLine,
  onClearPendingFilter
}: BankStatementTableProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmUnmatchId, setConfirmUnmatchId] = useState<string | null>(null);
  const isLocked = isPeriodLocked || isReadOnlyClient;
  const lockReason = isReadOnlyClient
    ? 'Modo solo lectura'
    : 'Periodo bloqueado ante el SAT';
  const visibleLines = showOnlyPending
    ? reconData.statementLines.filter((l) => !l.matchedMovementId)
    : reconData.statementLines;
  const totalCargos = visibleLines.reduce((acc, l) => acc + l.cargoBanco, 0);
  const totalAbonos = visibleLines.reduce((acc, l) => acc + l.abonoBanco, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            1. Estado de Cuenta Bancario ({reconData.account.name})
          </h2>
          <p className="text-xs text-slate-600">
            Haz clic en una partida pendiente para resaltar posibles cruces por monto en Libros Contables
          </p>
        </div>
        <span className="text-[11px] font-mono text-slate-600">
          {visibleLines.length} de {reconData.statementLines.length} movimientos
        </span>
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label="Tabla de estado de cuenta bancario"
        className="overflow-x-auto max-h-[380px] overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-600"
      >
        <table className="w-full text-left border-collapse erp-sticky-table">
          <caption className="visually-hidden">
            Movimientos del estado de cuenta bancario
          </caption>
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <th scope="col" className="py-2.5 px-4 w-[110px]">Fecha</th>
              <th scope="col" className="py-2.5 px-4 w-[130px]">Referencia</th>
              <th scope="col" className="py-2.5 px-4 min-w-[200px]">Descripción en Estado de Cuenta</th>
              <th scope="col" className="py-2.5 px-4 w-[130px] text-right">Retiro (Cargo)</th>
              <th scope="col" className="py-2.5 px-4 w-[130px] text-right">Depósito (Abono)</th>
              <th scope="col" className="py-2.5 px-4 w-[150px] text-center">Estado Conciliación</th>
              <th scope="col" className="py-2.5 px-4 w-[210px] text-right">Acción Contable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {visibleLines.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-600 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
                    <Landmark className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      {showOnlyPending && reconData.statementLines.length > 0
                        ? 'Sin partidas bancarias pendientes por conciliar'
                        : 'No hay extractos bancarios registrados para esta cuenta'}
                    </p>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto mt-1">
                      {showOnlyPending && reconData.statementLines.length > 0
                        ? 'Todos los movimientos del estado de cuenta ya están cruzados.'
                        : 'Importa un CSV o registra un movimiento manual para iniciar la conciliación.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {showOnlyPending && reconData.statementLines.length > 0 && onClearPendingFilter && (
                      <button
                        type="button"
                        onClick={onClearPendingFilter}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 cursor-pointer"
                      >
                        Ver todos los movimientos
                      </button>
                    )}
                    {!isLocked && !showOnlyPending && onTriggerCsvImport && (
                      <button
                        type="button"
                        onClick={onTriggerCsvImport}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 cursor-pointer"
                      >
                        <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
                        Importar CSV Banco
                      </button>
                    )}
                    {!isLocked && !showOnlyPending && onOpenAddLine && (
                      <button
                        type="button"
                        onClick={onOpenAddLine}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        Agregar Línea Manual
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              visibleLines.map((line) => {
                const isSelected = selectedLineId === line.id;
                const isRowMutating = activeBankLineId === line.id;
                return (
                  <tr
                    key={line.id}
                    tabIndex={!line.matchedMovementId && onSelectLine ? 0 : undefined}
                    aria-selected={!line.matchedMovementId && onSelectLine ? isSelected : undefined}
                    aria-label={!line.matchedMovementId && onSelectLine ? `${isSelected ? 'Deseleccionar' : 'Seleccionar'} movimiento bancario ${line.referencia} por ${formatCurrency(line.cargoBanco || line.abonoBanco)} para cruce manual` : undefined}
                    onClick={() => {
                      if (!line.matchedMovementId && onSelectLine) onSelectLine(line.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (!line.matchedMovementId && onSelectLine && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onSelectLine(line.id);
                      }
                    }}
                    className={
                      isSelected
                        ? 'bg-blue-100/80 ring-1 ring-inset ring-blue-400 cursor-pointer'
                        : line.matchedMovementId
                        ? 'hover:bg-blue-50/30'
                        : 'bg-amber-50/40 hover:bg-amber-50/70 cursor-pointer'
                    }
                  >
                    <td className="py-2.5 px-4 font-mono text-slate-600 w-[110px] whitespace-nowrap">
                      {formatShortDate(line.fecha)}
                      {isSelected && <span className="visually-hidden"> (Partida seleccionada para cruce)</span>}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900 w-[130px] whitespace-nowrap">
                      {line.referencia}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800 font-medium">
                      {line.descripcion}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold w-[130px] whitespace-nowrap tabular-nums">
                      {line.cargoBanco > 0 ? formatCurrency(line.cargoBanco) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold w-[130px] whitespace-nowrap tabular-nums">
                      {line.abonoBanco > 0 ? formatCurrency(line.abonoBanco) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center w-[150px]">
                      {line.matchedMovementId ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Conciliado ({line.matchedPolizaFolio || 'Póliza'})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-950 border border-amber-300">
                          Sin Conciliar
                        </span>
                      )}
                    </td>
                    <td
                      className="py-2.5 px-4 text-right w-[210px] whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!line.matchedMovementId ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isCreatePolizaPending || isLocked}
                            aria-busy={isCreatePolizaPending && isRowMutating}
                            onClick={() => onCreatePolizaFromBank(line.id)}
                            title={
                              isLocked
                                ? `${lockReason}. No es posible generar pólizas.`
                                : 'Elegir contracuenta, IVA y generar póliza'
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition ${
                              isLocked
                                ? 'opacity-50 cursor-not-allowed bg-slate-500 text-white'
                                : 'bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white cursor-pointer'
                            }`}
                          >
                            {isLocked ? <Lock className="w-3.5 h-3.5" aria-hidden="true" /> : <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />}
                            {isCreatePolizaPending && isRowMutating ? 'Creando...' : 'Crear Póliza'}
                          </button>
                          {onDeleteBankLine && (
                            confirmDeleteId === line.id ? (
                              <span
                                role="group"
                                aria-label="Confirmar eliminación de línea"
                                onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setConfirmDeleteId(null); } }}
                                className="inline-flex items-center gap-1"
                              >
                                <button
                                  type="button"
                                  disabled={isDeletePending || isLocked}
                                  aria-label={`Confirmar eliminación de ${line.referencia}`}
                                  onClick={() => { setConfirmDeleteId(null); onDeleteBankLine(line.id); }}
                                  className="px-2 py-1 rounded-lg text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 cursor-pointer"
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  autoFocus
                                  disabled={isDeletePending}
                                  aria-label={`Cancelar eliminación de ${line.referencia}`}
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isDeletePending || isLocked}
                                onClick={() => setConfirmDeleteId(line.id)}
                                title={isLocked ? lockReason : 'Eliminar línea bancaria mal importada'}
                                aria-label={`Eliminar movimiento bancario ${line.referencia}`}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 border border-slate-200 hover:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            )
                          )}
                        </div>
                      ) : confirmUnmatchId === line.id ? (
                        <span
                          role="group"
                          aria-label="Confirmar desconciliación"
                          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setConfirmUnmatchId(null); } }}
                          className="inline-flex items-center gap-1"
                        >
                          <button
                            type="button"
                            disabled={isUnmatchPending || isLocked}
                            aria-label={`Confirmar desconciliación de ${line.referencia}`}
                            onClick={() => { setConfirmUnmatchId(null); onUnmatchBankLine(line.id); }}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 cursor-pointer"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            autoFocus
                            disabled={isUnmatchPending}
                            aria-label={`Cancelar desconciliación de ${line.referencia}`}
                            onClick={() => setConfirmUnmatchId(null)}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isUnmatchPending || isLocked}
                          aria-busy={isUnmatchPending && isRowMutating}
                          onClick={() => setConfirmUnmatchId(line.id)}
                          title={isLocked ? lockReason : 'Desvincular esta línea bancaria para volver a conciliar'}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                            isLocked
                              ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200'
                              : 'text-slate-700 bg-slate-100 hover:bg-red-50 hover:text-red-800 border-slate-200 hover:border-red-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                          }`}
                        >
                          <Unlink className="w-3.5 h-3.5" aria-hidden="true" />
                          {isUnmatchPending && isRowMutating ? 'Desvinculando...' : 'Desconciliar'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {visibleLines.length > 0 && (
            <tfoot className="sticky bottom-0 z-10 bg-slate-100 [&_td]:bg-slate-100">
              <tr className="border-t-2 border-slate-300 font-mono text-xs font-bold text-slate-900">
                <td colSpan={3} className="py-2.5 px-4 font-sans text-right uppercase tracking-wider text-slate-700">
                  Totales Banco ({visibleLines.length}):
                </td>
                <td className="py-2.5 px-4 text-right whitespace-nowrap tabular-nums">
                  {formatCurrency(totalCargos)}
                </td>
                <td className="py-2.5 px-4 text-right whitespace-nowrap tabular-nums">
                  {formatCurrency(totalAbonos)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
