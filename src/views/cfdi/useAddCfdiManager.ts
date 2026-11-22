import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { buildAutoPolizaPlan } from '../../shared/accounting-engine';
import { SAFETY_BOUNDS } from '../../shared/sat-catalog';
import type { CfdiDocument } from '../../shared/types';
import { exportCfdisCsv } from './exportCfdisCsv';
import { computeCfdiTotals, filterCfdis } from './filterCfdis';
import { buildSimulatedCfdiXml, type SimulatedCfdiPayload } from './simulateCfdiXml';
import { useAddCfdiMutations } from './useAddCfdiMutations';

export function useAddCfdiManager() {
  const { activeCompany, activeCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const toast = useToast();

  const xmlModalRef = useRef<HTMLDialogElement>(null);
  const contabilizarModalRef = useRef<HTMLDialogElement>(null);
  const simModalRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'ALL' | 'EMITIDO' | 'RECIBIDO' | 'PENDING'>('ALL');
  const [tipoFilter, setTipoFilter] = useState<'ALL' | 'I' | 'P' | 'N' | 'RET'>('ALL');
  const [metodoFilter, setMetodoFilter] = useState<'ALL' | 'PUE' | 'PPD'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCfdi, setSelectedCfdi] = useState<CfdiDocument | null>(null);
  const [operationAccountCode, setOperationAccountCode] = useState<string>('');
  const [counterAccountCode, setCounterAccountCode] = useState<string>('');
  const [selectedCfdiIds, setSelectedCfdiIds] = useState<Set<string>>(new Set());
  const [previewInvoiceCfdi, setPreviewInvoiceCfdi] = useState<CfdiDocument | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);
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
  const [periodScope, setPeriodScope] = useState<'CURRENT' | 'ALL'>('CURRENT');

  const { data: periodLock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId)
  });
  const isPeriodLocked = Boolean(periodLock?.isLocked);

  const { data: cfdis = [], isLoading } = useQuery({
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

  const affectableAccounts = useMemo(
    () => accounts.filter((a) => a.isAffectable),
    [accounts]
  );

  const pendingCfdis = useMemo(() => scopedCfdis.filter((c) => !c.polizaId), [scopedCfdis]);
  const emitidosCount = useMemo(
    () => scopedCfdis.filter((c) => c.direction === 'EMITIDO').length,
    [scopedCfdis]
  );
  const recibidosCount = useMemo(
    () => scopedCfdis.filter((c) => c.direction === 'RECIBIDO').length,
    [scopedCfdis]
  );

  const {
    uploadXmlMutation,
    autoPolizaMutation,
    deleteCfdiMutation,
    batchContabilizarMutation,
    batchDeleteMutation,
    verifySatMutation,
    batchProgress
  } = useAddCfdiMutations({
    isPeriodLocked,
    currentYear,
    currentPeriod,
    simModalRef,
    contabilizarModalRef,
    setConfirmDeleteCfdiId,
    setSelectedCfdiIds
  });

  const processXmlFiles = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    const xmlList: string[] = [];

    for (const file of rawFiles) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.xml') || file.type.includes('xml')) {
        const text = await file.text();
        xmlList.push(text);
      } else if (lower.endsWith('.zip') || file.type.includes('zip')) {
        try {
          if (file.size > SAFETY_BOUNDS.MAX_ZIP_UNCOMPRESSED_BYTES) {
            toast.error(`El archivo ZIP ${file.name} excede el límite de 50MB.`);
            continue;
          }
          const buffer = new Uint8Array(await file.arrayBuffer());
          const { unzipSync, strFromU8 } = await import('fflate');
          const unzipped = unzipSync(buffer, {
            filter(fileInfo) {
              return fileInfo.originalSize <= SAFETY_BOUNDS.MAX_XML_BYTES;
            }
          });
          for (const [name, content] of Object.entries(unzipped)) {
            if (name.toLowerCase().endsWith('.xml')) {
              xmlList.push(strFromU8(content));
              if (xmlList.length >= SAFETY_BOUNDS.MAX_BATCH_CFDI) break;
            }
          }
        } catch {
          toast.error(`No fue posible leer el archivo ZIP: ${file.name}`);
        }
      }
    }

    const boundedXmls = xmlList.slice(0, SAFETY_BOUNDS.MAX_BATCH_CFDI);
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
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processXmlFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processXmlFiles(e.dataTransfer.files);
    }
  };

  const openContabilizarModal = (cfdi: CfdiDocument) => {
    setSelectedCfdi(cfdi);
    const plan = buildAutoPolizaPlan(cfdi, accounts);
    const opMov = plan.movements[0];
    const counterMov = plan.movements[plan.movements.length - 1];
    setOperationAccountCode(
      opMov?.accountCode ??
        (cfdi.tipoComprobante === 'P'
          ? cfdi.direction === 'EMITIDO'
            ? '105-01-002'
            : '201-01-099'
          : cfdi.direction === 'EMITIDO'
          ? '401-01-002'
          : '601-01-003')
    );
    setCounterAccountCode(
      counterMov?.accountCode ??
        (cfdi.metodoPago === 'PUE' || cfdi.tipoComprobante === 'P'
          ? '102-01-001'
          : cfdi.direction === 'EMITIDO'
          ? '105-01-002'
          : '201-01-099')
    );
    contabilizarModalRef.current?.showModal();
  };

  const openXmlViewer = (cfdi: CfdiDocument) => {
    setSelectedCfdi(cfdi);
    xmlModalRef.current?.showModal();
  };

  const handleCopyUuid = (uuid: string) => {
    navigator.clipboard?.writeText(uuid);
    setCopiedUuid(uuid);
    setTimeout(() => setCopiedUuid(null), 1800);
  };

  const handleDownloadSelectedXml = () => {
    if (!selectedCfdi) return;
    const blob = new Blob([selectedCfdi.xmlRaw], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CFDI_${selectedCfdi.serie}_${selectedCfdi.folio}_${selectedCfdi.uuid.slice(0, 8)}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewMovements = useMemo(() => {
    if (!selectedCfdi || affectableAccounts.length === 0) return [];
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
  }, [selectedCfdi, operationAccountCode, counterAccountCode, affectableAccounts]);

  const filteredCfdis = useMemo(
    () => filterCfdis(cfdis, tab, tipoFilter, searchQuery, periodScope, currentPeriodPrefix, metodoFilter),
    [cfdis, tab, tipoFilter, searchQuery, periodScope, currentPeriodPrefix, metodoFilter]
  );

  const filteredTotals = useMemo(() => computeCfdiTotals(filteredCfdis), [filteredCfdis]);

  const toggleSelectAll = () => {
    if (selectedCfdiIds.size === filteredCfdis.length && filteredCfdis.length > 0) {
      setSelectedCfdiIds(new Set());
    } else {
      setSelectedCfdiIds(new Set(filteredCfdis.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedCfdiIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    const xmlRaw = buildSimulatedCfdiXml(payload, activeCompany);
    uploadXmlMutation.mutate({ companyId: activeCompanyId, xmlRaw });
  };

  return {
    activeCompany,
    activeCompanyId,
    currentYear,
    currentPeriod,
    isPeriodLocked,
    xmlModalRef,
    contabilizarModalRef,
    simModalRef,
    fileInputRef,
    tab, setTab, tipoFilter, setTipoFilter, metodoFilter, setMetodoFilter,
    searchQuery, setSearchQuery, selectedCfdi, setSelectedCfdi,
    operationAccountCode, setOperationAccountCode, counterAccountCode, setCounterAccountCode,
    selectedCfdiIds, setSelectedCfdiIds, previewInvoiceCfdi, setPreviewInvoiceCfdi,
    isDragging, setIsDragging, copiedUuid, confirmDeleteCfdiId, setConfirmDeleteCfdiId,
    showSoapFielPanel, setShowSoapFielPanel, periodScope, setPeriodScope,
    cfdis, countInCurrentPeriod, accounts, affectableAccounts, pendingCfdis, isLoading,
    uploadXmlMutation, autoPolizaMutation, deleteCfdiMutation,
    batchContabilizarMutation, batchDeleteMutation, verifySatMutation,
    processXmlFiles, handleFileUpload, handleDrop,
    openContabilizarModal, openXmlViewer, handleCopyUuid, handleDownloadSelectedXml,
    previewMovements, filteredCfdis, filteredTotals,
    toggleSelectAll, toggleSelectOne, handleExportCsv,
    handleSimulateSubmit, onSoapDownloadSuccess, batchProgress,
    scopedCfdis, emitidosCount, recibidosCount
  };
}
