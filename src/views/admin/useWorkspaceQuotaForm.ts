import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useToast } from '../../context/ToastContext';
import type { WorkspacePlanTier, WorkspaceQuota, WorkspaceQuotaPayload } from '../../shared/admin-types';

export const PLAN_OPTIONS: ReadonlyArray<{ value: WorkspacePlanTier; label: string }> = [
  { value: 'FREE', label: 'FREE' },
  { value: 'PRO', label: 'PRO' },
  { value: 'DESPACHO', label: 'DESPACHO' },
  { value: 'ENTERPRISE', label: 'ENTERPRISE' }
];

const PLAN_PRESETS: Record<WorkspacePlanTier, { maxCompanies: number; maxCfdisPerMonth: number; maxStorageMb: number }> = {
  FREE: { maxCompanies: 3, maxCfdisPerMonth: 500, maxStorageMb: 250 },
  PRO: { maxCompanies: 10, maxCfdisPerMonth: 3000, maxStorageMb: 1024 },
  DESPACHO: { maxCompanies: 50, maxCfdisPerMonth: 15000, maxStorageMb: 5120 },
  ENTERPRISE: { maxCompanies: 250, maxCfdisPerMonth: 100000, maxStorageMb: 25600 }
};

export const MAX_COMPANIES_LIMIT = 10_000;
export const MAX_CFDIS_LIMIT = 10_000_000;
export const MAX_STORAGE_MB_LIMIT = 10_000_000;

const DEFAULT_FORM = {
  planTier: 'FREE' as WorkspacePlanTier,
  maxCompanies: 3,
  maxCfdisPerMonth: 500,
  maxStorageMb: 250,
  notes: ''
};

function parseQuotaInt(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return Number.NaN;
  const n = Number(trimmed);
  return Number.isInteger(n) ? n : Number.NaN;
}

