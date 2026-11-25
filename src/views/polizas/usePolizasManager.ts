import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { getDefaultDateForPeriod } from '../../lib/formatters';
import type { Poliza, PolizaTemplate, PolizaType } from '../../shared/types';
import { exportPolizasCsv } from './exportPolizasCsv';
import {
  buildPlanDraftsFromCfdi, collectPolizaUniqueUuids, computePolizasTotals,
  filterPolizas, formatPolizaCopyText, isPolizaDateInDifferentPeriod, parsePolizasUrlSearch
} from './filterPolizas';
import {
  buildInitialPolizaMovements, createPolizaSnapshot,
  mapPolizaMovementsToDraft, type PolizaEditorSnapshot
} from './polizaDirtyCheck';
import { useDraftPolizaMovements } from './useDraftPolizaMovements';
import { usePolizasDataQueries } from './usePolizasDataQueries';
import { usePolizasKeyboardShortcuts } from './usePolizasKeyboardShortcuts';
import { usePolizasMutations } from './usePolizasMutations';
import { usePolizasSearchFilters } from './usePolizasSearchFilters';

export function usePolizasManager() {
  const { activeCompany, activeCompanyId, isReadOnlySupportMode, isReadOnlyClient: rawReadOnlyClient, effectiveCompanyRole } = useCompany();
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
  const [confirmReverseId, setConfirmReverseId] = useState<string | null>(null);
  const [ledgerAccountId, setLedgerAccountId] = useState<string | null>(null);
  const [copiedPolizaId, setCopiedPolizaId] = useState<string | null>(null);
  const [isPedimentoModalOpen, setIsPedimentoModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAsambleaModalOpen, setIsAsambleaModalOpen] = useState(false);

  const clearAllFiltersRef = useRef(searchFilters.clearAllFilters);
  clearAllFiltersRef.current = searchFilters.clearAllFilters;

  useEffect(() => {
    clearAllFiltersRef.current();
  }, [activeCompanyId]);

  useEffect(() => {
    setEditingPolizaId(null);
    setEditingPolizaPeriodo(null);
    setTipo('DIARIO');
    setFecha(defaultPeriodDate);
    setConcepto('');
    setCfdiUuids([]);
    setFormError(null);
    setConfirmDeleteId(null);
    setConfirmReverseId(null);
    setLedgerAccountId(null);
    setCopiedPolizaId(null);
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [activeCompanyId, defaultPeriodDate]);

  // Form State
  const [editingPolizaId, setEditingPolizaId] = useState<string | null>(null);
  const [editingPolizaPeriodo, setEditingPolizaPeriodo] = useState<number | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleDialogClose = () => {
      setEditingPolizaId(null);
      setEditingPolizaPeriodo(null);
    };
    dialog.addEventListener('close', handleDialogClose);
    return () => dialog.removeEventListener('close', handleDialogClose);
  }, []);
  const [editorSessionId, setEditorSessionId] = useState(0);
  const [initialSnapshot, setInitialSnapshot] = useState<PolizaEditorSnapshot | null>(null);
  const [tipo, setTipo] = useState<PolizaType>('DIARIO');
  const [fecha, setFecha] = useState<string>(defaultPeriodDate);
  const [concepto, setConcepto] = useState('');
  const [cfdiUuids, setCfdiUuids] = useState<string[]>([]);
  const cfdiUuid = cfdiUuids[0] || '';

  const queries = usePolizasDataQueries(
    activeCompanyId, currentYear, currentPeriod, periodScope, periodFrom, periodTo
  );
  const {
    polizas, accounts, cfdis, isLoadingAccounts, isLoadingPeriodLock,
    isPeriodLocked, isPeriod13Locked, affectableAccounts
  } = queries;
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;

  const predictedNextFolio = useMemo(() => {
    const existingSameType = polizas.filter(
      (p) => p.tipo === tipo && (!currentPeriod || p.periodo === currentPeriod)
    );
    return existingSameType.reduce((max, p) => Math.max(max, p.folio), 0) + 1;
  }, [polizas, tipo, currentPeriod]);

  const draft = useDraftPolizaMovements(accounts, predictedNextFolio, setTipo, setConcepto);
  const { movements, setMovements, resetDraftMovements } = draft;

  useEffect(() => {
    resetDraftMovements();
  }, [activeCompanyId]);

  const {
    savePolizaMutation, deletePolizaMutation, closeYearMutation,
    createPedimentoMutation, reversePolizaMutation, savePolizaTemplateMutation
  } = usePolizasMutations({
    activeCompanyId, currentYear, currentPeriod, isPeriodLocked, isPeriod13Locked,
    isReadOnlyClient, editingPolizaId, editingPolizaPeriodo, tipo, fecha, concepto,
    cfdiUuid, cfdiUuids, movements, accounts, dialogRef,
    onSaveSuccess: () => { setEditingPolizaId(null); setEditingPolizaPeriodo(null); },
    onPedimentoSuccess: () => setIsPedimentoModalOpen(false),
    setFormError, setConfirmDeleteId, setConfirmReverseId
  });

  const filteredPolizas = useMemo(
    () => filterPolizas(polizas, filterTipo, originFilter, searchQuery, { minAmount: parsedMin, maxAmount: parsedMax }),
    [polizas, filterTipo, originFilter, searchQuery, parsedMin, parsedMax]
  );

  const filteredPolizasTotals = useMemo(() => computePolizasTotals(filteredPolizas), [filteredPolizas]);

  const openEditorWithDraft = useCallback(
    (params: {
      editId: string | null;
      editPeriodo?: number | null;
      nextTipo: PolizaType;
      nextFecha: string;
      nextConcepto: string;
      nextUuids: string[];
      nextMovements: ReturnType<typeof buildInitialPolizaMovements>;
    }) => {
      setEditingPolizaId(params.editId);
      setEditingPolizaPeriodo(params.editPeriodo ?? null);
      setTipo(params.nextTipo);
      setFecha(params.nextFecha);
      setConcepto(params.nextConcepto);
      setCfdiUuids(params.nextUuids);
      setFormError(null);
      setMovements(params.nextMovements);
      setInitialSnapshot(
        createPolizaSnapshot({
          tipo: params.nextTipo,
          fecha: params.nextFecha,
          concepto: params.nextConcepto,
          cfdiUuids: params.nextUuids,
          movements: params.nextMovements
        })
      );
      setEditorSessionId((prev) => prev + 1);
      if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
      requestAnimationFrame(() => document.getElementById('pol-concepto')?.focus());
    },
    [setMovements]
  );

  const openNewPolizaModal = useCallback(() => {
    if (isWriteBlocked) return;
    openEditorWithDraft({
      editId: null,
      editPeriodo: null,
      nextTipo: 'DIARIO',
      nextFecha: defaultPeriodDate,
      nextConcepto: '',
      nextUuids: [],
      nextMovements: buildInitialPolizaMovements(affectableAccounts)
    });
  }, [isWriteBlocked, openEditorWithDraft, defaultPeriodDate, affectableAccounts]);

  const openEditPolizaModal = useCallback((pol: Poliza) => {
    if (isWriteBlocked) return;
    openEditorWithDraft({
      editId: pol.id,
      editPeriodo: pol.periodo,
      nextTipo: pol.tipo,
      nextFecha: pol.fecha,
      nextConcepto: pol.concepto,
      nextUuids: collectPolizaUniqueUuids(pol),
      nextMovements: mapPolizaMovementsToDraft(pol, true)
    });
  }, [isWriteBlocked, openEditorWithDraft]);

  const openDuplicatePolizaModal = (pol: Poliza) => {
    if (isWriteBlocked) return;
    openEditorWithDraft({
      editId: null,
      editPeriodo: null,
      nextTipo: pol.tipo,
      nextFecha: defaultPeriodDate,
      nextConcepto: `${pol.concepto} (Copia)`,
      nextUuids: [],
      nextMovements: mapPolizaMovementsToDraft(pol, false)
    });
    toast.info('Póliza Duplicada', 'Revisa los importes y fecha antes de guardar.');
  };

  const openNewPolizaWithTemplate = useCallback((tpl: PolizaTemplate) => {
    if (isWriteBlocked) return;
    openNewPolizaModal();
    draft.applySavedTemplate(tpl);
  }, [isWriteBlocked, openNewPolizaModal, draft]);

  const handleSaveAsTemplate = useCallback(async (name: string) => {
    await savePolizaTemplateMutation.mutateAsync(name);
  }, [savePolizaTemplateMutation]);

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
    ...queries, isReadOnlyClient, effectiveCompanyRole, isWriteBlocked, dialogRef,
    filteredPolizas, filteredPolizasTotals,
    ...searchFilters, compactMode, setCompactMode,
    expandedIds, setExpandedIds, confirmDeleteId, setConfirmDeleteId,
    confirmReverseId, setConfirmReverseId,
    ledgerAccountId, setLedgerAccountId, copiedPolizaId, editingPolizaId,
    editorSessionId, initialSnapshot, handleUseActivePeriodDate,
    tipo, setTipo, fecha, setFecha, concepto, setConcepto,
    cfdiUuid, cfdiUuids, formError, setFormError,
    predictedNextFolio, isDateDifferentPeriod, savePolizaMutation, deletePolizaMutation,
    closeYearMutation, createPedimentoMutation, reversePolizaMutation,
    isPedimentoModalOpen, setIsPedimentoModalOpen,
    isTemplatesModalOpen, setIsTemplatesModalOpen,
    isImportModalOpen, setIsImportModalOpen,
    isAsambleaModalOpen, setIsAsambleaModalOpen,
    openNewPolizaModal, openEditPolizaModal, openDuplicatePolizaModal, openNewPolizaWithTemplate,
    handleSaveAsTemplate, isSavingTemplate: savePolizaTemplateMutation.isPending,
    handleCopyPoliza, handleSelectCfdiForForm, handleAddCfdiUuid, handleRemoveCfdiUuid,
    handleExportPolizasCsv,
    ...draft
  };
}
