import { Link } from '@tanstack/react-router';
import { ArrowRight, Coins, RotateCcw, Save } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';

export interface AjustesFiscalTabProps {
  currentYear: number;
  currentPeriod: number;
  coefUtilidad: number;
  setCoefUtilidad: (v: number) => void;
  tcDof: number;
  setTcDof: (v: number) => void;
  perdidasAnt: number;
  setPerdidasAnt: (v: number) => void;
  pagosAnt: number;
  setPagosAnt: (v: number) => void;
  saldoIvaAnt: number;
  setSaldoIvaAnt: (v: number) => void;
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
  isReadOnly?: boolean;
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
  isReadOnly = false
}: AjustesFiscalTabProps) {
  return (
    <section className="space-y-5">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="p-cu" className="text-xs font-bold text-slate-700 block">
                Coeficiente de Utilidad (C.U. Art. 14 LISR) *
              </label>
              <div className="relative">
                <input
                  id="p-cu"
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  min="0"
                  max="1"
                  required
                  disabled={isReadOnly}
                  value={coefUtilidad}
                  onChange={(e) => setCoefUtilidad(Number(e.target.value))}
                  className="w-full px-3 py-2 pr-12 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800 focus:outline-blue-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
                <span className="absolute right-3 top-2 text-[11px] text-slate-600 font-bold font-mono">
                  C.U.
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Margen fiscal equivalente: <strong className="font-mono text-slate-800">{(coefUtilidad * 100).toFixed(2)}%</strong>
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="p-tc" className="text-xs font-bold text-slate-700 block">
                Tipo de Cambio DOF al Cierre del Mes (USD/MXN) *
              </label>
              <div className="relative">
                <input
                  id="p-tc"
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  min="0"
                  required
                  disabled={isReadOnly}
                  value={tcDof}
                  onChange={(e) => setTcDof(Number(e.target.value))}
                  className="w-full px-3 py-2 pr-20 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800 focus:outline-blue-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
                <span className="absolute right-3 top-2 text-[10px] text-slate-600 font-bold font-mono">
                  MXN/USD
                </span>
              </div>
              <p className="text-[11px] text-slate-600">Para valuación de fluctuación cambiaria oficial (0 para empresas solo MXN).</p>
            </div>

            <div className="space-y-1">
              <label htmlFor="p-perdidas" className="text-xs font-bold text-slate-700 block">
                Pérdidas Fiscales de Ejercicios Anteriores Pendientes
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-slate-600 font-bold font-mono">$</span>
                <input
                  id="p-perdidas"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  disabled={isReadOnly}
                  value={perdidasAnt}
                  onChange={(e) => setPerdidasAnt(Number(e.target.value))}
                  className="w-full pl-7 pr-12 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800 focus:outline-blue-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
                <span className="absolute right-3 top-2 text-[10px] text-slate-600 font-mono">MXN</span>
              </div>
              <p className="text-[11px] text-slate-600">Amortizables contra la utilidad fiscal estimada.</p>
            </div>

            <div className="space-y-1">
              <label htmlFor="p-pagos-ant" className="text-xs font-bold text-slate-700 block">
                Pagos Provisionales de ISR Efectuados con Anterioridad
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-slate-600 font-bold font-mono">$</span>
                <input
                  id="p-pagos-ant"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  disabled={isReadOnly}
                  value={pagosAnt}
                  onChange={(e) => setPagosAnt(Number(e.target.value))}
                  className="w-full pl-7 pr-12 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800 focus:outline-blue-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
                <span className="absolute right-3 top-2 text-[10px] text-slate-600 font-mono">MXN</span>
              </div>
              <p className="text-[11px] text-slate-600">Suma de pagos de ISR realizados de enero al mes previo.</p>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label htmlFor="p-iva-ant" className="text-xs font-bold text-slate-700 block">
                Saldo a Favor de IVA de Meses Anteriores por Acreditar
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-slate-600 font-bold font-mono">$</span>
                <input
                  id="p-iva-ant"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  disabled={isReadOnly}
                  value={saldoIvaAnt}
                  onChange={(e) => setSaldoIvaAnt(Number(e.target.value))}
                  className="w-full pl-7 pr-12 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800 focus:outline-blue-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
                <span className="absolute right-3 top-2 text-[10px] text-slate-600 font-mono">MXN</span>
              </div>
              <p className="text-[11px] text-slate-600">Acreditamiento directo contra el IVA a cargo del periodo.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-2">
              {isFiscalDirty && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  Cambios sin guardar
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {isFiscalDirty && !isReadOnly && (
                <button
                  type="button"
                  onClick={onResetFiscal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Restablecer
                </button>
              )}
              <button
                type="submit"
                disabled={isReadOnly || saveFiscalParamsMutation.isPending || !isFiscalDirty}
                title={isReadOnly ? 'Solo un Contador o Socio puede modificar parámetros fiscales' : undefined}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
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
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-[#0A1120] hover:bg-slate-800 transition shadow-xs"
              >
                Generar Póliza de Provisión
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
