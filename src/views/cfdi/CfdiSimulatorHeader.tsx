import { Button } from '../../components/ui';
import type { ForeignReceiptPreset } from './useCfdiSimulatorForm';

interface CfdiSimulatorHeaderProps {
  onApplyPreset: (preset: ForeignReceiptPreset) => void;
}

export function CfdiSimulatorHeader({ onApplyPreset }: CfdiSimulatorHeaderProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onApplyPreset('FOREIGN_USD')}
      >
        1. Factura Extranjero USD (Software / Cloud)
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onApplyPreset('FOREIGN_EUR')}
      >
        2. Servicio Extranjero EUR
      </Button>
      <Button
        variant="danger-outline"
        size="sm"
        onClick={() => onApplyPreset('NO_CFDI')}
      >
        3. Gasto Sin CFDI (No Deducible)
      </Button>
    </div>
  );
}
