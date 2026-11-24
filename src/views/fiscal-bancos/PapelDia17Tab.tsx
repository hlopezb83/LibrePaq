import { AlertCircle, Calculator, Check, Copy, FileText, RefreshCw, RotateCcw, Save, Sparkles } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import {
  PapelDia17IsrCard,
  PapelDia17IvaCard,
  PapelDia17UsdCard
} from './PapelDia17Cards';
import { PapelDia17SummaryBar } from './PapelDia17SummaryBar';
import { ResicoCashBasisBanner } from './ResicoCashBasisBanner';
import { usePapelDia17 } from './usePapelDia17';

function sanitizeNonNeg(raw: string, max?: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return max !== undefined ? Math.min(n, max) : n;
}

export interface PapelDia17TabProps {
  companyId: string;
  year: number;
  period: number;
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  onFeedback: (msg: string, type?: 'success' | 'error') => void;
  onOpenDeliverable?: (tab: 'DOSSIER' | 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'DIA17' | 'CONFIG') => void;
}

export function PapelDia17Tab({
  companyId,
  year,
  period,
  isPeriodLocked = false,
  isReadOnlyClient: isReadOnlyClientProp = false,
  onFeedback,
  onOpenDeliverable
}: PapelDia17TabProps) {
  const { isReadOnlyClient, isReadOnlySupportMode } = useCompany();
  const isReadOnly = Boolean(isReadOnlyClientProp) || isReadOnlyClient || isReadOnlySupportMode;
  const isWriteLocked = isPeriodLocked || isReadOnly;
  const lockTitle = isReadOnly ? 'Modo solo lectura' : 'Periodo fiscal bloqueado ante el SAT';
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
    pagosPreviosInput,
    setPagosPreviosInput,
    ivaSaldoFavor,
    setIvaSaldoFavor,
    tcCierreUsd,
    setTcCierreUsd,
    hasUnsavedParams,
    resetTaxParams,
    copiedSatDyp,
    handleCopySatDyp,
    saveTaxParamsMutation,
    genTaxProvisionMutation,
    genExchangePolizaMutation
  } = usePapelDia17({ companyId, year, period, isPeriodLocked, isReadOnlyClient: isReadOnly, onFeedback });

  if (isErrorWp) {
    return (
      <div role="alert" className="p-8 text-center bg-white rounded-2xl border border-red-200 shadow-2xs space-y-4 max-w-lg mx-auto my-12">
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
      <div role="status" aria-live="polite" aria-busy="true" className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-600">
        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-blue-600" aria-hidden="true" />
        Calculando Papel de Trabajo Fiscal Día 17 (ISR Provisional + IVA Definitivo + Fluctuación Cambiaria)...
      </div>
    );
  }

  const cap = workpaper.resumenLineaCapturaSat;
  const isResico = workpaper.isrProvisional.esResico;
  const isPfGeneral = workpaper.company.rfc.trim().length === 13 && !isResico;

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Calculator className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900">
                Papel de Trabajo Fiscal Día 17 — Parámetros de Cálculo ({workpaper.company.regimenFiscal})
              </h2>
              <p className="text-xs text-slate-600">
                {isResico
                  ? 'Régimen de Flujo de Efectivo (RESICO): ajusta pérdidas fiscales por amortizar, pagos provisionales anteriores, saldo a favor de IVA o tipo de cambio DOF'
                  : isPfGeneral
                    ? 'Persona Física (Art. 106 LISR — Tarifa Progresiva): ajusta pérdidas fiscales, pagos provisionales anteriores, saldo a favor de IVA o tipo de cambio DOF'
                    : 'Ajusta el Coeficiente de Utilidad (Art. 14 LISR), pérdidas fiscales por amortizar, saldo a favor de IVA o tipo de cambio DOF'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="visually-hidden" role="status" aria-live="polite">
              {copiedSatDyp ? 'Datos estructurados para Declaraciones y Pagos SAT copiados al portapapeles' : ''}
            </span>
            <button
              type="button"
              onClick={handleCopySatDyp}
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
                  <Copy className="w-4 h-4 text-slate-600" aria-hidden="true" />
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
              disabled={genTaxProvisionMutation.isPending || isWriteLocked}
              title={isWriteLocked ? lockTitle : 'Contabilizar provisión mensual de ISR e IVA'}
              onClick={() => genTaxProvisionMutation.mutate()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              {genTaxProvisionMutation.isPending ? 'Contabilizando Provisión...' : 'Generar Póliza de Provisión ISR + IVA'}
            </button>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isWriteLocked) saveTaxParamsMutation.mutate();
          }}
          className={`grid grid-cols-1 sm:grid-cols-2 ${isPfGeneral ? 'lg:grid-cols-5' : 'lg:grid-cols-6'} gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs`}
        >
          {!isPfGeneral && (
            <div>
              <label htmlFor="dia17-coef-utilidad" className="block text-[11px] font-bold text-slate-700 mb-1">
                Coeficiente Utilidad (C.U.)
              </label>
              <input
                id="dia17-coef-utilidad"
                type="number"
                inputMode="decimal"
                step="0.0001"
                min="0"
                max="1"
                disabled={isWriteLocked || isResico}
                title={
                  isWriteLocked
                    ? lockTitle
                    : isResico
                      ? 'No aplica en RESICO (tributa sobre flujo de efectivo)'
                      : 'Coeficiente de Utilidad según última declaración anual (Art. 14 LISR)'
                }
                value={coefUtilidad}
                onChange={(e) => setCoefUtilidad(sanitizeNonNeg(e.target.value, 1))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              {isResico && <p className="mt-1 text-[11px] text-slate-600">No aplica en RESICO</p>}
            </div>
          )}
          <div>
            <label htmlFor="dia17-perdidas-amortizar" className="block text-[11px] font-bold text-slate-700 mb-1">
              Pérdidas x Amortizar ($)
            </label>
            <input
              id="dia17-perdidas-amortizar"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              disabled={isWriteLocked}
              title={isWriteLocked ? lockTitle : 'Pérdidas fiscales pendientes de amortizar actualizadas (Art. 57 LISR)'}
              value={perdidasAmortizar}
              onChange={(e) => setPerdidasAmortizar(sanitizeNonNeg(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="dia17-pagos-previos" className="block text-[11px] font-bold text-slate-700 mb-1">
              Pagos Prov. Anteriores ($)
            </label>
            <input
              id="dia17-pagos-previos"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              disabled={isWriteLocked}
              title={isWriteLocked ? lockTitle : 'Pagos provisionales de ISR enterados previamente en el ejercicio (Art. 14 LISR)'}
              value={pagosPreviosInput}
              onChange={(e) => setPagosPreviosInput(sanitizeNonNeg(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="dia17-iva-saldo-favor" className="block text-[11px] font-bold text-slate-700 mb-1">
              Saldo a Favor IVA Ant. ($)
            </label>
            <input
              id="dia17-iva-saldo-favor"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              disabled={isWriteLocked}
              title={isWriteLocked ? lockTitle : 'Saldo a favor de IVA de meses previos por acreditar (Art. 6 LIVA)'}
              value={ivaSaldoFavor}
              onChange={(e) => setIvaSaldoFavor(sanitizeNonNeg(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="dia17-tc-cierre-usd" className="block text-[11px] font-bold text-slate-700 mb-1">
              TC Cierre USD (DOF)
            </label>
            <input
              id="dia17-tc-cierre-usd"
              type="number"
              inputMode="decimal"
              step="0.0001"
              min="0"
              disabled={isWriteLocked}
              title={isWriteLocked ? lockTitle : 'Tipo de cambio oficial publicado por el Diario Oficial de la Federación (DOF) al cierre de mes'}
              value={tcCierreUsd}
              onChange={(e) => setTcCierreUsd(sanitizeNonNeg(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div className="flex items-end gap-1.5">
            <button
              type="submit"
              disabled={saveTaxParamsMutation.isPending || isWriteLocked}
              title={isWriteLocked ? lockTitle : 'Aplicar parámetros y recalcular cédula Día 17'}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A1120] hover:bg-slate-800 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition shadow-2xs"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{saveTaxParamsMutation.isPending ? 'Aplicando...' : 'Recalcular'}</span>
            </button>
            {hasUnsavedParams && (
              <button
                type="button"
                disabled={isWriteLocked}
                onClick={resetTaxParams}
                title={isWriteLocked ? lockTitle : 'Descartar cambios sin guardar'}
                aria-label="Descartar cambios de parámetros fiscales"
                className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </form>

        {hasUnsavedParams && (
          <div role="status" aria-live="polite" className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 font-medium">
            Tienes parámetros modificados sin aplicar. Haz clic en <strong>Recalcular</strong> para actualizar el ISR, IVA y valuación cambiaria.
          </div>
        )}
      </div>

      <PapelDia17SummaryBar cap={cap} retencionesDesglose={workpaper.retencionesDesglose} />

      {/* Flujo RESICO, Semáforo de Topes y Prorrateo IVA */}
      <ResicoCashBasisBanner workpaper={workpaper} />

      {/* 3 Cédulas Fiscales lado a lado: ISR Provisional, IVA Definitivo y Fluctuación USD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <PapelDia17IsrCard workpaper={workpaper} period={period} />
        <PapelDia17IvaCard workpaper={workpaper} />
        <PapelDia17UsdCard
          workpaper={workpaper}
          isPeriodLocked={isPeriodLocked}
          isReadOnlyClient={isReadOnly}
          genExchangePolizaMutation={genExchangePolizaMutation}
        />
      </div>
    </div>
  );
}
