import { useState } from 'react';
import { FileCode2, Plus, Sparkles, X } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { CfdiDocument } from '../../shared/types';

interface PolizaMultiCfdiBarProps {
  editingPolizaId: string | null;
  cfdiUuids: string[];
  pendingCfdis: CfdiDocument[];
  allCfdis?: CfdiDocument[];
  onSelectPrimaryCfdi: (uuid: string) => void;
  onAddCfdiUuid: (uuid: string) => void;
  onRemoveCfdiUuid: (uuid: string) => void;
}

export function PolizaMultiCfdiBar({
  editingPolizaId,
  cfdiUuids,
  pendingCfdis,
  allCfdis = [],
  onSelectPrimaryCfdi,
  onAddCfdiUuid,
  onRemoveCfdiUuid
}: PolizaMultiCfdiBarProps) {
  const [selectedAddUuid, setSelectedAddUuid] = useState('');
  const [manualUuidInput, setManualUuidInput] = useState('');

  const availableToLink = pendingCfdis.filter((c) => !cfdiUuids.includes(c.uuid.toUpperCase()));
  const cfdiLookup = new Map(
    [...allCfdis, ...pendingCfdis].map((c) => [c.uuid.toUpperCase(), c])
  );

  return (
    <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-xs text-blue-950">
          <Sparkles className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
          <div>
            <span className="font-bold block">
              Comprobantes CFDI 4.0 Asociados ({cfdiUuids.length})
            </span>
            <span className="text-[11px] text-blue-800">
              {editingPolizaId
                ? 'Agrega o quita múltiples UUIDs en cabecera o por partida individual.'
                : 'Selecciona un CFDI para autocompletar o vincula múltiples UUIDs a esta póliza.'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {availableToLink.length > 0 && (
            <>
              <select
                aria-label="Seleccionar CFDI para asociar a la póliza"
                value={selectedAddUuid}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  if (!editingPolizaId && cfdiUuids.length === 0) {
                    onSelectPrimaryCfdi(val);
                  } else {
                    onAddCfdiUuid(val);
                  }
                  setSelectedAddUuid('');
                }}
                className="px-2.5 py-1.5 rounded-xl border border-blue-300 bg-white text-xs font-mono text-slate-800 max-w-xs cursor-pointer"
              >
                <option value="">
                  {cfdiUuids.length === 0 && !editingPolizaId
                    ? '-- Autocompletar / Asociar CFDI --'
                    : '+ Asociar otro CFDI del ADD...'}
                </option>
                {availableToLink.map((c) => (
                  <option key={c.id} value={c.uuid}>
                    [{c.direction}] {c.serie}-{c.folio} ({formatCurrency(c.total)}) -{' '}
                    {c.direction === 'EMITIDO' ? c.receptorNombre : c.emisorNombre}
                  </option>
                ))}
              </select>
            </>
          )}

          <div className="inline-flex items-center gap-1">
            <input
              type="text"
              value={manualUuidInput}
              onChange={(e) => setManualUuidInput(e.target.value.toUpperCase())}
              placeholder="Pegar UUID manual..."
              aria-label="Pegar UUID CFDI manual"
              className="w-44 px-2.5 py-1.5 rounded-xl border border-blue-300 bg-white text-[11px] font-mono text-slate-800 uppercase"
            />
            <button
              type="button"
              disabled={!manualUuidInput.trim()}
              onClick={() => {
                onAddCfdiUuid(manualUuidInput.trim().toUpperCase());
                setManualUuidInput('');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold disabled:opacity-40 cursor-pointer"
            >
              <Plus className="w-3 h-3" aria-hidden="true" />
              Vincular
            </button>
          </div>
        </div>
      </div>

      {cfdiUuids.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-blue-200/70">
          {cfdiUuids.map((u) => {
            const match = cfdiLookup.get(u.toUpperCase());
            return (
              <span
                key={u}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-[11px] font-mono text-slate-800 shadow-2xs"
              >
                <FileCode2 className="w-3 h-3 text-blue-700 shrink-0" aria-hidden="true" />
                <span title={u}>
                  {match ? `${match.serie}-${match.folio} (${formatCurrency(match.total)}) · ` : ''}
                  {u.slice(0, 12)}...
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveCfdiUuid(u)}
                  aria-label={`Desvincular UUID ${u}`}
                  className="text-slate-400 hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
