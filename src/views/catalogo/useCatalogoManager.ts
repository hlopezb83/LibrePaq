import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { SAFETY_BOUNDS } from '../../shared/sat-constants';
import type { AccountType, AccountWithBalance } from '../../shared/types';
import { exportCatalogoCsv, importCatalogoCsvFile } from './catalogoCsvIo';
import { suggestNextCodeForParent } from './catalogoHierarchy';
import { useCatalogoFilters } from './useCatalogoFilters';

export function useCatalogoManager() {
  const { activeCompany, activeCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const toast = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const csvImportRef = useRef<HTMLInputElement>(null);

  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;

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

  useEffect(() => {
    setFormError(null);
    setConfirmDeleteId(null);
    setLedgerAccountId(null);
    setEditingAccountId(null);
    if (dialogRef.current?.open) dialogRef.current.close();
  }, [activeCompanyId]);

  const { data: accounts = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['accounts', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getAccounts(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId)
  });

  const { data: periodLock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });
  const isPeriodLocked = Boolean(periodLock?.isLocked);

  const filters = useCatalogoFilters(accounts);

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
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
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
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
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
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
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
        isAffectable: level >= 3,
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

  const handleExportCsv = () => {
    exportCatalogoCsv(
      filters.filteredAccounts,
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
    isError,
    error,
    refetch,
    parentAccounts,
    ...filters,
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
