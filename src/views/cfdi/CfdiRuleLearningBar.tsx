import { Sparkles } from 'lucide-react';
import { Select, StatusBadge } from '../../components/ui';
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
  disabled?: boolean;
}

export function CfdiRuleLearningBar({
  direction,
  counterpartyRfc,
  matchedRule,
  deductiblePct,
  setDeductiblePct,
  rememberRule,
  setRememberRule,
  disabled = false
}: CfdiRuleLearningBarProps) {
  const hasCustomPreset = !DEDUCTIBLE_PRESETS.includes(
    deductiblePct as (typeof DEDUCTIBLE_PRESETS)[number]
  );

  return (
    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
      {matchedRule && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
          <StatusBadge
            tone="emerald"
            icon={<Sparkles className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            Regla automática aplicada
          </StatusBadge>
          <span className="text-[11px] text-slate-600 font-medium break-words">
            {matchedRule.name || matchedRule.matchRfc || matchedRule.matchClaveProdServ} · Cta{' '}
            <span className="font-mono font-bold text-slate-800">
              {matchedRule.operationAccountCode}
            </span>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <label
          htmlFor="cfdi-remember-rule"
          className={`inline-flex items-center gap-2 select-none text-slate-800 font-medium min-w-0 ${
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <input
            id="cfdi-remember-rule"
            type="checkbox"
            checked={rememberRule}
            disabled={disabled}
            onChange={(e) => setRememberRule(e.target.checked)}
            className="w-4 h-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-600 disabled:cursor-not-allowed"
          />
          <span className="break-words">
            {matchedRule
              ? 'Actualizar regla contable guardada para este RFC'
              : 'Recordar regla contable para este RFC'}{' '}
            {counterpartyRfc && (
              <span className="font-mono font-bold text-slate-900">({counterpartyRfc})</span>
            )}
          </span>
        </label>

        {direction === 'RECIBIDO' && (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 min-w-0 w-full sm:w-auto">
            <label
              htmlFor="cfdi-deductible-pct"
              className="text-xs font-semibold text-slate-700 whitespace-nowrap"
            >
              % Deducible:
            </label>
            <Select
              id="cfdi-deductible-pct"
              size="sm"
              value={deductiblePct}
              disabled={disabled}
              onChange={(e) => setDeductiblePct(Number(e.target.value))}
              containerClassName="w-full sm:w-auto min-w-0 max-w-full"
              className="font-mono"
            >
              {hasCustomPreset && (
                <option value={deductiblePct}>{deductiblePct}% (Regla)</option>
              )}
              <option value={100}>100% (Totalmente deducible)</option>
              <option value={50}>50% (Parcial · 50% a No Deducibles 801)</option>
              <option value={25}>25% (Parcial · 75% a No Deducibles 801)</option>
              <option value={10}>10% (Parcial · 90% a No Deducibles 801)</option>
              <option value={0}>0% (No deducible · 100% a No Deducibles 801)</option>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
