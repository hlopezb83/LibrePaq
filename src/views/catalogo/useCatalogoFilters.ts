import { useMemo, useState } from 'react';
import { normalizeSearchText } from '../../components/account-picker/accountPickerSearch';
import type { AccountWithBalance } from '../../shared/types';
import { isAncestorCollapsed } from './catalogoHierarchy';
import type { QuickFilterType } from './CatalogoFilterBar';

/**
 * Maneja filtros de búsqueda, tipo, nivel jerárquico, estado de colapso
 * del árbol de cuentas y contadores resumen para el Catálogo de Cuentas.
 */
export function useCatalogoFilters(accounts: AccountWithBalance[]) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('ALL');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'AFFECTABLE' | 'MAYOR'>('ALL');
  const [collapsedCodes, setCollapsedCodes] = useState<Record<string, boolean>>({});
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const byCodeMap = useMemo(() => new Map(accounts.map((a) => [a.code, a])), [accounts]);

  const quickFilterCounts = useMemo(() => {
    const base = selectedType === 'ALL' ? accounts : accounts.filter((a) => a.type === selectedType);
    return {
      ALL: base.length,
      AFFECTABLE: base.filter((a) => a.isAffectable).length,
      ACTIVE_BALANCE: base.filter((a) => a.finalBalance !== 0).length,
      WITH_MOVEMENTS: base.filter((a) => a.periodCharges > 0 || a.periodCredits > 0).length,
      RED_BALANCES: base.filter((a) => a.isAffectable && a.finalBalance < 0).length
    };
  }, [accounts, selectedType]);

  const filteredAccounts = useMemo(() => {
    const isSearching = Boolean(globalFilter.trim());
    const q = normalizeSearchText(globalFilter);
    return accounts.filter((acc) => {
      if (selectedType !== 'ALL' && acc.type !== selectedType) return false;

      if (quickFilter === 'AFFECTABLE' && !acc.isAffectable) return false;
      if (quickFilter === 'ACTIVE_BALANCE' && acc.finalBalance === 0) return false;
      if (quickFilter === 'WITH_MOVEMENTS' && acc.periodCharges === 0 && acc.periodCredits === 0) {
        return false;
      }
      if (quickFilter === 'RED_BALANCES' && (!acc.isAffectable || acc.finalBalance >= 0)) return false;

      if (levelFilter === 'AFFECTABLE' && !acc.isAffectable) return false;
      if (levelFilter === 'MAYOR' && acc.isAffectable) return false;

      if (
        !isSearching &&
        quickFilter === 'ALL' &&
        levelFilter === 'ALL' &&
        isAncestorCollapsed(acc, collapsedCodes, byCodeMap)
      ) {
        return false;
      }

      if (!isSearching) return true;
      return (
        normalizeSearchText(acc.code).includes(q) ||
        normalizeSearchText(acc.name).includes(q) ||
        normalizeSearchText(acc.satGroupCode).includes(q)
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

  return {
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
    filteredSummaryTotals
  };
}
