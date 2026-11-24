import { Link } from '@tanstack/react-router';
import {
  Clock,
  Eye,
  FileCode2,
  LayoutDashboard,
  Lock,
  Printer,
  ReceiptText,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { Button, PageHeader, StatusBadge, getButtonClasses } from '../../components/ui';
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

  return (
    <PageHeader
      icon={<LayoutDashboard className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      eyebrow={
        <>
          <StatusBadge tone="blue" icon={<Sparkles className="w-3 h-3" aria-hidden="true" />}>
            Tablero Fiscal • {mesActualNombre} {company.currentYear}
          </StatusBadge>
          <Link
            to="/fiscal-bancos"
            search={{ tab: 'DIA17' } as unknown as Record<string, string>}
            title={satDeadlineTitle}
            className="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <StatusBadge tone="amber" icon={<Clock className="w-3 h-3" aria-hidden="true" />}>
              {satDeadlineLabel}
            </StatusBadge>
          </Link>
          {efosAlertCount > 0 && (
            <Link
              to="/fiscal-bancos"
              search={{ tab: 'PADRON_RFC' } as unknown as Record<string, string>}
              title="Revisar proveedores o terceros señalados en la lista del Art. 69-B CFF"
              className="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <StatusBadge tone="red" icon={<ShieldAlert className="w-3 h-3" aria-hidden="true" />}>
                {efosAlertCount} EFOS 69-B
              </StatusBadge>
            </Link>
          )}
          {isReadOnly && (
            <span
              role="status"
              title="Acceso en modo solo consulta: las acciones de escritura y captura están deshabilitadas."
            >
              <StatusBadge tone="sky" icon={<Eye className="w-3 h-3" aria-hidden="true" />}>
                Solo Consulta
              </StatusBadge>
            </span>
          )}
          {isPeriodLocked && (
            <span
              role="status"
              title="Este periodo está cerrado con candado fiscal ante el SAT; solo se permiten consultas y auditoría."
            >
              <StatusBadge tone="amber" icon={<Lock className="w-3 h-3" aria-hidden="true" />}>
                Periodo Cerrado (Solo Consulta)
              </StatusBadge>
            </span>
          )}
        </>
      }
      title="Resumen General de Operaciones"
      subtitle={
        <>
          Ejercicio fiscal <span className="font-mono font-bold text-slate-900">{company.currentYear}</span> •{' '}
          {company.regimenFiscal} • CP <span className="font-mono text-slate-800">{company.codigoPostal}</span>
        </>
      }
      actions={
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={onOpenDeliverables}
            leftIcon={<Printer className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />}
          >
            Dossier de Cierre (PDF)
          </Button>
          <Link to="/add" className={getButtonClasses('secondary', 'md')}>
            <FileCode2 className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            <span>Bóveda ADD ({cfdisPendientesCount} pendientes)</span>
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
            className={getButtonClasses(isCaptureDisabled ? 'secondary' : 'primary', 'md')}
          >
            <ReceiptText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isCaptureDisabled ? 'Consultar Pólizas' : 'Capturar Póliza'}</span>
          </Link>
        </>
      }
    />
  );
}
