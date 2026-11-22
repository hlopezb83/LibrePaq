import { AlertTriangle } from 'lucide-react';
import type { Company } from '../../shared/types';
import type { CompanyTheme } from './companyThemes';

interface CompanySwitchConfirmViewProps {
  activeCompany: Company | null;
  pendingTargetCompany: Company;
  currentTheme: CompanyTheme;
  targetTheme: CompanyTheme;
  hasAcknowledged: boolean;
  setHasAcknowledged: (val: boolean) => void;
}

export function CompanySwitchConfirmView({
  activeCompany,
  pendingTargetCompany,
  currentTheme,
  targetTheme,
  hasAcknowledged,
  setHasAcknowledged
}: CompanySwitchConfirmViewProps) {
  return (
    <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
      {/* Comparativa Visual De -> A */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Cambio de Contexto Fiscal
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          {/* Origen */}
          {activeCompany && (
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1 opacity-70">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Sesión que se cerrará:
              </span>
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-md ${currentTheme.bg} ${currentTheme.text} font-mono font-bold text-[10px] flex items-center justify-center shrink-0`}
                >
                  {activeCompany.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-slate-800 truncate">
                  {activeCompany.name}
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-600 block">
                RFC: {activeCompany.rfc}
              </span>
            </div>
          )}

          {/* Destino */}
          <div className="p-3 rounded-xl bg-blue-50/60 border-2 border-blue-600 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">
              Nueva Empresa Activa:
            </span>
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-md ${targetTheme.bg} ${targetTheme.text} font-mono font-bold text-[10px] flex items-center justify-center shrink-0 shadow-2xs`}
              >
                {pendingTargetCompany.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-slate-900 truncate">
                {pendingTargetCompany.name}
              </span>
            </div>
            <span className="font-mono text-[11px] font-bold text-blue-900 block">
              RFC: {pendingTargetCompany.rfc}
            </span>
          </div>
        </div>
      </div>

      {/* Alerta de Responsabilidad Contable */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wide text-amber-900">
              Verificación Obligatoria de Cambio de Entidad Fiscal
            </h3>
            <p className="text-xs text-amber-900/90 leading-relaxed">
              Asegúrate de que tus comprobantes digitales (CFDI 4.0), XMLs de nómina, estados de cuenta bancarios y pólizas correspondan estrictamente a{' '}
              <strong>{pendingTargetCompany.name}</strong> con RFC{' '}
              <strong className="font-mono">{pendingTargetCompany.rfc}</strong>.
            </p>
            <p className="text-[11px] text-amber-800">
              Trabajar en la empresa equivocada puede distorsionar la Contabilidad Electrónica y generar discrepancias en las declaraciones definitivas ante el SAT.
            </p>
          </div>
        </div>

        {/* Checkbox Obligatorio para Habilitar el Cambio */}
        <label htmlFor="switch-company-ack" className="flex items-start gap-2.5 pt-2 border-t border-amber-200 cursor-pointer select-none">
          <input
            id="switch-company-ack"
            type="checkbox"
            checked={hasAcknowledged}
            onChange={(e) => setHasAcknowledged(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-amber-400 text-blue-700 focus:ring-blue-600 cursor-pointer"
          />
          <span className="text-xs font-bold text-amber-950">
            He verificado y confirmo que deseo trabajar sobre la contabilidad del RFC{' '}
            <span className="font-mono text-blue-900">{pendingTargetCompany.rfc}</span>.
          </span>
        </label>
      </div>
    </div>
  );
}
