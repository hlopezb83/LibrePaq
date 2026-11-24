import { Copy, ShieldAlert } from 'lucide-react';
import { StatusBadge } from '../../components/ui';
import { checkRfc69BStatus } from '../../shared/sat-69b';
import type { CfdiDocument } from '../../shared/types';

export function CfdiTipoCell({ row }: { row: CfdiDocument }) {
  const tipoLabel =
    row.tipoComprobante === 'P'
      ? 'REP 2.0'
      : row.tipoComprobante === 'N'
      ? 'Nómina 1.2'
      : row.tipoComprobante === 'E'
      ? 'Nota Créd. (E)'
      : row.tipoComprobante === 'T'
      ? 'Traslado (T)'
      : 'Ingreso (I)';

  const directionTone =
    row.tipoComprobante === 'P'
      ? 'slate'
      : row.direction === 'EMITIDO'
      ? 'emerald'
      : 'blue';

  return (
    <div className="space-y-1 whitespace-nowrap">
      <div className="flex items-center gap-1">
        <StatusBadge tone={directionTone} shape="tag">
          {row.direction}
        </StatusBadge>
        {(row.metodoPago === 'PUE' || row.metodoPago === 'PPD') && (
          <span
            title={
              row.metodoPago === 'PPD'
                ? 'Pago en Parcialidades o Diferido'
                : 'Pago en Una Sola Exhibición'
            }
          >
            <StatusBadge
              tone={row.metodoPago === 'PPD' ? 'amber' : 'slate'}
              shape="tag"
            >
              {row.metodoPago}
            </StatusBadge>
          </span>
        )}
      </div>
      <div className="text-[11px] font-mono text-slate-700 font-semibold">{tipoLabel}</div>
    </div>
  );
}

export function CfdiTerceroCell({
  row,
  copiedUuid,
  handleCopyUuid
}: {
  row: CfdiDocument;
  copiedUuid: string | null;
  handleCopyUuid: (uuid: string) => void;
}) {
  const terceroNombre = row.direction === 'EMITIDO' ? row.receptorNombre : row.emisorNombre;
  const terceroRfc = row.direction === 'EMITIDO' ? row.receptorRfc : row.emisorRfc;
  const efosCheck = checkRfc69BStatus(terceroRfc);
  const isCancelled = row.statusSat === 'CANCELADO';

  return (
    <div className="max-w-[260px]">
      <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
        <span className={`truncate ${isCancelled ? 'line-through text-slate-500' : ''}`}>
          {terceroNombre}
        </span>
        <StatusBadge tone="slate" shape="tag" className="font-normal">
          {terceroRfc}
        </StatusBadge>
        {efosCheck.isEfos && (
          <span title="Contribuyente listado en Artículo 69-B del CFF (EFOS SAT). Comprobante presuntamente no deducible.">
            <StatusBadge
              tone="red"
              shape="tag"
              icon={<ShieldAlert className="w-3 h-3" aria-hidden="true" />}
            >
              69-B: {efosCheck.record?.situacion || 'EFOS'}
            </StatusBadge>
          </span>
        )}
      </div>
      <div
        className={`text-xs truncate mt-0.5 ${isCancelled ? 'line-through text-slate-500' : 'text-slate-600'}`}
        title={row.conceptoPrincipal}
      >
        {row.conceptoPrincipal}
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[10px] font-mono text-slate-600 whitespace-nowrap" title={row.uuid}>
          UUID: {row.uuid.slice(0, 8)}…{row.uuid.slice(-4)}
        </span>
        <button
          type="button"
          onClick={() => handleCopyUuid(row.uuid)}
          aria-label={`Copiar UUID completo ${row.uuid}`}
          title="Copiar UUID completo al portapapeles"
          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
        >
          <Copy className="w-2.5 h-2.5" aria-hidden="true" />
          {copiedUuid === row.uuid ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}
