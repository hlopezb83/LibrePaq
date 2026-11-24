import type { RfcModulo11Result } from '../../shared/accounting-engine';

interface WizardModulo11BreakdownProps {
  personType: 'MORAL' | 'FISICA';
  rfcModulo11: RfcModulo11Result;
}

export function WizardModulo11Breakdown({
  personType,
  rfcModulo11
}: WizardModulo11BreakdownProps) {
  return (
    <div className="p-3 bg-slate-50 text-slate-800 rounded-xl text-xs font-mono border border-slate-200">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 text-[11px] text-slate-700 font-sans font-bold">
        <span>Desglose de Validación SAT (Anexo 3)</span>
        <span className="text-amber-800">
          {personType === 'MORAL' ? 'Base Persona Moral (+481)' : 'Base Persona Física (0)'}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between text-[11px] text-slate-600 gap-2">
        <span>
          Suma Ponderada: <strong className="text-slate-900">{rfcModulo11.sum}</strong> | Residuo:{' '}
          <strong className="text-slate-900">{rfcModulo11.remainder}</strong>
        </span>
        <span>
          Dígito SAT Oficial:{' '}
          <strong className="text-blue-800 font-bold">{rfcModulo11.expectedCheckDigit}</strong>
        </span>
      </div>
    </div>
  );
}
