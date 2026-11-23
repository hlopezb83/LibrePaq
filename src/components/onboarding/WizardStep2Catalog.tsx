import { BookOpen, CreditCard, FileSpreadsheet } from 'lucide-react';

interface WizardStep2CatalogProps {
  catalogPreset: 'SAT_STANDARD' | 'RESICO_SIMPLIFIED' | 'CUSTOM';
  setCatalogPreset: (preset: 'SAT_STANDARD' | 'RESICO_SIMPLIFIED' | 'CUSTOM') => void;
}

export function WizardStep2Catalog({
  catalogPreset,
  setCatalogPreset
}: WizardStep2CatalogProps) {
  return (
    <fieldset className="space-y-3.5">
      <legend className="text-xs text-slate-600 mb-1">
        Selecciona la arquitectura de cuentas que mejor se adapte al régimen y giro del contribuyente:
      </legend>

      <label
        htmlFor="preset-sat-standard"
        className={`block p-3.5 rounded-2xl border-2 transition cursor-pointer ${
          catalogPreset === 'SAT_STANDARD'
            ? 'border-blue-600 bg-blue-50/50 shadow-xs'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 flex flex-wrap items-center gap-2">
                Catálogo General SAT Anexo 24
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-700 text-white">
                  Recomendado
                </span>
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                54 cuentas prediseñadas en 3 niveles con agrupadores oficiales listos para Balanza XML.
              </div>
            </div>
          </div>
          <input
            id="preset-sat-standard"
            type="radio"
            name="catalogPreset"
            checked={catalogPreset === 'SAT_STANDARD'}
            onChange={() => setCatalogPreset('SAT_STANDARD')}
            className="mt-1 text-blue-600 shrink-0"
          />
        </div>
      </label>

      <label
        htmlFor="preset-resico"
        className={`block p-3.5 rounded-2xl border-2 transition cursor-pointer ${
          catalogPreset === 'RESICO_SIMPLIFIED'
            ? 'border-blue-600 bg-blue-50/50 shadow-xs'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">
                Catálogo Simplificado RESICO / Servicios
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Especializado para flujo de efectivo, retenciones de ISR 1.25% e IVA 2/3.
              </div>
            </div>
          </div>
          <input
            id="preset-resico"
            type="radio"
            name="catalogPreset"
            checked={catalogPreset === 'RESICO_SIMPLIFIED'}
            onChange={() => setCatalogPreset('RESICO_SIMPLIFIED')}
            className="mt-1 text-blue-600 shrink-0"
          />
        </div>
      </label>

      <label
        htmlFor="preset-custom"
        className={`block p-3.5 rounded-2xl border-2 transition cursor-pointer ${
          catalogPreset === 'CUSTOM'
            ? 'border-blue-600 bg-blue-50/50 shadow-xs'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">
                Migración CONTPAQi / Catálogo Propio (.CSV)
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Se iniciará con la estructura base y podrás importar tu CSV desde el módulo de Catálogo.
              </div>
            </div>
          </div>
          <input
            id="preset-custom"
            type="radio"
            name="catalogPreset"
            checked={catalogPreset === 'CUSTOM'}
            onChange={() => setCatalogPreset('CUSTOM')}
            className="mt-1 text-blue-600 shrink-0"
          />
        </div>
      </label>
    </fieldset>
  );
}
