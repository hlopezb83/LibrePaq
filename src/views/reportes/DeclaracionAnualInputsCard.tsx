import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, Lock, Save } from 'lucide-react';
import type { AnnualTaxInputs, AnnualTaxRegimeType, SaveAnnualTaxInputsPayload } from '../../shared/types/annual-tax.types';

interface DeclaracionAnualInputsCardProps {
  inputs: AnnualTaxInputs;
  tipoRegimenAnual: AnnualTaxRegimeType;
  isSaving: boolean;
  isReadOnly?: boolean;
  onSave: (payload: SaveAnnualTaxInputsPayload) => void;
}

type InputFieldKey = keyof Omit<AnnualTaxInputs, 'companyId' | 'ejercicio' | 'updatedAt'>;

interface InputFieldConfig {
  key: InputFieldKey;
  label: string;
  step: string;
  unit: 'Índice' | 'MXN $';
  hint: string;
  pmOnly?: boolean;
}

const FIELDS: ReadonlyArray<InputFieldConfig> = [
  { key: 'inpcCierreAnterior', label: 'INPC Dic. Anterior', step: '0.001', unit: 'Índice', hint: 'Art. 44 LISR', pmOnly: true },
  { key: 'inpcCierreActual', label: 'INPC Dic. Ejercicio', step: '0.001', unit: 'Índice', hint: 'INEGI DOF', pmOnly: true },
  { key: 'ptuPagadaAnterior', label: 'PTU Pagada en Ejercicio', step: '0.01', unit: 'MXN $', hint: 'Art. 9 Fracc. I' },
  { key: 'noDeduciblesManual', label: 'No Deducibles Manuales', step: '0.01', unit: 'MXN $', hint: 'Art. 28 LISR' },
  { key: 'cucaInicial', label: 'CUCA Inicial', step: '0.01', unit: 'MXN $', hint: 'Art. 78 LISR', pmOnly: true },
  { key: 'aportacionesCapital', label: 'Aportaciones de Capital', step: '0.01', unit: 'MXN $', hint: 'Incrementa CUCA', pmOnly: true },
  { key: 'reduccionesCapital', label: 'Reducciones de Capital', step: '0.01', unit: 'MXN $', hint: 'Disminuye CUCA', pmOnly: true },
  { key: 'cufinInicial', label: 'CUFIN Inicial', step: '0.01', unit: 'MXN $', hint: 'Art. 77 LISR', pmOnly: true },
  { key: 'dividendosPagados', label: 'Dividendos Pagados', step: '0.01', unit: 'MXN $', hint: 'Disminuye CUFIN', pmOnly: true }
];

function buildDrafts(inputs: AnnualTaxInputs): Record<InputFieldKey, string> {
  return {
    inpcCierreAnterior: String(inputs.inpcCierreAnterior),
    inpcCierreActual: String(inputs.inpcCierreActual),
    cucaInicial: String(inputs.cucaInicial),
    aportacionesCapital: String(inputs.aportacionesCapital),
    reduccionesCapital: String(inputs.reduccionesCapital),
    cufinInicial: String(inputs.cufinInicial),
    dividendosPagados: String(inputs.dividendosPagados),
    ptuPagadaAnterior: String(inputs.ptuPagadaAnterior),
    noDeduciblesManual: String(inputs.noDeduciblesManual)
  };
}

