import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { bankN1Client } from '../../lib/bank-n1-client';
import { isSupabaseConfigured } from '../../lib/supabase';

interface ExtendedBankApiClient {
  manualMatchBankLine?: (lineId: string, movementId: string) => Promise<unknown>;
  deleteBankStatementLine?: (lineId: string) => Promise<unknown>;
  saveBankClosureBalance?: (
    companyId: string,
    accountId: string,
    ejercicio: number,
    periodo: number,
    saldoBancoCierre: number
  ) => Promise<void>;
}
import { useToast } from '../../context/ToastContext';
import type { BankReconciliationResponse, BankStatementLine, ReconciliationFormulaData } from '../../shared/types';
import type { BankN1MatchProposal } from '../../shared/types/bank-n1.types';
import { exportBankReconciliationXlsx, printBankReconciliationPdf } from './BankReconciliationExport';

export function useConciliacionTabActions(params: {
  companyId: string;
  companyName: string;
  companyRfc: string;
  effectiveBankId: string;
  year?: number;
  period?: number;
  isWriteLocked: boolean;
  reconData: BankReconciliationResponse | null | undefined;
  reconFormula: ReconciliationFormulaData | null;
}) {
  const {
    companyId, companyName, companyRfc, effectiveBankId, year, period,
    isWriteLocked, reconData, reconFormula
  } = params;
  const queryClient = useQueryClient();
  const toast = useToast();

  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedBookMovId, setSelectedBookMovId] = useState<string | null>(null);
  const [polizaModalLine, setPolizaModalLine] = useState<BankStatementLine | null>(null);
  const [n1Proposals, setN1Proposals] = useState<BankN1MatchProposal[]>([]);
  const [isSearchingN1, setIsSearchingN1] = useState(false);
  const [isApplyingN1, setIsApplyingN1] = useState(false);
  const [bankBalanceDraft, setBankBalanceDraft] = useState<string>('');

  const balanceStorageKey = `lp_bank_final_bal_${companyId}_${effectiveBankId}_${year ?? 0}_${period ?? 0}`;
  const contextKey = `${companyId}::${effectiveBankId}::${year ?? ''}::${period ?? ''}`;
  const contextKeyRef = useRef(contextKey);
  contextKeyRef.current = contextKey;
  const proposeReqIdRef = useRef(0);
  const applyReqIdRef = useRef(0);

  useEffect(() => {
    proposeReqIdRef.current += 1;
    applyReqIdRef.current += 1;
    setN1Proposals([]);
    setSelectedLineId(null);
    setSelectedBookMovId(null);
    setPolizaModalLine(null);
    setIsSearchingN1(false);
    setIsApplyingN1(false);
  }, [companyId, effectiveBankId, year, period]);

  useEffect(() => {
    const cloudVal = reconData?.summary?.saldoBancoCierre;
    if (cloudVal !== undefined && cloudVal !== null && Number.isFinite(cloudVal)) {
      const strVal = String(cloudVal);
      setBankBalanceDraft(strVal);
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(balanceStorageKey, strVal);
      } catch {
        // ignore storage errors
      }
      return;
    }
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(balanceStorageKey) : null;
      if (saved !== null && saved.trim() !== '' && Number.isFinite(Number(saved))) {
        setBankBalanceDraft(saved);
        return;
      }
    } catch {
      // ignore storage errors
    }
    setBankBalanceDraft('');
  }, [balanceStorageKey, reconData?.summary?.saldoBancoCierre]);

  const parsedBankBalance = Number.parseFloat(bankBalanceDraft);
  const hasCapturedBankBalance = bankBalanceDraft.trim() !== '' && Number.isFinite(parsedBankBalance);
  const bankStatementBalance = hasCapturedBankBalance ? parsedBankBalance : 0;

  const saveClosureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (saveClosureTimerRef.current) clearTimeout(saveClosureTimerRef.current);
  }, []);

  const handleBankBalanceChange = (raw: string) => {
    setBankBalanceDraft(raw);
    try {
      if (typeof window !== 'undefined') {
        if (raw.trim() === '') window.localStorage.removeItem(balanceStorageKey);
        else if (Number.isFinite(Number.parseFloat(raw))) window.localStorage.setItem(balanceStorageKey, raw);
      }
    } catch {
      // ignore storage errors
    }
    const numVal = Number.parseFloat(raw);
    const saveFn = (apiClient as unknown as ExtendedBankApiClient).saveBankClosureBalance;
    if (
      isSupabaseConfigured &&
      !isWriteLocked &&
      typeof saveFn === 'function' &&
      companyId &&
      effectiveBankId &&
      year &&
      period &&
      Number.isFinite(numVal)
    ) {
      if (saveClosureTimerRef.current) clearTimeout(saveClosureTimerRef.current);
      saveClosureTimerRef.current = setTimeout(() => {
        void saveFn(companyId, effectiveBankId, year, period, numVal).catch(() => {});
      }, 450);
    }
  };

  const manualMatchMutation = useMutation({
    mutationFn: ({ lineId, movementId }: { lineId: string; movementId: string }) => {
      if (isWriteLocked) throw new Error('Periodo bloqueado o modo solo lectura.');
      const fn = (apiClient as unknown as ExtendedBankApiClient).manualMatchBankLine;
      if (!isSupabaseConfigured || typeof fn !== 'function') {
        throw new Error('El emparejamiento manual requiere conexión activa en la nube.');
      }
      return fn(lineId, movementId);
    },
    onSuccess: () => {
      setSelectedLineId(null);
      setSelectedBookMovId(null);
      invalidateAccountingQueries(queryClient, ['bank-reconciliation', 'dashboard'], companyId);
      toast.success('Partida bancaria y movimiento contable conciliados manualmente 1-a-1.');
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const deleteBankLineMutation = useMutation({
    mutationFn: (lineId: string) => {
      if (isWriteLocked) throw new Error('Periodo bloqueado o modo solo lectura.');
      const fn = (apiClient as unknown as ExtendedBankApiClient).deleteBankStatementLine;
      if (!isSupabaseConfigured || typeof fn !== 'function') {
        throw new Error('Eliminar líneas bancarias requiere conexión activa en la nube.');
      }
      return fn(lineId);
    },
    onSuccess: () => {
      setSelectedLineId(null);
      invalidateAccountingQueries(queryClient, ['bank-reconciliation', 'dashboard'], companyId);
      toast.info('Línea bancaria eliminada del estado de cuenta.');
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const customCreatePolizaMutation = useMutation({
    mutationFn: ({ lineId, options }: { lineId: string; options: { counterAccountCode: string; desglosarIva: boolean } }) => {
      if (isWriteLocked) throw new Error('Periodo bloqueado o modo solo lectura.');
      return apiClient.createPolizaFromBankLine(lineId, options);
    },
    onSuccess: () => {
      setPolizaModalLine(null);
      invalidateAccountingQueries(queryClient, ['bank-reconciliation', 'polizas', 'accounts', 'account-ledger', 'reports', 'dashboard'], companyId);
      toast.success('¡Póliza contable generada con la contracuenta elegida y partida conciliada!');
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const handleProposeN1 = async () => {
    if (!companyId || !effectiveBankId || isWriteLocked) return;
    const reqId = ++proposeReqIdRef.current;
    const reqContext = contextKeyRef.current;
    setIsSearchingN1(true);
    try {
      const res = await bankN1Client.proposeBankN1Matches(companyId, effectiveBankId, year, period);
      if (proposeReqIdRef.current !== reqId || contextKeyRef.current !== reqContext) return;
      if (res.proposals.length === 0) {
        setN1Proposals([]);
        toast.info('No se detectaron grupos de varias pólizas pendientes dentro de la tolerancia.');
      } else {
        setN1Proposals(res.proposals);
      }
    } catch (err: unknown) {
      if (proposeReqIdRef.current !== reqId || contextKeyRef.current !== reqContext) return;
      toast.error(err instanceof Error ? err.message : 'Error buscando coincidencias de varias pólizas.');
    } finally {
      if (proposeReqIdRef.current === reqId && contextKeyRef.current === reqContext) setIsSearchingN1(false);
    }
  };

  const handleApplyN1 = async () => {
    if (!companyId || !effectiveBankId || n1Proposals.length === 0 || isWriteLocked) return;
    const reqId = ++applyReqIdRef.current;
    const reqContext = contextKeyRef.current;
    setIsApplyingN1(true);
    try {
      const res = await bankN1Client.applyBankN1Matches(companyId, effectiveBankId, n1Proposals, year, period);
      invalidateAccountingQueries(queryClient, ['bank-reconciliation', 'dashboard'], companyId);
      if (applyReqIdRef.current !== reqId || contextKeyRef.current !== reqContext) return;
      setN1Proposals([]);
      toast.success(`Conciliación múltiple aplicada: ${res.appliedCount} partidas bancarias cruzadas.`);
    } catch (err: unknown) {
      if (applyReqIdRef.current !== reqId || contextKeyRef.current !== reqContext) return;
      toast.error(err instanceof Error ? err.message : 'Error aplicando conciliación múltiple.');
    } finally {
      if (applyReqIdRef.current === reqId && contextKeyRef.current === reqContext) setIsApplyingN1(false);
    }
  };

  const handleExportExcel = () => {
    if (!reconData || !reconFormula) return;
    void exportBankReconciliationXlsx({
      companyName, companyRfc, reconData, reconFormula, bankStatementFinalBalance: bankStatementBalance
    }).then(() => toast.success('Cédula de Conciliación Bancaria exportada en Excel (.xlsx).'));
  };

  const handlePrintPdf = () => {
    if (!reconData || !reconFormula) return;
    const ok = printBankReconciliationPdf({
      companyName, companyRfc, reconData, reconFormula, bankStatementFinalBalance: bankStatementBalance
    });
    if (!ok) toast.error('Permite las ventanas emergentes para imprimir o guardar el PDF.');
  };

  return {
    selectedLineId, setSelectedLineId, selectedBookMovId, setSelectedBookMovId,
    polizaModalLine, setPolizaModalLine, n1Proposals, setN1Proposals,
    isSearchingN1, isApplyingN1, bankStatementBalance, bankBalanceDraft, hasCapturedBankBalance, handleBankBalanceChange,
    manualMatchMutation, deleteBankLineMutation, customCreatePolizaMutation,
    handleProposeN1, handleApplyN1, handleExportExcel, handlePrintPdf
  };
}
