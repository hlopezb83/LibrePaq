import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { checkRfcsAgainstCloud69B } from '../../lib/supabase/supabase-cxc-sat';
import type { CfdiDocument } from '../../shared/types';
import { computeNextCfdiSelection } from './cfdiXmlUploadHelpers';

export function useBeforeUnloadGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [active]);
}

export function useCloud69BSync(activeCompanyId: string, cfdis: readonly CfdiDocument[]) {
  const [, setCloud69BRev] = useState(0);
  const checked69BKeyRef = useRef('');

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !activeCompanyId || cfdis.length === 0) return;
    const rfcs = Array.from(
      new Set(cfdis.flatMap((c) => [c.emisorRfc, c.receptorRfc]).filter(Boolean))
    ).sort();
    const key = `${activeCompanyId}:${rfcs.join(',')}`;
    if (rfcs.length === 0 || checked69BKeyRef.current === key) return;
    checked69BKeyRef.current = key;
    void checkRfcsAgainstCloud69B(rfcs, activeCompanyId)
      .then((res) => {
        if (res.matches.length > 0) setCloud69BRev((v) => v + 1);
      })
      .catch(() => {
        // Silencioso en caso de sesión offline o sin permisos
      });
  }, [activeCompanyId, cfdis]);
}

/**
 * Gestiona la selección múltiple segura en la Bóveda ADD:
 * - Deriva `visibleSelectedIds` contra `filteredCfdis` para erradicar acciones fantasma sobre filas ocultas.
 * - Poda `selectedCfdiIds` cuando cambian filtros, pestaña o periodo.
 */
export function useCfdiSelection(filteredCfdis: readonly CfdiDocument[], activeCompanyId: string) {
  const [selectedCfdiIds, setSelectedCfdiIds] = useState<Set<string>>(new Set());
  const lastSelectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedCfdiIds(new Set());
    lastSelectedIdRef.current = null;
  }, [activeCompanyId]);

  const visibleIdSet = useMemo(
    () => new Set(filteredCfdis.map((c) => c.id)),
    [filteredCfdis]
  );

  useEffect(() => {
    setSelectedCfdiIds((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visibleIdSet.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [visibleIdSet]);

  const visibleSelectedIds = useMemo(() => {
    if (selectedCfdiIds.size === 0) return selectedCfdiIds;
    const next = new Set<string>();
    for (const id of selectedCfdiIds) {
      if (visibleIdSet.has(id)) next.add(id);
    }
    return next;
  }, [selectedCfdiIds, visibleIdSet]);

  const toggleSelectAll = useCallback(() => {
    const allVisibleSelected =
      filteredCfdis.length > 0 && filteredCfdis.every((c) => visibleSelectedIds.has(c.id));
    if (allVisibleSelected) {
      setSelectedCfdiIds(new Set());
    } else {
      setSelectedCfdiIds(new Set(filteredCfdis.map((c) => c.id)));
    }
  }, [filteredCfdis, visibleSelectedIds]);

  const toggleSelectOne = useCallback(
    (id: string, shiftKey = false) => {
      const lastId = lastSelectedIdRef.current;
      lastSelectedIdRef.current = id;
      setSelectedCfdiIds((prev) => computeNextCfdiSelection(prev, filteredCfdis, id, lastId, shiftKey));
    },
    [filteredCfdis]
  );

  return {
    selectedCfdiIds: visibleSelectedIds,
    setSelectedCfdiIds,
    toggleSelectAll,
    toggleSelectOne
  };
}
