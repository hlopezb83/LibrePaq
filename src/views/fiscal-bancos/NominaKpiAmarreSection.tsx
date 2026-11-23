import { AlertCircle, CheckCircle2, Users } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { PayrollPeriodSummary } from '../../shared/types/payroll-summary.types';

export interface NominaKpiAmarreSectionProps {
  summary: PayrollPeriodSummary;
  periodLabel: string;
}

export function NominaKpiAmarreSection({ summary, periodLabel }: NominaKpiAmarreSectionProps) {
  const kpiCards = [
    {
      label: 'Recibos Timbrados (Tipo N)',
      value: String(summary.nominaCount),
      sub: `Periodo ${periodLabel}`,
      tone: 'text-slate-900',
      icon: true
    },
    {
      label: 'Total Percepciones',
      value: formatCurrency(summary.totalPercepciones),
      sub: `IMSS Obrero est.: ${formatCurrency(summary.imssObreroEstimado)}`,
      tone: 'text-slate-900'
    },
    {
      label: 'Subsidio al Empleo / Otros Pagos',
      value: formatCurrency(summary.totalSubsidioEmpleo),
      sub: 'Complemento Nómina 1.2',
      tone: 'text-blue-700'
    },
    {
      label: 'Neto Pagado',
      value: formatCurrency(summary.totalNetoPagado),
      sub: `ISR retenido: ${formatCurrency(summary.isrRetenidoCfdis)}`,
      tone: 'text-emerald-700'
    }
  ];

  const amarreMeta =
    summary.amarreStatus === 'CUADRADO'
      ? { badge: 'bg-emerald-50 text-emerald-800 border-emerald-300', label: 'CUADRADO vs Libros' }
      : summary.amarreStatus === 'DIFERENCIA'
        ? { badge: 'bg-red-50 text-red-800 border-red-300', label: 'CON DIFERENCIA' }
        : { badge: 'bg-slate-100 text-slate-700 border-slate-300', label: 'SIN NÓMINA EN PERIODO' };

  const amarreRows = [
    { label: 'ISR Retenido CFDIs (Nómina 1.2)', value: formatCurrency(summary.isrRetenidoCfdis), tone: 'text-slate-900' },
    { label: `Saldo Acreedor Libros (${summary.cuentaIsrCode})`, value: formatCurrency(summary.isrRetenidoLibros), tone: 'text-slate-900' },
    {
      label: 'Diferencia (CFDIs − Libros)',
      value: formatCurrency(summary.diferenciaIsrAmarre),
      tone: summary.diferenciaIsrAmarre === 0 ? 'text-emerald-700' : 'text-red-700'
    }
  ];

  return (
    <>
      <section aria-labelledby="nomina-kpi-heading" className="space-y-2">
        <h2 id="nomina-kpi-heading" className="visually-hidden">Resumen mensual de Nómina 1.2</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiCards.map((k) => (
            <div key={k.label} className="bg-white p-4 rounded-2xl border border-slate-300/90 shadow-2xs min-w-0">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                <span>{k.label}</span>
                {k.icon && <Users className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />}
              </div>
              <p className={`text-xl font-bold font-mono tabular-nums mt-1 ${k.tone}`}>{k.value}</p>
              <p className="text-[11px] font-mono tabular-nums text-slate-600 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="nomina-amarre-heading" className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="min-w-0">
            <h2 id="nomina-amarre-heading" className="text-sm font-bold text-slate-900">
              Amarre ISR Retenido por Salarios vs. Contabilidad ({summary.cuentaIsrCode})
            </h2>
            <p className="text-xs text-slate-600">
              Compara la suma de ISR retenido en CFDIs Tipo N vigentes contra los abonos del periodo en balanza
            </p>
          </div>
          <span role="status" className={`self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${amarreMeta.badge}`}>
            {summary.amarreStatus === 'CUADRADO' && <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
            {summary.amarreStatus === 'DIFERENCIA' && <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />}
            {amarreMeta.label}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {amarreRows.map((row) => (
            <div key={row.label} className="bg-slate-50 p-3 rounded-xl border border-slate-200 min-w-0">
              <span className="text-[11px] font-medium text-slate-600 block">{row.label}</span>
              <span className={`text-base font-bold font-mono tabular-nums ${row.tone}`}>{row.value}</span>
            </div>
          ))}
        </div>

        {summary.amarreStatus === 'DIFERENCIA' && (
          <p role="status" className="text-xs text-red-900 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            Existe una discrepancia entre el ISR retenido en los recibos Tipo N y los abonos contabilizados en la cuenta{' '}
            <strong className="font-mono">{summary.cuentaIsrCode}</strong>. Revisa las pólizas de nómina del periodo o verifica que no falten XMLs Tipo N por importar o cancelar.
          </p>
        )}
        {summary.amarreStatus === 'SIN_NOMINA' && (
          <p role="status" className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            No se encontraron recibos de nómina (CFDI Tipo N) vigentes en el periodo {periodLabel}. Si pagaste sueldos, importa los XMLs correspondientes en la <strong>Bóveda Digital (ADD)</strong>.
          </p>
        )}
      </section>
    </>
  );
}
