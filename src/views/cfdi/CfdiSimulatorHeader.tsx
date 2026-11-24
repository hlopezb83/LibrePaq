import { Button } from '../../components/ui';
import type { CfdiSimulatorPreset } from './useCfdiSimulatorForm';

interface CfdiSimulatorHeaderProps {
  onApplyPreset: (preset: CfdiSimulatorPreset) => void;
}

export function CfdiSimulatorHeader({ onApplyPreset }: CfdiSimulatorHeaderProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onApplyPreset('NORMAL')}
      >
        1. Factura Gasto Normal (16% IVA)
      </Button>
      <Button
        variant="danger-outline"
        size="sm"
        onClick={() => onApplyPreset('HONORARIOS_RET')}
      >
        2. Honorarios con Retención ISR e IVA
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onApplyPreset('REP_PAGO')}
      >
        3. Complemento de Pago REP 2.0 (Tipo P)
      </Button>
    </div>
  );
}
