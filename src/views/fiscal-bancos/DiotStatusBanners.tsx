import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';

export interface DiotStatusBannersProps {
  efosCount: number;
  unpostedPaidCfdisCount: number;
  regimenFiscal: string;
  isTruncatedLocal69B: boolean;
  cachedCount69B: number;
  totalCount69B: number;
}

export function DiotStatusBanners({
  efosCount,
  unpostedPaidCfdisCount,
  regimenFiscal,
  isTruncatedLocal69B,
  cachedCount69B,
  totalCount69B
}: DiotStatusBannersProps) {
  const isResico = regimenFiscal.startsWith('626');

  return (
    <div className="space-y-3 mx-5 mt-4">
      {efosCount > 0 && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-red-50 border border-red-300 flex items-start gap-2.5 text-xs text-red-950"
        >
          <ShieldAlert className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong className="block font-bold text-red-900">
              Alerta Art. 69-B CFF: {efosCount} proveedor(es) listado(s) como EFOS en esta DIOT
            </strong>
            <span className="text-[11px] text-red-800">
              Verifica materialidad y estatus en el padrón oficial del SAT antes de acreditar este IVA en tu declaración mensual.
            </span>
          </div>
        </div>
      )}

      {isTruncatedLocal69B && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-xs text-amber-950"
        >
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong className="block font-bold text-amber-900">
              Caché local 69-B truncada ({cachedCount69B.toLocaleString()} de {totalCount69B.toLocaleString()} RFCs)
            </strong>
            <span className="text-[11px] text-amber-800">
              El almacenamiento del navegador no retuvo todo el padrón SAT 69-B y la verificación en la nube no está confirmada. Reimporta o sincroniza en la nube para validar el 100% de RFCs.
            </span>
          </div>
        </div>
      )}

      {unpostedPaidCfdisCount > 0 && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-xs text-amber-950"
        >
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong className="block font-bold text-amber-900">
              {unpostedPaidCfdisCount} CFDI(s) PUE/REP pagado(s) sin póliza contable en el periodo
            </strong>
            <span className="text-[11px] text-amber-800">
              La DIOT solo reporta CFDIs efectivamente pagados y contabilizados en pólizas del periodo. Contabiliza estos comprobantes para incluirlos en el archivo batch.
            </span>
          </div>
        </div>
      )}

      {isResico && (
        <div
          role="note"
          className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2.5 text-xs text-blue-950"
        >
          <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong className="block font-bold text-blue-900">
              Regla 3.13.17 RMF · Relevamiento DIOT para RESICO
            </strong>
            <span className="text-[11px] text-blue-800">
              Las Personas Físicas y Morales que tributan en RESICO (626) cuyos ingresos del ejercicio anterior no excedan $4,000,000 MXN quedan relevadas de presentar la DIOT conforme a la Regla 3.13.17 RMF. Este papel sigue disponible como control interno y soporte de IVA acreditable.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
