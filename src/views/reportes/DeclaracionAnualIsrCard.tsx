import { Landmark } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type {
  AnnualFiscalReconciliation,
  AnnualTaxDetermination,
  AnnualTaxInputs
} from '../../shared/types/annual-tax.types';

interface DeclaracionAnualIsrCardProps {
  ejercicio: number;
  determination: AnnualTaxDetermination;
  reconciliation: AnnualFiscalReconciliation;
  inputs: AnnualTaxInputs;
}

function formatNegativeOrZero(value: number): string {
  return value > 0 ? formatCurrency(-value) : formatCurrency(0);
}

export function DeclaracionAnualKpiGrid({
  determination,
  reconciliation
}: {
  determination: AnnualTaxDetermination;
  reconciliation: AnnualFiscalReconciliation;
}) {
  const isNetCargo = determination.isrAnualCargoFavor >= 0;
  const isPersonaFisica =
    determination.tipoRegimenAnual === 'PF_RESICO' || determination.tipoRegimenAnual === 'PF_ART152';
  const isPfResico = determination.tipoRegimenAnual === 'PF_RESICO';

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${isPersonaFisica ? 'xl:grid-cols-3' : 'xl:grid-cols-4'} gap-3.5`}>
      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
          {isPfResico ? 'Ingresos Cobrados (Base RESICO)' : 'Resultado Fiscal'}
        </span>
        <div className="text-xl font-extrabold font-mono tabular-nums text-slate-900">
          {formatCurrency(isPfResico ? determination.ingresosNominales : reconciliation.resultadoFiscal)}
        </div>
        <p className="text-[11px] text-slate-600 font-mono tabular-nums">
          {isPfResico
            ? 'Flujo de efectivo acumulado (Art. 113-F)'
            : `Utilidad Fiscal: ${formatCurrency(reconciliation.utilidadFiscal)}`}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
          ISR Anual ({determination.tasaAplicablePct.toFixed(2)}%)
        </span>
        <div className="text-xl font-extrabold font-mono tabular-nums text-blue-900">
          {formatCurrency(determination.isrAnualCausado)}
        </div>
        <p className={`text-[11px] font-bold font-mono tabular-nums ${isNetCargo ? 'text-amber-700' : 'text-emerald-700'}`}>
          {isNetCargo
            ? `Neto a Cargo: ${formatCurrency(determination.isrACargo)}`
            : `Saldo a Favor: ${formatCurrency(determination.isrAFavor)}`}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">PTU por Pagar (10%)</span>
        <div className="text-xl font-extrabold font-mono tabular-nums text-slate-900">
          {formatCurrency(determination.ptuPorPagar10Pct)}
        </div>
        <p className="text-[11px] text-slate-600 font-mono tabular-nums">
          Renta Gravable: {formatCurrency(determination.ptuBase)}
        </p>
      </div>

      {!isPersonaFisica && (
        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Nuevo Coeficiente de Utilidad
          </span>
          <div className="text-xl font-extrabold font-mono tabular-nums text-emerald-800">
            {determination.nuevoCoeficienteUtilidad.toFixed(4)}
          </div>
          {determination.tipoRegimenAnual !== 'PM_GENERAL' ? (
            <p className="text-[11px] font-medium text-amber-800">
              Aplica solo a PM Régimen General (Art. 14 LISR)
            </p>
          ) : (
            <p className="text-[11px] text-slate-600 font-mono tabular-nums">
              Ingresos Nom.: {formatCurrency(determination.ingresosNominales)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function DeclaracionAnualIsrCard({
  ejercicio,
  determination,
  inputs
}: Omit<DeclaracionAnualIsrCardProps, 'reconciliation'>) {
  const isNetCargo = determination.isrAnualCargoFavor >= 0;
  const isPersonaFisica =
    determination.tipoRegimenAnual === 'PF_RESICO' || determination.tipoRegimenAnual === 'PF_ART152';
  const netLabel = isNetCargo ? '(=) ISR Anual a Cargo' : '(=) Saldo a Favor de ISR';
  const netAmount = isNetCargo ? determination.isrACargo : determination.isrAFavor;

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <h3 id="annual-isr-determination-heading" className="text-sm font-bold text-slate-900">
            Determinación de ISR Anual a Cargo / Favor ({ejercicio})
          </h3>
          <Landmark className="w-4 h-4 text-blue-700" aria-hidden="true" />
        </div>

        <div tabIndex={0} role="region" aria-labelledby="annual-isr-determination-heading" className="overflow-x-auto max-w-full">
          <table className="w-full text-xs">
            <caption className="visually-hidden">
              Determinación de ISR Anual a Cargo o Saldo a Favor del ejercicio {ejercicio}
            </caption>
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th scope="col" className="text-left py-1.5 px-2 font-bold">Concepto Fiscal</th>
                <th scope="col" className="text-right py-1.5 px-2 font-bold whitespace-nowrap">Importe MXN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <th scope="row" className="py-1.5 px-2 text-left font-semibold text-slate-800">
                  ISR Causado ({determination.tasaAplicablePct.toFixed(2)}%)
                </th>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-900 font-semibold">
                  {formatCurrency(determination.isrAnualCausado)}
                </td>
              </tr>
              <tr>
                <th scope="row" className="py-1.5 px-2 text-left font-normal text-slate-700">
                  (-) Pagos Provisionales Efectuados
                </th>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums whitespace-nowrap text-emerald-700">
                  {formatNegativeOrZero(determination.pagosProvisionalesEfectuados)}
                </td>
              </tr>
              <tr>
                <th scope="row" className="py-1.5 px-2 text-left font-normal text-slate-700">
                  (-) ISR Retenido Acreditable
                </th>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums whitespace-nowrap text-emerald-700">
                  {formatNegativeOrZero(determination.isrRetenidoAcreditable)}
                </td>
              </tr>
              <tr className={isNetCargo ? 'bg-amber-50/70 font-extrabold text-amber-950' : 'bg-emerald-50/70 font-extrabold text-emerald-950'}>
                <th scope="row" className="py-2 px-2 text-left font-extrabold text-inherit">{netLabel}</th>
                <td className="py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap text-inherit">
                  {formatCurrency(netAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {!isPersonaFisica && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-2 text-xs">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
            CUCA — Cuenta de Capital de Aportación (Art. 78)
          </h3>
          <div className="flex justify-between gap-2">
            <span className="text-slate-700">CUCA Inicial Actualizada</span>
            <span className="font-mono tabular-nums whitespace-nowrap text-slate-900">{formatCurrency(determination.cucaActualizada)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-700">(+) Aportaciones</span>
            <span className="font-mono tabular-nums whitespace-nowrap text-slate-900">{formatCurrency(inputs.aportacionesCapital)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-700">(-) Reducciones</span>
            <span className="font-mono tabular-nums whitespace-nowrap text-slate-900">{formatNegativeOrZero(inputs.reduccionesCapital)}</span>
          </div>
          <div className="flex justify-between gap-2 font-extrabold text-slate-900 border-t border-slate-200 pt-1.5">
            <span>(=) CUCA Final</span>
            <span className="font-mono tabular-nums whitespace-nowrap">{formatCurrency(determination.cucaFinal)}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-2 text-xs">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
            CUFIN — Cuenta de Utilidad Fiscal Neta (Art. 77)
          </h3>
          <div className="flex justify-between gap-2">
            <span className="text-slate-700">CUFIN Inicial Actualizada</span>
            <span className="font-mono tabular-nums whitespace-nowrap text-slate-900">{formatCurrency(determination.cufinActualizada)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-700">(+) UFIN del Ejercicio</span>
            <span className="font-mono tabular-nums whitespace-nowrap text-slate-900">{formatCurrency(determination.ufinDelEjercicio)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-700">(-) Dividendos Pagados</span>
            <span className="font-mono tabular-nums whitespace-nowrap text-slate-900">{formatNegativeOrZero(inputs.dividendosPagados)}</span>
          </div>
          <div className="flex justify-between gap-2 font-extrabold text-slate-900 border-t border-slate-200 pt-1.5">
            <span>(=) CUFIN Final</span>
            <span className="font-mono tabular-nums whitespace-nowrap">{formatCurrency(determination.cufinFinal)}</span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
