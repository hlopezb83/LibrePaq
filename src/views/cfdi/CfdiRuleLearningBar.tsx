import { Sparkles } from 'lucide-react';
import type { AccountingRuleRecord } from '../../shared/types/accounting-rules.types';

const DEDUCTIBLE_PRESETS = [100, 50, 25, 10, 0] as const;

export interface CfdiRuleLearningBarProps {
  direction: 'EMITIDO' | 'RECIBIDO';
  counterpartyRfc: string;
  matchedRule: AccountingRuleRecord | null;
  deductiblePct: number;
  setDeductiblePct: (pct: number) => void;
  rememberRule: boolean;
  setRememberRule: (checked: boolean) => void;
}

export function CfdiRuleLearningBar({
  direction,
  counterpartyRfc,
  matchedRule,
  deductiblePct,
  setDeductiblePct,
  rememberRule,
  setRememberRule
}: CfdiRuleLearningBarProps) {
  const hasCustomPreset = !DEDUCTIBLE_PRESETS.includes(
    deductiblePct as (typeof DEDUCTIBLE_PRESETS)[number]
  );

  return (
    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
      {matchedRule && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
            Regla automática aplicada
          </span>
          <span className="text-[11px] text-slate-600 font-medium">
            {matchedRule.name || matchedRule.matchRfc || matchedRule.matchClaveProdServ} · Cta{' '}
            <span className="font-mono font-bold text-slate-800">
              {matchedRule.operationAccountCode}
            </span>
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-800 font-medium">
          <input
            type="checkbox"
            checked={rememberRule}
            onChange={(e) => setRememberRule(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
          />
          <span>
            Recordar regla contable para este RFC{' '}
            {counterpartyRfc && (
              <span className="font-mono font-bold text-slate-900">({counterpartyRfc})</span>
            )}
          </span>
        </label>

        {direction === 'RECIBIDO' && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="cfdi-deductible-pct"
              className="text-xs font-semibold text-slate-700 whitespace-nowrap"
            >
              % Deducible:
            </label>
            <select
              id="cfdi-deductible-pct"
              value={deductiblePct}
              onChange={(e) => setDeductiblePct(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            >
              {hasCustomPreset && (
                <option value={deductiblePct}>{deductiblePct}% (Regla)</option>
              )}
              <option value={100}>100% (Totalmente deducible)</option>
              <option value={50}>50% (Parcial · 50% a 801)</option>
              <option value={25}>25% (Parcial · 75% a 801)</option>
              <option value={10}>10% (Parcial · 90% a 801)</option>
              <option value={0}>0% (No deducible · 100% a 801)</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
