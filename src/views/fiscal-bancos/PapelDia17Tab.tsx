import { AlertCircle, Calculator, Check, Copy, FileText, RefreshCw, Save, Sparkles } from 'lucide-react';
import {
  PapelDia17IsrCard,
  PapelDia17IvaCard,
  PapelDia17UsdCard
} from './PapelDia17Cards';
import { usePapelDia17 } from './usePapelDia17';

export interface PapelDia17TabProps {
  companyId: string;
  year: number;
  period: number;
  onFeedback: (msg: string) => void;
  onOpenDeliverable?: (tab: 'DOSSIER' | 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'DIA17' | 'CONFIG') => void;
}

export function PapelDia17Tab({
  companyId,
  year,
  period,
  onFeedback,
  onOpenDeliverable
}: PapelDia17TabProps) {
  const {
    workpaper,
    loadingWp,
    isErrorWp,
    errorWp,
    refetchWp,
    coefUtilidad,
    setCoefUtilidad,
    perdidasAmortizar,
    setPerdidasAmortizar,
    ivaSaldoFavor,
    setIvaSaldoFavor,
    tcCierreUsd,
    setTcCierreUsd,
    copiedSatDyp,
    handleCopySatDyp,
    saveTaxParamsMutation,
    genTaxProvisionMutation,
    genExchangePolizaMutation
  } = usePapelDia17({ companyId, year, period, onFeedback });

  if (isErrorWp) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-red-200 shadow-2xs space-y-4 max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">Error al calcular Papel de Trabajo Día 17</h3>
          <p className="text-xs text-slate-600 mt-1">
            {errorWp instanceof Error ? errorWp.message : 'Error de conexión'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetchWp()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reintentar cálculo</span>
        </button>
      </div>
    );
  }

  if (loadingWp || !workpaper) {
    return (
      <div className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-500">
        Calculando Papel de Trabajo Fiscal Día 17 (ISR Provisional + IVA Definitivo + Fluctuación Cambiaria)...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Barra de Parámetros Fiscales Editables del Periodo */}
      <div className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-blue-700" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Papel de Trabajo Fiscal Día 17 — Parámetros de Cálculo ({workpaper.company.regimenFiscal})
              </h2>
              <p className="text-xs text-slate-500">
                Ajusta el Coeficiente de Utilidad (Art. 14 LISR), pérdidas fiscales por amortizar, saldo a favor de IVA o tipo de cambio DOF
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopySatDyp}
              aria-live="polite"
              title="Copiar datos estructurados para llenar el formulario de Declaraciones y Pagos (DyP) en el portal del SAT"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs transition cursor-pointer"
            >
              {copiedSatDyp ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  <span className="text-emerald-700 font-bold">¡Copiado para DyP!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>Copiar para DyP SAT</span>
                </>
              )}
            </button>

            {onOpenDeliverable && (
              <button
                type="button"
                onClick={() => onOpenDeliverable('DIA17')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-blue-900 border border-blue-300 shadow-2xs transition cursor-pointer"
              >
                <FileText className="w-4 h-4 text-blue-700" aria-hidden="true" />
                Cédula y Firmas Día 17 (PDF)
              </button>
            )}
            <button
              type="button"
              disabled={genTaxProvisionMutation.isPending}
              onClick={() => genTaxProvisionMutation.mutate()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              {genTaxProvisionMutation.isPending
                ? 'Contabilizando Provisión...'
                : 'Generar Póliza de Provisión ISR + IVA'}
            </button>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveTaxParamsMutation.mutate();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs"
        >
          <div>
            <label htmlFor="dia17-coef-utilidad" className="block text-[11px] font-bold text-slate-700 mb-1">
              Coeficiente de Utilidad (C.U.)
            </label>
            <input
              id="dia17-coef-utilidad"
              type="number"
              step="0.0001"
              min="0"
              max="1"
              title="Coeficiente de Utilidad según última declaración anual (Art. 14 LISR)"
              value={coefUtilidad}
              onChange={(e) => setCoefUtilidad(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="dia17-perdidas-amortizar" className="block text-[11px] font-bold text-slate-700 mb-1">
              Pérdidas Fiscales x Amortizar ($)
            </label>
            <input
              id="dia17-perdidas-amortizar"
              type="number"
              step="0.01"
              min="0"
              title="Pérdidas fiscales pendientes de amortizar actualizadas (Art. 57 LISR)"
              value={perdidasAmortizar}
              onChange={(e) => setPerdidasAmortizar(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="dia17-iva-saldo-favor" className="block text-[11px] font-bold text-slate-700 mb-1">
              Saldo a Favor IVA Anterior ($)
            </label>
            <input
              id="dia17-iva-saldo-favor"
              type="number"
              step="0.01"
              min="0"
              title="Saldo a favor de IVA de meses previos por acreditar (Art. 6 LIVA)"
              value={ivaSaldoFavor}
              onChange={(e) => setIvaSaldoFavor(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="dia17-tc-cierre-usd" className="block text-[11px] font-bold text-slate-700 mb-1">
              Tipo de Cambio Cierre USD (DOF)
            </label>
            <input
              id="dia17-tc-cierre-usd"
              type="number"
              step="0.0001"
              min="0"
              title="Tipo de cambio oficial publicado por el Diario Oficial de la Federación (DOF) al cierre de mes"
              value={tcCierreUsd}
              onChange={(e) => setTcCierreUsd(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saveTaxParamsMutation.isPending}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A1120] hover:bg-slate-800 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition shadow-2xs"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{saveTaxParamsMutation.isPending ? 'Recalculando Cédula...' : 'Recalcular Cédula Día 17'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3 Cédulas Fiscales lado a lado: ISR Provisional, IVA Definitivo y Fluctuación USD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <PapelDia17IsrCard workpaper={workpaper} period={period} />
        <PapelDia17IvaCard workpaper={workpaper} />
        <PapelDia17UsdCard
          workpaper={workpaper}
          genExchangePolizaMutation={genExchangePolizaMutation}
        />
      </div>
    </div>
  );
}
