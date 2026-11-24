import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Lock, Save } from 'lucide-react';
import { AlertBanner, Button, Input, StatusBadge } from '../../components/ui';
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
  pfHint?: string;
  exampleNote?: string;
  pmOnly?: boolean;
  pfOnly?: boolean;
}

const FIELDS: ReadonlyArray<InputFieldConfig> = [
  { key: 'inpcCierreAnterior', label: 'INPC Dic. Anterior', step: '0.001', unit: 'Índice', hint: 'Art. 44 LISR', pmOnly: true },
  { key: 'inpcCierreActual', label: 'INPC Dic. Ejercicio', step: '0.001', unit: 'Índice', hint: 'INEGI DOF', pmOnly: true },
  { key: 'ptuPagadaAnterior', label: 'PTU Pagada en Ejercicio', step: '0.01', unit: 'MXN $', hint: 'Art. 9 Fracc. I', pfHint: 'Art. 109 LISR' },
  { key: 'noDeduciblesManual', label: 'No Deducibles Manuales', step: '0.01', unit: 'MXN $', hint: 'Art. 28 LISR', pfHint: 'Art. 109 / 148 LISR' },
  {
    key: 'deduccionesPersonales',
    label: 'Deducciones Personales',
    step: '0.01',
    unit: 'MXN $',
    hint: 'Art. 151 LISR (Tope 5 UMA / 15%)',
    exampleNote: 'Tope Art. 151: menor entre 5 UMA anuales o 15% de ingresos totales. Ej. honorarios médicos, hospitalarios, colegiaturas, gastos funerarios e intereses reales hipotecarios.',
    pfOnly: true
  },
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
    noDeduciblesManual: String(inputs.noDeduciblesManual),
    deduccionesPersonales: String(inputs.deduccionesPersonales ?? 0)
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
    () =>
      isPfResico
        ? []
        : isPersonaFisica
          ? FIELDS.filter((f) => !f.pmOnly)
          : FIELDS.filter((f) => !f.pfOnly),
    [isPfResico, isPersonaFisica]
  );

  useEffect(() => {
    setDrafts(buildDrafts(inputs));
    setValidationError(null);
  }, [inputs]);

  const isDirty = useMemo(
    () => visibleFields.some((field) => parseDraftNumber(drafts[field.key]) !== (inputs[field.key] ?? 0)),
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
      noDeduciblesManual: parseDraftNumber(drafts.noDeduciblesManual),
      deduccionesPersonales: parseDraftNumber(drafts.deduccionesPersonales)
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
              <span role="status">
                <StatusBadge tone="amber">Cambios sin guardar</StatusBadge>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600">
            Captura los saldos para recalcular la Declaración Anual.
            {lastSavedText && <span className="ml-1.5 font-medium text-slate-700">• Último guardado: {lastSavedText}</span>}
          </p>
        </div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isSaving}
          disabled={isReadOnly}
          title={isReadOnly ? 'Modo solo lectura' : undefined}
          leftIcon={<Save className="w-3.5 h-3.5" aria-hidden="true" />}
          className="hidden sm:inline-flex"
        >
          {isSaving ? 'Guardando...' : 'Guardar y Recalcular'}
        </Button>
      </div>

      {isReadOnly && (
        <AlertBanner tone="warning" icon={<Lock className="w-4 h-4" aria-hidden="true" />}>
          Modo solo lectura: los parámetros anuales no pueden modificarse en esta sesión.
        </AlertBanner>
      )}

      {validationError && (
        <AlertBanner tone="danger">
          <span className="font-semibold">{validationError}</span>
        </AlertBanner>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {visibleFields.map((field) => {
          const inputId = `annual-input-${field.key}`;
          const hintId = `${inputId}-hint`;
          const isInpcInvalid =
            !isPersonaFisica &&
            (field.key === 'inpcCierreAnterior' || field.key === 'inpcCierreActual') &&
            parseDraftNumber(drafts[field.key]) <= 0;
          const effectiveHint = isPersonaFisica && field.pfHint ? field.pfHint : field.hint;
          const noteId = field.exampleNote ? `${inputId}-note` : undefined;
          return (
            <div key={field.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={inputId} className="text-xs font-semibold text-slate-800">{field.label}</label>
                <span id={hintId} className="text-[11px] font-medium text-slate-600">{field.unit} • {effectiveHint}</span>
              </div>
              <Input
                id={inputId}
                type="number"
                inputMode="decimal"
                min={field.key.startsWith('inpc') ? '0.001' : '0'}
                step={field.step}
                disabled={isReadOnly}
                aria-invalid={isInpcInvalid || undefined}
                aria-describedby={noteId ? `${hintId} ${noteId}` : hintId}
                value={drafts[field.key]}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  setValidationError(null);
                  setDrafts((prev) => ({ ...prev, [field.key]: nextVal }));
                }}
                className={`bg-slate-50/50 focus:bg-white font-mono tabular-nums ${
                  isInpcInvalid ? 'border-red-500' : ''
                }`}
              />
              {field.exampleNote && (
                <p id={noteId} className="text-[11px] text-slate-600 leading-snug">
                  {field.exampleNote}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="sm:hidden pt-1">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isSaving}
          disabled={isReadOnly}
          title={isReadOnly ? 'Modo solo lectura' : undefined}
          leftIcon={<Save className="w-3.5 h-3.5" aria-hidden="true" />}
          className="w-full"
        >
          {isSaving ? 'Guardando...' : 'Guardar y Recalcular'}
        </Button>
      </div>
    </form>
  );
}
