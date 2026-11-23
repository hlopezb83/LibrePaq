import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { accountingRulesClient } from '../../lib/accounting-rules-client';
import {
  buildAutoPolizaPlan,
  resolveMatchingAccountingRule
} from '../../shared/engine/auto-poliza.engine';
import type { Account, CfdiDocument } from '../../shared/types';
import type { AccountingRuleRecord } from '../../shared/types/accounting-rules.types';

export interface PreviewMovementRow {
  code: string;
  name: string;
  concepto: string;
  cargo: number;
  abono: number;
}

interface UseCfdiContabilizarRulesParams {
  selectedCfdi: CfdiDocument | null;
  affectableAccounts: Account[];
  operationAccountCode: string;
  setOperationAccountCode: (code: string) => void;
  counterAccountCode: string;
  setCounterAccountCode: (code: string) => void;
  fallbackPreviewMovements: PreviewMovementRow[];
}

export function useCfdiContabilizarRules({
  selectedCfdi,
  affectableAccounts,
  operationAccountCode,
  setOperationAccountCode,
  counterAccountCode,
  setCounterAccountCode,
  fallbackPreviewMovements
}: UseCfdiContabilizarRulesParams) {
  const { activeCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const toast = useToast();

  const companyId = selectedCfdi?.companyId || activeCompanyId;
  const [deductiblePct, setDeductiblePct] = useState<number>(100);
  const [rememberRule, setRememberRule] = useState<boolean>(false);
  const [isSavingRule, setIsSavingRule] = useState<boolean>(false);

  const { data: rules = [] } = useQuery<AccountingRuleRecord[]>({
    queryKey: ['accounting-rules', companyId],
    queryFn: () => accountingRulesClient.listAccountingRules(companyId),
    enabled: Boolean(companyId)
  });

  const matchedRule = useMemo(
    () => (selectedCfdi ? resolveMatchingAccountingRule(selectedCfdi, rules) : null),
    [selectedCfdi, rules]
  );

  useEffect(() => {
    setRememberRule(false);
  }, [selectedCfdi?.id]);

  const appliedKeyRef = useRef<string>('');
  useEffect(() => {
    if (!selectedCfdi) {
      appliedKeyRef.current = '';
      setDeductiblePct(100);
      return;
    }
    if (matchedRule && affectableAccounts.length === 0) return;

    const key = `${selectedCfdi.id}:${matchedRule?.id ?? 'none'}`;
    if (appliedKeyRef.current === key) return;
    appliedKeyRef.current = key;

    if (matchedRule) {
      if (affectableAccounts.some((a) => a.code === matchedRule.operationAccountCode)) {
        setOperationAccountCode(matchedRule.operationAccountCode);
      }
      if (
        matchedRule.counterAccountCode &&
        affectableAccounts.some((a) => a.code === matchedRule.counterAccountCode)
      ) {
        setCounterAccountCode(matchedRule.counterAccountCode);
      }
      setDeductiblePct(matchedRule.deductiblePct);
    } else {
      setDeductiblePct(100);
    }
  }, [
    selectedCfdi,
    matchedRule,
    affectableAccounts,
    setOperationAccountCode,
    setCounterAccountCode
  ]);

  const effectivePreviewMovements = useMemo<PreviewMovementRow[]>(() => {
    if (!selectedCfdi || affectableAccounts.length === 0) {
      return fallbackPreviewMovements;
    }
    const plan = buildAutoPolizaPlan(selectedCfdi, affectableAccounts, {
      operationAccountCode: operationAccountCode || undefined,
      counterAccountCode: counterAccountCode || undefined,
      rules,
      deductiblePct
    });
    return plan.movements.map((m) => ({
      code: m.accountCode,
      name: m.accountName,
      concepto: m.concepto,
      cargo: m.cargo,
      abono: m.abono
    }));
  }, [
    selectedCfdi,
    affectableAccounts,
    operationAccountCode,
    counterAccountCode,
    rules,
    deductiblePct,
    fallbackPreviewMovements
  ]);

  const saveLearnedRuleIfEnabled = async () => {
    if (!rememberRule || !selectedCfdi || !companyId || !operationAccountCode) return;
    const counterpartyRfc = (
      selectedCfdi.direction === 'EMITIDO' ? selectedCfdi.receptorRfc : selectedCfdi.emisorRfc
    )
      .trim()
      .toUpperCase();
    const counterpartyName = (
      selectedCfdi.direction === 'EMITIDO'
        ? selectedCfdi.receptorNombre
        : selectedCfdi.emisorNombre
    ).trim();
    if (!counterpartyRfc) return;

    setIsSavingRule(true);
    try {
      const existingRfcRuleId =
        matchedRule &&
        matchedRule.matchRfc === counterpartyRfc &&
        matchedRule.direction === selectedCfdi.direction
          ? matchedRule.id
          : undefined;
      await accountingRulesClient.upsertAccountingRule({
        id: existingRfcRuleId,
        companyId,
        name: `${counterpartyName || counterpartyRfc} (${deductiblePct}% ded.)`,
        matchRfc: counterpartyRfc,
        matchClaveProdServ: null,
        matchUsoCfdi: null,
        direction: selectedCfdi.direction,
        operationAccountCode,
        counterAccountCode: counterAccountCode || null,
        deductiblePct: selectedCfdi.direction === 'RECIBIDO' ? deductiblePct : 100,
        priority: matchedRule?.priority ?? 20,
        autoLearned: true
      });
      await queryClient.invalidateQueries({ queryKey: ['accounting-rules', companyId] });
      toast.success(`Regla contable recordada para ${counterpartyRfc}`);
    } catch (err: unknown) {
      toast.warning(
        `No se pudo guardar la regla contable: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsSavingRule(false);
    }
  };

  return {
    matchedRule,
    deductiblePct,
    setDeductiblePct,
    rememberRule,
    setRememberRule,
    isSavingRule,
    effectivePreviewMovements,
    saveLearnedRuleIfEnabled
  };
}
