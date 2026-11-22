import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
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

  const { data: accountsList = [] } = useQuery({
    queryKey: ['accounts', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getAccounts(activeCompanyId, currentYear, currentPeriod),
    enabled: isEnabled
  });

  const { data: polizasData = [] } = useQuery({
    queryKey: ['polizas', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPolizas(activeCompanyId, currentYear, currentPeriod),
    enabled: isEnabled
  });

  const { data: cfdisList = [] } = useQuery({
    queryKey: ['cfdis', activeCompanyId],
    queryFn: () => apiClient.getCfdis(activeCompanyId),
    enabled: isEnabled
  });

  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const csvCatalogInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = async () => {
    if (!activeCompany) return;
    try {
      setIsExportingBackup(true);
      const bundle = await apiClient.exportCompanyBackup(activeCompany.id);
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bundle, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `LibrePaq_Backup_${activeCompany.rfc}_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
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
      setIsRestoringBackup(true);
      const text = await file.text();
      const bundle = JSON.parse(text) as CompanyBackupBundle;
      if (!bundle || !bundle.company || !bundle.company.rfc) {
        throw new Error('El archivo no contiene una estructura de respaldo JSON válida de LibrePaq.');
      }

      const backupRfc = bundle.company.rfc.toUpperCase();
      const backupName = bundle.company.name;
      const polCount = bundle.polizas?.length || 0;
      const accCount = bundle.accounts?.length || 0;

      const confirmMsg =
        `¿Confirmas la restauración del respaldo para "${backupName}" (${backupRfc})?\n\n` +
        `• Pólizas a cargar: ${polCount}\n` +
        `• Cuentas a cargar: ${accCount}\n\n` +
        `IMPORTANTE: Los registros contables actuales de esta empresa serán reemplazados por el estado del respaldo.`;

      if (!window.confirm(confirmMsg)) {
        return;
      }

      const restored = await apiClient.restoreCompanyBackup(bundle);
      toast.success('Respaldo restaurado', `La empresa ${restored.name} (${restored.rfc}) se recuperó correctamente.`);
      invalidateAccountingQueries(queryClient);
    } catch (err: unknown) {
      toast.error(`Error al restaurar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRestoringBackup(false);
      if (restoreInputRef.current) restoreInputRef.current.value = '';
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
    isExportingBackup,
    isRestoringBackup,
    handleExportBackup,
    handleRestoreBackupFile,
    handleImportCsvCatalog,
    restoreInputRef,
    csvCatalogInputRef
  };
}
