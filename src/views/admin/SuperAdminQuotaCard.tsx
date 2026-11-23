import { useId } from 'react';
import { Gauge, Lock, RotateCcw, Save, Sparkles } from 'lucide-react';
import type { WorkspacePlanTier } from '../../shared/admin-types';
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
}

export function SuperAdminQuotaCard({ workspaceId, userId, canEdit }: SuperAdminQuotaCardProps) {
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const planTierId = `${baseId}-planTier`;
  const maxCompaniesId = `${baseId}-maxCompanies`;
  const maxCfdisId = `${baseId}-maxCfdisPerMonth`;
  const maxStorageId = `${baseId}-maxStorageMb`;
  const storageHintId = `${baseId}-maxStorageMb-hint`;
  const notesId = `${baseId}-notes`;

  const {
    quotaQuery, planTier, setPlanTier, maxCompaniesInput, setMaxCompaniesInput,
    maxCfdisInput, setMaxCfdisInput, maxStorageInput, setMaxStorageInput,
    notes, setNotes, isDirty, companiesValid, cfdisValid, storageValid,
    validationError, isValid, isSaving, handleSubmit, applyPlanPreset, handleDiscard
  } = useWorkspaceQuotaForm({ workspaceId, userId, canEdit });

  const disabled = !canEdit || quotaQuery.isLoading || isSaving;

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
          No se pudo consultar la cuota actual del despacho.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="text-xs">
            <label htmlFor={planTierId} className="font-semibold text-slate-700 block mb-1">Plan</label>
            <select
              id={planTierId}
              name="planTier"
              value={planTier}
              onChange={(e) => setPlanTier(e.target.value as WorkspacePlanTier)}
              disabled={disabled}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-600"
            >
              {PLAN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{PLAN_LABELS[opt.value]}</option>
              ))}
            </select>
          </div>

          <div className="text-xs">
            <label htmlFor={maxCompaniesId} className="font-semibold text-slate-700 block mb-1">Máx. empresas (RFC)</label>
            <input
              id={maxCompaniesId}
              name="maxCompanies"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_COMPANIES_LIMIT}
              value={maxCompaniesInput}
              onChange={(e) => setMaxCompaniesInput(e.target.value)}
              aria-invalid={!companiesValid}
              disabled={disabled}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs tabular-nums disabled:bg-slate-100 disabled:text-slate-600"
            />
          </div>

          <div className="text-xs">
            <label htmlFor={maxCfdisId} className="font-semibold text-slate-700 block mb-1">Máx. CFDIs / mes</label>
            <input
              id={maxCfdisId}
              name="maxCfdisPerMonth"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_CFDIS_LIMIT}
              value={maxCfdisInput}
              onChange={(e) => setMaxCfdisInput(e.target.value)}
              aria-invalid={!cfdisValid}
              disabled={disabled}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs tabular-nums disabled:bg-slate-100 disabled:text-slate-600"
            />
          </div>

          <div className="text-xs">
            <label htmlFor={maxStorageId} className="font-semibold text-slate-700 block mb-1">Almacenamiento (MB)</label>
            <input
              id={maxStorageId}
              name="maxStorageMb"
              type="number"
              inputMode="numeric"
              min={10}
              max={MAX_STORAGE_MB_LIMIT}
              value={maxStorageInput}
              onChange={(e) => setMaxStorageInput(e.target.value)}
              aria-invalid={!storageValid}
              aria-describedby={storageHintId}
              disabled={disabled}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs tabular-nums disabled:bg-slate-100 disabled:text-slate-600"
            />
            <p id={storageHintId} className="text-[11px] text-slate-600 mt-1">Mín. 10 MB</p>
          </div>
        </div>

        {validationError && (
          <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
            {validationError}
          </p>
        )}

        <div className="text-xs">
          <label htmlFor={notesId} className="font-semibold text-slate-700 block mb-1">Notas operativas</label>
          <textarea
            id={notesId}
            name="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={disabled}
            placeholder="Acuerdo comercial, vigencia o exención temporal..."
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs disabled:bg-slate-100 disabled:text-slate-600"
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {isDirty && canEdit && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleDiscard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Descartar
            </button>
          )}
          <button
            type="submit"
            disabled={disabled || !isDirty || !isValid}
            title={!isValid && validationError ? validationError : !isDirty ? 'No hay cambios pendientes por guardar' : undefined}
            aria-busy={isSaving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            {isSaving ? 'Guardando...' : 'Guardar Cuota'}
          </button>
        </div>
      </form>
    </section>
  );
}
