import { useState } from 'react';
import { CheckCircle2, Landmark, Lock, Plus, Sparkles, Trash2, Unlink, UploadCloud } from 'lucide-react';
import { Button, ClearFiltersButton, EmptyState, InlineConfirm, StatusBadge } from '../../components/ui';
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
  const lockReason = isReadOnlyClient ? 'Modo solo lectura' : 'Periodo bloqueado ante el SAT';
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
          <caption className="visually-hidden">Movimientos del estado de cuenta bancario</caption>
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
                <td colSpan={7}>
                  <EmptyState
                    icon={<Landmark className="w-6 h-6" aria-hidden="true" />}
                    tone="blue"
                    title={
                      showOnlyPending && reconData.statementLines.length > 0
                        ? 'Sin partidas bancarias pendientes por conciliar'
                        : 'No hay extractos bancarios registrados para esta cuenta'
                    }
                    description={
                      showOnlyPending && reconData.statementLines.length > 0
                        ? 'Todos los movimientos del estado de cuenta ya están cruzados.'
                        : 'Importa un CSV o registra un movimiento manual para iniciar la conciliación.'
                    }
                    actions={
                      <>
                        {showOnlyPending && reconData.statementLines.length > 0 && onClearPendingFilter && (
                          <ClearFiltersButton onClick={onClearPendingFilter} label="Ver todos los movimientos" />
                        )}
                        {!isLocked && !showOnlyPending && onTriggerCsvImport && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={onTriggerCsvImport}
                            leftIcon={<UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />}
                          >
                            Importar CSV Banco
                          </Button>
                        )}
                        {!isLocked && !showOnlyPending && onOpenAddLine && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={onOpenAddLine}
                            leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
                          >
                            Agregar Línea Manual
                          </Button>
                        )}
                      </>
                    }
                  />
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
                    aria-label={
                      !line.matchedMovementId && onSelectLine
                        ? `${isSelected ? 'Deseleccionar' : 'Seleccionar'} movimiento bancario ${line.referencia} por ${formatCurrency(line.cargoBanco || line.abonoBanco)} para cruce manual`
                        : undefined
                    }
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
                    <td className="py-2.5 px-4 text-slate-800 font-medium">{line.descripcion}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold w-[130px] whitespace-nowrap tabular-nums">
                      {line.cargoBanco > 0 ? formatCurrency(line.cargoBanco) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold w-[130px] whitespace-nowrap tabular-nums">
                      {line.abonoBanco > 0 ? formatCurrency(line.abonoBanco) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center w-[150px]">
                      {line.matchedMovementId ? (
                        <StatusBadge tone="emerald" icon={<CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}>
                          Conciliado ({line.matchedPolizaFolio || 'Póliza'})
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="amber">Sin Conciliar</StatusBadge>
                      )}
                    </td>
                    <td
                      className="py-2.5 px-4 text-right w-[210px] whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!line.matchedMovementId ? (
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant={isLocked ? 'secondary' : 'primary'}
                            disabled={isCreatePolizaPending || isLocked}
                            aria-busy={isCreatePolizaPending && isRowMutating}
                            onClick={() => onCreatePolizaFromBank(line.id)}
                            title={
                              isLocked
                                ? `${lockReason}. No es posible generar pólizas.`
                                : 'Elegir contracuenta, IVA y generar póliza'
                            }
                            leftIcon={
                              isLocked
                                ? <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                                : <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                            }
                          >
                            {isCreatePolizaPending && isRowMutating ? 'Creando...' : 'Crear Póliza'}
                          </Button>
                          {onDeleteBankLine && (
                            confirmDeleteId === line.id ? (
                              <div tabIndex={-1} autoFocus className="inline-block focus:outline-none">
                                <InlineConfirm
                                  ariaLabel={`Confirmar eliminación de ${line.referencia}`}
                                  busy={isDeletePending || isLocked}
                                  confirmLabel="Confirmar"
                                  cancelLabel="Cancelar"
                                  onCancel={() => setConfirmDeleteId(null)}
                                  onConfirm={() => {
                                    setConfirmDeleteId(null);
                                    onDeleteBankLine(line.id);
                                  }}
                                />
                              </div>
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
                        <div tabIndex={-1} autoFocus className="inline-block focus:outline-none">
                          <InlineConfirm
                            ariaLabel={`Confirmar desconciliación de ${line.referencia}`}
                            busy={isUnmatchPending || isLocked}
                            confirmLabel="Confirmar"
                            cancelLabel="Cancelar"
                            onCancel={() => setConfirmUnmatchId(null)}
                            onConfirm={() => {
                              setConfirmUnmatchId(null);
                              onUnmatchBankLine(line.id);
                            }}
                          />
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isUnmatchPending || isLocked}
                          aria-busy={isUnmatchPending && isRowMutating}
                          onClick={() => setConfirmUnmatchId(line.id)}
                          title={isLocked ? lockReason : 'Desvincular esta línea bancaria para volver a conciliar'}
                          leftIcon={<Unlink className="w-3.5 h-3.5" aria-hidden="true" />}
                          className={!isLocked ? 'hover:bg-red-50 hover:text-red-800 hover:border-red-200' : ''}
                        >
                          {isUnmatchPending && isRowMutating ? 'Desvinculando...' : 'Desconciliar'}
                        </Button>
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
