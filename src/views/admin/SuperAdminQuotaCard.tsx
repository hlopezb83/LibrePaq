import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gauge, Lock, Save } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useToast } from '../../context/ToastContext';
import type { WorkspacePlanTier, WorkspaceQuota, WorkspaceQuotaPayload } from '../../shared/admin-types';

export interface SuperAdminQuotaCardProps {
  workspaceId: string;
  userId?: string;
  canEdit: boolean;
}

const PLAN_OPTIONS: ReadonlyArray<{ value: WorkspacePlanTier; label: string }> = [
  { value: 'FREE', label: 'FREE' },
  { value: 'PRO', label: 'PRO' },
  { value: 'DESPACHO', label: 'DESPACHO' },
  { value: 'ENTERPRISE', label: 'ENTERPRISE' }
];

const DEFAULT_FORM = {
  planTier: 'FREE' as WorkspacePlanTier,
  maxCompanies: 1,
  maxCfdisPerMonth: 500,
  maxStorageMb: 250,
  notes: ''
};

export function SuperAdminQuotaCard({ workspaceId, userId, canEdit }: SuperAdminQuotaCardProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [planTier, setPlanTier] = useState<WorkspacePlanTier>(DEFAULT_FORM.planTier);
  const [maxCompanies, setMaxCompanies] = useState<number>(DEFAULT_FORM.maxCompanies);
  const [maxCfdisPerMonth, setMaxCfdisPerMonth] = useState<number>(DEFAULT_FORM.maxCfdisPerMonth);
  const [maxStorageMb, setMaxStorageMb] = useState<number>(DEFAULT_FORM.maxStorageMb);
  const [notes, setNotes] = useState<string>(DEFAULT_FORM.notes);

  const quotaQuery = useQuery<WorkspaceQuota | null>({
    queryKey: ['admin-workspace-quota', workspaceId],
    queryFn: () => apiClient.getWorkspaceQuota(workspaceId),
    enabled: Boolean(workspaceId)
  });

  useEffect(() => {
    if (!quotaQuery.data) {
      setPlanTier(DEFAULT_FORM.planTier);
      setMaxCompanies(DEFAULT_FORM.maxCompanies);
      setMaxCfdisPerMonth(DEFAULT_FORM.maxCfdisPerMonth);
      setMaxStorageMb(DEFAULT_FORM.maxStorageMb);
      setNotes(DEFAULT_FORM.notes);
      return;
    }
    setPlanTier(quotaQuery.data.planTier);
    setMaxCompanies(quotaQuery.data.maxCompanies);
    setMaxCfdisPerMonth(quotaQuery.data.maxCfdisPerMonth);
    setMaxStorageMb(quotaQuery.data.maxStorageMb);
    setNotes(quotaQuery.data.notes ?? '');
  }, [quotaQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: WorkspaceQuotaPayload) => apiClient.upsertWorkspaceQuota(workspaceId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workspace-quota', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
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
    if (!canEdit || saveMutation.isPending) return;
    saveMutation.mutate({
      userId: userId ?? quotaQuery.data?.userId ?? null,
      planTier,
      maxCompanies: Math.max(1, Number(maxCompanies) || 1),
      maxCfdisPerMonth: Math.max(1, Number(maxCfdisPerMonth) || 1),
      maxStorageMb: Math.max(1, Number(maxStorageMb) || 1),
      notes: notes.trim() || null
    });
  };

  const disabled = !canEdit || quotaQuery.isLoading || saveMutation.isPending;

  return (
    <section
      aria-label="Cuotas y plan del workspace"
      className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <Gauge className="w-4 h-4 text-blue-600" aria-hidden="true" />
          Cuotas y Plan del Despacho
        </h4>
        {quotaQuery.isLoading && (
          <span role="status" className="text-[11px] text-slate-600">Cargando cuota...</span>
        )}
      </div>

      {!canEdit && (
        <div
          role="status"
          className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-xs"
        >
          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Permiso de solo lectura: no tienes autorización para modificar cuotas o planes.</span>
        </div>
      )}

      {quotaQuery.isError && (
        <div role="alert" className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs">
          No se pudo consultar la cuota actual del workspace.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block text-xs">
            <span className="font-semibold text-slate-700 block mb-1">Plan</span>
            <select
              value={planTier}
              onChange={(e) => setPlanTier(e.target.value as WorkspacePlanTier)}
              disabled={disabled}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-500"
            >
              {PLAN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-xs">
            <span className="font-semibold text-slate-700 block mb-1">Máx. empresas (RFC)</span>
            <input
              type="number"
              min={1}
              value={maxCompanies}
              onChange={(e) => setMaxCompanies(Number(e.target.value))}
              disabled={disabled}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs tabular-nums disabled:bg-slate-100 disabled:text-slate-500"
            />
          </label>

          <label className="block text-xs">
            <span className="font-semibold text-slate-700 block mb-1">Máx. CFDIs / mes</span>
            <input
              type="number"
              min={1}
              value={maxCfdisPerMonth}
              onChange={(e) => setMaxCfdisPerMonth(Number(e.target.value))}
              disabled={disabled}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs tabular-nums disabled:bg-slate-100 disabled:text-slate-500"
            />
          </label>

          <label className="block text-xs">
            <span className="font-semibold text-slate-700 block mb-1">Almacenamiento (MB)</span>
            <input
              type="number"
              min={1}
              value={maxStorageMb}
              onChange={(e) => setMaxStorageMb(Number(e.target.value))}
              disabled={disabled}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs tabular-nums disabled:bg-slate-100 disabled:text-slate-500"
            />
          </label>
        </div>

        <label className="block text-xs">
          <span className="font-semibold text-slate-700 block mb-1">Notas operativas</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={disabled}
            placeholder="Acuerdo comercial, vigencia o exención temporal..."
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs disabled:bg-slate-100 disabled:text-slate-500"
          />
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={disabled}
            aria-busy={saveMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            {saveMutation.isPending ? 'Guardando...' : 'Guardar Cuota'}
          </button>
        </div>
      </form>
    </section>
  );
}
