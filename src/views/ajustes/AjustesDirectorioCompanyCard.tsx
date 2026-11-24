import { ArrowRight, Building2, CheckCircle2, Trash2 } from 'lucide-react';
import { validateRfcModulo11 } from '../../shared/accounting-engine';
import type { Company } from '../../shared/types';

interface AjustesDirectorioCompanyCardProps {
  company: Company;
  isCurrent: boolean;
  companiesCount: number;
  canDeleteCompany: boolean;
  confirmDeleteCompany: boolean;
  setConfirmDeleteCompany: (val: boolean) => void;
  onSelectCompany: (company: Company) => void;
  onConfigureFicha: () => void;
  onRequestDeleteCompany: (company: Company) => void;
}

export function AjustesDirectorioCompanyCard({
  company: c,
  isCurrent,
  companiesCount,
  canDeleteCompany,
  confirmDeleteCompany,
  setConfirmDeleteCompany,
  onSelectCompany,
  onConfigureFicha,
  onRequestDeleteCompany
}: AjustesDirectorioCompanyCardProps) {
  const m11 = validateRfcModulo11(c.rfc);

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
        isCurrent
          ? 'bg-gradient-to-br from-emerald-50/50 via-white to-blue-50/40 border-emerald-300 ring-2 ring-emerald-500/30 shadow-xs'
          : 'bg-white border-slate-300/90 hover:border-slate-400 hover:shadow-xs'
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-slate-900 leading-snug">{c.name}</span>
              {isCurrent && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                  Activa en Uso
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 line-clamp-1">{c.regimenFiscal}</p>
          </div>

          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-slate-50 border-slate-200 text-slate-600">
            <Building2 className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono flex-wrap pt-1">
          <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-800 font-bold flex items-center gap-1">
            RFC: {c.rfc}
            {m11.isValidCheckDigit ? (
              <span title="Dígito verificador SAT Módulo 11 válido" className="text-emerald-700 text-[10px] ml-0.5 cursor-help">
                ✓ M11
              </span>
            ) : m11.expectedCheckDigit ? (
              <span
                title={`Dígito verificador SAT Módulo 11 esperado: ${m11.expectedCheckDigit}`}
                className="text-amber-700 text-[10px] ml-0.5 cursor-help"
              >
                ⚠ M11:{m11.expectedCheckDigit}
              </span>
            ) : null}
          </span>
          <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
            CP: {c.codigoPostal || 'Sin C.P.'}
          </span>
          <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
            Ejercicio: {c.currentYear}
          </span>
          <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
            Periodo: P{String(c.currentPeriod || 1).padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isCurrent ? (
            <>
              <span className="text-xs text-emerald-800 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Activa en uso
              </span>
              <button
                type="button"
                onClick={onConfigureFicha}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
              >
                <span>Configurar Ficha Fiscal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSelectCompany(c)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 shadow-2xs transition cursor-pointer"
            >
              <span>Abrir Empresa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!isCurrent && canDeleteCompany && (
            <button
              type="button"
              onClick={() => onRequestDeleteCompany(c)}
              aria-label={`Eliminar empresa ${c.name}`}
              title={`Eliminar empresa ${c.name}`}
              className="p-2 min-w-9 min-h-9 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {isCurrent && companiesCount > 1 && canDeleteCompany && (
            <button
              type="button"
              onClick={() => setConfirmDeleteCompany(!confirmDeleteCompany)}
              className="text-[11px] text-slate-500 hover:text-red-700 font-semibold underline cursor-pointer py-1"
            >
              Opciones de baja
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
