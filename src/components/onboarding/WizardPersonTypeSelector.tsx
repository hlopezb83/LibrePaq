import { Building2, CreditCard } from 'lucide-react';
import { REGIMENES_FISCALES_SAT } from '../../shared/sat-constants';

interface WizardPersonTypeSelectorProps {
  personType: 'MORAL' | 'FISICA';
  onSelectPersonType: (type: 'MORAL' | 'FISICA', defaultRegimen: string) => void;
}

export function WizardPersonTypeSelector({
  personType,
  onSelectPersonType
}: WizardPersonTypeSelectorProps) {
  return (
    <div>
      <span
        id="wizard-person-type-label"
        className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider"
      >
        Tipo de Contribuyente SAT
      </span>
      <div
        role="group"
        aria-labelledby="wizard-person-type-label"
        className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
      >
        <button
          type="button"
          aria-pressed={personType === 'MORAL'}
          onClick={() =>
            onSelectPersonType(
              'MORAL',
              REGIMENES_FISCALES_SAT[0] ?? '601 - General de Ley Personas Morales'
            )
          }
          className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
            personType === 'MORAL'
              ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-2xs'
              : 'border-slate-300 hover:border-slate-400 text-slate-700'
          }`}
        >
          <Building2
            className={`w-5 h-5 shrink-0 ${
              personType === 'MORAL' ? 'text-blue-700' : 'text-slate-500'
            }`}
            aria-hidden="true"
          />
          <div>
            <div className="text-xs font-bold">Persona Moral</div>
            <div className="text-[11px] text-slate-600">
              Empresas S.A., S.A.P.I., S. de R.L. (RFC 12)
            </div>
          </div>
        </button>

        <button
          type="button"
          aria-pressed={personType === 'FISICA'}
          onClick={() =>
            onSelectPersonType(
              'FISICA',
              '612 - Personas Físicas con Actividades Empresariales y Profesionales'
            )
          }
          className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
            personType === 'FISICA'
              ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-2xs'
              : 'border-slate-300 hover:border-slate-400 text-slate-700'
          }`}
        >
          <CreditCard
            className={`w-5 h-5 shrink-0 ${
              personType === 'FISICA' ? 'text-blue-700' : 'text-slate-500'
            }`}
            aria-hidden="true"
          />
          <div>
            <div className="text-xs font-bold">Persona Física</div>
            <div className="text-[11px] text-slate-600">
              Honorarios, RESICO, Actividad Emp. (RFC 13)
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