export function useWorkspaceQuotaForm({
  workspaceId,
  userId,
  canEdit
}: {
  workspaceId: string;
  userId?: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [planTier, setPlanTier] = useState<WorkspacePlanTier>(DEFAULT_FORM.planTier);
  const [maxCompaniesInput, setMaxCompaniesInput] = useState<string>(String(DEFAULT_FORM.maxCompanies));
  const [maxCfdisInput, setMaxCfdisInput] = useState<string>(String(DEFAULT_FORM.maxCfdisPerMonth));
  const [maxStorageInput, setMaxStorageInput] = useState<string>(String(DEFAULT_FORM.maxStorageMb));
  const [notes, setNotes] = useState<string>(DEFAULT_FORM.notes);

  const quotaQuery = useQuery<WorkspaceQuota | null>({
    queryKey: ['admin-workspace-quota', workspaceId],
    queryFn: () => apiClient.getWorkspaceQuota(workspaceId),
    enabled: Boolean(workspaceId)
  });

  const baseline = useMemo(
    () => ({
      planTier: quotaQuery.data?.planTier ?? DEFAULT_FORM.planTier,
      maxCompanies: quotaQuery.data?.maxCompanies ?? DEFAULT_FORM.maxCompanies,
      maxCfdisPerMonth: quotaQuery.data?.maxCfdisPerMonth ?? DEFAULT_FORM.maxCfdisPerMonth,
      maxStorageMb: quotaQuery.data?.maxStorageMb ?? DEFAULT_FORM.maxStorageMb,
      notes: quotaQuery.data?.notes ?? DEFAULT_FORM.notes
    }),
    [quotaQuery.data]
  );

  const lastSyncedWorkspaceRef = useRef<string | null>(null);
  const lastSyncedUpdatedAtRef = useRef<string | undefined>(undefined);

  const isDirty =
    planTier !== baseline.planTier ||
    maxCompaniesInput.trim() !== String(baseline.maxCompanies) ||
    maxCfdisInput.trim() !== String(baseline.maxCfdisPerMonth) ||
    maxStorageInput.trim() !== String(baseline.maxStorageMb) ||
    notes.trim() !== baseline.notes.trim();

  useEffect(() => {
    const workspaceChanged = lastSyncedWorkspaceRef.current !== workspaceId;
    const currentUpdatedAt = quotaQuery.data?.updatedAt;
    const updatedAtChanged = currentUpdatedAt !== undefined && currentUpdatedAt !== lastSyncedUpdatedAtRef.current;

    if (workspaceChanged || (updatedAtChanged && !isDirty)) {
      setPlanTier(baseline.planTier);
      setMaxCompaniesInput(String(baseline.maxCompanies));
      setMaxCfdisInput(String(baseline.maxCfdisPerMonth));
      setMaxStorageInput(String(baseline.maxStorageMb));
      setNotes(baseline.notes);
      lastSyncedWorkspaceRef.current = workspaceId;
      lastSyncedUpdatedAtRef.current = currentUpdatedAt;
    }
  }, [workspaceId, quotaQuery.data?.updatedAt, baseline, isDirty]);

  const parsedCompanies = parseQuotaInt(maxCompaniesInput);
  const parsedCfdis = parseQuotaInt(maxCfdisInput);
  const parsedStorage = parseQuotaInt(maxStorageInput);
  const companiesValid = Number.isFinite(parsedCompanies) && parsedCompanies >= 1 && parsedCompanies <= MAX_COMPANIES_LIMIT;
  const cfdisValid = Number.isFinite(parsedCfdis) && parsedCfdis >= 1 && parsedCfdis <= MAX_CFDIS_LIMIT;
  const storageValid = Number.isFinite(parsedStorage) && parsedStorage >= 10 && parsedStorage <= MAX_STORAGE_MB_LIMIT;
  const validationError = !companiesValid
    ? `Máx. empresas debe ser un número entero entre 1 y ${MAX_COMPANIES_LIMIT.toLocaleString('es-MX')}.`
    : !cfdisValid
      ? `Máx. CFDIs / mes debe ser un número entero entre 1 y ${MAX_CFDIS_LIMIT.toLocaleString('es-MX')}.`
      : !storageValid
        ? `Almacenamiento debe ser un número entero entre 10 y ${MAX_STORAGE_MB_LIMIT.toLocaleString('es-MX')} MB.`
        : null;
  const isValid = validationError === null;

  const saveMutation = useMutation({
    mutationFn: (payload: WorkspaceQuotaPayload) => apiClient.upsertWorkspaceQuota(workspaceId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workspace-quota', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs-paginated'] });
      toast.success('Cuota actualizada', 'Los límites del despacho se guardaron correctamente.');
    },
    onError: (err: unknown) => {
      toast.error(
        'No se pudo guardar la cuota',
        err instanceof Error ? err.message : 'Error inesperado al actualizar límites'
      );
    }
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || !isDirty || !isValid || saveMutation.isPending) return;
    saveMutation.mutate({
      userId: userId ?? quotaQuery.data?.userId ?? null,
      planTier,
      maxCompanies: parsedCompanies,
      maxCfdisPerMonth: parsedCfdis,
      maxStorageMb: parsedStorage,
      notes: notes.trim() || null
    });
  };

  const applyPlanPreset = () => {
    const preset = PLAN_PRESETS[planTier];
    setMaxCompaniesInput(String(preset.maxCompanies));
    setMaxCfdisInput(String(preset.maxCfdisPerMonth));
    setMaxStorageInput(String(preset.maxStorageMb));
  };

  const handleDiscard = () => {
    setPlanTier(baseline.planTier);
    setMaxCompaniesInput(String(baseline.maxCompanies));
    setMaxCfdisInput(String(baseline.maxCfdisPerMonth));
    setMaxStorageInput(String(baseline.maxStorageMb));
    setNotes(baseline.notes);
  };

  return {
    quotaQuery,
    planTier,
    setPlanTier,
    maxCompaniesInput,
    setMaxCompaniesInput,
    maxCfdisInput,
    setMaxCfdisInput,
    maxStorageInput,
    setMaxStorageInput,
    notes,
    setNotes,
    isDirty,
    companiesValid,
    cfdisValid,
    storageValid,
    validationError,
    isValid,
    isSaving: saveMutation.isPending,
    handleSubmit,
    applyPlanPreset,
    handleDiscard
  };
}
