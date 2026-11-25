import { useMemo, useState } from 'react';
import type { CfdiDocument } from '../../shared/types';
import {
  computeCfdiTotals,
  filterCfdis,
  getCfdiEffectivePeriodDate,
  isCfdiPendingForPoliza,
  type CfdiFormaPagoFilter,
  type CfdiMetodoFilter,
  type CfdiStatusSatFilter,
  type CfdiTabFilter,
  type CfdiTipoFilter
} from './filterCfdis';

/**
 * Estado y selectores memoizados para filtrado de comprobantes CFDI en la Bóveda ADD.
 */
export function useCfdiFilters(cfdis: CfdiDocument[], currentPeriodPrefix: string) {
  const [tab, setTab] = useState<CfdiTabFilter>('ALL');
  const [tipoFilter, setTipoFilter] = useState<CfdiTipoFilter>('ALL');
  const [metodoFilter, setMetodoFilter] = useState<CfdiMetodoFilter>('ALL');
  const [statusSatFilter, setStatusSatFilter] = useState<CfdiStatusSatFilter>('ALL');
  const [formaPagoFilter, setFormaPagoFilter] = useState<CfdiFormaPagoFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [periodScope, setPeriodScope] = useState<'CURRENT' | 'ALL'>('CURRENT');

  const currentYearPrefix = currentPeriodPrefix.slice(0, 4);

  const countInCurrentPeriod = useMemo(
    () => cfdis.filter((c) => getCfdiEffectivePeriodDate(c).startsWith(currentPeriodPrefix)).length,
    [cfdis, currentPeriodPrefix]
  );

  const countInCurrentYear = useMemo(
    () =>
      currentYearPrefix
        ? cfdis.filter((c) => getCfdiEffectivePeriodDate(c).startsWith(currentYearPrefix)).length
        : cfdis.length,
    [cfdis, currentYearPrefix]
  );

  const scopedCfdis = useMemo(() => {
    if (periodScope === 'CURRENT') {
      return cfdis.filter((c) => getCfdiEffectivePeriodDate(c).startsWith(currentPeriodPrefix));
    }
    return currentYearPrefix
      ? cfdis.filter((c) => getCfdiEffectivePeriodDate(c).startsWith(currentYearPrefix))
      : cfdis;
  }, [cfdis, periodScope, currentPeriodPrefix, currentYearPrefix]);

  const pendingCfdis = useMemo(
    () => scopedCfdis.filter(isCfdiPendingForPoliza),
    [scopedCfdis]
  );
  const emitidosCount = useMemo(
    () => scopedCfdis.filter((c) => c.direction === 'EMITIDO').length,
    [scopedCfdis]
  );
  const recibidosCount = useMemo(
    () => scopedCfdis.filter((c) => c.direction === 'RECIBIDO').length,
    [scopedCfdis]
  );

  const filteredCfdis = useMemo(
    () =>
      filterCfdis(
        cfdis,
        tab,
        tipoFilter,
        searchQuery,
        periodScope,
        currentPeriodPrefix,
        metodoFilter,
        statusSatFilter,
        formaPagoFilter
      ),
    [
      cfdis,
      tab,
      tipoFilter,
      searchQuery,
      periodScope,
      currentPeriodPrefix,
      metodoFilter,
      statusSatFilter,
      formaPagoFilter
    ]
  );

  const filteredTotals = useMemo(() => computeCfdiTotals(filteredCfdis), [filteredCfdis]);

  return {
    pendingCfdis,
    filters: {
      tab,
      setTab,
      tipoFilter,
      setTipoFilter,
      metodoFilter,
      setMetodoFilter,
      statusSatFilter,
      setStatusSatFilter,
      formaPagoFilter,
      setFormaPagoFilter,
      searchQuery,
      setSearchQuery,
      periodScope,
      setPeriodScope,
      countInCurrentPeriod,
      countInCurrentYear,
      scopedCfdis,
      emitidosCount,
      recibidosCount,
      filteredCfdis,
      filteredTotals
    }
  };
}
