import { ShieldAlert } from 'lucide-react';
import { AlertBanner } from '../../components/ui';
import type { DiotBatchValidationWarning } from '../../shared/engine/diot-txt';

export interface DiotStatusBannersProps {
  efosCount: number;
  unpostedPaidCfdisCount: number;
  regimenFiscal: string;
  isTruncatedLocal69B: boolean;
  cachedCount69B: number;
  totalCount69B: number;
  batchWarnings?: ReadonlyArray<DiotBatchValidationWarning>;
}

export function DiotStatusBanners({
  efosCount,
  unpostedPaidCfdisCount,
  regimenFiscal,
  isTruncatedLocal69B,
  cachedCount69B,
  totalCount69B,
  batchWarnings = []
}: DiotStatusBannersProps) {
  const isResico = regimenFiscal.startsWith('626');
  const hasAny =
    efosCount > 0 ||
    isTruncatedLocal69B ||
    unpostedPaidCfdisCount > 0 ||
    batchWarnings.length > 0 ||
    isResico;
  if (!hasAny) return null;

  return (
    <div className="space-y-3 mx-5 mt-4">
      {efosCount > 0 && (
        <AlertBanner
          tone="danger"
          icon={<ShieldAlert className="w-4 h-4" aria-hidden="true" />}
          title={`Alerta Art. 69-B CFF: ${efosCount} proveedor(es) listado(s) como EFOS en esta DIOT`}
        >
          <span className="block text-[11px]">
            Verifica materialidad y estatus en el padrón oficial del SAT antes de acreditar este IVA en tu declaración mensual.
          </span>
        </AlertBanner>
      )}

      {isTruncatedLocal69B && (
        <AlertBanner
          tone="warning"
          title={`Padrón 69-B parcial en este equipo (${cachedCount69B.toLocaleString()} de ${totalCount69B.toLocaleString()} RFCs)`}
        >
          <span className="block text-[11px]">
            El navegador no pudo conservar todo el padrón SAT 69-B localmente y la verificación en la nube no está confirmada. Reimporta el archivo oficial o verifica tu conexión para validar el 100% de RFCs.
          </span>
        </AlertBanner>
      )}

      {unpostedPaidCfdisCount > 0 && (
        <AlertBanner
          tone="warning"
          title={`${unpostedPaidCfdisCount} CFDI(s) PUE/REP pagado(s) sin póliza contable en el periodo`}
        >
          <span className="block text-[11px]">
            La DIOT solo reporta CFDIs efectivamente pagados y contabilizados en pólizas del periodo. Contabiliza estos comprobantes para incluirlos en el archivo batch.
          </span>
        </AlertBanner>
      )}

      {batchWarnings.length > 0 && (
        <AlertBanner
          tone="warning"
          title={`${batchWarnings.length} validación(es) de layout DIOT 54 campos (Campo 13 <= Campo 12)`}
        >
          <ul className="list-disc pl-4 text-[11px] space-y-0.5">
            {batchWarnings.slice(0, 5).map((w, idx) => (
              <li key={`${w.rfc}-${idx}`}>
                <strong className="font-mono">{w.rfc}</strong> ({w.nombre}): {w.message}
              </li>
            ))}
          </ul>
        </AlertBanner>
      )}

      {isResico && (
        <AlertBanner
          tone="blue"
          title="Regla 3.13.17 RMF · Relevamiento DIOT para RESICO"
        >
          <span className="block text-[11px]">
            Las Personas Físicas y Morales que tributan en RESICO (626) cuyos ingresos del ejercicio anterior no excedan $4,000,000 MXN quedan relevadas de presentar la DIOT conforme a la Regla 3.13.17 RMF. Este papel sigue disponible como control interno y soporte de IVA acreditable.
          </span>
        </AlertBanner>
      )}
    </div>
  );
}
