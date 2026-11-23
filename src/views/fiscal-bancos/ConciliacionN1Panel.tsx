import { CheckCircle2, Loader2, X } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { BankN1MatchProposal } from '../../shared/types/bank-n1.types';

interface ConciliacionN1PanelProps {
  proposals: BankN1MatchProposal[];
  isApplying: boolean;
  isLocked: boolean;
  onDiscardAll: () => void;
  onRemoveProposal: (bankLineId: string) => void;
  onApplyAll: () => void;
}

export function ConciliacionN1Panel({
  proposals,
  isApplying,
  isLocked,
  onDiscardAll,
  onRemoveProposal,
  onApplyAll
}: ConciliacionN1PanelProps) {
  if (proposals.length === 0) return null;

  return (
    <section
      aria-label="Propuestas Agrupadas (Varios a 1)"
      aria-live="polite"
      className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-4 space-y-3 shadow-2xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-emerald-950">
            Propuestas Agrupadas (Varios a 1) ({proposals.length})
          </h3>
          <p className="text-xs text-emerald-800">
            Revisa los grupos de varias pólizas que suman un solo movimiento bancario antes de aplicar
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isApplying}
            onClick={onDiscardAll}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Descartar
          </button>
          <button
            type="button"
            disabled={isApplying || isLocked}
            title={
              isLocked
                ? 'Edición deshabilitada en periodo bloqueado o modo solo lectura'
                : 'Aplicar todas las propuestas agrupadas detectadas'
            }
            onClick={onApplyAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isApplying ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            )}
            {isApplying ? 'Aplicando...' : `Aplicar Grupos (${proposals.length})`}
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-56 overflow-y-auto scrollable-panel">
        {proposals.map((p) => {
          const movementsTotal = p.movements.reduce((acc, m) => acc + Number(m.amount || 0), 0);
          const proposalLabel = p.bankReferencia || p.bankDescripcion || p.bankFecha;
          return (
            <div
              key={p.bankLineId}
              className="bg-white rounded-xl border border-emerald-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="font-semibold text-slate-900 break-words">
                  {p.bankFecha} <span aria-hidden="true">·</span> {p.bankReferencia || 'Sin ref.'} — {p.bankDescripcion}{' '}
                  <span className="font-mono font-bold text-emerald-800 tabular-nums">
                    ({formatCurrency(p.bankAmount)})
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-1.5">
                  {p.movements.map((m) => (
                    <span
                      key={m.movementId}
                      className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono tabular-nums"
                    >
                      {m.polizaFolio}: {formatCurrency(m.amount)}
                    </span>
                  ))}
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200 font-mono font-semibold tabular-nums">
                    Suma pólizas: {formatCurrency(movementsTotal)}
                  </span>
                  {p.diffCents > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono tabular-nums">
                      Dif: {formatCurrency(p.diffCents / 100)}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={isApplying}
                aria-label={`Quitar propuesta ${proposalLabel}`}
                onClick={() => onRemoveProposal(p.bankLineId)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed self-end sm:self-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
