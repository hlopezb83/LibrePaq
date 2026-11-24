import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, BookMarked, Eye, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
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
  const [counterAccountCode, setCounterAccountCode] = useState('');
  const [deductiblePct, setDeductiblePct] = useState(100);
  const [priority, setPriority] = useState(20);
  const [confirmDeleteRuleId, setConfirmDeleteRuleId] = useState<string | null>(null);

  const { data: rules = [], isLoading, isError, error, refetch } = useQuery<AccountingRuleRecord[]>({
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
  const validCounterAccounts = affectableAccounts.filter((acc) =>
    direction === 'EMITIDO'
      ? /^(101|102|105)/.test(acc.code)
      : /^(101|102|201|205)/.test(acc.code)
  );

  const handleDirectionChange = (nextDir: AccountingRuleDirection) => {
    setDirection(nextDir);
    if (nextDir === 'EMITIDO') {
      const preferred =
        affectableAccounts.find((a) => a.code === '401-01-001')?.code ??
        affectableAccounts.find((a) => a.code.startsWith('401-'))?.code ??
        '401-01-001';
      setOperationAccountCode(preferred);
    } else if (operationAccountCode.startsWith('4')) {
      const preferred =
        affectableAccounts.find((a) => a.code === '601-01-003')?.code ??
        affectableAccounts.find((a) => a.code.startsWith('601-'))?.code ??
        '601-01-003';
      setOperationAccountCode(preferred);
    }
    setCounterAccountCode('');
  };

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
        counterAccountCode: counterAccountCode.trim() || null,
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
      setCounterAccountCode('');
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
      setConfirmDeleteRuleId(null);
      void queryClient.invalidateQueries({ queryKey: ['accounting-rules', companyId] });
      toast.info('Regla contable eliminada.');
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const hasCriteria = Boolean(matchRfc.trim() || matchClaveProdServ.trim() || matchUsoCfdi.trim());
  const addDisabled = isReadOnly || !hasCriteria || !operationAccountCode || createMutation.isPending;
  const addDisabledReason = isReadOnly
    ? 'Modo solo lectura: no puedes agregar reglas contables'
    : !hasCriteria
    ? 'Ingresa al menos un criterio (RFC, ClaveProdServ o Uso CFDI)'
    : !operationAccountCode
    ? 'Selecciona una cuenta operativa'
    : 'Guardar regla contable';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!addDisabled) createMutation.mutate();
  };

  const inputCls =
    'w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed';

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <BookMarked className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Reglas Contables por RFC / ClaveProdServ y No Deducibles (801)</h3>
            <p className="text-xs text-slate-600">Asigna cuentas automáticas y % de deducibilidad (Art. 28 LISR) al contabilizar CFDI.</p>
          </div>
        </div>
        <span className="text-[11px] font-mono font-bold text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
          {rules.length} {rules.length === 1 ? 'regla activa' : 'reglas activas'}
        </span>
      </div>

      {isReadOnly && (
        <div role="status" className="mx-5 mt-4 px-3.5 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 text-xs flex items-center gap-2">
          <Eye className="w-4 h-4 text-sky-700 shrink-0" aria-hidden="true" />
          <span>Modo solo lectura: puedes consultar las reglas configuradas, pero no crear ni eliminar reglas.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-5 border-b border-slate-200 bg-slate-50/40 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-3 text-xs">
          <div>
            <label htmlFor="rule-direction" className="block font-semibold text-slate-700 mb-1">Dirección</label>
            <select id="rule-direction" disabled={isReadOnly} value={direction} onChange={(e) => handleDirectionChange(e.target.value as AccountingRuleDirection)} className={`${inputCls} font-medium cursor-pointer`}>
              <option value="RECIBIDO">RECIBIDO (Gasto)</option>
              <option value="EMITIDO">EMITIDO (Ingreso)</option>
            </select>
          </div>
          <div>
            <label htmlFor="rule-rfc" className="block font-semibold text-slate-700 mb-1">RFC (Prioridad alta)</label>
            <input id="rule-rfc" type="text" maxLength={13} disabled={isReadOnly} value={matchRfc} onChange={(e) => setMatchRfc(e.target.value.toUpperCase())} placeholder="Ej. PRO180214A99" className={`${inputCls} font-mono uppercase`} />
          </div>
          <div>
            <label htmlFor="rule-clave" className="block font-semibold text-slate-700 mb-1">ClaveProdServ SAT</label>
            <input id="rule-clave" type="text" maxLength={10} disabled={isReadOnly} value={matchClaveProdServ} onChange={(e) => setMatchClaveProdServ(e.target.value.toUpperCase())} placeholder="Ej. 81112501" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label htmlFor="rule-uso" className="block font-semibold text-slate-700 mb-1">Uso CFDI</label>
            <input id="rule-uso" type="text" maxLength={5} disabled={isReadOnly} value={matchUsoCfdi} onChange={(e) => setMatchUsoCfdi(e.target.value.toUpperCase())} placeholder="Ej. G03" className={`${inputCls} font-mono uppercase`} />
          </div>
          <div>
            <label htmlFor="rule-account" className="block font-semibold text-slate-700 mb-1">Cuenta Operativa</label>
            {affectableAccounts.length > 0 ? (
              <select id="rule-account" disabled={isReadOnly} value={operationAccountCode} onChange={(e) => setOperationAccountCode(e.target.value)} className={`${inputCls} font-mono cursor-pointer`}>
                {affectableAccounts.map((acc) => (
                  <option key={acc.id} value={acc.code}>{acc.code} - {acc.name}</option>
                ))}
              </select>
            ) : (
              <input id="rule-account" type="text" disabled={isReadOnly} value={operationAccountCode} onChange={(e) => setOperationAccountCode(e.target.value)} className={`${inputCls} font-mono`} />
            )}
          </div>
          <div>
            <label htmlFor="rule-counter-account" className="block font-semibold text-slate-700 mb-1">Contrapartida (Opc.)</label>
            {validCounterAccounts.length > 0 ? (
              <select id="rule-counter-account" disabled={isReadOnly} value={counterAccountCode} onChange={(e) => setCounterAccountCode(e.target.value)} className={`${inputCls} font-mono cursor-pointer`}>
                <option value="">Automática (PUE/PPD)</option>
                {validCounterAccounts.map((acc) => (
                  <option key={acc.id} value={acc.code}>{acc.code} - {acc.name}</option>
                ))}
              </select>
            ) : (
              <input id="rule-counter-account" type="text" disabled={isReadOnly} value={counterAccountCode} onChange={(e) => setCounterAccountCode(e.target.value)} placeholder="201-01-001" className={`${inputCls} font-mono`} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="rule-deductible" className="block font-semibold text-slate-700 mb-1">% Deducible</label>
              <input id="rule-deductible" type="number" min={0} max={100} value={deductiblePct} disabled={isReadOnly || direction === 'EMITIDO'} onChange={(e) => setDeductiblePct(Number(e.target.value))} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label htmlFor="rule-priority" title="Menor número = mayor prioridad (ej. 10 antes que 20)" className="block font-semibold text-slate-700 mb-1">Prioridad (1=↑)</label>
              <input id="rule-priority" type="number" title="Menor número = mayor prioridad (ej. 10 antes que 20)" disabled={isReadOnly} value={priority} onChange={(e) => setPriority(Number(e.target.value))} className={`${inputCls} font-mono`} />
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <span className="text-[11px] text-slate-600">
            Precedencia: <strong>RFC</strong> &gt; <strong>ClaveProdServ</strong> &gt; <strong>Uso CFDI</strong>. Prioridad: <strong>menor número = mayor prioridad</strong> (ej. 10 antes que 20). Deducibilidad &lt; 100% envía diferencia + IVA a cuenta 801.
          </span>
          <button
            type="submit"
            disabled={addDisabled}
            title={addDisabledReason}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            {createMutation.isPending ? 'Guardando...' : 'Agregar Regla'}
          </button>
        </div>
      </form>

      <div className="divide-y divide-slate-200 max-h-80 overflow-y-auto">
        {isError ? (
          <div role="alert" className="p-4 m-4 rounded-xl border border-red-200 bg-red-50/70 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-red-900">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
              <span>{error instanceof Error ? error.message : 'Error al cargar las reglas contables.'}</span>
            </div>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        ) : isLoading ? (
          <div role="status" aria-live="polite" aria-busy="true" className="p-5 text-xs text-slate-600 text-center">
            Cargando reglas contables...
          </div>
        ) : rules.length === 0 ? (
          <div className="p-5 text-xs text-slate-600 text-center">
            No hay reglas registradas. Activa «Recordar regla contable» al contabilizar un CFDI o agrega una arriba.
          </div>
        ) : (
          rules.map((rule) => {
            const ruleLabel = rule.name || [rule.matchRfc, rule.matchClaveProdServ, rule.matchUsoCfdi].filter(Boolean).join(' / ') || rule.operationAccountCode;
            return (
              <div key={rule.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-slate-50">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{rule.name || rule.operationAccountCode}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{rule.direction}</span>
                    {rule.autoLearned && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Sparkles className="w-3 h-3" aria-hidden="true" /> Aprendida
                      </span>
                    )}
                    {rule.deductiblePct < 100 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                        {rule.deductiblePct}% Deducible · {100 - rule.deductiblePct}% a 801
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600 font-mono">
                    {rule.matchRfc && <span>RFC: {rule.matchRfc}</span>}
                    {rule.matchClaveProdServ && <span>ClaveProdServ: {rule.matchClaveProdServ}</span>}
                    {rule.matchUsoCfdi && <span>Uso CFDI: {rule.matchUsoCfdi}</span>}
                    <span className="text-blue-800 font-bold">→ Cuenta {rule.operationAccountCode}</span>
                    {rule.counterAccountCode && (
                      <span className="text-indigo-800 font-semibold">· Contrapartida {rule.counterAccountCode}</span>
                    )}
                    <span className="text-slate-600">Prioridad: {rule.priority}</span>
                  </div>
                </div>

                {confirmDeleteRuleId === rule.id ? (
                  <div
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setConfirmDeleteRuleId(null);
                      }
                    }}
                    className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1"
                  >
                    <button
                      type="button"
                      disabled={isReadOnly || deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(rule.id)}
                      className="px-2 py-0.5 rounded text-[11px] font-bold text-red-800 hover:bg-red-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirmar
                    </button>
                    <span className="text-red-300" aria-hidden="true">|</span>
                    <button
                      type="button"
                      autoFocus
                      onClick={() => setConfirmDeleteRuleId(null)}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 hover:bg-white cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label={`Eliminar regla contable ${ruleLabel}`}
                    title={isReadOnly ? 'Modo solo lectura: no puedes eliminar reglas contables' : `Eliminar regla ${ruleLabel}`}
                    disabled={isReadOnly || deleteMutation.isPending}
                    onClick={() => setConfirmDeleteRuleId(rule.id)}
                    className="p-2 rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
