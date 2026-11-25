import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import type { CfdiDocument } from '../../shared/types';
import {
  buildContabilizarPreviewMovements,
  downloadCfdiXmlFile,
  extractXmlStringsFromFiles,
  resolveDefaultAccountsForCfdi,
  uploadXmlsInSequentialBatches,
  type UploadBatchProgress
} from './cfdiXmlUploadHelpers';
import { exportCfdisCsv } from './exportCfdisCsv';
import { exportCfdisZip } from './exportCfdisZip';
import type { ForeignNoCfdiPayload } from '../../shared/cfdi-xml-foreign';
import type { BatchPolizaGroupingMode } from '../../shared/engine/auto-poliza-types';
import { useAddCfdiMutations } from './useAddCfdiMutations';
import { useCfdiFilters } from './useCfdiFilters';
import { useBeforeUnloadGuard, useCfdiSelection, useCloud69BSync } from './useCfdiSelection';

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
  const [previewInvoiceCfdi, setPreviewInvoiceCfdi] = useState<CfdiDocument | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [uploadBatchProgress, setUploadBatchProgress] = useState<UploadBatchProgress | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);
  const [confirmDeleteCfdiId, setConfirmDeleteCfdiId] = useState<string | null>(null);
  const [batchGroupingMode, setBatchGroupingMode] = useState<BatchPolizaGroupingMode>('PER_CFDI');
  const [showSoapFielPanel, setShowSoapFielPanel] = useState(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    return p.get('sat') === 'open' || p.get('openSat') === 'true';
  });

  useEffect(() => {
    setSelectedCfdi(null);
    setConfirmDeleteCfdiId(null);
    setPreviewInvoiceCfdi(null);
    if (contabilizarModalRef.current?.open) contabilizarModalRef.current.close();
    if (simModalRef.current?.open) simModalRef.current.close();
    if (xmlModalRef.current?.open) xmlModalRef.current.close();
  }, [activeCompanyId]);

  useBeforeUnloadGuard(isUploadingFiles);

  useEffect(() => {
    if (isReadOnlyClient) {
      setShowSoapFielPanel(false);
      return;
    }
    if (typeof window !== 'undefined' && (window.location.search.includes('sat=open') || window.location.search.includes('openSat=true'))) {
      setShowSoapFielPanel(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById('sat-soap-fiel-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
  }, [isReadOnlyClient]);

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

  useCloud69BSync(activeCompanyId, cfdis);

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

  const {
    selectedCfdiIds,
    setSelectedCfdiIds,
    toggleSelectAll,
    toggleSelectOne
  } = useCfdiSelection(filteredCfdis, activeCompanyId);

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
    batchPartialAlert,
    dismissBatchPartialAlert,
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
    let ranBatch = false;
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

      ranBatch = true;
      const res = await uploadXmlsInSequentialBatches({
        companyId: activeCompanyId,
        xmls: boundedXmls,
        toast,
        onProgress: setUploadBatchProgress
      });
      toast.success(
        `Se importaron ${res.uploadedCount} archivos XML al ADD${
          res.skippedDuplicates > 0 ? ` (${res.skippedDuplicates} duplicados omitidos)` : ''
        }.`
      );
    } finally {
      if (ranBatch) {
        invalidateAccountingQueries(queryClient, ['cfdis', 'dashboard']);
      }
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

  const handleSimulateSubmit = (payload: ForeignNoCfdiPayload) => {
    if (isReadOnlyClient) return;
    uploadXmlMutation.mutate(payload);
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
    batchPartialAlert, dismissBatchPartialAlert,
    processXmlFiles, handleFileUpload, handleDrop,
    openContabilizarModal, openXmlViewer, handleCopyUuid, handleDownloadSelectedXml,
    previewMovements, filteredCfdis, filteredTotals,
    toggleSelectAll, toggleSelectOne, handleExportCsv, handleExportZipSelected,
    handleSimulateSubmit, onSoapDownloadSuccess, batchProgress,
    batchGroupingMode, setBatchGroupingMode,
    scopedCfdis, emitidosCount, recibidosCount
  };
}
