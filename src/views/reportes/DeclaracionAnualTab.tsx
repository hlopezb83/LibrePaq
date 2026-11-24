import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Building2, Calculator, ChevronDown, ChevronUp, RefreshCw, Scale } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { annualTaxClient } from '../../lib/annual-tax-client';
import { formatCurrency } from '../../lib/formatters';
import type { AnnualInflationResult, AnnualTaxRegimeType, SaveAnnualTaxInputsPayload } from '../../shared/types/annual-tax.types';
import { DeclaracionAnualInputsCard } from './DeclaracionAnualInputsCard';
import { DeclaracionAnualIsrCard, DeclaracionAnualKpiGrid } from './DeclaracionAnualIsrCard';

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

const INFLATION_TIPO_LABELS: Record<AnnualInflationResult['tipo'], string> = {
  ACUMULABLE: 'Ingreso Acumulable',
  DEDUCIBLE: 'Deducción Autorizada',
  NEUTRO: 'Sin Efecto (Neutro)'
};

export function DeclaracionAnualTab({ companyId, ejercicio }: DeclaracionAnualTabProps) {
  const { activeCompanyId, activeCompany, isReadOnlySupportMode, isReadOnlyClient } = useCompany();
  const isReadOnly = isReadOnlySupportMode || isReadOnlyClient;
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
    mutationFn: ({ companyId: cid, payload }: { companyId: string; year: number; payload: SaveAnnualTaxInputsPayload }) => {
      if (isReadOnly) throw new Error('Modo solo lectura: no es posible modificar los parámetros anuales.');
      return annualTaxClient.saveAnnualTaxInputs(cid, payload);
    },
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(['annual-tax', variables.companyId, variables.year], updated);
      toast.success('Parámetros anuales guardados y cálculo actualizado');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'No se pudieron guardar los parámetros anuales');
    }
  });

  if (!targetCompanyId) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-300 text-center space-y-2">
        <Building2 className="w-6 h-6 text-slate-500 mx-auto" aria-hidden="true" />
        <p className="text-xs font-semibold text-slate-700">
          Selecciona o crea una empresa para calcular su Declaración Anual LISR.
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="p-6 bg-white rounded-2xl border border-red-200 text-center space-y-3">
        <AlertCircle className="w-6 h-6 text-red-600 mx-auto" aria-hidden="true" />
        <p className="text-xs text-slate-700">{error instanceof Error ? error.message : 'Error al calcular la Declaración Anual'}</p>
        <button type="button" onClick={() => void refetch()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reintentar</span>
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="p-8 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-600">
        Calculando Declaración Anual, Ajuste por Inflación INPC, CUCA y CUFIN...
      </div>
    );
  }

  const { inflation, reconciliation, determination, inputs } = data;
  const isPersonaFisica =
    determination.tipoRegimenAnual === 'PF_RESICO' || determination.tipoRegimenAnual === 'PF_ART152';
  const conciliationRows: ReadonlyArray<{ label: string; value: number; rowClass?: string; labelClass?: string; valueClass?: string }> = [
    { label: 'Utilidad / Pérdida Contable', value: reconciliation.utilidadContable, labelClass: 'font-semibold text-slate-800', valueClass: 'font-semibold text-slate-900' },
    { label: '(+) Ingresos Fiscales No Contables (Ajuste Inflación)', value: reconciliation.ingresosFiscalesNoContables, valueClass: 'text-amber-800' },
    { label: '(+) Deducciones Contables No Fiscales (Provisión ISR, Depreciación Contable y No Deducibles)', value: reconciliation.deduccionesContablesNoFiscales },
    { label: '(-) Deducciones Fiscales No Contables (Inv. Art. 31 + Inflación Ded.)', value: -reconciliation.deduccionesFiscalesNoContables, valueClass: 'text-emerald-700' },
    { label: '(-) PTU Pagada en el Ejercicio', value: -reconciliation.ptuPagadaEjercicio, valueClass: 'text-emerald-700' },
    { label: '(=) Utilidad / Pérdida Fiscal', value: reconciliation.utilidadFiscal, rowClass: 'bg-slate-50 font-bold text-slate-900', labelClass: 'font-bold text-slate-900', valueClass: 'font-bold text-slate-900' },
    { label: '(-) Pérdidas Fiscales Actualizadas Aplicadas', value: -reconciliation.perdidasFiscalesAplicadas, valueClass: 'text-emerald-700' },
    { label: '(=) Resultado Fiscal Gravable', value: reconciliation.resultadoFiscal, rowClass: 'bg-blue-50/70 font-extrabold text-blue-950', labelClass: 'font-extrabold text-blue-950', valueClass: 'font-extrabold text-blue-950' }
  ];

  const inflationRows: ReadonlyArray<{ label: string; value: string; bold?: boolean }> = [
    { label: 'Promedio Anual de Créditos (102, 103, 105, 106, 107*, 113)', value: formatCurrency(inflation.promedioCreditos) },
    { label: 'Promedio Anual de Deudas (201, 202, 205, 206, 210–216, 251–253)', value: formatCurrency(inflation.promedioDeudas) },
    { label: 'Diferencia Promedios', value: formatCurrency(inflation.diferenciaPromedios), bold: true },
    { label: `Factor Ajuste (${inflation.inpcCierreActual.toFixed(3)} / ${inflation.inpcCierreAnterior.toFixed(3)} - 1)`, value: inflation.factorAjuste.toFixed(4) }
  ];

  const inflationEffectLabel =
    inflation.tipo === 'ACUMULABLE' ? 'Ajuste Anual Acumulable' : inflation.tipo === 'DEDUCIBLE' ? 'Ajuste Anual Deducible' : 'Ajuste Anual por Inflación (Neutro)';
  const inflationEffectValue =
    inflation.tipo === 'ACUMULABLE' ? inflation.ajusteAcumulable : inflation.tipo === 'DEDUCIBLE' ? inflation.ajusteDeducible : 0;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Declaración Anual LISR — Ejercicio {data.ejercicio}</h2>
            <p className="text-xs text-slate-600">{data.company.name} ({data.company.rfc}) • {REGIME_LABELS[determination.tipoRegimenAnual]}</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 font-mono tabular-nums">
          Factor Act. INPC: {determination.factorActualizacionInpc.toFixed(4)}
        </span>
      </div>

      <DeclaracionAnualKpiGrid determination={determination} reconciliation={reconciliation} />

      {!isPersonaFisica && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 id="annual-conciliation-heading" className="text-sm font-bold text-slate-900">Conciliación Contable-Fiscal</h3>
            <Calculator className="w-4 h-4 text-blue-700" aria-hidden="true" />
          </div>
          <div tabIndex={0} role="region" aria-labelledby="annual-conciliation-heading" className="overflow-x-auto max-w-full">
            <table className="w-full text-xs">
              <caption className="visually-hidden">Conciliación Contable-Fiscal del ejercicio {data.ejercicio}</caption>
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th scope="col" className="text-left py-1.5 px-2 font-bold">Concepto</th>
                  <th scope="col" className="text-right py-1.5 px-2 font-bold whitespace-nowrap">Importe MXN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conciliationRows.map((row) => (
                  <tr key={row.label} className={row.rowClass}>
                    <th scope="row" className={`py-1.5 px-2 text-left font-normal ${row.labelClass ?? 'text-slate-700'}`}>{row.label}</th>
                    <td className={`py-1.5 px-2 text-right font-mono tabular-nums whitespace-nowrap ${row.valueClass ?? 'text-slate-900'}`}>{formatCurrency(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <h3 id="annual-inflation-heading" className="text-sm font-bold text-slate-900">Ajuste Anual por Inflación (Art. 44–46)</h3>
            <span
              role="status"
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                inflation.tipo === 'ACUMULABLE' ? 'bg-amber-100 text-amber-900' : inflation.tipo === 'DEDUCIBLE' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {INFLATION_TIPO_LABELS[inflation.tipo]}
            </span>
          </div>
          <div tabIndex={0} role="region" aria-labelledby="annual-inflation-heading" className="overflow-x-auto max-w-full">
            <table className="w-full text-xs">
              <caption className="visually-hidden">Cálculo del Ajuste Anual por Inflación conforme a los Artículos 44 al 46 de la LISR</caption>
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th scope="col" className="text-left py-1.5 px-2 font-bold">Concepto</th>
                  <th scope="col" className="text-right py-1.5 px-2 font-bold whitespace-nowrap">Importe / Factor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inflationRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="py-1.5 px-2 text-left font-normal text-slate-700">{row.label}</th>
                    <td className={`py-1.5 px-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-900 ${row.bold ? 'font-semibold' : ''}`}>{row.value}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold text-slate-900">
                  <th scope="row" className="py-2 px-2 text-left font-bold text-slate-900">{inflationEffectLabel}</th>
                  <td className="py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-900">{formatCurrency(inflationEffectValue)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <button
            type="button"
            aria-expanded={showMonthlyInflation}
            aria-controls="annual-inflation-monthly-panel"
            onClick={() => setShowMonthlyInflation((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
          >
            {showMonthlyInflation ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
            <span>{showMonthlyInflation ? 'Ocultar desglose mensual (12 meses)' : 'Ver desglose mensual (12 meses)'}</span>
          </button>

          {showMonthlyInflation && (
            <div id="annual-inflation-monthly-panel" tabIndex={0} role="region" aria-labelledby="annual-inflation-monthly-heading" className="max-h-52 overflow-y-auto overflow-x-auto max-w-full border border-slate-200 rounded-xl">
              <h4 id="annual-inflation-monthly-heading" className="visually-hidden">Desglose mensual de créditos y deudas (12 meses)</h4>
              <table className="w-full text-[11px]">
                <caption className="visually-hidden">Desglose mensual de créditos y deudas de cierre durante los 12 meses del ejercicio</caption>
                <thead className="bg-slate-50 text-slate-700 sticky top-0">
                  <tr>
                    <th scope="col" className="text-left py-1.5 px-2">Mes</th>
                    <th scope="col" className="text-right py-1.5 px-2 whitespace-nowrap">Créditos</th>
                    <th scope="col" className="text-right py-1.5 px-2 whitespace-nowrap">Deudas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inflation.monthlyRows.map((row) => (
                    <tr key={row.periodo}>
                      <th scope="row" className="py-1 px-2 text-left font-medium text-slate-700">{row.mesNombre}</th>
                      <td className="py-1 px-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-900">{formatCurrency(row.creditosCierre)}</td>
                      <td className="py-1 px-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-900">{formatCurrency(row.deudasCierre)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      <DeclaracionAnualIsrCard ejercicio={data.ejercicio} determination={determination} inputs={inputs} />

      <DeclaracionAnualInputsCard
        inputs={inputs}
        isSaving={saveMutation.isPending}
        isReadOnly={isReadOnly}
        onSave={(payload) => saveMutation.mutate({ companyId: targetCompanyId, year: targetYear, payload })}
      />
    </div>
  );
}
