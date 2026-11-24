import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { getDefaultDateForPeriod } from '../../lib/formatters';
import type { Poliza, PolizaType } from '../../shared/types';
import { exportPolizasCsv } from './exportPolizasCsv';
import {
  buildPlanDraftsFromCfdi,
  collectPolizaUniqueUuids,
  computePolizasTotals,
  filterPolizas,
  formatPolizaCopyText,
  isPolizaDateInDifferentPeriod,
  parsePolizasUrlSearch
} from './filterPolizas';
import { createPolizaSnapshot, type PolizaEditorSnapshot } from './polizaDirtyCheck';
import { useDraftPolizaMovements } from './useDraftPolizaMovements';
import { usePolizasDataQueries } from './usePolizasDataQueries';
import { usePolizasKeyboardShortcuts } from './usePolizasKeyboardShortcuts';
import { usePolizasMutations } from './usePolizasMutations';
import { usePolizasSearchFilters } from './usePolizasSearchFilters';

export function usePolizasManager() {
  const { activeCompany, activeCompanyId, isReadOnlySupportMode, isReadOnlyClient: rawReadOnlyClient } = useCompany();
  const isReadOnlyClient = Boolean(isReadOnlySupportMode || rawReadOnlyClient);
  const routerState = useRouterState();
  const toast = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;
  const defaultPeriodDate = getDefaultDateForPeriod(currentYear, currentPeriod);

  const { urlSearchParam, isNewRequested } = useMemo(
    () => parsePolizasUrlSearch(routerState.location.search),
    [routerState.location.search]
  );

  const searchFilters = usePolizasSearchFilters(urlSearchParam, currentPeriod);
  const {
    filterTipo, originFilter, searchQuery,
    periodScope, periodFrom, periodTo, parsedMin, parsedMax
  } = searchFilters;
  const [formError, setFormError] = useState<string | null>(null);
  const [compactMode, setCompactMode] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [ledgerAccountId, setLedgerAccountId] = useState<string | null>(null);
  const [copiedPolizaId, setCopiedPolizaId] = useState<string | null>(null);
  const [isPedimentoModalOpen, setIsPedimentoModalOpen] = useState(false);

  useEffect(() => {
    setEditingPolizaId(null);
    setTipo('DIARIO');
    setFecha(defaultPeriodDate);
    setConcepto('');
    setCfdiUuids([]);
    setFormError(null);
    setConfirmDeleteId(null);
    setLedgerAccountId(null);
    setCopiedPolizaId(null);
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [activeCompanyId, defaultPeriodDate]);

  // Form State
  const [editingPolizaId, setEditingPolizaId] = useState<string | null>(null);
  const [editorSessionId, setEditorSessionId] = useState(0);
  const [initialSnapshot, setInitialSnapshot] = useState<PolizaEditorSnapshot | null>(null);
  const [tipo, setTipo] = useState<PolizaType>('DIARIO');
  const [fecha, setFecha] = useState<string>(defaultPeriodDate);
  const [concepto, setConcepto] = useState('');
  const [cfdiUuids, setCfdiUuids] = useState<string[]>([]);
  const cfdiUuid = cfdiUuids[0] || '';

  const queries = usePolizasDataQueries(
    activeCompanyId,
    currentYear,
    currentPeriod,
    periodScope,
    periodFrom,
    periodTo
  );
  const {
    polizas, accounts, cfdis, isLoadingAccounts, isLoadingPeriodLock,
    isPeriodLocked, isPeriod13Locked, affectableAccounts
  } = queries;
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;

  const predictedNextFolio = useMemo(() => {
    const existingSameType = polizas.filter((p) => p.tipo === tipo);
    const maxFolio = existingSameType.reduce((max, p) => Math.max(max, p.folio), 0);
    return maxFolio + 1;
  }, [polizas, tipo]);

  const draft = useDraftPolizaMovements(
    accounts,
    predictedNextFolio,
    setTipo,
    setConcepto
  );
  const { movements, setMovements, resetDraftMovements } = draft;

  useEffect(() => {
    resetDraftMovements();
  }, [activeCompanyId]);

  const {
    savePolizaMutation,
    deletePolizaMutation,
    closeYearMutation,
    createPedimentoMutation,
    reversePolizaMutation
  } = usePolizasMutations({
    activeCompanyId,
    currentYear,
    currentPeriod,
    isPeriodLocked,
    isPeriod13Locked,
    isReadOnlyClient,
    editingPolizaId,
    tipo,
    fecha,
    concepto,
    cfdiUuid,
    cfdiUuids,
    movements,
    accounts,
    dialogRef,
    onPedimentoSuccess: () => setIsPedimentoModalOpen(false),
    setFormError,
    setConfirmDeleteId
  });

  const filteredPolizas = useMemo(
    () =>
      filterPolizas(polizas, filterTipo, originFilter, searchQuery, {
        minAmount: parsedMin,
        maxAmount: parsedMax
      }),
    [polizas, filterTipo, originFilter, searchQuery, parsedMin, parsedMax]
  );

  const filteredPolizasTotals = useMemo(
    () => computePolizasTotals(filteredPolizas),
    [filteredPolizas]
  );

  const openNewPolizaModal = useCallback(() => {
    if (isWriteBlocked) return;
    setEditingPolizaId(null);
    setTipo('DIARIO');
    setFecha(defaultPeriodDate);
    setConcepto('');
    setCfdiUuids([]);
    setFormError(null);
    const defaultAcc1 = affectableAccounts[0]?.id || '';
    const defaultAcc2 = affectableAccounts[1]?.id || defaultAcc1;
    const initialMovements = [
      { _rowId: crypto.randomUUID(), accountId: defaultAcc1, referencia: 'REF-01', concepto: '', cargo: 0, abono: 0 },
      { _rowId: crypto.randomUUID(), accountId: defaultAcc2, referencia: 'REF-01', concepto: '', cargo: 0, abono: 0 }
    ];
    setMovements(initialMovements);
    setInitialSnapshot(
      createPolizaSnapshot({
        tipo: 'DIARIO',
        fecha: defaultPeriodDate,
        concepto: '',
        cfdiUuids: [],
        movements: initialMovements
      })
    );
    setEditorSessionId((prev) => prev + 1);
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    requestAnimationFrame(() => document.getElementById('pol-concepto')?.focus());
  }, [isWriteBlocked, defaultPeriodDate, affectableAccounts, setMovements]);

  const openEditPolizaModal = useCallback((pol: Poliza) => {
    if (isWriteBlocked) return;
    setEditingPolizaId(pol.id);
    setTipo(pol.tipo);
    setFecha(pol.fecha);
    setConcepto(pol.concepto);
    const uniqueUuids = collectPolizaUniqueUuids(pol);
    setCfdiUuids(uniqueUuids);
    setFormError(null);
    const editMovements = pol.movements.map((m) => ({
      _rowId: m.id || crypto.randomUUID(),
      accountId: m.accountId,
      referencia: m.referencia,
      concepto: m.concepto,
      cargo: m.cargo,
      abono: m.abono,
      cfdiUuid: m.cfdiUuid ?? null
    }));
    setMovements(editMovements);
    setInitialSnapshot(
      createPolizaSnapshot({
        tipo: pol.tipo,
        fecha: pol.fecha,
        concepto: pol.concepto,
        cfdiUuids: uniqueUuids,
        movements: editMovements
      })
    );
    setEditorSessionId((prev) => prev + 1);
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    requestAnimationFrame(() => document.getElementById('pol-concepto')?.focus());
  }, [isWriteBlocked, setMovements]);

  const openDuplicatePolizaModal = (pol: Poliza) => {
    if (isWriteBlocked) return;
    setEditingPolizaId(null);
    setTipo(pol.tipo);
    setFecha(defaultPeriodDate);
    const copyConcepto = `${pol.concepto} (Copia)`;
    setConcepto(copyConcepto);
    setCfdiUuids([]);
    setFormError(null);
    const dupMovements = pol.movements.map((m) => ({
      _rowId: crypto.randomUUID(),
      accountId: m.accountId,
      referencia: m.referencia,
      concepto: m.concepto,
      cargo: m.cargo,
      abono: m.abono
    }));
    setMovements(dupMovements);
    setInitialSnapshot(
      createPolizaSnapshot({
        tipo: pol.tipo,
        fecha: defaultPeriodDate,
        concepto: copyConcepto,
        cfdiUuids: [],
        movements: dupMovements
      })
    );
    setEditorSessionId((prev) => prev + 1);
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    requestAnimationFrame(() => document.getElementById('pol-concepto')?.focus());
    toast.info('Póliza Duplicada', 'Revisa los importes y fecha antes de guardar.');
  };

  const handleCopyPoliza = (pol: Poliza) => {
    navigator.clipboard
      ?.writeText(formatPolizaCopyText(pol))
      .then(() => {
        setCopiedPolizaId(pol.id);
        toast.success('Asiento copiado al portapapeles');
        setTimeout(() => setCopiedPolizaId((prev) => (prev === pol.id ? null : prev)), 2500);
      })
      .catch(() => {
        toast.error('No se pudo copiar al portapapeles');
      });
  };

  const handleAddCfdiUuid = (rawUuid: string) => {
    const clean = rawUuid.trim().toUpperCase();
    if (!clean) return;
    setCfdiUuids((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
  };

  const handleRemoveCfdiUuid = (rawUuid: string) => {
    const clean = rawUuid.trim().toUpperCase();
    setCfdiUuids((prev) => prev.filter((u) => u !== clean));
    setMovements((prev) =>
      prev.map((mv) =>
        mv.cfdiUuid?.trim().toUpperCase() === clean ? { ...mv, cfdiUuid: null } : mv
      )
    );
  };

  const handleSelectCfdiForForm = (uuid: string) => {
    const clean = uuid.trim().toUpperCase();
    if (!clean) { setCfdiUuids([]); return; }
    setCfdiUuids((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    const target = cfdis.find((c) => c.uuid.toUpperCase() === clean);
    if (!target) return;
    try {
      const built = buildPlanDraftsFromCfdi(target, accounts);
      setTipo(built.tipo);
      setFecha(built.fecha);
      setConcepto(built.concepto);
      setMovements(built.movements);
      setFormError(null);
      toast.info('Asiento Pre-Llenado desde CFDI', 'Cuentas e IVA sugeridos por el ADD.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No fue posible pre-llenar el asiento desde el CFDI.';
      setFormError(msg);
      toast.error('No se pudo pre-llenar CFDI', msg);
    }
  };

  const handleExportPolizasCsv = () => {
    if (filteredPolizas.length === 0) {
      toast.info('Sin pólizas visibles para exportar', 'Ajusta los filtros o captura una póliza primero.');
      return;
    }
    exportPolizasCsv(
      filteredPolizas,
      activeCompany?.rfc || activeCompanyId,
      currentYear,
      currentPeriod
    );
    toast.success('Pólizas exportadas en CSV');
  };

  const isDateDifferentPeriod = useMemo(
    () => isPolizaDateInDifferentPeriod(fecha, currentYear, currentPeriod),
    [fecha, currentYear, currentPeriod]
  );

  const handleUseActivePeriodDate = useCallback(() => {
    setFecha(defaultPeriodDate);
  }, [defaultPeriodDate]);

  usePolizasKeyboardShortcuts({
    dialogRef,
    isNewRequested,
    isLoadingAccounts,
    isLoadingPeriodLock,
    isWriteBlocked,
    accountsCount: accounts.length,
    openNewPolizaModal
  });

  return {
    activeCompany, activeCompanyId, currentYear, currentPeriod,
    ...queries, isReadOnlyClient, isWriteBlocked, dialogRef,
    filteredPolizas, filteredPolizasTotals,
    ...searchFilters, compactMode, setCompactMode,
    expandedIds, setExpandedIds, confirmDeleteId, setConfirmDeleteId,
    ledgerAccountId, setLedgerAccountId, copiedPolizaId, editingPolizaId,
    editorSessionId, initialSnapshot, handleUseActivePeriodDate,
    tipo, setTipo, fecha, setFecha, concepto, setConcepto,
    cfdiUuid, cfdiUuids, formError, setFormError,
    predictedNextFolio, isDateDifferentPeriod, savePolizaMutation, deletePolizaMutation,
    closeYearMutation, createPedimentoMutation, reversePolizaMutation,
    isPedimentoModalOpen, setIsPedimentoModalOpen,
    openNewPolizaModal, openEditPolizaModal, openDuplicatePolizaModal,
    handleCopyPoliza, handleSelectCfdiForForm, handleAddCfdiUuid, handleRemoveCfdiUuid,
    handleExportPolizasCsv,
    ...draft
  };
}