function parseDraftNumber(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatUpdatedAt(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

export function DeclaracionAnualInputsCard({
  inputs,
  tipoRegimenAnual,
  isSaving,
  isReadOnly = false,
  onSave
}: DeclaracionAnualInputsCardProps) {
  const [drafts, setDrafts] = useState<Record<InputFieldKey, string>>(() => buildDrafts(inputs));
  const [validationError, setValidationError] = useState<string | null>(null);

  const isPersonaFisica = tipoRegimenAnual === 'PF_RESICO' || tipoRegimenAnual === 'PF_ART152';
  const isPfResico = tipoRegimenAnual === 'PF_RESICO';
  const visibleFields = useMemo(
    () => (isPfResico ? [] : isPersonaFisica ? FIELDS.filter((f) => !f.pmOnly) : FIELDS),
    [isPfResico, isPersonaFisica]
  );

  useEffect(() => {
    setDrafts(buildDrafts(inputs));
    setValidationError(null);
  }, [inputs]);

  const isDirty = useMemo(
    () => visibleFields.some((field) => parseDraftNumber(drafts[field.key]) !== inputs[field.key]),
    [drafts, inputs, visibleFields]
  );

  const lastSavedText = formatUpdatedAt(inputs.updatedAt);

  if (isPfResico) {
    return (
      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 text-xs text-slate-700">
        <strong className="text-slate-900 block mb-0.5">RESICO Persona Física (Art. 113-F LISR)</strong>
        El cálculo anual se determina directamente sobre los ingresos efectivamente cobrados (sin ajuste por inflación INPC, CUCA ni CUFIN).
      </div>
    );
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    const inpcAnt = parseDraftNumber(drafts.inpcCierreAnterior);
    const inpcAct = parseDraftNumber(drafts.inpcCierreActual);
    if (!isPersonaFisica && (inpcAnt <= 0 || inpcAct <= 0)) {
      setValidationError('Los índices INPC de cierre anterior y del ejercicio deben ser mayores a 0.');
      return;
    }
    setValidationError(null);
    onSave({
      companyId: inputs.companyId,
      ejercicio: inputs.ejercicio,
      inpcCierreAnterior: inpcAnt,
      inpcCierreActual: inpcAct,
      cucaInicial: parseDraftNumber(drafts.cucaInicial),
      aportacionesCapital: parseDraftNumber(drafts.aportacionesCapital),
      reduccionesCapital: parseDraftNumber(drafts.reduccionesCapital),
      cufinInicial: parseDraftNumber(drafts.cufinInicial),
      dividendosPagados: parseDraftNumber(drafts.dividendosPagados),
      ptuPagadaAnterior: parseDraftNumber(drafts.ptuPagadaAnterior),
      noDeduciblesManual: parseDraftNumber(drafts.noDeduciblesManual)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              {isPersonaFisica
                ? `Parámetros Anuales Persona Física (${inputs.ejercicio})`
                : `Parámetros Anuales, INPC, CUCA y CUFIN (${inputs.ejercicio})`}
            </h3>
            {isDirty && (
              <span role="status" className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Cambios sin guardar
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600">
            Captura los saldos para recalcular la Declaración Anual.
            {lastSavedText && <span className="ml-1.5 font-medium text-slate-700">• Último guardado: {lastSavedText}</span>}
          </p>
        </div>
        <button
          type="submit"
          disabled={isSaving || isReadOnly}
          aria-busy={isSaving}
          title={isReadOnly ? 'Modo solo lectura' : undefined}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isSaving ? 'Guardando...' : 'Guardar y Recalcular'}</span>
        </button>
      </div>

      {isReadOnly && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          <Lock className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
          <span>Modo solo lectura: los parámetros anuales no pueden modificarse en esta sesión.</span>
        </div>
      )}

      {validationError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {visibleFields.map((field) => {
          const inputId = `annual-input-${field.key}`;
          const hintId = `${inputId}-hint`;
          const isInpcInvalid =
            !isPersonaFisica &&
            (field.key === 'inpcCierreAnterior' || field.key === 'inpcCierreActual') &&
            parseDraftNumber(drafts[field.key]) <= 0;
          return (
            <div key={field.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={inputId} className="text-xs font-semibold text-slate-800">{field.label}</label>
                <span id={hintId} className="text-[11px] font-medium text-slate-600">{field.unit} • {field.hint}</span>
              </div>
              <input
                id={inputId}
                type="number"
                inputMode="decimal"
                min={field.key.startsWith('inpc') ? '0.001' : '0'}
                step={field.step}
                disabled={isReadOnly}
                aria-invalid={isInpcInvalid || undefined}
                aria-describedby={hintId}
                value={drafts[field.key]}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  setValidationError(null);
                  setDrafts((prev) => ({ ...prev, [field.key]: nextVal }));
                }}
                className={`w-full px-3 py-2 rounded-xl border bg-slate-50/50 focus:bg-white focus:border-blue-500 text-xs font-mono tabular-nums text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 ${
                  isInpcInvalid ? 'border-red-500' : 'border-slate-300'
                }`}
              />
            </div>
          );
        })}
      </div>

      <div className="sm:hidden pt-1">
        <button
          type="submit"
          disabled={isSaving || isReadOnly}
          aria-busy={isSaving}
          title={isReadOnly ? 'Modo solo lectura' : undefined}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isSaving ? 'Guardando...' : 'Guardar y Recalcular'}</span>
        </button>
      </div>
    </form>
  );
}
