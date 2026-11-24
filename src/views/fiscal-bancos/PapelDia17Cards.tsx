import { Coins, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { FiscalWorkpaperResponse } from '../../shared/types';

export function PapelDia17IsrCard({ workpaper, period }: { workpaper: FiscalWorkpaperResponse; period: number }) {
  const isPersonaFisica = workpaper.company.rfc.trim().length === 13;
  const isResico = workpaper.isrProvisional.esResico;
  const isResicoPf = isResico && isPersonaFisica;
  const isResicoPm = isResico && !isPersonaFisica;
  const isPfGeneral = isPersonaFisica && !isResico;
  const dedAcum =
    workpaper.isrProvisional.deduccionesAcumuladasEjercicio ??
    workpaper.isrProvisional.deduccionesAutorizadasPeriodo;
  const isrMethodLabel = isResico
    ? 'RESICO Flujo'
    : isPfGeneral
      ? 'Art. 106 LISR — Tarifa Progresiva'
      : 'Art. 14 C.U.';

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-2.5">
      <div className="border-b border-slate-200 pb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-blue-800">
          1. Pago Provisional ISR ({isrMethodLabel})
        </h3>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold shrink-0">
          Tasa {workpaper.isrProvisional.tasaIsrPct}%
        </span>
      </div>
      <dl className="space-y-1.5 text-xs font-mono">
        <div className="flex justify-between">
          <dt className="font-sans text-slate-600">Ingresos Nominales del Mes:</dt>
          <dd className="font-semibold text-slate-900">
            {formatCurrency(workpaper.isrProvisional.ingresosPeriodo)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-sans text-slate-600">Ingresos Acumulados (P01-P{String(period).padStart(2, '0')}):</dt>
          <dd className="font-semibold text-slate-900">
            {formatCurrency(workpaper.isrProvisional.ingresosAcumuladosEjercicio)}
          </dd>
        </div>
        {!isResicoPf && (isResicoPm || isPfGeneral) && (
          <>
            <div className="flex justify-between">
              <dt className="font-sans text-slate-600">(-) Deducciones del Mes:</dt>
              <dd className="font-semibold text-slate-900">
                -{formatCurrency(workpaper.isrProvisional.deduccionesAutorizadasPeriodo)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-sans text-slate-600">
                (-) Deducciones Acumuladas (P01-P{String(period).padStart(2, '0')}):
              </dt>
              <dd className="font-semibold text-slate-900">
                -{formatCurrency(dedAcum)}
              </dd>
            </div>
          </>
        )}
        {!isResicoPf && (
          <div className="flex justify-between">
            <dt className="font-sans text-slate-600">
              {isResicoPm || isPfGeneral
                ? '(=) Utilidad Fiscal (Ing. - Ded.):'
                : `(x) Coeficiente Utilidad (${workpaper.isrProvisional.coeficienteUtilidadAplicado.toFixed(4)}):`}
            </dt>
            <dd className="font-semibold text-slate-900">
              {formatCurrency(workpaper.isrProvisional.utilidadFiscalEstimada)}
            </dd>
          </div>
        )}
        {!isResicoPf && (
          <div className="flex justify-between">
            <dt className="font-sans text-slate-600">(-) Pérdidas Fiscales Amortizadas:</dt>
            <dd className="text-emerald-700">
              -{formatCurrency(workpaper.isrProvisional.perdidasFiscalesAplicadas)}
            </dd>
          </div>
        )}
        <div className="flex justify-between pt-1 border-t border-slate-100">
          <dt className="font-sans font-semibold text-slate-800">(=) Base Gravable ISR:</dt>
          <dd className="font-bold text-slate-900">
            {formatCurrency(workpaper.isrProvisional.baseGravableIsr)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-sans text-slate-600">(=) ISR Causado del Periodo:</dt>
          <dd className="font-semibold text-slate-900">
            {formatCurrency(workpaper.isrProvisional.isrCausado)}
          </dd>
        </div>
        {!isResicoPf && (
          <div className="flex justify-between">
            <dt className="font-sans text-slate-600">(-) Pagos Prov. Anteriores:</dt>
            <dd className="text-emerald-700">
              -{formatCurrency(workpaper.isrProvisional.pagosProvisionalesPrevios)}
            </dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="font-sans text-slate-600">(-) ISR Retenido por Clientes:</dt>
          <dd className="text-emerald-700">
            -{formatCurrency(workpaper.isrProvisional.isrRetenidoPeriodo)}
          </dd>
        </div>
        <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
          <dt className="font-sans font-bold text-slate-900">ISR A CARGO DÍA 17:</dt>
          <dd className="font-bold text-blue-800">
            {formatCurrency(workpaper.isrProvisional.isrNetoAPagar)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function PapelDia17IvaCard({ workpaper }: { workpaper: FiscalWorkpaperResponse }) {
  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-2.5">
      <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
          2. Determinación Definitiva de IVA (Flujo)
        </h3>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold">
          LIVA Art. 1-B / 5
        </span>
      </div>
      <dl className="space-y-1.5 text-xs font-mono">
        <div className="flex justify-between">
          <dt className="font-sans text-slate-600">(+) IVA Trasladado Cobrado:</dt>
          <dd className="font-semibold text-slate-900">
            {formatCurrency(workpaper.ivaDefinitivo.ivaTrasladadoCobrado)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-sans text-slate-600">(-) IVA Acreditable Pagado DIOT:</dt>
          <dd className="text-emerald-700">
            -{formatCurrency(workpaper.ivaDefinitivo.ivaAcreditablePagado)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-sans text-slate-600">(-) IVA Retenido Acreditable (por Clientes):</dt>
          <dd className="text-emerald-700">
            -{formatCurrency(workpaper.ivaDefinitivo.ivaRetenidoAcreditable ?? 0)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-sans text-slate-600">(-) Saldo a Favor IVA Acreditado:</dt>
          <dd className="text-emerald-700">
            -{formatCurrency(workpaper.ivaDefinitivo.saldoFavorIvaAcreditable)}
          </dd>
        </div>
        <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
          <dt className="font-sans font-bold text-slate-900">
            {workpaper.ivaDefinitivo.ivaNetoAPagar > 0
              ? 'IVA DEFINITIVO A CARGO:'
              : 'SALDO A FAVOR IVA DEL MES:'}
          </dt>
          <dd
            className={`font-bold ${
              workpaper.ivaDefinitivo.ivaNetoAPagar > 0
                ? 'text-blue-800'
                : 'text-emerald-800'
            }`}
          >
            {formatCurrency(
              workpaper.ivaDefinitivo.ivaNetoAPagar > 0
                ? workpaper.ivaDefinitivo.ivaNetoAPagar
                : workpaper.ivaDefinitivo.saldoFavorIvaRemanente
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function PapelDia17UsdCard({
  workpaper,
  isPeriodLocked = false,
  isReadOnlyClient = false,
  hasUnsavedParams = false,
  genExchangePolizaMutation
}: {
  workpaper: FiscalWorkpaperResponse;
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  hasUnsavedParams?: boolean;
  genExchangePolizaMutation: { isPending: boolean; mutate: () => void };
}) {
  const isLocked = isPeriodLocked || isReadOnlyClient;
  const noExchangeDiff = workpaper.fluctuacionCambiaria.diferenciaCambiariaMxn === 0;
  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-2.5">
      <div className="border-b border-slate-200 pb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <Coins className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
          3. Fluctuación Cambiaria USD (NIF B-15)
        </h3>
        <span className="font-mono tabular-nums text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-900 font-semibold shrink-0">
          TC {workpaper.fluctuacionCambiaria.tipoCambioDofCierre.toFixed(4)}
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <dl className="space-y-1.5 font-mono tabular-nums pt-1">
          <div className="flex justify-between">
            <dt className="font-sans text-slate-600">Saldo USD en CFDI/Bancos:</dt>
            <dd className="font-semibold text-slate-900">
              $
              {workpaper.fluctuacionCambiaria.saldoMonedaExtranjeraUsd.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}{' '}
              USD
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-sans text-slate-600">Valuación Cierre DOF (MXN):</dt>
            <dd className="font-semibold text-slate-900">
              {formatCurrency(workpaper.fluctuacionCambiaria.valuacionCierreDofMxn)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-sans text-slate-600">Saldo en Libros (MXN):</dt>
            <dd className="font-semibold text-slate-900">
              {formatCurrency(workpaper.fluctuacionCambiaria.valuacionLibrosMxn)}
            </dd>
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-200 text-xs font-bold">
            <dt className="font-sans text-slate-800">
              {noExchangeDiff
                ? 'Diferencia Cambiaria:'
                : workpaper.fluctuacionCambiaria.tipoDiferencia === 'UTILIDAD_CAMBIARIA'
                  ? 'Utilidad Cambiaria:'
                  : 'Pérdida Cambiaria:'}
            </dt>
            <dd
              className={
                noExchangeDiff
                  ? 'text-slate-700'
                  : workpaper.fluctuacionCambiaria.tipoDiferencia === 'UTILIDAD_CAMBIARIA'
                    ? 'text-emerald-700'
                    : 'text-red-700'
              }
            >
              {formatCurrency(workpaper.fluctuacionCambiaria.diferenciaCambiariaMxn)}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          disabled={genExchangePolizaMutation.isPending || isLocked || noExchangeDiff || hasUnsavedParams}
          title={
            isLocked
              ? (isReadOnlyClient ? 'Modo solo lectura' : 'Periodo fiscal bloqueado ante el SAT')
              : hasUnsavedParams
                ? 'Aplica los cambios con Recalcular antes de generar la póliza cambiaria'
                : noExchangeDiff
                  ? 'Sin diferencia cambiaria pendiente por contabilizar'
                  : 'Generar póliza de utilidad o pérdida cambiaria USD'
          }
          onClick={() => genExchangePolizaMutation.mutate()}
          className="w-full mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          {genExchangePolizaMutation.isPending
            ? 'Generando Póliza USD...'
            : 'Generar Póliza Fluctuación USD'}
        </button>
      </div>
    </div>
  );
}
