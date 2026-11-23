import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Calculator, ChevronDown, ChevronUp, RefreshCw, Scale } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { annualTaxClient } from '../../lib/annual-tax-client';
import { formatCurrency } from '../../lib/formatters';
import type { AnnualTaxRegimeType, SaveAnnualTaxInputsPayload } from '../../shared/types/annual-tax.types';
import { DeclaracionAnualInputsCard } from './DeclaracionAnualInputsCard';

interface DeclaracionAnualTabProps {
  companyId?: string;
  ejercicio?: number;
}

const REGIME_LABELS: Record<AnnualTaxRegimeType, string> = {
  PM_GENERAL: 'Persona Moral Régimen General (30%)',
  PM_RESICO: 'Persona Moral RESICO Flujo (30%)',
  PF_ART152: 'Persona Física Tarifa Anual Art. 152',
  PF_RESICO: 'Persona Física RESICO Anual (1%–2.5%)'
};

export function DeclaracionAnualTab({ companyId, ejercicio }: DeclaracionAnualTabProps) {
  const { activeCompanyId, activeCompany } = useCompany();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showMonthlyInflation, setShowMonthlyInflation] = useState(false);

  const targetCompanyId = companyId ?? activeCompanyId;
  const targetYear = ejercicio ?? activeCompany?.currentYear ?? 2026;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['annual-tax', targetCompanyId, targetYear],
    queryFn: () => annualTaxClient.getAnnualTaxSummary(targetCompanyId, targetYear),
    enabled: Boolean(targetCompanyId)
  });

  const saveMutation = useMutation({
    mutationFn: (payload: SaveAnnualTaxInputsPayload) =>
      annualTaxClient.saveAnnualTaxInputs(targetCompanyId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['annual-tax', targetCompanyId, targetYear], updated);
      toast.success('Parámetros anuales guardados y cálculo actualizado');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'No se pudieron guardar los parámetros anuales');
    }
  });

  if (isError) {
    return (
      <div role="alert" className="p-6 bg-white rounded-2xl border border-red-200 text-center space-y-3">
        <AlertCircle className="w-6 h-6 text-red-600 mx-auto" aria-hidden="true" />
        <p className="text-xs text-slate-700">
          {error instanceof Error ? error.message : 'Error al calcular la Declaración Anual'}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reintentar</span>
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div role="status" className="p-8 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-500">
        Calculando Declaración Anual, Ajuste por Inflación INPC, CUCA y CUFIN...
      </div>
    );
  }

  const { inflation, reconciliation, determination, inputs } = data;
  const isNetCargo = determination.isrAnualCargoFavor >= 0;
  const conciliationRows: ReadonlyArray<{ label: string; value: number; className?: string }> = [
    { label: 'Utilidad / Pérdida Contable', value: reconciliation.utilidadContable, className: 'font-semibold' },
    { label: '(+) Ingresos Fiscales No Contables (Ajuste Inflación)', value: reconciliation.ingresosFiscalesNoContables, className: 'text-amber-800' },
    { label: '(+) Deducciones Contables No Fiscales (801/611, 601-01-006, Manual)', value: reconciliation.deduccionesContablesNoFiscales },
    { label: '(-) Deducciones Fiscales No Contables (Inv. Art. 31 + Inflación Ded.)', value: -reconciliation.deduccionesFiscalesNoContables, className: 'text-emerald-700' },
    { label: '(-) PTU Pagada en el Ejercicio', value: -reconciliation.ptuPagadaEjercicio, className: 'text-emerald-700' },
    { label: '(=) Utilidad / Pérdida Fiscal', value: reconciliation.utilidadFiscal, className: 'bg-slate-50 font-bold text-slate-900' },
    { label: '(-) Pérdidas Fiscales Actualizadas Aplicadas', value: -reconciliation.perdidasFiscalesAplicadas, className: 'text-emerald-700' },
    { label: '(=) Resultado Fiscal Gravable', value: reconciliation.resultadoFiscal, className: 'bg-blue-50/70 font-extrabold text-blue-950' }
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
            <Scale className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Declaración Anual LISR — Ejercicio {data.ejercicio}
            </h2>
            <p className="text-xs text-slate-600">
              {data.company.name} ({data.company.rfc}) • {REGIME_LABELS[determination.tipoRegimenAnual]}
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 font-mono">
          Factor Act. INPC: {determination.factorActualizacionInpc.toFixed(4)}
        </span>
      </div>

      {/* Tarjetas KPI Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Resultado Fiscal</span>
          <div className="text-xl font-extrabold font-mono text-slate-900">
            {formatCurrency(reconciliation.resultadoFiscal)}
          </div>
          <p className="text-[11px] text-slate-600 font-mono">
            Utilidad Fiscal: {formatCurrency(reconciliation.utilidadFiscal)}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            ISR Anual ({determination.tasaAplicablePct.toFixed(2)}%)
          </span>
          <div className="text-xl font-extrabold font-mono text-blue-900">
            {formatCurrency(determination.isrAnualCausado)}
          </div>
          <p className={`text-[11px] font-bold font-mono ${isNetCargo ? 'text-amber-700' : 'text-emerald-700'}`}>
            {isNetCargo
              ? `Neto a Cargo: ${formatCurrency(determination.isrACargo)}`
              : `Saldo a Favor: ${formatCurrency(determination.isrAFavor)}`}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">PTU por Pagar (10%)</span>
          <div className="text-xl font-extrabold font-mono text-slate-900">
            {formatCurrency(determination.ptuPorPagar10Pct)}
          </div>
          <p className="text-[11px] text-slate-600 font-mono">
            Renta Gravable: {formatCurrency(determination.ptuBase)}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Nuevo Coeficiente de Utilidad
          </span>
          <div className="text-xl font-extrabold font-mono text-emerald-800">
            {determination.nuevoCoeficienteUtilidad.toFixed(4)}
          </div>
          <p className="text-[11px] text-slate-600 font-mono">
            Ingresos Nom.: {formatCurrency(determination.ingresosNominales)}
          </p>
        </div>
      </div>

      {/* Grid Conciliación Contable-Fiscal + Ajuste Anual por Inflación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-sm font-bold text-slate-900">Conciliación Contable-Fiscal</h3>
            <Calculator className="w-4 h-4 text-blue-700" aria-hidden="true" />
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              {conciliationRows.map((row) => (
                <tr key={row.label} className={row.className?.includes('bg-') ? row.className : undefined}>
                  <td className="py-1.5 px-1 text-slate-700">{row.label}</td>
                  <td className={`py-1.5 px-1 text-right font-mono ${row.className ?? ''}`}>
                    {formatCurrency(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-sm font-bold text-slate-900">Ajuste Anual por Inflación (Art. 44–46)</h3>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              inflation.tipo === 'ACUMULABLE'
                ? 'bg-amber-100 text-amber-900'
                : inflation.tipo === 'DEDUCIBLE'
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'bg-slate-100 text-slate-700'
            }`}>
              {inflation.tipo}
            </span>
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-1.5 text-slate-700">Promedio Anual de Créditos (102, 105, 107)</td>
                <td className="py-1.5 text-right font-mono">{formatCurrency(inflation.promedioCreditos)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate-700">Promedio Anual de Deudas (201, 205, 252)</td>
                <td className="py-1.5 text-right font-mono">{formatCurrency(inflation.promedioDeudas)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate-700">Diferencia Promedios</td>
                <td className="py-1.5 text-right font-mono font-semibold">{formatCurrency(inflation.diferenciaPromedios)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate-700">
                  Factor Ajuste ({inflation.inpcCierreActual.toFixed(3)} / {inflation.inpcCierreAnterior.toFixed(3)} - 1)
                </td>
                <td className="py-1.5 text-right font-mono">{inflation.factorAjuste.toFixed(4)}</td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td className="py-2 px-1 text-slate-900">
                  {inflation.tipo === 'ACUMULABLE' ? 'Ajuste Anual Acumulable' : 'Ajuste Anual Deducible'}
                </td>
                <td className="py-2 px-1 text-right font-mono">
                  {formatCurrency(inflation.tipo === 'ACUMULABLE' ? inflation.ajusteAcumulable : inflation.ajusteDeducible)}
                </td>
              </tr>
            </tbody>
          </table>

          <button
            type="button"
            onClick={() => setShowMonthlyInflation((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
          >
            {showMonthlyInflation ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
            <span>{showMonthlyInflation ? 'Ocultar desglose mensual (12 meses)' : 'Ver desglose mensual (12 meses)'}</span>
          </button>

          {showMonthlyInflation && (
            <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-600 sticky top-0">
                  <tr>
                    <th scope="col" className="text-left py-1.5 px-2">Mes</th>
                    <th scope="col" className="text-right py-1.5 px-2">Créditos</th>
                    <th scope="col" className="text-right py-1.5 px-2">Deudas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inflation.monthlyRows.map((row) => (
                    <tr key={row.periodo}>
                      <td className="py-1 px-2 text-slate-700">{row.mesNombre}</td>
                      <td className="py-1 px-2 text-right font-mono">{formatCurrency(row.creditosCierre)}</td>
                      <td className="py-1 px-2 text-right font-mono">{formatCurrency(row.deudasCierre)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CUCA y CUFIN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-2 text-xs">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
            CUCA — Cuenta de Capital de Aportación (Art. 78)
          </h3>
          <div className="flex justify-between"><span>CUCA Inicial Actualizada</span><span className="font-mono">{formatCurrency(determination.cucaActualizada)}</span></div>
          <div className="flex justify-between"><span>(+) Aportaciones</span><span className="font-mono">{formatCurrency(inputs.aportacionesCapital)}</span></div>
          <div className="flex justify-between"><span>(-) Reducciones</span><span className="font-mono">-{formatCurrency(inputs.reduccionesCapital)}</span></div>
          <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-200 pt-1.5">
            <span>(=) CUCA Final</span><span className="font-mono">{formatCurrency(determination.cucaFinal)}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-2 text-xs">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
            CUFIN — Cuenta de Utilidad Fiscal Neta (Art. 77)
          </h3>
          <div className="flex justify-between"><span>CUFIN Inicial Actualizada</span><span className="font-mono">{formatCurrency(determination.cufinActualizada)}</span></div>
          <div className="flex justify-between"><span>(+) UFIN del Ejercicio</span><span className="font-mono">{formatCurrency(determination.ufinDelEjercicio)}</span></div>
          <div className="flex justify-between"><span>(-) Dividendos Pagados</span><span className="font-mono">-{formatCurrency(inputs.dividendosPagados)}</span></div>
          <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-200 pt-1.5">
            <span>(=) CUFIN Final</span><span className="font-mono">{formatCurrency(determination.cufinFinal)}</span>
          </div>
        </div>
      </div>

      <DeclaracionAnualInputsCard
        inputs={inputs}
        isSaving={saveMutation.isPending}
        onSave={(payload) => saveMutation.mutate(payload)}
      />
    </div>
  );
}
