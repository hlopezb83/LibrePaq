import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { SAFETY_BOUNDS } from '../../shared/sat-catalog';
import type { AccountType, AccountWithBalance } from '../../shared/types';
import { exportCatalogoCsv, importCatalogoCsvFile } from './catalogoCsvIo';
import { isAncestorCollapsed, suggestNextCodeForParent } from './catalogoHierarchy';
import type { QuickFilterType } from './CatalogoFilterBar';

export function useCatalogoManager() {
  const { activeCompany, activeCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const toast = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const csvImportRef = useRef<HTMLInputElement>(null);

  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;

  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('ALL');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'AFFECTABLE' | 'MAYOR'>('ALL');
  const [collapsedCodes, setCollapsedCodes] = useState<Record<string, boolean>>({});
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [ledgerAccountId, setLedgerAccountId] = useState<string | null>(null);

  // Form State
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [code, setCode] = useState('601-01-006');
  const [name, setName] = useState('');
  const [parentCode, setParentCode] = useState<string>('601-00-000');
  const [satGroupCode, setSatGroupCode] = useState('601.84');
  const [type, setType] = useState<AccountType>('GASTOS');
  const [nature, setNature] = useState<'DEUDORA' | 'ACREEDORA'>('DEUDORA');
  const [level, setLevel] = useState(3);
  const [initialBalance, setInitialBalance] = useState(0);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getAccounts(activeCompanyId, currentYear, currentPeriod)
  });

  const { data: periodLock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });
  const isPeriodLocked = Boolean(periodLock?.isLocked);

  const getNextCode = (pCode: string) => suggestNextCodeForParent(pCode, accounts);

  const openCreateModal = () => {
    setFormError(null);
    setEditingAccountId(null);
    const defaultParent = '601-00-000';
    setParentCode(defaultParent);
    setCode(getNextCode(defaultParent));
    setName('');
    setSatGroupCode('601.84');
    setType('GASTOS');
    setNature('DEUDORA');
    setLevel(3);
    setInitialBalance(0);
    dialogRef.current?.showModal();
  };

  const openEditModal = (acc: AccountWithBalance) => {
    setFormError(null);
    setEditingAccountId(acc.id);
    setCode(acc.code);
    setName(acc.name);
    setParentCode(acc.parentCode || '');
    setSatGroupCode(acc.satGroupCode);
    setType(acc.type);
    setNature(acc.nature);
    setLevel(acc.level);
    setInitialBalance(acc.initialBalance);
    dialogRef.current?.showModal();
  };

  const openCreateSubaccountModal = (parentAcc: AccountWithBalance) => {
    setFormError(null);
    setEditingAccountId(null);
    setParentCode(parentAcc.code);
    setCode(getNextCode(parentAcc.code));
    setName('');
    setSatGroupCode(parentAcc.satGroupCode || '601.84');
    setType(parentAcc.type);
    setNature(parentAcc.nature);
    setLevel(Math.min(SAFETY_BOUNDS.MAX_ACCOUNT_LEVEL, parentAcc.level + 1));
    setInitialBalance(0);
    dialogRef.current?.showModal();
  };

  const saveAccountMutation = useMutation({
    mutationFn: async () => {
      if (editingAccountId) {
        return apiClient.updateAccount(editingAccountId, {
          name,
          satGroupCode,
          type,
          nature,
          initialBalance
        });
      }
      return apiClient.createAccount({
        companyId: activeCompanyId,
        code,
        name,
        parentCode: parentCode || null,
        type,
        nature,
        level,
        isAffectable: level === 3,
        satGroupCode,
        initialBalance
      });
    },
    onSuccess: () => {
      invalidateAccountingQueries(queryClient, ['accounts', 'reports', 'dashboard']);
      dialogRef.current?.close();
      toast.success(
        editingAccountId
          ? `Cuenta contable ${code} actualizada correctamente`
          : `Cuenta contable ${code} creada exitosamente`
      );
    },
    onError: (err: Error) => {
      setFormError(err.message);
      toast.error('Error al guardar cuenta', err.message);
    }
  });

  const deleteAccountMutation = useMutation({
    mutationFn: apiClient.deleteAccount,
    onSuccess: () => {
      invalidateAccountingQueries(queryClient, ['accounts', 'reports', 'dashboard']);
      setConfirmDeleteId(null);
      toast.success('Cuenta contable eliminada correctamente');
    },
    onError: (err: Error) => {
      setConfirmDeleteId(null);
      toast.error('Error al eliminar cuenta', err.message);
    }
  });

  const byCodeMap = useMemo(() => new Map(accounts.map((a) => [a.code, a])), [accounts]);

  const quickFilterCounts = useMemo(() => {
    const base = selectedType === 'ALL' ? accounts : accounts.filter((a) => a.type === selectedType);
    return {
      ALL: base.length,
      AFFECTABLE: base.filter((a) => a.isAffectable).length,
      ACTIVE_BALANCE: base.filter((a) => a.finalBalance !== 0).length,
      WITH_MOVEMENTS: base.filter((a) => a.periodCharges > 0 || a.periodCredits > 0).length,
      RED_BALANCES: base.filter((a) => a.finalBalance < 0).length
    };
  }, [accounts, selectedType]);

  const filteredAccounts = useMemo(() => {
    const isSearching = Boolean(globalFilter.trim());
    return accounts.filter((acc) => {
      if (selectedType !== 'ALL' && acc.type !== selectedType) return false;

      if (quickFilter === 'AFFECTABLE' && !acc.isAffectable) return false;
      if (quickFilter === 'ACTIVE_BALANCE' && acc.finalBalance === 0) return false;
      if (quickFilter === 'WITH_MOVEMENTS' && acc.periodCharges === 0 && acc.periodCredits === 0) return false;
      if (quickFilter === 'RED_BALANCES' && acc.finalBalance >= 0) return false;

      if (levelFilter === 'AFFECTABLE' && !acc.isAffectable) return false;
      if (levelFilter === 'MAYOR' && acc.isAffectable) return false;

      if (!isSearching && quickFilter === 'ALL' && levelFilter === 'ALL' && isAncestorCollapsed(acc, collapsedCodes, byCodeMap)) {
        return false;
      }

      if (!isSearching) return true;
      const q = globalFilter.toLowerCase();
      return (
        acc.code.toLowerCase().includes(q) ||
        acc.name.toLowerCase().includes(q) ||
        acc.satGroupCode.toLowerCase().includes(q)
      );
    });
  }, [
    accounts,
    selectedType,
    quickFilter,
    levelFilter,
    globalFilter,
    collapsedCodes,
    byCodeMap
  ]);

  const selectedAccount = useMemo(() => {
    if (!selectedAccountId) return null;
    return accounts.find((a) => a.id === selectedAccountId) || null;
  }, [accounts, selectedAccountId]);

  const selectedIndex = useMemo(() => {
    if (!selectedAccountId) return -1;
    return filteredAccounts.findIndex((a) => a.id === selectedAccountId);
  }, [filteredAccounts, selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) return;
    const rowEl = document.getElementById(`acc-row-${selectedAccountId}`);
    if (rowEl) {
      rowEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedAccountId]);

  const toggleNodeCollapse = (accCode: string) => {
    setCollapsedCodes((prev) => ({
      ...prev,
      [accCode]: !prev[accCode]
    }));
  };

  const collapseToMayor = () => {
    const next: Record<string, boolean> = {};
    for (const acc of accounts) {
      if (acc.level === 2) next[acc.code] = true;
    }
    setCollapsedCodes(next);
  };

  const expandAllNodes = () => setCollapsedCodes({});

  const handleExportCsv = () => {
    exportCatalogoCsv(
      filteredAccounts,
      activeCompany?.rfc || activeCompanyId,
      currentYear,
      currentPeriod
    );
  };

  const handleImportAccountsCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importCatalogoCsvFile(file, activeCompanyId, queryClient, toast);
    } catch (err) {
      toast.error('Error al importar cuentas', (err as Error).message);
    } finally {
      e.target.value = '';
    }
  };

  const filteredSummaryTotals = useMemo(() => {
    return filteredAccounts.reduce(
      (acc, a) => {
        if (a.isAffectable) {
          acc.countAffectable += 1;
          acc.cargos += a.periodCharges;
          acc.abonos += a.periodCredits;
        }
        return acc;
      },
      { countAffectable: 0, cargos: 0, abonos: 0 }
    );
  }, [filteredAccounts]);

  const parentAccounts = accounts.filter((a) => !a.isAffectable);

  return {
    activeCompany,
    activeCompanyId,
    currentYear,
    currentPeriod,
    isPeriodLocked,
    dialogRef,
    csvImportRef,
    accounts,
    isLoading,
    parentAccounts,
    globalFilter,
    setGlobalFilter,
    selectedType,
    setSelectedType,
    quickFilter,
    setQuickFilter,
    quickFilterCounts,
    levelFilter,
    setLevelFilter,
    collapsedCodes,
    setCollapsedCodes,
    toggleNodeCollapse,
    collapseToMayor,
    expandAllNodes,
    selectedAccountId,
    setSelectedAccountId,
    selectedAccount,
    selectedIndex,
    filteredAccounts,
    filteredSummaryTotals,
    formError,
    confirmDeleteId,
    setConfirmDeleteId,
    ledgerAccountId,
    setLedgerAccountId,
    editingAccountId,
    code,
    setCode,
    name,
    setName,
    parentCode,
    setParentCode,
    satGroupCode,
    setSatGroupCode,
    type,
    setType,
    nature,
    setNature,
    level,
    setLevel,
    initialBalance,
    setInitialBalance,
    suggestNextCodeForParent: getNextCode,
    openCreateModal,
    openEditModal,
    openCreateSubaccountModal,
    saveAccountMutation,
    deleteAccountMutation,
    handleExportCsv,
    handleImportAccountsCsv
  };
}
