import { Link } from '@tanstack/react-router';
import { ArrowRight, Coins, Loader2, RotateCcw, Save } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { sanitizeFiscalDecimalInput } from './useAjustesFiscalParams';

export interface AjustesFiscalTabProps {
  currentYear: number;
  currentPeriod: number;
  coefUtilidad: string;
  setCoefUtilidad: (v: string) => void;
  tcDof: string;
  setTcDof: (v: string) => void;
  perdidasAnt: string;
  setPerdidasAnt: (v: string) => void;
  pagosAnt: string;
  setPagosAnt: (v: string) => void;
  saldoIvaAnt: string;
  setSaldoIvaAnt: (v: string) => void;
  isFiscalDirty: boolean;
  onResetFiscal: () => void;
  saveFiscalParamsMutation: {
    mutate: () => void;
    isPending: boolean;
  };
  fiscalWp?: {
    isrProvisional: {
      ingresosAcumuladosEjercicio: number;
      utilidadFiscalEstimada: number;
      isrNetoAPagar: number;
    };
    ivaDefinitivo: {
      ivaNetoAPagar: number;
    };
  } | null;
  isLoadingFiscalWp?: boolean;
  isReadOnly?: boolean;
}

function normalizeDecimalDraft(raw: string, max?: number): string {
  const num = Number(raw.replaceAll(',', '.').trim());
  if (!Number.isFinite(num) || num < 0) return '0';
  return String(max !== undefined ? Math.min(max, num) : num);
}

