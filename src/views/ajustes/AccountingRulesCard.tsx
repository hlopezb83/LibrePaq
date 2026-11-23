import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { accountingRulesClient } from '../../lib/accounting-rules-client';
import { apiClient } from '../../lib/api-client';
import type { AccountingRuleDirection, AccountingRuleRecord } from '../../shared/types/accounting-rules.types';

export interface AccountingRulesCardProps {
  companyId: string;
}

export function AccountingRulesCard({ companyId }: AccountingRulesCardProps) {
  const { isReadOnlySupportMode, isReadOnlyClient } = useCompany();
  const isReadOnly = isReadOnlySupportMode || isReadOnlyClient;
  const queryClient = useQueryClient();
  const toast = useToast();
  const [direction, setDirection] = useState<AccountingRuleDirection>('RECIBIDO');
  const [matchRfc, setMatchRfc] = useState('');
  const [matchClaveProdServ, setMatchClaveProdServ] = useState('');
  const [matchUsoCfdi, setMatchUsoCfdi] = useState('');
  const [operationAccountCode, setOperationAccountCode] = useState('601-01-003');
  const [deductiblePct, setDeductiblePct] = useState(100);
  const [priority, setPriority] = useState(20);

  const { data: rules = [], isLoading } = useQuery<AccountingRuleRecord[]>({
    queryKey: ['accounting-rules', companyId],
    queryFn: () => accountingRulesClient.listAccountingRules(companyId),
    enabled: Boolean(companyId)
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', companyId],
    queryFn: () => apiClient.getAccounts(companyId),
    enabled: Boolean(companyId)
  });
  const affectableAccounts = accounts.filter((a) => a.isAffectable);

  useEffect(() => {
    if (affectableAccounts.length === 0) return;
    const exists = affectableAccounts.some((acc) => acc.code === operationAccountCode);
    if (!exists && affectableAccounts[0]?.code) {
      setOperationAccountCode(affectableAccounts[0].code);
    }
  }, [affectableAccounts, operationAccountCode]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (isReadOnly) {
        throw new Error('Modo solo lectura: no es posible crear o editar reglas contables.');
      }
      return accountingRulesClient.upsertAccountingRule({
        companyId,
        direction,
        matchRfc: matchRfc.trim().toUpperCase() || null,
        matchClaveProdServ: matchClaveProdServ.trim().toUpperCase() || null,
        matchUsoCfdi: matchUsoCfdi.trim().toUpperCase() || null,
        operationAccountCode,
        deductiblePct: direction === 'RECIBIDO' ? deductiblePct : 100,
        priority,
        autoLearned: false
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounting-rules', companyId] });
      setMatchRfc('');
      setMatchClaveProdServ('');
      setMatchUsoCfdi('');
      setDeductiblePct(100);
      toast.success('Regla contable guardada.');
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => {
      if (isReadOnly) {
        throw new Error('Modo solo lectura: no es posible eliminar reglas contables.');
      }
      return accountingRulesClient.deleteAccountingRule(companyId, ruleId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounting-rules', companyId] });
      toast.info('Regla contable eliminada.');
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const hasCriteria = Boolean(matchRfc.trim() || matchClaveProdServ.trim() || matchUsoCfdi.trim());
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isReadOnly && hasCriteria && operationAccountCode && !createMutation.isPending) createMutation.mutate();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <BookMarked className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Reglas Contables por RFC / ClaveProdServ y No Deducibles (801)</h3>
            <p className="text-xs text-slate-500">Asigna cuentas automáticas y % de deducibilidad (Art. 28 LISR) al contabilizar CFDI.</p>
          </div>
        </div>
        <span className="text-[11px] font-mono font-bold text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
          {rules.length} {rules.length === 1 ? 'regla activa' : 'reglas activas'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="p-5 border-b border-slate-200 bg-slate-50/40 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label htmlFor="rule-direction" className="block font-semibold text-slate-700 mb-1">Dirección</label>
            <select id="rule-direction" disabled={isReadOnly} value={direction} onChange={(e) => setDirection(e.target.value as AccountingRuleDirection)} className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-medium disabled:bg-slate-100">
              <option value="RECIBIDO">RECIBIDO (Gasto)</option>
              <option value="EMITIDO">EMITIDO (Ingreso)</option>
            </select>
          </div>
          <div>
            <label htmlFor="rule-rfc" className="block font-semibold text-slate-700 mb-1">RFC (Prioridad alta)</label>
            <input id="rule-rfc" type="text" maxLength={13} disabled={isReadOnly} value={matchRfc} onChange={(e) => setMatchRfc(e.target.value.toUpperCase())} placeholder="Ej. PRO180214A99" className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-mono uppercase disabled:bg-slate-100" />
          </div>
          <div>
            <label htmlFor="rule-clave" className="block font-semibold text-slate-700 mb-1">ClaveProdServ SAT</label>
            <input id="rule-clave" type="text" maxLength={10} disabled={isReadOnly} value={matchClaveProdServ} onChange={(e) => setMatchClaveProdServ(e.target.value.toUpperCase())} placeholder="Ej. 81112501" className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-mono disabled:bg-slate-100" />
          </div>
          <div>
            <label htmlFor="rule-uso" className="block font-semibold text-slate-700 mb-1">Uso CFDI</label>
            <input id="rule-uso" type="text" maxLength={5} disabled={isReadOnly} value={matchUsoCfdi} onChange={(e) => setMatchUsoCfdi(e.target.value.toUpperCase())} placeholder="Ej. G03" className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-mono uppercase disabled:bg-slate-100" />
          </div>
          <div>
            <label htmlFor="rule-account" className="block font-semibold text-slate-700 mb-1">Cuenta Operativa</label>
            {affectableAccounts.length > 0 ? (
              <select id="rule-account" disabled={isReadOnly} value={operationAccountCode} onChange={(e) => setOperationAccountCode(e.target.value)} className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-mono disabled:bg-slate-100">
                {affectableAccounts.map((acc) => (
                  <option key={acc.id} value={acc.code}>{acc.code} - {acc.name}</option>
                ))}
              </select>
            ) : (
              <input id="rule-account" type="text" disabled={isReadOnly} value={operationAccountCode} onChange={(e) => setOperationAccountCode(e.target.value)} className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-mono disabled:bg-slate-100" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="rule-deductible" className="block font-semibold text-slate-700 mb-1">% Ded.</label>
              <input id="rule-deductible" type="number" min={0} max={100} value={deductiblePct} disabled={isReadOnly || direction === 'EMITIDO'} onChange={(e) => setDeductiblePct(Number(e.target.value))} className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-mono disabled:bg-slate-100" />
            </div>
            <div>
              <label htmlFor="rule-priority" className="block font-semibold text-slate-700 mb-1">Prioridad</label>
              <input id="rule-priority" type="number" disabled={isReadOnly} value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-mono disabled:bg-slate-100" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-600">
            Precedencia: <strong>RFC</strong> &gt; <strong>ClaveProdServ</strong> &gt; <strong>Uso CFDI</strong>. Deducibilidad &lt; 100% envía diferencia + IVA a cuenta 801.
          </span>
          <button type="submit" disabled={isReadOnly || !hasCriteria || !operationAccountCode || createMutation.isPending} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            {createMutation.isPending ? 'Guardando...' : 'Agregar Regla'}
          </button>
        </div>
      </form>

      <div className="divide-y divide-slate-200 max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="p-5 text-xs text-slate-500 text-center">Cargando reglas contables...</div>
        ) : rules.length === 0 ? (
          <div className="p-5 text-xs text-slate-500 text-center">No hay reglas registradas. Activa «Recordar regla contable» al contabilizar un CFDI o agrega una arriba.</div>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-slate-50">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900">{rule.name || rule.operationAccountCode}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{rule.direction}</span>
                  {rule.autoLearned && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <Sparkles className="w-3 h-3" aria-hidden="true" /> Aprendida
                    </span>
                  )}
                  {rule.deductiblePct < 100 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                      {rule.deductiblePct}% Deducible · {100 - rule.deductiblePct}% a 801
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600 font-mono">
                  {rule.matchRfc && <span>RFC:{rule.matchRfc}</span>}
                  {rule.matchClaveProdServ && <span>Prod:{rule.matchClaveProdServ}</span>}
                  {rule.matchUsoCfdi && <span>Uso:{rule.matchUsoCfdi}</span>}
                  <span className="text-blue-800 font-bold">→ Cta {rule.operationAccountCode}</span>
                  <span className="text-slate-500">Prio:{rule.priority}</span>
                </div>
              </div>
              <button type="button" aria-label={`Eliminar regla ${rule.name || rule.id}`} disabled={isReadOnly || deleteMutation.isPending} onClick={() => deleteMutation.mutate(rule.id)} className="p-2 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer">
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
