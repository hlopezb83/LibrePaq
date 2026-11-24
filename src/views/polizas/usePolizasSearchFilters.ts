import { useEffect, useState } from 'react';
import type { PolizaType } from '../../shared/types';
import type { PolizaPeriodScope } from './filterPolizas';

export function usePolizasSearchFilters(urlSearchParam: string, currentPeriod?: number) {
  const [filterTipo, setFilterTipo] = useState<'ALL' | PolizaType>('ALL');
  const [originFilter, setOriginFilter] = useState<'ALL' | 'WITH_CFDI' | 'MANUAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState(() => urlSearchParam);
  const [periodScope, setPeriodScope] = useState<PolizaPeriodScope>('CURRENT');
  const [periodFrom, setPeriodFrom] = useState<number>(1);
  const [periodTo, setPeriodTo] = useState<number>(currentPeriod ?? 12);
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  useEffect(() => {
    if (urlSearchParam) {
      setSearchQuery(urlSearchParam);
    }
  }, [urlSearchParam]);

  useEffect(() => {
    if (currentPeriod && periodScope !== 'RANGE') {
      setPeriodTo(currentPeriod);
    }
  }, [currentPeriod, periodScope]);

  const parsedMin = minAmount.trim() !== '' ? Number(minAmount) : null;
  const parsedMax = maxAmount.trim() !== '' ? Number(maxAmount) : null;
  const hasAdvancedFilters =
    filterTipo !== 'ALL' ||
    originFilter !== 'ALL' ||
    searchQuery.trim() !== '' ||
    periodScope !== 'CURRENT' ||
    minAmount.trim() !== '' ||
    maxAmount.trim() !== '';

  const clearAllFilters = () => {
    setFilterTipo('ALL');
    setOriginFilter('ALL');
    setSearchQuery('');
    setPeriodScope('CURRENT');
    setPeriodFrom(1);
    setPeriodTo(currentPeriod ?? 12);
    setMinAmount('');
    setMaxAmount('');
  };

  return {
    filterTipo,
    setFilterTipo,
    originFilter,
    setOriginFilter,
    searchQuery,
    setSearchQuery,
    periodScope,
    setPeriodScope,
    periodFrom,
    setPeriodFrom,
    periodTo,
    setPeriodTo,
    minAmount,
    setMinAmount,
    maxAmount,
    setMaxAmount,
    parsedMin: parsedMin !== null && Number.isFinite(parsedMin) ? parsedMin : null,
    parsedMax: parsedMax !== null && Number.isFinite(parsedMax) ? parsedMax : null,
    hasAdvancedFilters,
    clearAllFilters
  };
}
