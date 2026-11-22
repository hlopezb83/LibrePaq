import { AlertTriangle, CheckCircle2, FolderTree, Lock, LockOpen, Save, ShieldCheck, Sparkles } from 'lucide-react';
import { REGIMENES_FISCALES_SAT } from '../../shared/sat-catalog';
import type { Company } from '../../shared/types';

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
                    value={compRfc}
                    onChange={(e) => setCompRfc(e.target.value.toUpperCase().replace(/[^A-Z0-9&Ñ]/g, ''))}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold tracking-wider uppercase focus:outline-blue-700 ${
                      isRfcValid
                        ? rfcModulo11?.isValidCheckDigit
                          ? 'border-emerald-300 bg-emerald-50/20 text-emerald-900'
                          : 'border-amber-300 bg-amber-50/20 text-slate-900'
                        : 'border-slate-300 text-slate-800'
                    }`}
                    placeholder="BBA830831LJ2"
                  />
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
                    required
                    maxLength={5}
                    value={compCp}
                    onChange={(e) => setCompCp(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-blue-700"
                    placeholder="64000"
                  />
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
            <span className="text-[11px] text-slate-600 font-medium">
              {isRfcValid ? 'Estructura SAT válida' : 'Ingresa un RFC válido (12 o 13 car.)'}
            </span>
            <button
              type="submit"
              disabled={updateCompanyMutation.isPending || !isRfcValid}
              aria-busy={updateCompanyMutation.isPending}
              title={!isRfcValid ? 'Ingresa un RFC válido de 12 o 13 caracteres para guardar' : undefined}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ml-auto"
            >
              <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{updateCompanyMutation.isPending ? 'Guardando...' : 'Guardar Datos Fiscales'}</span>
            </button>
          </div>
        </form>

        {/* Columna 2: Candado de Periodo + Estructura Contable + Garantía SAT */}
        <div className="space-y-5">
          {/* Tarjeta: Candado Fiscal de Periodo */}
          <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Lock className="w-4 h-4 text-blue-700" />
                <span>Control y Candado Fiscal</span>
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                P{String(activeCompany.currentPeriod).padStart(2, '0')}/{activeCompany.currentYear}
              </span>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Protege los registros contables contra modificaciones accidentales una vez presentada la declaración del mes ante el SAT.
              </p>

              <div
                className={`p-4 rounded-xl border ${
                  periodLock?.isLocked
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  {periodLock?.isLocked ? (
                    <>
                      <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>PERIODO BLOQUEADO (SOLO LECTURA)</span>
                    </>
                  ) : (
                    <>
                      <LockOpen className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>PERIODO ABIERTO PARA CAPTURA</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] mt-1 text-slate-600">
                  {periodLock?.isLocked
                    ? `El periodo ${activeCompany.currentPeriod}/${activeCompany.currentYear} se encuentra protegido contra altas, bajas o modificaciones.`
                    : `Permite registrar pólizas, importar CFDIs y conciliar movimientos bancarios libremente.`}
                </p>
              </div>

              <button
                type="button"
                disabled={togglePeriodLockMutation.isPending}
                onClick={() => togglePeriodLockMutation.mutate(!(periodLock?.isLocked ?? false))}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  periodLock?.isLocked
                    ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-2xs'
                    : 'bg-amber-600 hover:bg-amber-700 text-white border-transparent shadow-xs'
                }`}
              >
                {periodLock?.isLocked ? (
                  <>
                    <LockOpen className="w-4 h-4" />
                    Reabrir Periodo para Captura
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Bloquear Periodo Fiscal
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Tarjeta: Estructura y Máscara de Cuentas */}
          <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <FolderTree className="w-4 h-4 text-purple-700" />
              <span>Estructura y Catálogo Contable</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-700 block text-[11px]">Máscara Contable</span>
                <span className="font-mono font-bold text-blue-900 bg-white px-2 py-0.5 rounded border border-slate-300 inline-block mt-1">
                  {compMask}
                </span>
                <p className="text-[10px] text-slate-500 mt-1">
                  3 niveles estándar reglamentados por Anexo 24.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-700 block text-[11px]">Catálogo Oficial</span>
                <span className="text-slate-900 font-bold block mt-1">
                  SAT Anexo 24
                </span>
                <p className="text-[10px] text-slate-500 mt-1">
                  Compatible con CONTPAQi Contabilidad.
                </p>
              </div>
            </div>
          </div>

          {/* Tarjeta: Estándares Fiscales SAT */}
          <div className="bg-[#0A1120] text-white rounded-2xl p-5 shadow-sm border border-slate-800 space-y-3.5 text-xs">
            <div className="flex items-center gap-2 text-blue-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span className="uppercase tracking-wider text-[11px]">Garantía de Conformidad Fiscal</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              LibrePaq Pro opera bajo las especificaciones técnicas obligatorias del Servicio de Administración Tributaria.
            </p>

            <div className="space-y-2 pt-2 border-t border-slate-800 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Contabilidad Electrónica</span>
                <span className="font-mono font-bold text-white">Anexo 24 RMF (XML 1.3)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Comprobantes Fiscales</span>
                <span className="font-mono font-bold text-white">CFDI Versión 4.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Aritmética Monetaria</span>
                <span className="font-mono font-bold text-emerald-400">Exactitud al Centavo</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Validación de RFC</span>
                <span className="font-mono font-bold text-emerald-400">SAT Módulo 11 Oficial</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
