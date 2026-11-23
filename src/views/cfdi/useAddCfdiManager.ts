import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { buildAutoPolizaPlan } from '../../shared/accounting-engine';
import type { CfdiDocument } from '../../shared/types';
import {
  downloadCfdiXmlFile,
  extractXmlStringsFromFiles,
  resolveDefaultAccountsForCfdi
} from './cfdiXmlUploadHelpers';
import { exportCfdisCsv } from './exportCfdisCsv';
import { buildSimulatedCfdiXml, type SimulatedCfdiPayload } from './simulateCfdiXml';
import { useAddCfdiMutations } from './useAddCfdiMutations';
import { useCfdiFilters } from './useCfdiFilters';

export function useAddCfdiManager() {
  const { activeCompany, activeCompanyId, isReadOnlySupportMode, isReadOnlyClient: rawReadOnlyClient } = useCompany();
  const isReadOnlyClient = Boolean(isReadOnlySupportMode || rawReadOnlyClient);
  const queryClient = useQueryClient();
  const toast = useToast();

  const xmlModalRef = useRef<HTMLDialogElement>(null);
  const contabilizarModalRef = useRef<HTMLDialogElement>(null);
  const simModalRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedCfdi, setSelectedCfdi] = useState<CfdiDocument | null>(null);
  const [operationAccountCode, setOperationAccountCode] = useState<string>('');
  const [counterAccountCode, setCounterAccountCode] = useState<string>('');
  const [selectedCfdiIds, setSelectedCfdiIds] = useState<Set<string>>(new Set());
  const [previewInvoiceCfdi, setPreviewInvoiceCfdi] = useState<CfdiDocument | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);
  const lastSelectedIdRef = useRef<string | null>(null);
  const [confirmDeleteCfdiId, setConfirmDeleteCfdiId] = useState<string | null>(null);
  const [showSoapFielPanel, setShowSoapFielPanel] = useState(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    return p.get('sat') === 'open' || p.get('openSat') === 'true';
  });

  const hasAutoOpenedPanelRef = useRef(false);

  useEffect(() => {
    hasAutoOpenedPanelRef.current = false;
    setSelectedCfdiIds(new Set());
    setSelectedCfdi(null);
    setConfirmDeleteCfdiId(null);
    setPreviewInvoiceCfdi(null);
    if (contabilizarModalRef.current?.open) contabilizarModalRef.current.close();
    if (simModalRef.current?.open) simModalRef.current.close();
    if (xmlModalRef.current?.open) xmlModalRef.current.close();
  }, [activeCompanyId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window.location.search.includes('sat=open') || window.location.search.includes('openSat=true'))) {
      setShowSoapFielPanel(true);
      const el = document.getElementById('sat-soap-fiel-section');
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }, []);

  const currentYear = activeCompany?.currentYear ?? 2026;
  const currentPeriod = activeCompany?.currentPeriod ?? 10;
  const currentPeriodPrefix = `${currentYear}-${String(currentPeriod).padStart(2, '0')}`;

  const { data: periodLock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId)
  });
  const isPeriodLocked = Boolean(periodLock?.isLocked);
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;

  const { data: cfdis = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cfdis', activeCompanyId],
    queryFn: () => apiClient.getCfdis(activeCompanyId),
    enabled: Boolean(activeCompanyId)
  });

  useEffect(() => {
    if (!isLoading && cfdis.length === 0 && !hasAutoOpenedPanelRef.current) {
      hasAutoOpenedPanelRef.current = true;
      setShowSoapFielPanel(true);
    }
  }, [isLoading, cfdis.length]);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getAccounts(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId)
  });

  const {
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
  } = useCfdiFilters(cfdis, currentPeriodPrefix);

  const affectableAccounts = useMemo(
    () => accounts.filter((a) => a.isAffectable),
    [accounts]
  );

  const {
    uploadXmlMutation,
    autoPolizaMutation,
    deleteCfdiMutation,
    batchContabilizarMutation,
    batchDeleteMutation,
    verifySatMutation,
    verifySatBatchMutation,
    satBatchAlert,
    dismissSatBatchAlert,
    batchProgress
  } = useAddCfdiMutations({
    activeCompanyId,
    isPeriodLocked,
    isReadOnlyClient,
    currentYear,
    currentPeriod,
    simModalRef,
    contabilizarModalRef,
    setConfirmDeleteCfdiId,
    setSelectedCfdiIds
  });

  const processXmlFiles = async (fileList: FileList | File[]) => {
    if (isReadOnlyClient) return;
    setIsUploadingFiles(true);
    try {
      const boundedXmls = await extractXmlStringsFromFiles(fileList, toast);
      if (boundedXmls.length === 0) {
        toast.warning('No se encontraron archivos XML válidos.');
        return;
      }

      if (boundedXmls.length === 1 && boundedXmls[0]) {
        await uploadXmlMutation.mutateAsync({
          companyId: activeCompanyId,
          xmlRaw: boundedXmls[0]
        });
        return;
      }

      const res = await apiClient.batchUploadCfdiXmls(activeCompanyId, boundedXmls);
      invalidateAccountingQueries(queryClient, ['cfdis', 'dashboard']);
      toast.success(
        `Se importaron ${res.uploaded.length} archivos XML al ADD${
          res.skippedDuplicates > 0 ? ` (${res.skippedDuplicates} duplicados omitidos)` : ''
        }.`
      );
    } finally {
      setIsUploadingFiles(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        await processXmlFiles(e.target.files);
      } catch (err: unknown) {
        toast.error(`Error al importar XML: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        e.target.value = '';
      }
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      try {
        await processXmlFiles(e.dataTransfer.files);
      } catch (err: unknown) {
        toast.error(`Error al importar XML: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  const openContabilizarModal = (cfdi: CfdiDocument) => {
    if (isWriteBlocked) return;
    setSelectedCfdi(cfdi);
    let defaults = { operationAccountCode: '', counterAccountCode: '' };
    try {
      defaults = resolveDefaultAccountsForCfdi(cfdi, accounts);
    } catch {
      defaults = { operationAccountCode: '', counterAccountCode: '' };
    }
    setOperationAccountCode(defaults.operationAccountCode);
    setCounterAccountCode(defaults.counterAccountCode);
    if (contabilizarModalRef.current && !contabilizarModalRef.current.open) {
      contabilizarModalRef.current.showModal();
    }
  };

  const openXmlViewer = (cfdi: CfdiDocument) => {
    setSelectedCfdi(cfdi);
    if (xmlModalRef.current && !xmlModalRef.current.open) {
      xmlModalRef.current.showModal();
    }
  };

  const handleCopyUuid = (uuid: string) => {
    navigator.clipboard?.writeText(uuid);
    setCopiedUuid(uuid);
    setTimeout(() => setCopiedUuid(null), 1800);
  };

  const handleDownloadSelectedXml = () => {
    if (!selectedCfdi) return;
    void downloadCfdiXmlFile(selectedCfdi, toast);
  };

  const previewMovements = useMemo(() => {
    if (!selectedCfdi || affectableAccounts.length === 0) return [];
    try {
      const plan = buildAutoPolizaPlan(selectedCfdi, affectableAccounts, {
        operationAccountCode: operationAccountCode || undefined,
        counterAccountCode: counterAccountCode || undefined
      });
      return plan.movements.map((m) => ({
        code: m.accountCode,
        name: m.accountName,
        concepto: m.concepto,
        cargo: m.cargo,
        abono: m.abono
      }));
    } catch {
      return [];
    }
  }, [selectedCfdi, operationAccountCode, counterAccountCode, affectableAccounts]);

  const toggleSelectAll = () => {
    if (selectedCfdiIds.size === filteredCfdis.length && filteredCfdis.length > 0) {
      setSelectedCfdiIds(new Set());
    } else {
      setSelectedCfdiIds(new Set(filteredCfdis.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string, shiftKey = false) => {
    setSelectedCfdiIds((prev) => {
      const next = new Set(prev);
      const shouldSelect = !prev.has(id);

      if (shiftKey && lastSelectedIdRef.current) {
        const startIdx = filteredCfdis.findIndex((c) => c.id === lastSelectedIdRef.current);
        const endIdx = filteredCfdis.findIndex((c) => c.id === id);
        if (startIdx !== -1 && endIdx !== -1) {
          const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          for (let i = from; i <= to; i++) {
            const doc = filteredCfdis[i];
            if (!doc) continue;
            if (shouldSelect) next.add(doc.id);
            else next.delete(doc.id);
          }
          lastSelectedIdRef.current = id;
          return next;
        }
      }

      if (next.has(id)) next.delete(id);
      else next.add(id);
      lastSelectedIdRef.current = id;
      return next;
    });
  };

  const hasActiveFilters =
    tab !== 'ALL' || tipoFilter !== 'ALL' || metodoFilter !== 'ALL' || searchQuery.trim().length > 0;

  const resetFilters = () => {
    setTab('ALL');
    setTipoFilter('ALL');
    setMetodoFilter('ALL');
    setSearchQuery('');
  };

  const handleExportCsv = () => {
    exportCfdisCsv(
      filteredCfdis,
      activeCompany?.rfc || 'Empresa',
      currentYear,
      currentPeriod,
      toast
    );
  };

  const onSoapDownloadSuccess = (msg: string) => {
    invalidateAccountingQueries(queryClient, ['cfdis', 'dashboard']);
    toast.success('Descarga SAT Exitosa', msg);
  };

  const handleSimulateSubmit = (payload: SimulatedCfdiPayload) => {
    if (isReadOnlyClient) return;
    const xmlRaw = buildSimulatedCfdiXml(payload, activeCompany);
    uploadXmlMutation.mutate({ companyId: activeCompanyId, xmlRaw });
  };

  return {
    activeCompany, activeCompanyId, currentYear, currentPeriod,
    isPeriodLocked, isReadOnlyClient, isWriteBlocked,
    xmlModalRef, contabilizarModalRef, simModalRef, fileInputRef,
    tab, setTab, tipoFilter, setTipoFilter, metodoFilter, setMetodoFilter,
    searchQuery, setSearchQuery, selectedCfdi, setSelectedCfdi,
    operationAccountCode, setOperationAccountCode, counterAccountCode, setCounterAccountCode,
    selectedCfdiIds, setSelectedCfdiIds, previewInvoiceCfdi, setPreviewInvoiceCfdi,
    isDragging, setIsDragging, isUploadingFiles, copiedUuid, confirmDeleteCfdiId, setConfirmDeleteCfdiId,
    hasActiveFilters, resetFilters,
    showSoapFielPanel, setShowSoapFielPanel, periodScope, setPeriodScope,
    cfdis, countInCurrentPeriod, accounts, affectableAccounts, pendingCfdis, isLoading, isError, error, refetch,
    verifyingCfdiId: verifySatMutation.isPending ? verifySatMutation.variables ?? null : null,
    uploadXmlMutation, autoPolizaMutation, deleteCfdiMutation,
    batchContabilizarMutation, batchDeleteMutation, verifySatMutation,
    verifySatBatchMutation, satBatchAlert, dismissSatBatchAlert,
    processXmlFiles, handleFileUpload, handleDrop,
    openContabilizarModal, openXmlViewer, handleCopyUuid, handleDownloadSelectedXml,
    previewMovements, filteredCfdis, filteredTotals,
    toggleSelectAll, toggleSelectOne, handleExportCsv,
    handleSimulateSubmit, onSoapDownloadSuccess, batchProgress,
    scopedCfdis, emitidosCount, recibidosCount
  };
}
