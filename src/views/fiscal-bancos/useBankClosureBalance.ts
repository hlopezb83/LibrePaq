import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { isGuestDemoMode } from '../../lib/sandbox/guest-demo-mode';
import { useToast } from '../../context/ToastContext';
import type { BankReconciliationResponse } from '../../shared/types';

export interface ExtendedBankClosureClient {
  saveBankClosureBalance?: (
    companyId: string,
    accountId: string,
    ejercicio: number,
    periodo: number,
    saldoBancoCierre: number
  ) => Promise<void>;
  deleteBankClosureBalance?: (
    companyId: string,
    accountId: string,
    ejercicio: number,
    periodo: number
  ) => Promise<void>;
}

export function useBankClosureBalance(params: {
  companyId: string;
  effectiveBankId: string;
  year?: number;
  period?: number;
  isWriteLocked: boolean;
  reconData: BankReconciliationResponse | null | undefined;
}) {
  const { companyId, effectiveBankId, year, period, isWriteLocked, reconData } = params;
  const queryClient = useQueryClient();
  const toast = useToast();

  const [bankBalanceDraft, setBankBalanceDraft] = useState<string>('');
  const [closureSaveStatus, setClosureSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const balanceStorageKey = `lp_bank_final_bal_${companyId}_${effectiveBankId}_${year ?? 0}_${period ?? 0}`;
  const contextKey = `${companyId}::${effectiveBankId}::${year ?? ''}::${period ?? ''}`;
  const contextKeyRef = useRef(contextKey);
  contextKeyRef.current = contextKey;
  const saveClosureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saveClosureTimerRef.current) {
      clearTimeout(saveClosureTimerRef.current);
      saveClosureTimerRef.current = null;
    }
    setClosureSaveStatus('idle');
  }, [companyId, effectiveBankId, year, period]);

  useEffect(() => {
    const isMatchingContext =
      !reconData ||
      (reconData.account.id === effectiveBankId &&
        (!year || reconData.ejercicio === year) &&
        (!period || reconData.periodo === period));
    const cloudVal = isMatchingContext ? reconData?.summary?.saldoBancoCierre : undefined;
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
  }, [balanceStorageKey, effectiveBankId, period, reconData, year]);

  useEffect(() => () => {
    if (saveClosureTimerRef.current) clearTimeout(saveClosureTimerRef.current);
  }, []);

  const updateClosureQueryCache = (
    targetCompanyId: string,
    targetBankId: string,
    targetYear: number | undefined,
    targetPeriod: number | undefined,
    nextVal: number | null
  ) => {
    queryClient.setQueryData<BankReconciliationResponse>(
      ['bank-reconciliation', targetCompanyId, targetBankId, targetYear, targetPeriod],
      (old) =>
        old
          ? {
              ...old,
              summary: { ...old.summary, saldoBancoCierre: nextVal }
            }
          : old
    );
  };

  const handleBankBalanceChange = (raw: string) => {
    if (saveClosureTimerRef.current) {
      clearTimeout(saveClosureTimerRef.current);
      saveClosureTimerRef.current = null;
    }
    setBankBalanceDraft(raw);
    const targetCompanyId = companyId;
    const targetBankId = effectiveBankId;
    const targetYear = year;
    const targetPeriod = period;
    const reqContext = contextKeyRef.current;

    try {
      if (typeof window !== 'undefined') {
        if (raw.trim() === '') window.localStorage.removeItem(balanceStorageKey);
        else if (Number.isFinite(Number.parseFloat(raw))) window.localStorage.setItem(balanceStorageKey, raw);
      }
    } catch {
      // ignore storage errors
    }

    const extClient = apiClient as unknown as ExtendedBankClosureClient;
    const numVal = Number.parseFloat(raw);
    if (raw.trim() === '') {
      updateClosureQueryCache(targetCompanyId, targetBankId, targetYear, targetPeriod, null);
      if (isWriteLocked || !targetCompanyId || !targetBankId || !targetYear || !targetPeriod) {
        setClosureSaveStatus('idle');
        return;
      }
      const canClearCloud =
        typeof extClient.deleteBankClosureBalance === 'function' ||
        (isSupabaseConfigured && Boolean(supabase) && !isGuestDemoMode());
      if (!canClearCloud) {
        setClosureSaveStatus('idle');
        return;
      }
      setClosureSaveStatus('saving');
      saveClosureTimerRef.current = setTimeout(() => {
        const clearPromise =
          typeof extClient.deleteBankClosureBalance === 'function'
            ? extClient.deleteBankClosureBalance(targetCompanyId, targetBankId, targetYear, targetPeriod)
            : Promise.resolve(
                supabase!
                  .from('bank_reconciliation_closures')
                  .delete()
                  .eq('company_id', targetCompanyId)
                  .eq('account_id', targetBankId)
                  .eq('ejercicio', targetYear)
                  .eq('periodo', targetPeriod)
              ).then(({ error }) => {
                if (error) throw new Error(error.message);
              });
        void clearPromise
          .then(() => {
            updateClosureQueryCache(targetCompanyId, targetBankId, targetYear, targetPeriod, null);
            void queryClient.invalidateQueries({ queryKey: ['bank-reconciliation', targetCompanyId] });
            if (contextKeyRef.current === reqContext) setClosureSaveStatus('idle');
          })
          .catch(() => {
            if (contextKeyRef.current === reqContext) {
              setClosureSaveStatus('error');
              toast.error('No se pudo limpiar el saldo final del estado de cuenta en la nube.');
            }
          });
      }, 450);
      return;
    }

    if (!Number.isFinite(numVal)) {
      setClosureSaveStatus('idle');
      return;
    }

    updateClosureQueryCache(targetCompanyId, targetBankId, targetYear, targetPeriod, numVal);
    const saveFn = extClient.saveBankClosureBalance;
    if (
      isSupabaseConfigured &&
      !isWriteLocked &&
      typeof saveFn === 'function' &&
      targetCompanyId &&
      targetBankId &&
      targetYear &&
      targetPeriod
    ) {
      setClosureSaveStatus('saving');
      saveClosureTimerRef.current = setTimeout(() => {
        void saveFn(targetCompanyId, targetBankId, targetYear, targetPeriod, numVal)
          .then(() => {
            updateClosureQueryCache(targetCompanyId, targetBankId, targetYear, targetPeriod, numVal);
            void queryClient.invalidateQueries({ queryKey: ['bank-reconciliation', targetCompanyId] });
            if (contextKeyRef.current === reqContext) setClosureSaveStatus('saved');
          })
          .catch(() => {
            if (contextKeyRef.current === reqContext) {
              setClosureSaveStatus('error');
              toast.error('No se pudo guardar el saldo final del estado de cuenta en la nube.');
            }
          });
      }, 450);
    }
  };

  const parsedBankBalance = Number.parseFloat(bankBalanceDraft);
  const hasCapturedBankBalance = bankBalanceDraft.trim() !== '' && Number.isFinite(parsedBankBalance);
  const bankStatementBalance = hasCapturedBankBalance ? parsedBankBalance : 0;

  return {
    bankBalanceDraft,
    bankStatementBalance,
    hasCapturedBankBalance,
    closureSaveStatus,
    handleBankBalanceChange
  };
}
