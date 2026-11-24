import { useNavigate } from '@tanstack/react-router';
import { AlertCircle, BookOpen, CheckCircle2, FileUp, Users } from 'lucide-react';
import { AlertBanner, Button, KpiCard, StatusBadge, type BadgeTone } from '../../components/ui';
import { useUIModal } from '../../context/UIModalContext';
import { formatCurrency } from '../../lib/formatters';
import type { PayrollPeriodSummary } from '../../shared/types/payroll-summary.types';

export interface NominaKpiAmarreSectionProps {
  summary: PayrollPeriodSummary;
  periodLabel: string;
  isrAccountId?: string;
}

export function NominaKpiAmarreSection({ summary, periodLabel, isrAccountId }: NominaKpiAmarreSectionProps) {
  const navigate = useNavigate();
  const { openLedger } = useUIModal();

  const amarreMeta: { tone: BadgeTone; label: string } =
    summary.amarreStatus === 'CUADRADO'
      ? { tone: 'emerald', label: 'CUADRADO vs Libros' }
      : summary.amarreStatus === 'DIFERENCIA'
        ? { tone: 'red', label: 'CON DIFERENCIA' }
        : { tone: 'slate', label: 'SIN NÓMINA EN PERIODO' };

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
          <KpiCard
            label="Recibos Timbrados (Tipo N)"
            value={String(summary.nominaCount)}
            icon={<Users className="w-4 h-4" aria-hidden="true" />}
            hint={`Periodo ${periodLabel}`}
          />
          <KpiCard
            label="Total Percepciones"
            value={formatCurrency(summary.totalPercepciones)}
            hint={`IMSS Obrero est.: ${formatCurrency(summary.imssObreroEstimado)}`}
          />
          <KpiCard
            label="Subsidio al Empleo / Otros Pagos"
            value={formatCurrency(summary.totalSubsidioEmpleo)}
            valueClassName="text-blue-700"
            hint="Complemento Nómina 1.2"
          />
          <KpiCard
            label="Neto Pagado"
            value={formatCurrency(summary.totalNetoPagado)}
            valueClassName="text-emerald-700"
            hint={`ISR retenido: ${formatCurrency(summary.isrRetenidoCfdis)}`}
          />
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
          <span role="status" className="self-start sm:self-auto shrink-0">
            <StatusBadge
              tone={amarreMeta.tone}
              icon={
                summary.amarreStatus === 'CUADRADO' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                ) : summary.amarreStatus === 'DIFERENCIA' ? (
                  <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                ) : undefined
              }
            >
              {amarreMeta.label}
            </StatusBadge>
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
          <AlertBanner
            tone="danger"
            action={
              isrAccountId && (
                <Button
                  size="sm"
                  variant="danger-outline"
                  onClick={() => openLedger(isrAccountId)}
                  leftIcon={<BookOpen className="w-3.5 h-3.5" aria-hidden="true" />}
                >
                  Ver Libro Mayor ({summary.cuentaIsrCode})
                </Button>
              )
            }
          >
            Existe una discrepancia entre el ISR retenido en los recibos Tipo N y los abonos contabilizados en la cuenta{' '}
            <strong className="font-mono">{summary.cuentaIsrCode}</strong>. Revisa las pólizas de nómina del periodo o verifica XMLs Tipo N.
          </AlertBanner>
        )}

        {summary.amarreStatus === 'SIN_NOMINA' && (
          <AlertBanner
            tone="info"
            action={
              <Button
                size="sm"
                variant="primary"
                onClick={() => void navigate({ to: '/add' })}
                leftIcon={<FileUp className="w-3.5 h-3.5" aria-hidden="true" />}
              >
                Ir a Bóveda Digital (ADD)
              </Button>
            }
          >
            No se encontraron recibos de nómina (CFDI Tipo N) vigentes en el periodo {periodLabel}. Si pagaste sueldos, importa los XMLs correspondientes en la <strong>Bóveda Digital (ADD)</strong>.
          </AlertBanner>
        )}
      </section>
    </>
  );
}
