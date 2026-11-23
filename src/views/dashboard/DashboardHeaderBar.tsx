import { Link } from '@tanstack/react-router';
import { Clock, FileCode2, Lock, Printer, ReceiptText, Sparkles } from 'lucide-react';
import { MESES_SAT } from '../../shared/sat-constants';
import type { Company } from '../../shared/types';

export interface DashboardHeaderBarProps {
  company: Company;
  mesActualNombre: string;
  cfdisPendientesCount: number;
  isPeriodLocked?: boolean;
  onOpenDeliverables: () => void;
}

export function DashboardHeaderBar({
  company,
  mesActualNombre,
  cfdisPendientesCount,
  isPeriodLocked = false,
  onOpenDeliverables
}: DashboardHeaderBarProps) {
  const nextMonthPeriod = company.currentPeriod === 12 ? 1 : company.currentPeriod + 1;
  const nextMonthName =
    MESES_SAT.find((m) => m.periodo === nextMonthPeriod)?.nombre || 'Siguiente Mes';

  return (
    <div className="bg-[#0A1120] border border-[#1E293B] rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3.5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-200 bg-[#111C35] border border-blue-800/70 px-2.5 py-0.5 rounded-full">
            <Sparkles className="w-3 h-3 text-blue-400" aria-hidden="true" />
            Tablero Fiscal • {mesActualNombre} {company.currentYear}
          </div>
          <div
            title={`Fecha legal límite para presentación de Pagos Provisionales (ISR, IVA) y DIOT del periodo ${mesActualNombre} ante el SAT (Art. 12 CFF / Art. 14 LISR)`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-950/60 border border-amber-600/40 px-2.5 py-0.5 rounded-full"
          >
            <Clock className="w-3 h-3 text-amber-400" aria-hidden="true" />
            <span>Límite SAT: 17 de {nextMonthName}</span>
          </div>
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
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Resumen General de Operaciones
        </h1>
        <p className="text-xs text-slate-300">
          Ejercicio fiscal <span className="font-mono font-bold text-white">{company.currentYear}</span> •{' '}
          {company.regimenFiscal} • CP <span className="font-mono">{company.codigoPostal}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpenDeliverables}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold text-white transition cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
          Dossier de Cierre (PDF)
        </button>
        <Link
          to="/add"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold text-white transition"
        >
          <FileCode2 className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
          Bóveda ADD ({cfdisPendientesCount} pendientes)
        </Link>
        <Link
          to="/polizas"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-xs transition"
        >
          <ReceiptText className="w-3.5 h-3.5" aria-hidden="true" />
          Capturar Póliza
        </Link>
      </div>
    </div>
  );
}
