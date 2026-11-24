import { Link } from '@tanstack/react-router';
import { Clock, FileCode2, Lock, Printer, ReceiptText, ShieldAlert, Sparkles } from 'lucide-react';
import { MESES_SAT } from '../../shared/sat-constants';
import type { Company } from '../../shared/types';

export interface DashboardHeaderBarProps {
  company: Company;
  mesActualNombre: string;
  cfdisPendientesCount: number;
  efosAlertCount?: number;
  isPeriodLocked?: boolean;
  isReadOnly?: boolean;
  onOpenDeliverables: () => void;
}

export function DashboardHeaderBar({
  company,
  mesActualNombre,
  cfdisPendientesCount,
  efosAlertCount = 0,
  isPeriodLocked = false,
  isReadOnly = false,
  onOpenDeliverables
}: DashboardHeaderBarProps) {
  const isAnnualAdjustment = company.currentPeriod === 13;
  const nextMonthPeriod = company.currentPeriod === 12 ? 1 : company.currentPeriod + 1;
  const nextMonthName =
    MESES_SAT.find((m) => m.periodo === nextMonthPeriod)?.nombre || 'Siguiente Mes';
  const satDeadlineLabel = isAnnualAdjustment
    ? 'Cierre Anual (P13)'
    : `Límite SAT: 17 de ${nextMonthName}`;
  const satDeadlineTitle = isAnnualAdjustment
    ? `Periodo de ajuste y cierre anual del ejercicio ${company.currentYear} ante el SAT (Declaración Anual Art. 9 / 150 LISR)`
    : `Fecha legal límite para presentación de Pagos Provisionales (ISR, IVA) y DIOT del periodo ${mesActualNombre} ante el SAT (Art. 12 CFF / Art. 14 LISR)`;
  const isCaptureDisabled = isPeriodLocked || isReadOnly;
  const darkFocusRing =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300';

  return (
    <div className="bg-[#0A1120] border border-[#1E293B] rounded-2xl p-3.5 sm:px-5 sm:py-4 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-200 bg-[#111C35] border border-blue-800/70 px-2.5 py-0.5 rounded-full">
            <Sparkles className="w-3 h-3 text-blue-400" aria-hidden="true" />
            Tablero Fiscal • {mesActualNombre} {company.currentYear}
          </div>
          <Link
            to="/fiscal-bancos"
            search={{ tab: 'DIA17' } as unknown as Record<string, string>}
            title={satDeadlineTitle}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-950/60 hover:bg-amber-900/70 border border-amber-600/40 px-2.5 py-0.5 rounded-full transition ${darkFocusRing}`}
          >
            <Clock className="w-3 h-3 text-amber-400" aria-hidden="true" />
            <span>{satDeadlineLabel}</span>
          </Link>
          {efosAlertCount > 0 && (
            <Link
              to="/fiscal-bancos"
              search={{ tab: 'PADRON_RFC' } as unknown as Record<string, string>}
              title="Revisar proveedores o terceros señalados en la lista del Art. 69-B CFF"
              className={`inline-flex items-center gap-1.5 text-xs font-bold text-red-200 bg-red-950/80 hover:bg-red-900/80 border border-red-500/60 px-2.5 py-0.5 rounded-full transition ${darkFocusRing}`}
            >
              <ShieldAlert className="w-3 h-3 text-red-300" aria-hidden="true" />
              <span>{efosAlertCount} EFOS 69-B</span>
            </Link>
          )}
          {isPeriodLocked && (
            <div
              role="status"
              title="Este periodo está cerrado con candado fiscal ante el SAT; solo se permiten consultas y auditoría."
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200 bg-amber-900/50 border border-amber-500/50 px-2.5 py-0.5 rounded-full"
            >
              <Lock className="w-3 h-3 text-amber-300" aria-hidden="true" />
              <span>Periodo Cerrado (Solo Consulta)</span>
            </div>
          )}
        </div>
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
          Resumen General de Operaciones
        </h1>
        <p className="text-xs text-slate-300">
          Ejercicio fiscal <span className="font-mono font-bold text-white">{company.currentYear}</span> •{' '}
          {company.regimenFiscal} • CP <span className="font-mono">{company.codigoPostal}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenDeliverables}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold text-white transition cursor-pointer ${darkFocusRing}`}
        >
          <Printer className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
          Dossier de Cierre (PDF)
        </button>
        <Link
          to="/add"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold text-white transition ${darkFocusRing}`}
        >
          <FileCode2 className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
          Bóveda ADD ({cfdisPendientesCount} pendientes)
        </Link>
        <Link
          to="/polizas"
          search={isCaptureDisabled ? undefined : ({ nueva: 'true' } as unknown as Record<string, string>)}
          title={
            isReadOnly
              ? 'Modo solo lectura: consultar pólizas del periodo'
              : isPeriodLocked
              ? 'Periodo cerrado: consultar pólizas del periodo'
              : 'Abrir captura rápida de nueva póliza contable'
          }
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${darkFocusRing} ${
            isCaptureDisabled
              ? 'bg-white/10 hover:bg-white/15 border border-white/20 text-slate-200'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
          }`}
        >
          <ReceiptText className="w-3.5 h-3.5" aria-hidden="true" />
          {isCaptureDisabled ? 'Consultar Pólizas' : 'Capturar Póliza'}
        </Link>
      </div>
    </div>
  );
}
