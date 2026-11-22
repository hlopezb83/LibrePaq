import { CheckCircle2, Landmark, Lock, Sparkles, Unlink } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { BankReconciliationResponse } from '../../shared/types';

interface BankStatementTableProps {
  reconData: BankReconciliationResponse;
  isPeriodLocked: boolean;
  isCreatePolizaPending: boolean;
  onCreatePolizaFromBank: (lineId: string) => void;
  isUnmatchPending: boolean;
  onUnmatchBankLine: (lineId: string) => void;
}

export function BankStatementTable({
  reconData,
  isPeriodLocked,
  isCreatePolizaPending,
  onCreatePolizaFromBank,
  isUnmatchPending,
  onUnmatchBankLine
}: BankStatementTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            1. Estado de Cuenta Bancario ({reconData.account.name})
          </h2>
          <p className="text-xs text-slate-500">
            Genera pólizas desde cargos bancarios no registrados o desconcilia partidas para corregir cruces
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse erp-sticky-table">
          <caption className="visually-hidden">
            Movimientos del estado de cuenta bancario
          </caption>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <th scope="col" className="py-2.5 px-4 w-[110px]">Fecha</th>
              <th scope="col" className="py-2.5 px-4 w-[130px]">Referencia</th>
              <th scope="col" className="py-2.5 px-4 min-w-[200px]">Descripción en Estado de Cuenta</th>
              <th scope="col" className="py-2.5 px-4 w-[130px] text-right">Retiro (Cargo)</th>
              <th scope="col" className="py-2.5 px-4 w-[130px] text-right">Depósito (Abono)</th>
              <th scope="col" className="py-2.5 px-4 w-[150px] text-center">Estado Conciliación</th>
              <th scope="col" className="py-2.5 px-4 w-[170px] text-right">Acción Contable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {reconData.statementLines.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-2xs mb-2">
                    <Landmark className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <p className="font-bold text-slate-800 text-sm">No hay extractos bancarios registrados para esta cuenta</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Usa &quot;Importar CSV&quot; o &quot;+ Agregar Línea&quot; para iniciar la conciliación contra pólizas contables.
                  </p>
                </td>
              </tr>
            ) : (
              reconData.statementLines.map((line) => (
                <tr key={line.id} className="hover:bg-blue-50/30">
                <td className="py-2.5 px-4 font-mono text-slate-600 w-[110px]">
                  {formatShortDate(line.fecha)}
                </td>
                <td className="py-2.5 px-4 font-mono font-bold text-slate-900 w-[130px]">
                  {line.referencia}
                </td>
                <td className="py-2.5 px-4 text-slate-800 font-medium">
                  {line.descripcion}
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold w-[130px]">
                  {line.cargoBanco > 0 ? formatCurrency(line.cargoBanco) : '—'}
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold w-[130px]">
                  {line.abonoBanco > 0 ? formatCurrency(line.abonoBanco) : '—'}
                </td>
                <td className="py-2.5 px-4 text-center w-[150px]">
                  {line.matchedMovementId ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Conciliado ({line.matchedPolizaFolio || 'Póliza'})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                      Sin Conciliar
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-right w-[170px]">
                  {!line.matchedMovementId ? (
                    <button
                      type="button"
                      disabled={isCreatePolizaPending || isPeriodLocked}
                      onClick={() => onCreatePolizaFromBank(line.id)}
                      title={
                        isPeriodLocked
                          ? 'Periodo bloqueado ante el SAT. No es posible generar pólizas.'
                          : 'Crear Póliza y Conciliar'
                      }
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition ${
                        isPeriodLocked
                          ? 'opacity-40 cursor-not-allowed bg-slate-400 text-white'
                          : 'bg-blue-700 hover:bg-blue-800 text-white cursor-pointer'
                      }`}
                    >
                      {isPeriodLocked ? (
                        <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      Crear Póliza y Conciliar
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isUnmatchPending || isPeriodLocked}
                      onClick={() => onUnmatchBankLine(line.id)}
                      title={
                        isPeriodLocked
                          ? 'Periodo bloqueado ante el SAT'
                          : 'Desvincular esta línea bancaria para volver a conciliar'
                      }
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        isPeriodLocked
                          ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                          : 'text-slate-700 bg-slate-100 hover:bg-red-50 hover:text-red-800 border-slate-200 hover:border-red-200 cursor-pointer'
                      }`}
                    >
                      <Unlink className="w-3.5 h-3.5" aria-hidden="true" />
                      Desconciliar
                    </button>
                  )}
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
