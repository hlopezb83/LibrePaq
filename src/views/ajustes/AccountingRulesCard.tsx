import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Plus, RefreshCw, X } from 'lucide-react';
import { AccountPickerCombobox } from '../../components/account-picker/AccountPickerCombobox';
import {
  AlertBanner,
  Button,
  EmptyState,
  FormField,
  Input,
  Select,
  StatusBadge
} from '../../components/ui';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { accountingRulesClient } from '../../lib/accounting-rules-client';
import { apiClient } from '../../lib/api-client';
import type { AccountingRuleDirection, AccountingRuleRecord } from '../../shared/types/accounting-rules.types';
import { AccountingRuleRow } from './AccountingRuleRow';

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

  const operationAccountId = affectableAccounts.find((a) => a.code === operationAccountCode)?.id ?? '';
  const counterAccountId = validCounterAccounts.find((a) => a.code === counterAccountCode)?.id ?? '';

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
            <BookMarked className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Reglas Contables por RFC / ClaveProdServ y No Deducibles (801)</h3>
            <p className="text-xs text-slate-600">Asigna cuentas automáticas y % de deducibilidad (Art. 28 LISR) al contabilizar CFDI.</p>
          </div>
        </div>
        <StatusBadge tone="blue" shape="tag" className="px-2.5 py-1 rounded-full text-[11px]">
          {rules.length} {rules.length === 1 ? 'regla activa' : 'reglas activas'}
        </StatusBadge>
      </div>

      <form onSubmit={handleSubmit} className="p-5 border-b border-slate-200 bg-slate-50/40 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <FormField htmlFor="rule-direction" label="Dirección">
            <Select id="rule-direction" disabled={isReadOnly} value={direction} onChange={(e) => handleDirectionChange(e.target.value as AccountingRuleDirection)} className="font-medium">
              <option value="RECIBIDO">RECIBIDO (Gasto)</option>
              <option value="EMITIDO">EMITIDO (Ingreso)</option>
            </Select>
          </FormField>
          <FormField htmlFor="rule-rfc" label="RFC (Prioridad alta)">
            <Input id="rule-rfc" type="text" maxLength={13} disabled={isReadOnly} value={matchRfc} onChange={(e) => setMatchRfc(e.target.value.toUpperCase())} placeholder="Ej. PRO180214A99" className="font-mono uppercase" />
          </FormField>
          <FormField htmlFor="rule-clave" label="ClaveProdServ SAT">
            <Input id="rule-clave" type="text" maxLength={10} disabled={isReadOnly} value={matchClaveProdServ} onChange={(e) => setMatchClaveProdServ(e.target.value.toUpperCase())} placeholder="Ej. 81112501" className="font-mono" />
          </FormField>
          <FormField htmlFor="rule-uso" label="Uso CFDI">
            <Input id="rule-uso" type="text" maxLength={5} disabled={isReadOnly} value={matchUsoCfdi} onChange={(e) => setMatchUsoCfdi(e.target.value.toUpperCase())} placeholder="Ej. G03" className="font-mono uppercase" />
          </FormField>
          <FormField htmlFor="rule-account" label="Cuenta Operativa">
            {!isReadOnly && affectableAccounts.length > 0 ? (
              <AccountPickerCombobox
                accounts={affectableAccounts}
                value={operationAccountId}
                onChange={(accountId) => {
                  const found = affectableAccounts.find((a) => a.id === accountId);
                  if (found) setOperationAccountCode(found.code);
                }}
                ariaLabel="Cuenta Operativa"
                placeholder="Buscar por código o nombre..."
              />
            ) : (
              <Input id="rule-account" type="text" disabled={isReadOnly} value={operationAccountCode} onChange={(e) => setOperationAccountCode(e.target.value)} className="font-mono" />
            )}
          </FormField>
          <FormField
            htmlFor="rule-counter-account"
            label={
              <span className="inline-flex items-center justify-between w-full gap-2">
                <span>Contrapartida (Opc.)</span>
                {counterAccountCode && !isReadOnly && (
                  <button type="button" onClick={() => setCounterAccountCode('')} className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-700 hover:underline cursor-pointer">
                    <X className="w-2.5 h-2.5" aria-hidden="true" />
                    Automática
                  </button>
                )}
              </span>
            }
          >
            {!isReadOnly && validCounterAccounts.length > 0 ? (
              <AccountPickerCombobox
                accounts={validCounterAccounts}
                value={counterAccountId}
                onChange={(accountId) => {
                  const found = validCounterAccounts.find((a) => a.id === accountId);
                  setCounterAccountCode(found?.code ?? '');
                }}
                ariaLabel="Contrapartida opcional"
                placeholder="Automática (PUE/PPD)..."
              />
            ) : (
              <Input id="rule-counter-account" type="text" disabled={isReadOnly} value={counterAccountCode} onChange={(e) => setCounterAccountCode(e.target.value)} placeholder="Automática (PUE/PPD)" className="font-mono" />
            )}
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField htmlFor="rule-deductible" label="% Deducible">
              <Input id="rule-deductible" type="number" min={0} max={100} value={deductiblePct} disabled={isReadOnly || direction === 'EMITIDO'} onChange={(e) => setDeductiblePct(Number(e.target.value))} className="font-mono tabular-nums" />
            </FormField>
            <FormField htmlFor="rule-priority" label="Prioridad (1=↑)">
              <Input id="rule-priority" type="number" title="Menor número = mayor prioridad (ej. 10 antes que 20)" disabled={isReadOnly} value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="font-mono tabular-nums" />
            </FormField>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <span className="text-[11px] text-slate-600">
            Precedencia: <strong>RFC</strong> &gt; <strong>ClaveProdServ</strong> &gt; <strong>Uso CFDI</strong>. Prioridad: <strong>menor número = mayor prioridad</strong> (ej. 10 antes que 20). Deducibilidad &lt; 100% envía diferencia + IVA a cuenta 801.
          </span>
          <Button
            type="submit"
            variant="primary"
            disabled={addDisabled}
            loading={createMutation.isPending}
            title={addDisabledReason}
            leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
            className="self-start sm:self-auto"
          >
            {createMutation.isPending ? 'Guardando...' : 'Agregar Regla'}
          </Button>
        </div>
      </form>

      <div className="divide-y divide-slate-200 max-h-80 overflow-y-auto">
        {isError ? (
          <div className="p-4">
            <AlertBanner
              tone="danger"
              action={
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
                  onClick={() => void refetch()}
                >
                  Reintentar
                </Button>
              }
            >
              {error instanceof Error ? error.message : 'Error al cargar las reglas contables.'}
            </AlertBanner>
          </div>
        ) : isLoading ? (
          <div role="status" aria-live="polite" aria-busy="true" className="p-5 text-xs text-slate-600 text-center">
            Cargando reglas contables...
          </div>
        ) : rules.length === 0 ? (
          <EmptyState
            icon={<BookMarked className="w-5 h-5" aria-hidden="true" />}
            tone="slate"
            title="Sin reglas contables registradas"
            description="Activa «Recordar regla contable» al contabilizar un CFDI o agrega una arriba."
          />
        ) : (
          rules.map((rule) => (
            <AccountingRuleRow
              key={rule.id}
              rule={rule}
              isReadOnly={isReadOnly}
              isConfirmingDelete={confirmDeleteRuleId === rule.id}
              isDeleting={deleteMutation.isPending}
              onRequestDelete={setConfirmDeleteRuleId}
              onCancelDelete={() => setConfirmDeleteRuleId(null)}
              onConfirmDelete={(id) => deleteMutation.mutate(id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
