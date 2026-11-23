import { useMemo, useState } from 'react';
import type { CfdiDocument } from '../../shared/types';
import { computeCfdiTotals, filterCfdis, isCfdiPendingForPoliza } from './filterCfdis';

/**
 * Estado y selectores memoizados para filtrado de comprobantes CFDI en la Bóveda ADD.
 */
export function useCfdiFilters(cfdis: CfdiDocument[], currentPeriodPrefix: string) {
  const [tab, setTab] = useState<'ALL' | 'EMITIDO' | 'RECIBIDO' | 'PENDING'>('ALL');
  const [tipoFilter, setTipoFilter] = useState<'ALL' | 'I' | 'P' | 'N' | 'RET'>('ALL');
  const [metodoFilter, setMetodoFilter] = useState<'ALL' | 'PUE' | 'PPD'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [periodScope, setPeriodScope] = useState<'CURRENT' | 'ALL'>('CURRENT');

  const countInCurrentPeriod = useMemo(
    () => cfdis.filter((c) => c.fecha.startsWith(currentPeriodPrefix)).length,
    [cfdis, currentPeriodPrefix]
  );

  const scopedCfdis = useMemo(() => {
    if (periodScope === 'CURRENT') {
      return cfdis.filter((c) => c.fecha.startsWith(currentPeriodPrefix));
    }
    return cfdis;
  }, [cfdis, periodScope, currentPeriodPrefix]);

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
        metodoFilter
      ),
    [cfdis, tab, tipoFilter, searchQuery, periodScope, currentPeriodPrefix, metodoFilter]
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
      searchQuery,
      setSearchQuery,
      periodScope,
      setPeriodScope,
      countInCurrentPeriod,
      scopedCfdis,
      emitidosCount,
      recibidosCount,
      filteredCfdis,
      filteredTotals
    }
  };
}
