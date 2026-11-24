import { Eye } from 'lucide-react';
import { AlertBanner } from '../ui';

export function ReadOnlyRoleBanner() {
  return (
    <AlertBanner
      variant="bar"
      tone="info"
      icon={<Eye className="w-4 h-4" aria-hidden="true" />}
      title="Acceso de Cliente (Solo lectura)"
      className="no-print"
    >
      Puedes consultar reportes, pólizas, XML y exportar Excel/PDF. Las ediciones las gestiona tu Despacho.
    </AlertBanner>
  );
}
