import { AlertTriangle, CheckCircle2, RotateCcw, Save, Sparkles } from 'lucide-react';
import { REGIMENES_FISCALES_SAT } from '../../shared/sat-constants';
import type { Company } from '../../shared/types';
import { AccountingRulesCard } from './AccountingRulesCard';
import { AjustesEmpresaComplianceCards } from './AjustesEmpresaComplianceCards';

export interface AjustesEmpresaTabProps {
  activeCompany: Company;
  compName: string;
  setCompName: (v: string) => void;
  compRfc: string;
  setCompRfc: (v: string) => void;
  compRegimen: string;
  setCompRegimen: (v: string) => void;
  compCp: string;
  setCompCp: (v: string) => void;
  compMask: string;
  isRfcValid: boolean;
  isCpValid: boolean;
  isCompanyDirty: boolean;
  onResetCompany: () => void;
  rfcModulo11: { isValidCheckDigit: boolean; expectedCheckDigit?: string | null; expectedRfc?: string | null } | null;
  updateCompanyMutation: { mutate: () => void; isPending: boolean };
  periodLock?: { isLocked: boolean } | null;
  togglePeriodLockMutation: { mutate: (lock: boolean) => void; isPending: boolean };
}

export function AjustesEmpresaTab({
  activeCompany,
  compName,
  setCompName,
  compRfc,
  setCompRfc,
  compRegimen,
  setCompRegimen,
  compCp,
  setCompCp,
  compMask,
  isRfcValid,
  isCpValid,
  isCompanyDirty,
  onResetCompany,
  rfcModulo11,
  updateCompanyMutation,
  periodLock,
  togglePeriodLockMutation
}: AjustesEmpresaTabProps) {
  return (
    <section className="space-y-5">
      {/* Grid Equilibrado: Formulario Fiscal + Parámetros de Operación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Columna 1: Formulario de Identidad Fiscal Oficial (CSF) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateCompanyMutation.mutate();
          }}
          className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden flex flex-col justify-between"
        >
          <div>
            <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Ficha y Régimen Fiscal (Constancia de Situación Fiscal)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Modifica los datos fiscales conforme a tu CSF vigente emitida por el SAT.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Razón Social */}
              <div className="space-y-1">
                <label htmlFor="set-name" className="text-xs font-bold text-slate-700 block">
                  Razón Social o Denominación Oficial *
                </label>
                <input
                  id="set-name"
                  type="text"
                  required
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-blue-700 focus:border-blue-700 transition"
                  placeholder="Ej. TECNOLOGIAS NUBE DEL NORTE S.A. DE C.V."
                />
              </div>

              {/* Grid RFC y Código Postal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="space-y-1">
                  <div className="flex items-center justify-between flex-wrap gap-1 min-h-6">
                    <label htmlFor="set-rfc" className="text-xs font-bold text-slate-700">
                      RFC *
                    </label>
                    {isRfcValid && rfcModulo11 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {rfcModulo11.isValidCheckDigit ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" /> SAT Módulo 11 OK
                          </span>
                        ) : (
                          <>
                            <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" aria-hidden="true" /> SAT M11: {rfcModulo11.expectedCheckDigit}
                            </span>
                            {rfcModulo11.expectedRfc && (
                              <button
                                type="button"
                                onClick={() => setCompRfc(rfcModulo11.expectedRfc!)}
                                title={`Corregir dígito verificador SAT a ${rfcModulo11.expectedRfc}`}
                                aria-label={`Corregir dígito verificador del RFC a ${rfcModulo11.expectedRfc}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition shadow-xs cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3 text-blue-600" aria-hidden="true" />
                                Corregir
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    id="set-rfc"
                    type="text"
                    required
                    maxLength={13}
                    aria-invalid={!isRfcValid}
                    aria-describedby="set-rfc-help"
                    value={compRfc}
                    onChange={(e) => setCompRfc(e.target.value.toUpperCase().replace(/[^A-Z0-9&Ñ]/g, ''))}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold tracking-wider uppercase focus:outline-blue-700 ${
                      isRfcValid
                        ? rfcModulo11?.isValidCheckDigit
                          ? 'border-emerald-300 bg-emerald-50/20 text-emerald-900'
                          : 'border-amber-300 bg-amber-50/20 text-slate-900'
                        : 'border-amber-300 text-slate-800'
                    }`}
                    placeholder="BBA830831LJ2"
                  />
                  <p id="set-rfc-help" className="text-[11px] font-mono text-slate-600">
                    {compRfc.length}/12 PM ó 13 PF {isRfcValid ? '· Formato SAT válido' : '· Estructura incompleta'}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center min-h-6">
                    <label htmlFor="set-cp" className="text-xs font-bold text-slate-700 block">
                      Código Postal Fiscal (CSF) *
                    </label>
                  </div>
                  <input
                    id="set-cp"
                    type="text"
                    inputMode="numeric"
                    required
                    pattern="\d{5}"
                    maxLength={5}
                    aria-invalid={!isCpValid}
                    aria-describedby="set-cp-help"
                    value={compCp}
                    onChange={(e) => setCompCp(e.target.value.replace(/\D/g, ''))}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold text-slate-900 focus:outline-blue-700 ${
                      isCpValid ? 'border-slate-300' : 'border-red-300 bg-red-50/30'
                    }`}
                    placeholder="64000"
                  />
                  <p
                    id="set-cp-help"
                    className={`text-[11px] ${isCpValid ? 'text-slate-600' : 'text-red-700 font-semibold'}`}
                  >
                    {isCpValid ? 'C.P. fiscal de 5 dígitos conforme a CSF' : `Debe tener 5 dígitos (${compCp.length}/5)`}
                  </p>
                </div>
              </div>

              {/* Régimen Fiscal */}
              <div className="space-y-1">
                <label htmlFor="set-regimen" className="text-xs font-bold text-slate-700 block">
                  Régimen Fiscal (Catálogo SAT c_RegimenFiscal) *
                </label>
                <select
                  id="set-regimen"
                  value={compRegimen}
                  onChange={(e) => setCompRegimen(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:outline-blue-700 cursor-pointer font-medium"
                >
                  {REGIMENES_FISCALES_SAT.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-600 font-medium">
                {!isRfcValid
                  ? 'Ingresa un RFC válido (12 o 13 car.)'
                  : !isCpValid
                  ? 'C.P. debe tener 5 dígitos'
                  : isCompanyDirty
                  ? 'Hay cambios pendientes por guardar'
                  : 'Identidad fiscal al día'}
              </span>
              {isCompanyDirty && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  Cambios sin guardar
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {isCompanyDirty && (
                <button
                  type="button"
                  onClick={onResetCompany}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Restablecer
                </button>
              )}
              <button
                type="submit"
                disabled={updateCompanyMutation.isPending || !isRfcValid || !isCpValid || !isCompanyDirty}
                aria-busy={updateCompanyMutation.isPending}
                title={
                  !isRfcValid || !isCpValid
                    ? 'Verifica que RFC y Código Postal sean válidos'
                    : !isCompanyDirty
                    ? 'No hay modificaciones pendientes por guardar'
                    : undefined
                }
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{updateCompanyMutation.isPending ? 'Guardando...' : 'Guardar Datos Fiscales'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Columna 2: Candado de Periodo + Estructura Contable + Garantía SAT */}
        <AjustesEmpresaComplianceCards
          activeCompany={activeCompany}
          compMask={compMask}
          periodLock={periodLock}
          togglePeriodLockMutation={togglePeriodLockMutation}
        />
      </div>

      {/* Reglas Contables Aprendidas por RFC / ClaveProdServ y No Deducibles (801) */}
      <AccountingRulesCard companyId={activeCompany.id} />
    </section>
  );
}
