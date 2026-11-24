import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { downloadBlobFile } from '../../lib/formatters';
import { getTodayLocalIso } from '../../shared/date-utils';
import { importCatalogoCsvFile } from '../catalogo/catalogoCsvIo';
import type { Company, CompanyBackupBundle } from '../../shared/types';

export function useAjustesBackups(
  activeCompany: Company | null,
  activeCompanyId: string,
  options?: { isTabActive?: boolean }
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentYear = activeCompany?.currentYear ?? 2026;
  const currentPeriod = activeCompany?.currentPeriod ?? 10;
  const isEnabled = Boolean(activeCompanyId && options?.isTabActive !== false);

  const {
    data: accountsList = [],
    isLoading: isLoadingAccounts,
    isError: isErrorAccounts,
    refetch: refetchAccounts
  } = useQuery({
    queryKey: ['accounts', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getAccounts(activeCompanyId, currentYear, currentPeriod),
    enabled: isEnabled
  });

  const {
    data: polizasData = [],
    isLoading: isLoadingPolizas,
    isError: isErrorPolizas,
    refetch: refetchPolizas
  } = useQuery({
    queryKey: ['polizas', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPolizas(activeCompanyId, currentYear, currentPeriod),
    enabled: isEnabled
  });

  const {
    data: cfdisList = [],
    isLoading: isLoadingCfdis,
    isError: isErrorCfdis,
    refetch: refetchCfdis
  } = useQuery({
    queryKey: ['cfdis', activeCompanyId],
    queryFn: () => apiClient.getCfdis(activeCompanyId),
    enabled: isEnabled
  });

  const isLoadingMetrics = isLoadingAccounts || isLoadingPolizas || isLoadingCfdis;
  const isErrorMetrics = isErrorAccounts || isErrorPolizas || isErrorCfdis;
  const refetchMetrics = () => {
    void refetchAccounts();
    void refetchPolizas();
    void refetchCfdis();
  };

  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<{
    bundle: CompanyBackupBundle;
    backupRfc: string;
    backupName: string;
    polCount: number;
    accCount: number;
  } | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const csvCatalogInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = async () => {
    if (!activeCompany) return;
    try {
      setIsExportingBackup(true);
      const bundle = await apiClient.exportCompanyBackup(activeCompany.id);
      downloadBlobFile(
        `LibrePaq_Backup_${activeCompany.rfc}_${getTodayLocalIso()}.json`,
        JSON.stringify(bundle, null, 2),
        'application/json;charset=utf-8'
      );
      toast.success('Respaldo descargado', 'El paquete de contabilidad fue generado exitosamente.');
    } catch (err: unknown) {
      toast.error(`Error al respaldar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleRestoreBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let bundle: CompanyBackupBundle;
      try {
        bundle = JSON.parse(text) as CompanyBackupBundle;
      } catch {
        throw new Error('El archivo seleccionado no es un JSON de respaldo válido.');
      }
      if (!bundle || !bundle.company || !bundle.company.rfc) {
        throw new Error('El archivo no contiene una estructura de respaldo válida de LibrePaq.');
      }

      setPendingRestore({
        bundle,
        backupRfc: bundle.company.rfc.toUpperCase(),
        backupName: bundle.company.name,
        polCount: bundle.polizas?.length || 0,
        accCount: bundle.accounts?.length || 0
      });
    } catch (err: unknown) {
      toast.error(`Error al leer respaldo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (restoreInputRef.current) restoreInputRef.current.value = '';
    }
  };

  const cancelRestoreBackup = () => {
    setPendingRestore(null);
  };

  const confirmRestoreBackup = async () => {
    if (!pendingRestore) return;
    try {
      setIsRestoringBackup(true);
      const restored = await apiClient.restoreCompanyBackup(pendingRestore.bundle);
      toast.success('Respaldo restaurado', `La empresa ${restored.name} (${restored.rfc}) se recuperó correctamente.`);
      setPendingRestore(null);
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
      invalidateAccountingQueries(queryClient);
    } catch (err: unknown) {
      toast.error(`Error al restaurar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleImportCsvCatalog = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCompanyId) return;
    try {
      await importCatalogoCsvFile(file, activeCompanyId, queryClient, toast);
    } catch (err: unknown) {
      toast.error(`Error al importar CSV: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (csvCatalogInputRef.current) csvCatalogInputRef.current.value = '';
    }
  };

  return {
    accountsList,
    polizasData,
    cfdisList,
    isLoadingMetrics,
    isErrorMetrics,
    refetchMetrics,
    isExportingBackup,
    isRestoringBackup,
    pendingRestore,
    confirmRestoreBackup,
    cancelRestoreBackup,
    handleExportBackup,
    handleRestoreBackupFile,
    handleImportCsvCatalog,
    restoreInputRef,
    csvCatalogInputRef
  };
}
