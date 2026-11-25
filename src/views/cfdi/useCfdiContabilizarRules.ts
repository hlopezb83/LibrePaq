import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { accountingRulesClient } from '../../lib/accounting-rules-client';
import { apiClient } from '../../lib/api-client';
import {
  buildAutoPolizaPlan,
  resolveMatchingAccountingRule
} from '../../shared/engine/auto-poliza.engine';
import {
  buildRelatedCfdiOverridesFromRows,
  type RelatedCfdiDbRowLike
} from '../../shared/engine/auto-poliza-related';
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

  const isRep = selectedCfdi?.tipoComprobante === 'P';
  const { data: companyCfdis = [] } = useQuery<CfdiDocument[]>({
    queryKey: ['cfdis', companyId],
    queryFn: () => apiClient.getCfdis(companyId),
    enabled: Boolean(companyId && isRep)
  });

  const relatedOverrides = useMemo(() => {
    if (!selectedCfdi || (selectedCfdi.tipoComprobante !== 'P' && selectedCfdi.tipoComprobante !== 'E')) {
      return {};
    }
    const relUuids = Array.from(
      new Set(
        [
          ...(selectedCfdi.relatedDocs?.map((d) => d.idDocumento) ?? []),
          ...(selectedCfdi.uuidRelacionado ? [selectedCfdi.uuidRelacionado] : [])
        ]
          .map((u) => u.trim().toUpperCase())
          .filter(Boolean)
      )
    );
    if (relUuids.length === 0 || companyCfdis.length === 0) return {};
    const uuidSet = new Set(relUuids);
    const relRows: RelatedCfdiDbRowLike[] = companyCfdis
      .filter((c) => uuidSet.has(c.uuid.trim().toUpperCase()))
      .map((c) => ({
        uuid: c.uuid,
        moneda: c.moneda,
        tipo_cambio: c.tipoCambio,
        metodo_pago: c.metodoPago,
        subtotal: c.subtotal,
        descuento: c.descuento,
        iva_trasladado: c.ivaTrasladado,
        isr_retenido: c.isrRetenido,
        iva_retenido: c.ivaRetenido,
        total: c.total,
        concepto_principal: c.conceptoPrincipal,
        clave_prod_serv: c.claveProdServ,
        emisor_nombre: c.emisorNombre,
        uso_cfdi: c.usoCfdi,
        deductible_pct:
          c.deductiblePct ?? resolveMatchingAccountingRule(c, rules)?.deductiblePct ?? null,
        xml_raw: c.xmlRaw
      }));
    return buildRelatedCfdiOverridesFromRows(relRows, selectedCfdi.tipoComprobante, relUuids.length);
  }, [selectedCfdi, companyCfdis, rules]);

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

    const key = `${selectedCfdi.id}:${matchedRule?.id ?? 'none'}:${relatedOverrides.deductiblePct ?? 'none'}`;
    if (appliedKeyRef.current === key) return;
    appliedKeyRef.current = key;

    if (isRep) {
      setDeductiblePct(relatedOverrides.deductiblePct ?? 100);
      return;
    }

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
      setDeductiblePct(selectedCfdi.deductiblePct ?? 100);
    }
  }, [
    selectedCfdi,
    isRep,
    matchedRule,
    relatedOverrides.deductiblePct,
    affectableAccounts,
    setOperationAccountCode,
    setCounterAccountCode
  ]);

  const effectivePreviewMovements = useMemo<PreviewMovementRow[]>(() => {
    if (!selectedCfdi || affectableAccounts.length === 0) {
      return fallbackPreviewMovements;
    }
    try {
      const plan = buildAutoPolizaPlan(selectedCfdi, affectableAccounts, {
        ...(isRep ? relatedOverrides : {}),
        operationAccountCode: operationAccountCode || undefined,
        counterAccountCode: counterAccountCode || undefined,
        rules,
        ...(isRep ? {} : { deductiblePct })
      });
      return plan.movements.map((m) => ({
        code: m.accountCode,
        name: m.accountName,
        concepto: m.concepto,
        cargo: m.cargo,
        abono: m.abono
      }));
    } catch {
      return [];
    }
  }, [
    selectedCfdi,
    isRep,
    relatedOverrides,
    affectableAccounts,
    operationAccountCode,
    counterAccountCode,
    rules,
    deductiblePct,
    fallbackPreviewMovements
  ]);

  const saveLearnedRuleIfEnabled = async () => {
    if (!rememberRule || !selectedCfdi || selectedCfdi.tipoComprobante === 'P' || !companyId || !operationAccountCode) return;
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
        !matchedRule.matchClaveProdServ &&
        !matchedRule.matchUsoCfdi &&
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
