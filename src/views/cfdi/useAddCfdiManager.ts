import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { checkRfcsAgainstCloud69B } from '../../lib/supabase/supabase-cxc-sat';
import type { CfdiDocument } from '../../shared/types';
import {
  buildContabilizarPreviewMovements,
  computeNextCfdiSelection,
  downloadCfdiXmlFile,
  extractXmlStringsFromFiles,
  resolveDefaultAccountsForCfdi,
  uploadXmlsInSequentialBatches,
  type UploadBatchProgress
} from './cfdiXmlUploadHelpers';
import { exportCfdisCsv } from './exportCfdisCsv';
import { exportCfdisZip } from './exportCfdisZip';
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
  const [uploadBatchProgress, setUploadBatchProgress] = useState<UploadBatchProgress | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [, setCloud69BRev] = useState(0);
  const checked69BKeyRef = useRef('');
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

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getAccounts(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId)
  });

  const {
    pendingCfdis,
    filters: {
      tab, setTab, tipoFilter, setTipoFilter, metodoFilter, setMetodoFilter,
      statusSatFilter, setStatusSatFilter, formaPagoFilter, setFormaPagoFilter,
      searchQuery, setSearchQuery, periodScope, setPeriodScope,
      countInCurrentPeriod, countInCurrentYear, scopedCfdis, emitidosCount, recibidosCount,
      filteredCfdis, filteredTotals
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

      const res = await uploadXmlsInSequentialBatches({
        companyId: activeCompanyId,
        xmls: boundedXmls,
        toast,
        onProgress: setUploadBatchProgress
      });
      invalidateAccountingQueries(queryClient, ['cfdis', 'dashboard']);
      toast.success(
        `Se importaron ${res.uploadedCount} archivos XML al ADD${
          res.skippedDuplicates > 0 ? ` (${res.skippedDuplicates} duplicados omitidos)` : ''
        }.`
      );
    } finally {
      setUploadBatchProgress(null);
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

  const previewMovements = useMemo(
    () =>
      buildContabilizarPreviewMovements(
        selectedCfdi,
        affectableAccounts,
        operationAccountCode,
        counterAccountCode
      ),
    [selectedCfdi, operationAccountCode, counterAccountCode, affectableAccounts]
  );

  const toggleSelectAll = () => {
    if (selectedCfdiIds.size === filteredCfdis.length && filteredCfdis.length > 0) {
      setSelectedCfdiIds(new Set());
    } else {
      setSelectedCfdiIds(new Set(filteredCfdis.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string, shiftKey = false) => {
    const lastId = lastSelectedIdRef.current;
    lastSelectedIdRef.current = id;
    setSelectedCfdiIds((prev) => computeNextCfdiSelection(prev, filteredCfdis, id, lastId, shiftKey));
  };

  const hasActiveFilters =
    tab !== 'ALL' || tipoFilter !== 'ALL' || metodoFilter !== 'ALL' ||
    statusSatFilter !== 'ALL' || formaPagoFilter !== 'ALL' || searchQuery.trim().length > 0;

  const resetFilters = () => {
    setTab('ALL');
    setTipoFilter('ALL');
    setMetodoFilter('ALL');
    setStatusSatFilter('ALL');
    setFormaPagoFilter('ALL');
    setSearchQuery('');
  };

  const handleExportCsv = () => {
    exportCfdisCsv(filteredCfdis, activeCompany?.rfc || 'Empresa', currentYear, currentPeriod, toast);
  };

  const handleExportZipSelected = async () => {
    const selected = filteredCfdis.filter((c) => selectedCfdiIds.has(c.id));
    const targets = selected.length > 0 ? selected : filteredCfdis;
    setIsExportingZip(true);
    try {
      await exportCfdisZip(targets, activeCompany?.rfc || 'Empresa', currentYear, currentPeriod, toast);
    } finally {
      setIsExportingZip(false);
    }
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
    statusSatFilter, setStatusSatFilter, formaPagoFilter, setFormaPagoFilter,
    searchQuery, setSearchQuery, selectedCfdi, setSelectedCfdi,
    operationAccountCode, setOperationAccountCode, counterAccountCode, setCounterAccountCode,
    selectedCfdiIds, setSelectedCfdiIds, previewInvoiceCfdi, setPreviewInvoiceCfdi,
    isDragging, setIsDragging, isUploadingFiles, uploadBatchProgress, isExportingZip,
    copiedUuid, confirmDeleteCfdiId, setConfirmDeleteCfdiId,
    hasActiveFilters, resetFilters,
    showSoapFielPanel, setShowSoapFielPanel, periodScope, setPeriodScope,
    cfdis, countInCurrentPeriod, countInCurrentYear, accounts, affectableAccounts, pendingCfdis, isLoading, isError, error, refetch,
    verifyingCfdiId: verifySatMutation.isPending ? verifySatMutation.variables ?? null : null,
    uploadXmlMutation, autoPolizaMutation, deleteCfdiMutation,
    batchContabilizarMutation, batchDeleteMutation, verifySatMutation,
    verifySatBatchMutation, satBatchAlert, dismissSatBatchAlert,
    processXmlFiles, handleFileUpload, handleDrop,
    openContabilizarModal, openXmlViewer, handleCopyUuid, handleDownloadSelectedXml,
    previewMovements, filteredCfdis, filteredTotals,
    toggleSelectAll, toggleSelectOne, handleExportCsv, handleExportZipSelected,
    handleSimulateSubmit, onSoapDownloadSuccess, batchProgress,
    scopedCfdis, emitidosCount, recibidosCount
  };
}
