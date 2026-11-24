import { CalendarClock, FileCheck2, FileSpreadsheet, Printer, Scale, TrendingUp } from 'lucide-react';
import { Button, KpiCard, StatusBadge } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
import { formatBalanceCutoffLabel, calculateDia17Deadline } from '../../shared/date-utils';
import type { DeliverableTabId } from '../../components/deliverables/useExecutiveDeliverables';

interface DossierEntregablesTabProps {
  mesNombre: string;
  ejercicio: number;
  periodo?: number;
  totals: { finalDeudor: number };
  incomeStatement: { utilidadNeta: number };
  balanceSheet: { totalActivo: number };
  onOpenDeliverablesModal: (tab?: DeliverableTabId) => void;
}

export function DossierEntregablesTab({
  mesNombre,
  ejercicio,
  periodo = 10,
  totals,
  incomeStatement,
  balanceSheet,
  onOpenDeliverablesModal
}: DossierEntregablesTabProps) {
  const dia17Deadline = calculateDia17Deadline(ejercicio, periodo).formattedSpanish;
  const isLoss = incomeStatement.utilidadNeta < 0;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <StatusBadge tone="blue" icon={<FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />}>
              Dossier Oficial de Entregables
            </StatusBadge>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Carpeta de Cierre Contable y Fiscal —{' '}
              {periodo === 13
                ? formatBalanceCutoffLabel(ejercicio, periodo, mesNombre)
                : `${mesNombre} ${ejercicio}`}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
              Paquete integral de estados financieros dictaminados bajo NIF mexicanas, cédula fiscal Día 17 y papeles de trabajo para dirección y auditores.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="primary"
              size="lg"
              onClick={() => onOpenDeliverablesModal('DOSSIER')}
              leftIcon={<Printer className="w-4 h-4" aria-hidden="true" />}
            >
              Abrir Centro de Impresión / PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="1 · Balanza de Comprobación"
          value={formatCurrency(totals.finalDeudor)}
          valueClassName="text-emerald-800"
          icon={<FileSpreadsheet className="w-4 h-4" aria-hidden="true" />}
          iconTone="blue"
          hint="Anexo 24 R.M.F. / NIF B-1"
          onClick={() => onOpenDeliverablesModal('BALANZA')}
          footer={
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-600 font-medium">Sumas Iguales</span>
              <span className="font-semibold text-blue-700">Vista previa →</span>
            </div>
          }
        />

        <KpiCard
          label="2 · Estado de Resultados"
          value={formatCurrency(incomeStatement.utilidadNeta)}
          valueClassName={isLoss ? 'text-red-700' : 'text-slate-900'}
          icon={<TrendingUp className="w-4 h-4" aria-hidden="true" />}
          iconTone="emerald"
          hint="NIF B-3 Integral con Análisis %"
          onClick={() => onOpenDeliverablesModal('RESULTADOS')}
          footer={
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-600 font-medium">
                {isLoss ? 'Pérdida Neta' : 'Utilidad Neta'}
              </span>
              <span className="font-semibold text-blue-700">Vista previa →</span>
            </div>
          }
        />

        <KpiCard
          label="3 · Balance General"
          value={formatCurrency(balanceSheet.totalActivo)}
          icon={<Scale className="w-4 h-4" aria-hidden="true" />}
          iconTone="blue"
          hint="NIF B-6 Posición Financiera"
          onClick={() => onOpenDeliverablesModal('BALANCE')}
          footer={
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-600 font-medium">Total Activo</span>
              <span className="font-semibold text-blue-700">Vista previa →</span>
            </div>
          }
        />

        <KpiCard
          label="4 · Cédula Fiscal Día 17"
          value={dia17Deadline}
          valueClassName="text-amber-800 text-base sm:text-lg"
          icon={<CalendarClock className="w-4 h-4" aria-hidden="true" />}
          iconTone="amber"
          hint="ISR Art. 14 / RESICO e IVA"
          onClick={() => onOpenDeliverablesModal('DIA17')}
          footer={
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-600 font-medium">Vencimiento</span>
              <span className="font-semibold text-blue-700">Vista previa →</span>
            </div>
          }
        />
      </div>
    </div>
  );
}