export function AjustesFiscalTab({
  currentYear,
  currentPeriod,
  coefUtilidad,
  setCoefUtilidad,
  tcDof,
  setTcDof,
  perdidasAnt,
  setPerdidasAnt,
  pagosAnt,
  setPagosAnt,
  saldoIvaAnt,
  setSaldoIvaAnt,
  isFiscalDirty,
  onResetFiscal,
  saveFiscalParamsMutation,
  fiscalWp,
  isLoadingFiscalWp = false,
  isReadOnly = false
}: AjustesFiscalTabProps) {
  return (
    <section className="space-y-5">
      {isReadOnly && (
        <div role="status" className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950">
          Modo solo consulta: los parámetros fiscales están bloqueados para edición.
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isReadOnly) saveFiscalParamsMutation.mutate();
          }}
          className="lg:col-span-2 bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                Cálculo de Pagos Provisionales (LISR Art. 14 / RESICO)
              </h2>
              <p className="text-xs text-slate-600">
                Parámetros base utilizados para la Cédula Fiscal y determinación de impuestos a pagar el Día 17.
              </p>
            </div>

            <Link
              to="/fiscal-bancos"
              search={{ tab: 'DIA17' } as unknown as Record<string, string>}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition shrink-0"
            >
              Ver Cédula Día 17
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          {isLoadingFiscalWp ? (
            <div role="status" aria-live="polite" aria-busy="true" className="p-6 text-center text-xs text-slate-600 space-y-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 mx-auto" aria-hidden="true" />
              <p>Cargando parámetros fiscales del periodo...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="p-cu" className="text-xs font-bold text-slate-700 block">
                  Coeficiente de Utilidad (C.U. Art. 14 LISR) *
                </label>
                <div className="relative">
                  <input
                    id="p-cu"
                    type="text"
                    inputMode="decimal"
                    required
                    disabled={isReadOnly}
                    aria-describedby="p-cu-hint"
                    value={coefUtilidad}
                    onChange={(e) => setCoefUtilidad(sanitizeFiscalDecimalInput(e.target.value))}
                    onBlur={() => setCoefUtilidad(normalizeDecimalDraft(coefUtilidad, 1))}
                    className="w-full px-3 py-2 pr-12 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                  <span aria-hidden="true" className="pointer-events-none absolute right-3 top-2 text-[11px] text-slate-600 font-bold font-mono">
                    C.U.
                  </span>
                </div>
                <p id="p-cu-hint" className="text-[11px] text-slate-600">
                  Margen fiscal equivalente:{' '}
                  <strong className="font-mono text-slate-800">
                    {((Number(coefUtilidad) || 0) * 100).toFixed(2)}%
                  </strong>
                </p>
              </div>

              <div className="space-y-1">
                <label htmlFor="p-tc" className="text-xs font-bold text-slate-700 block">
                  Tipo de Cambio DOF al Cierre del Mes (USD/MXN) *
                </label>
                <div className="relative">
                  <input
                    id="p-tc"
                    type="text"
                    inputMode="decimal"
                    required
                    disabled={isReadOnly}
                    aria-describedby="p-tc-hint"
                    value={tcDof}
                    onChange={(e) => setTcDof(sanitizeFiscalDecimalInput(e.target.value))}
                    onBlur={() => setTcDof(normalizeDecimalDraft(tcDof))}
                    className="w-full px-3 py-2 pr-20 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                  <span aria-hidden="true" className="pointer-events-none absolute right-3 top-2 text-[11px] text-slate-600 font-bold font-mono">
                    MXN/USD
                  </span>
                </div>
                <p id="p-tc-hint" className="text-[11px] text-slate-600">
                  Para valuación de fluctuación cambiaria oficial (0 para empresas solo MXN).
                </p>
              </div>

              <div className="space-y-1">
                <label htmlFor="p-perdidas" className="text-xs font-bold text-slate-700 block">
                  Pérdidas Fiscales de Ejercicios Anteriores Pendientes
                </label>
                <div className="relative">
                  <span aria-hidden="true" className="pointer-events-none absolute left-3 top-2 text-xs text-slate-600 font-bold font-mono">$</span>
                  <input
                    id="p-perdidas"
                    type="text"
                    inputMode="decimal"
                    disabled={isReadOnly}
                    aria-describedby="p-perdidas-hint"
                    value={perdidasAnt}
                    onChange={(e) => setPerdidasAnt(sanitizeFiscalDecimalInput(e.target.value))}
                    onBlur={() => setPerdidasAnt(normalizeDecimalDraft(perdidasAnt))}
                    className="w-full pl-7 pr-12 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                  <span aria-hidden="true" className="pointer-events-none absolute right-3 top-2 text-[11px] text-slate-600 font-mono">MXN</span>
                </div>
                <p id="p-perdidas-hint" className="text-[11px] text-slate-600">
                  Amortizables contra la utilidad fiscal estimada.
                </p>
              </div>

              <div className="space-y-1">
                <label htmlFor="p-pagos-ant" className="text-xs font-bold text-slate-700 block">
                  Pagos Provisionales de ISR Efectuados con Anterioridad
                </label>
                <div className="relative">
                  <span aria-hidden="true" className="pointer-events-none absolute left-3 top-2 text-xs text-slate-600 font-bold font-mono">$</span>
                  <input
                    id="p-pagos-ant"
                    type="text"
                    inputMode="decimal"
                    disabled={isReadOnly}
                    aria-describedby="p-pagos-ant-hint"
                    value={pagosAnt}
                    onChange={(e) => setPagosAnt(sanitizeFiscalDecimalInput(e.target.value))}
                    onBlur={() => setPagosAnt(normalizeDecimalDraft(pagosAnt))}
                    className="w-full pl-7 pr-12 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                  <span aria-hidden="true" className="pointer-events-none absolute right-3 top-2 text-[11px] text-slate-600 font-mono">MXN</span>
                </div>
                <p id="p-pagos-ant-hint" className="text-[11px] text-slate-600">
                  Suma de pagos de ISR realizados de enero al mes previo.
                </p>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="p-iva-ant" className="text-xs font-bold text-slate-700 block">
                  Saldo a Favor de IVA de Meses Anteriores por Acreditar
                </label>
                <div className="relative">
                  <span aria-hidden="true" className="pointer-events-none absolute left-3 top-2 text-xs text-slate-600 font-bold font-mono">$</span>
                  <input
                    id="p-iva-ant"
                    type="text"
                    inputMode="decimal"
                    disabled={isReadOnly}
                    aria-describedby="p-iva-ant-hint"
                    value={saldoIvaAnt}
                    onChange={(e) => setSaldoIvaAnt(sanitizeFiscalDecimalInput(e.target.value))}
                    onBlur={() => setSaldoIvaAnt(normalizeDecimalDraft(saldoIvaAnt))}
                    className="w-full pl-7 pr-12 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                  <span aria-hidden="true" className="pointer-events-none absolute right-3 top-2 text-[11px] text-slate-600 font-mono">MXN</span>
                </div>
                <p id="p-iva-ant-hint" className="text-[11px] text-slate-600">
                  Acreditamiento directo contra el IVA a cargo del periodo.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-2">
              {isFiscalDirty && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  Cambios sin guardar
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {isFiscalDirty && !isReadOnly && (
                <button
                  type="button"
                  onClick={onResetFiscal}
                  title="Descartar cambios y restaurar valores guardados"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Restablecer
                </button>
              )}
              <button
                type="submit"
                disabled={isReadOnly || saveFiscalParamsMutation.isPending || !isFiscalDirty}
                title={
                  isReadOnly
                    ? 'Solo un Contador o Socio puede modificar parámetros fiscales'
                    : !isFiscalDirty
                      ? 'No hay cambios pendientes por guardar'
                      : 'Guardar parámetros fiscales del periodo'
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveFiscalParamsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="w-4 h-4" aria-hidden="true" />
                )}
                <span>{saveFiscalParamsMutation.isPending ? 'Guardando...' : 'Guardar Parámetros Fiscales'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Tarjeta Informativa de la Cédula Actual */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-blue-700" aria-hidden="true" />
                Cédula Fiscal del Periodo
              </h3>
              <span className="text-[11px] font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                P{String(currentPeriod).padStart(2, '0')}/{currentYear}
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Ingresos Acumulados:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(fiscalWp?.isrProvisional.ingresosAcumuladosEjercicio ?? 0)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Utilidad Estimada:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(fiscalWp?.isrProvisional.utilidadFiscalEstimada ?? 0)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">ISR Provisional a Pagar:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {formatCurrency(fiscalWp?.isrProvisional.isrNetoAPagar ?? 0)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">IVA Definitivo a Pagar:</span>
                <span className="font-mono font-bold text-blue-700">
                  {formatCurrency(fiscalWp?.ivaDefinitivo.ivaNetoAPagar ?? 0)}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                to="/fiscal-bancos"
                search={{ tab: 'DIA17' } as unknown as Record<string, string>}
                className="dark-focus-ring w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-[#0A1120] hover:bg-slate-800 transition shadow-xs"
              >
                Generar Póliza de Provisión
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
