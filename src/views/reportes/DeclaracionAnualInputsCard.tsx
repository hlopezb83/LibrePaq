import { useEffect, useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import type { AnnualTaxInputs, SaveAnnualTaxInputsPayload } from '../../shared/types/annual-tax.types';

interface DeclaracionAnualInputsCardProps {
  inputs: AnnualTaxInputs;
  isSaving: boolean;
  isReadOnly?: boolean;
  onSave: (payload: SaveAnnualTaxInputsPayload) => void;
}

interface InputFieldConfig {
  key: keyof Omit<AnnualTaxInputs, 'companyId' | 'ejercicio' | 'updatedAt'>;
  label: string;
  step: string;
  hint: string;
}

const FIELDS: ReadonlyArray<InputFieldConfig> = [
  { key: 'inpcCierreAnterior', label: 'INPC Dic. Anterior', step: '0.001', hint: 'Art. 44 LISR' },
  { key: 'inpcCierreActual', label: 'INPC Dic. Ejercicio', step: '0.001', hint: 'INEGI DOF' },
  { key: 'ptuPagadaAnterior', label: 'PTU Pagada en Ejercicio', step: '0.01', hint: 'Art. 9 Fracc. I' },
  { key: 'noDeduciblesManual', label: 'No Deducibles Manuales', step: '0.01', hint: 'Art. 28 LISR' },
  { key: 'cucaInicial', label: 'CUCA Inicial', step: '0.01', hint: 'Art. 78 LISR' },
  { key: 'aportacionesCapital', label: 'Aportaciones de Capital', step: '0.01', hint: 'Incrementa CUCA' },
  { key: 'reduccionesCapital', label: 'Reducciones de Capital', step: '0.01', hint: 'Disminuye CUCA' },
  { key: 'cufinInicial', label: 'CUFIN Inicial', step: '0.01', hint: 'Art. 77 LISR' },
  { key: 'dividendosPagados', label: 'Dividendos Pagados', step: '0.01', hint: 'Disminuye CUFIN' }
];

export function DeclaracionAnualInputsCard({
  inputs,
  isSaving,
  isReadOnly = false,
  onSave
}: DeclaracionAnualInputsCardProps) {
  const [form, setForm] = useState<Omit<AnnualTaxInputs, 'companyId' | 'ejercicio' | 'updatedAt'>>({
    inpcCierreAnterior: inputs.inpcCierreAnterior,
    inpcCierreActual: inputs.inpcCierreActual,
    cucaInicial: inputs.cucaInicial,
    aportacionesCapital: inputs.aportacionesCapital,
    reduccionesCapital: inputs.reduccionesCapital,
    cufinInicial: inputs.cufinInicial,
    dividendosPagados: inputs.dividendosPagados,
    ptuPagadaAnterior: inputs.ptuPagadaAnterior,
    noDeduciblesManual: inputs.noDeduciblesManual
  });

  useEffect(() => {
    setForm({
      inpcCierreAnterior: inputs.inpcCierreAnterior,
      inpcCierreActual: inputs.inpcCierreActual,
      cucaInicial: inputs.cucaInicial,
      aportacionesCapital: inputs.aportacionesCapital,
      reduccionesCapital: inputs.reduccionesCapital,
      cufinInicial: inputs.cufinInicial,
      dividendosPagados: inputs.dividendosPagados,
      ptuPagadaAnterior: inputs.ptuPagadaAnterior,
      noDeduciblesManual: inputs.noDeduciblesManual
    });
  }, [inputs]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    onSave({
      companyId: inputs.companyId,
      ejercicio: inputs.ejercicio,
      ...form
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Parámetros Anuales, INPC, CUCA y CUFIN ({inputs.ejercicio})
          </h3>
          <p className="text-xs text-slate-600">
            Captura los saldos históricos y factores de cierre para recalcular la Declaración Anual.
          </p>
        </div>
        <button
          type="submit"
          disabled={isSaving || isReadOnly}
          title={isReadOnly ? 'Modo solo lectura' : undefined}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isSaving ? 'Guardando...' : 'Guardar y Recalcular'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {FIELDS.map((field) => {
          const inputId = `annual-input-${field.key}`;
          return (
            <div key={field.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={inputId} className="text-xs font-semibold text-slate-700">
                  {field.label}
                </label>
                <span className="text-[10px] font-medium text-slate-500">{field.hint}</span>
              </div>
              <input
                id={inputId}
                type="number"
                min="0"
                step={field.step}
                disabled={isReadOnly}
                value={form[field.key]}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    [field.key]: Number.isFinite(parsed) ? parsed : 0
                  }));
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:outline-none text-xs font-mono text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          );
        })}
      </div>
    </form>
  );
}
