import { Sparkles, Trash2 } from 'lucide-react';
import { InlineConfirm, StatusBadge } from '../../components/ui';
import type { AccountingRuleRecord } from '../../shared/types/accounting-rules.types';

export interface AccountingRuleRowProps {
  rule: AccountingRuleRecord;
  isReadOnly: boolean;
  isConfirmingDelete: boolean;
  isDeleting: boolean;
  onRequestDelete: (ruleId: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (ruleId: string) => void;
}

export function AccountingRuleRow({
  rule,
  isReadOnly,
  isConfirmingDelete,
  isDeleting,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete
}: AccountingRuleRowProps) {
  const ruleLabel =
    rule.name ||
    [rule.matchRfc, rule.matchClaveProdServ, rule.matchUsoCfdi].filter(Boolean).join(' / ') ||
    rule.operationAccountCode;

  return (
    <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-slate-50">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-900">{rule.name || rule.operationAccountCode}</span>
          <StatusBadge tone="slate">{rule.direction}</StatusBadge>
          {rule.autoLearned && (
            <StatusBadge tone="emerald" icon={<Sparkles className="w-3 h-3" aria-hidden="true" />}>
              Aprendida
            </StatusBadge>
          )}
          {rule.deductiblePct < 100 && (
            <StatusBadge tone="amber">
              {rule.deductiblePct}% Deducible · {100 - rule.deductiblePct}% a 801
            </StatusBadge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600 font-mono">
          {rule.matchRfc && <span>RFC: {rule.matchRfc}</span>}
          {rule.matchClaveProdServ && <span>ClaveProdServ: {rule.matchClaveProdServ}</span>}
          {rule.matchUsoCfdi && <span>Uso CFDI: {rule.matchUsoCfdi}</span>}
          <span className="text-blue-800 font-bold">→ Cuenta {rule.operationAccountCode}</span>
          {rule.counterAccountCode && (
            <span className="text-blue-700 font-semibold">· Contrapartida {rule.counterAccountCode}</span>
          )}
          <span className="text-slate-600 tabular-nums">Prioridad: {rule.priority}</span>
        </div>
      </div>

      {isConfirmingDelete ? (
        <InlineConfirm
          tone="danger"
          busy={isReadOnly || isDeleting}
          cancelLabel="Cancelar"
          confirmLabel={isDeleting ? 'Eliminando...' : 'Confirmar'}
          ariaLabel={`Confirmar eliminación de regla ${ruleLabel}`}
          onCancel={onCancelDelete}
          onConfirm={() => onConfirmDelete(rule.id)}
        />
      ) : (
        <button
          type="button"
          aria-label={`Eliminar regla contable ${ruleLabel}`}
          title={
            isReadOnly
              ? 'Modo solo lectura: no puedes eliminar reglas contables'
              : `Eliminar regla ${ruleLabel}`
          }
          disabled={isReadOnly || isDeleting}
          onClick={() => onRequestDelete(rule.id)}
          className="p-2 rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
