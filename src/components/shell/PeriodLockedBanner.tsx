import { Lock } from 'lucide-react';
import { MESES_SAT } from '../../shared/sat-constants';
import { AlertBanner, Button } from '../ui';

interface PeriodLockedBannerProps {
  period: number;
  year: number;
  canReopen?: boolean;
  isReopening?: boolean;
  onReopen?: () => void;
}

/**
 * Aviso global del shell cuando el período fiscal activo está cerrado ante cambios.
 */
export function PeriodLockedBanner({
  period,
  year,
  canReopen = false,
  isReopening = false,
  onReopen
}: PeriodLockedBannerProps) {
  const mesNombre =
    MESES_SAT.find((m) => m.periodo === period)?.nombre ?? (period === 13 ? 'Cierre Anual' : `Periodo ${period}`);
  const periodLabel = `P${String(period).padStart(2, '0')} (${mesNombre} ${year})`;

  return (
    <AlertBanner
      variant="bar"
      tone="warning"
      icon={<Lock className="w-4 h-4" aria-hidden="true" />}
      title={`Periodo fiscal cerrado (${periodLabel})`}
      className="no-print"
      action={
        canReopen && onReopen ? (
          <Button
            variant="secondary"
            size="sm"
            loading={isReopening}
            onClick={onReopen}
          >
            {isReopening ? 'Reabriendo...' : 'Reabrir periodo'}
          </Button>
        ) : undefined
      }
    >
      La captura, edición y eliminación de pólizas, CFDIs e inventarios está bloqueada para proteger la declaración del periodo.
    </AlertBanner>
  );
}
