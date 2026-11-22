import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import type { UserWorkspace } from '../../context/CompanyContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import type { Company, CompanyBackupBundle } from '../../shared/types';

export function useSandboxDemoActions(companyId: string, onDemoDeleted: () => void) {
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const handleDeleteDemo = async () => {
    setIsDeleting(true);
    try {
      await apiClient.deleteCompany(companyId);
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      invalidateAccountingQueries(queryClient);
      onDemoDeleted();
      toast.success('Empresa Ejemplo eliminada de tu Despacho');
    } catch (err) {
      toast.error(
        'No se pudo eliminar la empresa ejemplo',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return { isDeleting, handleDeleteDemo };
}

interface UseWorkspaceEmptyActionsParams {
  workspace: UserWorkspace | null;
  onRenameWorkspace: (nextName: string) => Promise<void>;
  onCompanyRestored: (companyId: string, company?: Company) => void;
}

export function useWorkspaceEmptyActions({
  workspace,
  onRenameWorkspace,
  onCompanyRestored
}: UseWorkspaceEmptyActionsParams) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(workspace?.name || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isProvisioningDemo, setIsProvisioningDemo] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const handleSaveName = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed) return;
    setIsSavingName(true);
    try {
      await onRenameWorkspace(trimmed);
      setIsEditingName(false);
      toast.success('Nombre de Despacho actualizado');
    } catch (err) {
      toast.error(
        'No se pudo actualizar el nombre',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setIsSavingName(false);
    }
  };

  const handleProvisionDemo = async () => {
    if (isProvisioningDemo) return;
    setIsProvisioningDemo(true);
    try {
      const { provisionSandboxDemoCompany } = await import('../../lib/sandbox-demo-seeder');
      const created = await provisionSandboxDemoCompany();
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      invalidateAccountingQueries(queryClient);
      onCompanyRestored(created.id, created);
      toast.success('¡Empresa Ejemplo cargada con 3 CFDIs y pólizas automáticas listas!');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo cargar la Empresa Ejemplo'
      );
    } finally {
      setIsProvisioningDemo(false);
    }
  };

  const handleRestoreFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsRestoring(true);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as CompanyBackupBundle;
      const res = await apiClient.restoreCompanyBackup(parsed);
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      invalidateAccountingQueries(queryClient);
      onCompanyRestored(res.id, res);
      toast.success(`Empresa ${res.name} restaurada en tu Despacho`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'El archivo seleccionado no es un respaldo válido'
      );
    } finally {
      setIsRestoring(false);
    }
  };

  return {
    isEditingName,
    setIsEditingName,
    draftName,
    setDraftName,
    isSavingName,
    isRestoring,
    isProvisioningDemo,
    handleSaveName,
    handleProvisionDemo,
    handleRestoreFile
  };
}
