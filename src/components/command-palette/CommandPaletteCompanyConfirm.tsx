import { useState } from 'react';
import { AlertTriangle, ArrowLeft, Building2, ShieldCheck } from 'lucide-react';
import type { Company } from '../../shared/types';

interface CommandPaletteCompanyConfirmProps {
  activeCompany: Company | null;
  targetCompany: Company;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CommandPaletteCompanyConfirm({
  activeCompany,
  targetCompany,
  onCancel,
  onConfirm
}: CommandPaletteCompanyConfirmProps) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="p-4 sm:p-5 space-y-4 bg-white">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Confirmar Cambio de Empresa (RFC)
          </h3>
          <p className="text-xs text-slate-600">
            Verifica que el RFC de destino corresponda a la contabilidad que vas a operar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        {activeCompany && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              Empresa Actual
            </span>
            <span className="font-bold text-slate-800 block truncate">{activeCompany.name}</span>
            <span className="font-mono text-[11px] text-slate-600 block">
              RFC: {activeCompany.rfc}
            </span>
          </div>
        )}
        <div className="p-3 rounded-xl bg-blue-50/70 border-2 border-blue-600 space-y-0.5">
          <span className="text-[10px] font-bold uppercase text-blue-800 block">
            Empresa Destino
          </span>
          <span className="font-bold text-slate-900 block truncate">{targetCompany.name}</span>
          <span className="font-mono text-[11px] font-bold text-blue-900 block">
            RFC: {targetCompany.rfc}
          </span>
        </div>
      </div>

      <label
        htmlFor="cmd-switch-rfc-confirm"
        className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 cursor-pointer select-none"
      >
        <input
          id="cmd-switch-rfc-confirm"
          type="checkbox"
          autoFocus
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-amber-400 text-blue-700 focus:ring-blue-600 cursor-pointer"
        />
        <span className="font-semibold leading-snug">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 inline mr-1 -mt-0.5" aria-hidden="true" />
          Confirmo que deseo cambiar la sesión contable al RFC{' '}
          <strong className="font-mono text-blue-900">{targetCompany.rfc}</strong>.
        </span>
      </label>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Volver
        </button>
        <button
          type="button"
          disabled={!confirmed}
          onClick={onConfirm}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
        >
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          Confirmar y Cambiar Empresa
        </button>
      </div>
    </div>
  );
}
