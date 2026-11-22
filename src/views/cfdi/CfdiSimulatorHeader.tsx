import { X } from 'lucide-react';
import type { Company } from '../../shared/types';
import type { CfdiSimulatorPreset } from './useCfdiSimulatorForm';

interface CfdiSimulatorHeaderProps {
  activeCompany?: Company | null;
  currentYear: number;
  currentPeriod: number;
  onClose: () => void;
  onApplyPreset: (preset: CfdiSimulatorPreset) => void;
}

export function CfdiSimulatorHeader({
  activeCompany,
  currentYear,
  currentPeriod,
  onClose,
  onApplyPreset
}: CfdiSimulatorHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 id="modal-sim-cfdi-title" className="text-base font-bold text-slate-900">
            Registro de Comprobante CFDI 4.0 / Retenciones / REP 2.0
          </h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-slate-600">
            <span className="font-bold text-slate-800">{activeCompany?.name}</span>
            <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 text-[11px] font-bold">
              {activeCompany?.rfc}
            </span>
            <span className="text-slate-400">•</span>
            <span className="font-mono text-[11px] text-blue-700 font-semibold">
              Periodo P{String(currentPeriod).padStart(2, '0')}/{currentYear}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Plantillas rápidas de prueba */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onApplyPreset('NORMAL')}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 cursor-pointer"
        >
          1. Factura Gasto Normal (16% IVA)
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset('HONORARIOS_RET')}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 cursor-pointer"
        >
          2. Honorarios con Retención ISR e IVA
        </button>
        <button
          type="button"
          onClick={() => onApplyPreset('REP_PAGO')}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 cursor-pointer"
        >
          3. Complemento de Pago REP 2.0 (Tipo P)
        </button>
      </div>
    </>
  );
}
