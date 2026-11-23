import { CheckCircle2, X } from 'lucide-react';
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
      aria-label="Propuestas de conciliación muchos a uno"
      className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-4 space-y-3 shadow-2xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-emerald-950">
            Propuestas N-a-1 Detectadas ({proposals.length})
          </h3>
          <p className="text-xs text-emerald-800">
            Revisa los grupos de pólizas que suman cada movimiento bancario antes de aplicar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscardAll}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 cursor-pointer"
          >
            Descartar
          </button>
          <button
            type="button"
            disabled={isApplying || isLocked}
            onClick={onApplyAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            {isApplying ? 'Aplicando...' : `Aplicar N-a-1 (${proposals.length})`}
          </button>
        </div>
      </div>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {proposals.map((p) => (
          <div
            key={p.bankLineId}
            className="bg-white rounded-xl border border-emerald-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
          >
            <div className="space-y-1 min-w-0">
              <div className="font-semibold text-slate-900">
                {p.bankFecha} · {p.bankReferencia} — {p.bankDescripcion}{' '}
                <span className="font-mono font-bold text-emerald-800 tabular-nums">
                  ({formatCurrency(p.bankAmount)})
                </span>
              </div>
              <div className="text-[11px] text-slate-600 flex flex-wrap gap-1.5">
                {p.movements.map((m) => (
                  <span
                    key={m.movementId}
                    className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono"
                  >
                    {m.polizaFolio}: {formatCurrency(m.amount)}
                  </span>
                ))}
                {p.diffCents > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono">
                    Dif: {(p.diffCents / 100).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label={`Quitar propuesta ${p.bankReferencia}`}
              onClick={() => onRemoveProposal(p.bankLineId)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 self-end sm:self-center cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
