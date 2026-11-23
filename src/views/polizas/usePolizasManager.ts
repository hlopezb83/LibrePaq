import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import { getDefaultDateForPeriod } from '../../lib/formatters';
import { buildAutoPolizaPlan } from '../../shared/accounting-engine';
import type { Poliza, PolizaType } from '../../shared/types';
import { exportPolizasCsv } from './exportPolizasCsv';
import { computePolizasTotals, filterPolizas } from './filterPolizas';
import { useDraftPolizaMovements } from './useDraftPolizaMovements';
import { usePolizasMutations } from './usePolizasMutations';

export function usePolizasManager() {
  const { activeCompany, activeCompanyId } = useCompany();
  const routerState = useRouterState();
  const toast = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;
  const defaultPeriodDate = getDefaultDateForPeriod(currentYear, currentPeriod);

  const { urlSearchParam, isNewRequested } = useMemo(() => {
    try {
      const sp = new URLSearchParams((routerState.location.search || {}) as Record<string, string>);
      return {
        urlSearchParam: sp.get('search') || sp.get('folio') || '',
        isNewRequested: sp.get('nueva') === 'true' || sp.get('action') === 'new'
      };
    } catch {
      return { urlSearchParam: '', isNewRequested: false };
    }
  }, [routerState.location.search]);

  const [filterTipo, setFilterTipo] = useState<'ALL' | PolizaType>('ALL');
  const [originFilter, setOriginFilter] = useState<'ALL' | 'WITH_CFDI' | 'MANUAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState(() => urlSearchParam);
  const [formError, setFormError] = useState<string | null>(null);
  const [compactMode, setCompactMode] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [ledgerAccountId, setLedgerAccountId] = useState<string | null>(null);
  const [copiedPolizaId, setCopiedPolizaId] = useState<string | null>(null);
  const [isPedimentoModalOpen, setIsPedimentoModalOpen] = useState(false);

  useEffect(() => {
    if (urlSearchParam) {
      setSearchQuery(urlSearchParam);
    }
  }, [urlSearchParam]);

  useEffect(() => {
    setEditingPolizaId(null);
    setTipo('DIARIO');
    setFecha(defaultPeriodDate);
    setConcepto('');
    setCfdiUuid('');
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
  const [tipo, setTipo] = useState<PolizaType>('DIARIO');
  const [fecha, setFecha] = useState<string>(defaultPeriodDate);
  const [concepto, setConcepto] = useState('');
  const [cfdiUuid, setCfdiUuid] = useState('');

  // Queries
  const { data: polizas = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['polizas', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPolizas(activeCompanyId, currentYear ?? 2026, currentPeriod ?? 10),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getAccounts(activeCompanyId, currentYear ?? 2026, currentPeriod ?? 10),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });

  const { data: cfdis = [] } = useQuery({
    queryKey: ['cfdis', activeCompanyId],
    queryFn: () => apiClient.getCfdis(activeCompanyId),
    enabled: Boolean(activeCompanyId)
  });

  const { data: periodLock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, currentPeriod],
    queryFn: () =>
      apiClient.getPeriodLock(
        activeCompanyId,
        currentYear ?? 2026,
        currentPeriod ?? 10
      ),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });
  const isPeriodLocked = Boolean(periodLock?.isLocked);

  const affectableAccounts = useMemo(
    () => accounts.filter((a) => a.isAffectable),
    [accounts]
  );

  const pendingCfdis = useMemo(
    () => cfdis.filter((c) => !c.polizaId),
    [cfdis]
  );

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
    createPedimentoMutation
  } = usePolizasMutations({
    activeCompanyId,
    currentYear,
    currentPeriod,
    isPeriodLocked,
    editingPolizaId,
    tipo,
    fecha,
    concepto,
    cfdiUuid,
    movements,
    accounts,
    dialogRef,
    onPedimentoSuccess: () => setIsPedimentoModalOpen(false),
    setFormError,
    setConfirmDeleteId
  });

  const filteredPolizas = useMemo(
    () => filterPolizas(polizas, filterTipo, originFilter, searchQuery),
    [polizas, filterTipo, originFilter, searchQuery]
  );

  const filteredPolizasTotals = useMemo(
    () => computePolizasTotals(filteredPolizas),
    [filteredPolizas]
  );

  const openNewPolizaModal = useCallback(() => {
    setEditingPolizaId(null);
    setTipo('DIARIO');
    setFecha(defaultPeriodDate);
    setConcepto('');
    setCfdiUuid('');
    setFormError(null);
    const defaultAcc1 = affectableAccounts[0]?.id || '';
    const defaultAcc2 = affectableAccounts[1]?.id || defaultAcc1;
    setMovements([
      { _rowId: crypto.randomUUID(), accountId: defaultAcc1, referencia: 'REF-01', concepto: '', cargo: 0, abono: 0 },
      { _rowId: crypto.randomUUID(), accountId: defaultAcc2, referencia: 'REF-01', concepto: '', cargo: 0, abono: 0 }
    ]);
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    requestAnimationFrame(() => document.getElementById('pol-concepto')?.focus());
  }, [defaultPeriodDate, affectableAccounts]);

  const openEditPolizaModal = useCallback((pol: Poliza) => {
    setEditingPolizaId(pol.id);
    setTipo(pol.tipo);
    setFecha(pol.fecha);
    setConcepto(pol.concepto);
    setCfdiUuid(pol.cfdiUuid || '');
    setFormError(null);
    setMovements(
      pol.movements.map((m) => ({
        _rowId: m.id || crypto.randomUUID(),
        accountId: m.accountId,
        referencia: m.referencia,
        concepto: m.concepto,
        cargo: m.cargo,
        abono: m.abono
      }))
    );
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    requestAnimationFrame(() => document.getElementById('pol-concepto')?.focus());
  }, []);

  const openDuplicatePolizaModal = (pol: Poliza) => {
    setEditingPolizaId(null);
    setTipo(pol.tipo);
    setFecha(defaultPeriodDate);
    setConcepto(`${pol.concepto} (Copia)`);
    setCfdiUuid('');
    setFormError(null);
    setMovements(
      pol.movements.map((m) => ({
        _rowId: crypto.randomUUID(),
        accountId: m.accountId,
        referencia: m.referencia,
        concepto: m.concepto,
        cargo: m.cargo,
        abono: m.abono
      }))
    );
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    toast.info('Póliza Duplicada', 'Revisa los importes y fecha antes de guardar.');
  };

  const handleCopyPoliza = (pol: Poliza) => {
    const lines = [
      `PÓLIZA ${pol.tipo} #${pol.folio} | Fecha: ${pol.fecha}`,
      `Concepto: ${pol.concepto}`,
      ...pol.movements.map(
        (m) => `  ${m.accountCode} ${m.accountName} | Debe: ${m.cargo.toFixed(2)} | Haber: ${m.abono.toFixed(2)}`
      ),
      `Sumas Iguales: Debe ${pol.totalCargos.toFixed(2)} | Haber ${pol.totalAbonos.toFixed(2)}`
    ].join('\n');
    navigator.clipboard
      ?.writeText(lines)
      .then(() => {
        setCopiedPolizaId(pol.id);
        toast.success('Asiento copiado al portapapeles');
        setTimeout(() => setCopiedPolizaId((prev) => (prev === pol.id ? null : prev)), 2500);
      })
      .catch(() => {
        toast.error('No se pudo copiar al portapapeles');
      });
  };

  const handleSelectCfdiForForm = (uuid: string) => {
    setCfdiUuid(uuid);
    if (!uuid) return;
    const target = cfdis.find((c) => c.uuid === uuid);
    if (!target) return;
    const plan = buildAutoPolizaPlan(target, accounts);
    setTipo(plan.polizaType);
    setFecha(target.fecha);
    setConcepto(plan.polizaConcept);
    setMovements(
      plan.movements.map((m) => ({
        _rowId: crypto.randomUUID(),
        accountId: m.accountId,
        referencia: m.referencia,
        concepto: m.concepto,
        cargo: m.cargo,
        abono: m.abono
      }))
    );
    toast.info('Asiento Pre-Llenado desde CFDI', 'Cuentas e IVA sugeridos por el ADD.');
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

  const isDateDifferentPeriod = useMemo(() => {
    if (!fecha || !currentYear || !currentPeriod) return false;
    const parts = fecha.split('-');
    if (parts.length < 2) return false;
    const y = Number(parts[0]);
    const p = Number(parts[1]);
    return y !== currentYear || p !== currentPeriod;
  }, [fecha, currentYear, currentPeriod]);

  useEffect(() => {
    if (isNewRequested && !isPeriodLocked) {
      openNewPolizaModal();
    }
  }, [isNewRequested, isPeriodLocked]);

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.altKey && (e.key === 'n' || e.key === 'N')) || e.key === 'Insert') {
        if (!isPeriodLocked && !dialogRef.current?.open) {
          e.preventDefault();
          openNewPolizaModal();
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isPeriodLocked, openNewPolizaModal]);

  return {
    activeCompany, activeCompanyId, currentYear, currentPeriod, isPeriodLocked, dialogRef,
    polizas, filteredPolizas, filteredPolizasTotals, isLoading, isError, error, refetch,
    filterTipo, setFilterTipo, originFilter, setOriginFilter,
    searchQuery, setSearchQuery, compactMode, setCompactMode,
    expandedIds, setExpandedIds, confirmDeleteId, setConfirmDeleteId,
    ledgerAccountId, setLedgerAccountId, copiedPolizaId, editingPolizaId,
    tipo, setTipo, fecha, setFecha, concepto, setConcepto,
    cfdiUuid, formError, setFormError, accounts, affectableAccounts, pendingCfdis,
    predictedNextFolio, isDateDifferentPeriod, savePolizaMutation, deletePolizaMutation,
    closeYearMutation, createPedimentoMutation, isPedimentoModalOpen, setIsPedimentoModalOpen,
    openNewPolizaModal, openEditPolizaModal, openDuplicatePolizaModal,
    handleCopyPoliza, handleSelectCfdiForForm, handleExportPolizasCsv,
    ...draft
  };
}
