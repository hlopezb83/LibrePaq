import { useEffect, useId } from 'react';
import { Gauge, Loader2, Lock, RotateCcw, Save, Sparkles } from 'lucide-react';
import { AlertBanner, Button, FormField, Input, Select } from '../../components/ui';
import type { WorkspacePlanTier } from '../../shared/admin-types';
import { AdminErrorBanner } from './AdminErrorBanner';
import {
  MAX_CFDIS_LIMIT,
  MAX_COMPANIES_LIMIT,
  MAX_STORAGE_MB_LIMIT,
  PLAN_OPTIONS,
  useWorkspaceQuotaForm
} from './useWorkspaceQuotaForm';

const PLAN_LABELS: Record<WorkspacePlanTier, string> = {
  FREE: 'Gratuito (FREE)',
  PRO: 'Pro',
  DESPACHO: 'Despacho',
  ENTERPRISE: 'Empresarial'
};

export interface SuperAdminQuotaCardProps {
  workspaceId: string;
  userId?: string;
  canEdit: boolean;
  onStateChange?: (state: { isDirty: boolean; isSaving: boolean }) => void;
}

export function SuperAdminQuotaCard({ workspaceId, userId, canEdit, onStateChange }: SuperAdminQuotaCardProps) {
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const planTierId = `${baseId}-planTier`;
  const maxCompaniesId = `${baseId}-maxCompanies`;
  const maxCfdisId = `${baseId}-maxCfdisPerMonth`;
  const maxStorageId = `${baseId}-maxStorageMb`;
  const storageHintId = `${baseId}-maxStorageMb-hint`;
  const validationErrorId = `${baseId}-validation-error`;
  const notesId = `${baseId}-notes`;

  const {
    quotaQuery, planTier, setPlanTier, maxCompaniesInput, setMaxCompaniesInput,
    maxCfdisInput, setMaxCfdisInput, maxStorageInput, setMaxStorageInput,
    notes, setNotes, isDirty, companiesValid, cfdisValid, storageValid,
    validationError, isValid, isSaving, handleSubmit, applyPlanPreset, handleDiscard
  } = useWorkspaceQuotaForm({ workspaceId, userId, canEdit });

  useEffect(() => {
    onStateChange?.({ isDirty, isSaving });
  }, [isDirty, isSaving, onStateChange]);

  const disabled = !canEdit || quotaQuery.isLoading || quotaQuery.isError || isSaving;
  const saveTitle = !canEdit
    ? 'Permiso de solo lectura: no tienes autorización para modificar cuotas'
    : quotaQuery.isError
      ? 'Reintenta cargar la cuota actual antes de guardar'
      : !isValid && validationError
        ? validationError
        : !isDirty
          ? 'No hay cambios pendientes por guardar'
          : undefined;

  return (
    <section
      aria-labelledby={headingId}
      className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <Gauge className="w-4 h-4 text-blue-600" aria-hidden="true" />
          Cuotas y Plan del Despacho
        </h3>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              disabled={disabled}
              onClick={applyPlanPreset}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-semibold text-slate-700 transition cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-blue-600" aria-hidden="true" />
              Aplicar sugeridos del plan
            </button>
          )}
          {quotaQuery.isLoading && (
            <span role="status" className="text-[11px] text-slate-600">Cargando cuota...</span>
          )}
        </div>
      </div>

      {!canEdit && (
        <AlertBanner tone="warning" icon={<Lock className="w-3.5 h-3.5" aria-hidden="true" />}>
          Permiso de solo lectura: no tienes autorización para modificar cuotas o planes.
        </AlertBanner>
      )}

      {quotaQuery.isError && (
        <AdminErrorBanner
          message="No se pudo consultar la cuota actual del despacho."
          onRetry={() => void quotaQuery.refetch()}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField htmlFor={planTierId} label="Plan">
            <Select
              size="sm"
              id={planTierId}
              name="planTier"
              value={planTier}
              onChange={(e) => setPlanTier(e.target.value as WorkspacePlanTier)}
              disabled={disabled}
              className="font-semibold"
            >
              {PLAN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{PLAN_LABELS[opt.value]}</option>
              ))}
            </Select>
          </FormField>

          <FormField htmlFor={maxCompaniesId} label="Máx. empresas (RFC)">
            <Input
              size="sm"
              id={maxCompaniesId}
              name="maxCompanies"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_COMPANIES_LIMIT}
              value={maxCompaniesInput}
              onChange={(e) => setMaxCompaniesInput(e.target.value)}
              aria-invalid={!companiesValid}
              aria-describedby={validationError ? validationErrorId : undefined}
              disabled={disabled}
              className="font-mono tabular-nums"
            />
          </FormField>

          <FormField htmlFor={maxCfdisId} label="Máx. CFDIs / mes">
            <Input
              size="sm"
              id={maxCfdisId}
              name="maxCfdisPerMonth"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_CFDIS_LIMIT}
              value={maxCfdisInput}
              onChange={(e) => setMaxCfdisInput(e.target.value)}
              aria-invalid={!cfdisValid}
              aria-describedby={validationError ? validationErrorId : undefined}
              disabled={disabled}
              className="font-mono tabular-nums"
            />
          </FormField>

          <FormField htmlFor={maxStorageId} label="Almacenamiento (MB)" hint="Mín. 10 MB">
            <Input
              size="sm"
              id={maxStorageId}
              name="maxStorageMb"
              type="number"
              inputMode="numeric"
              min={10}
              max={MAX_STORAGE_MB_LIMIT}
              value={maxStorageInput}
              onChange={(e) => setMaxStorageInput(e.target.value)}
              aria-invalid={!storageValid}
              aria-describedby={validationError ? `${storageHintId} ${validationErrorId}` : storageHintId}
              disabled={disabled}
              className="font-mono tabular-nums"
            />
          </FormField>
        </div>

        {validationError && (
          <p id={validationErrorId} role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
            {validationError}
          </p>
        )}

        <FormField htmlFor={notesId} label="Notas operativas">
          <textarea
            id={notesId}
            name="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={disabled}
            placeholder="Acuerdo comercial, vigencia o exención temporal..."
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs disabled:bg-slate-100 disabled:text-slate-600 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
          />
        </FormField>

        <div className="flex flex-wrap justify-end gap-2">
          {isDirty && canEdit && (
            <Button
              variant="secondary"
              size="sm"
              disabled={isSaving}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />}
              onClick={handleDiscard}
            >
              Descartar
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={disabled || !isDirty || !isValid}
            loading={isSaving}
            title={saveTitle}
            leftIcon={
              isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
              )
            }
          >
            {isSaving ? 'Guardando...' : 'Guardar Cuota'}
          </Button>
        </div>
      </form>
    </section>
  );
}
