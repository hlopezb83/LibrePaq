import { useState } from 'react';
import { FileCode2, Plus, Sparkles, X } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { CfdiDocument } from '../../shared/types';
import { isValidSatUuid } from './polizaDirtyCheck';

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

  const trimmedManualUuid = manualUuidInput.trim().toUpperCase();
  const hasManualInput = trimmedManualUuid.length > 0;
  const isManualUuidInvalid = hasManualInput && !isValidSatUuid(trimmedManualUuid);

  const handleLinkManualUuid = () => {
    if (!hasManualInput || isManualUuidInvalid) return;
    onAddCfdiUuid(trimmedManualUuid);
    setManualUuidInput('');
  };

  const availableToLink = pendingCfdis.filter((c) => !cfdiUuids.includes(c.uuid.toUpperCase()));
  const cfdiLookup = new Map(
    [...allCfdis, ...pendingCfdis].map((c) => [c.uuid.toUpperCase(), c])
  );

  return (
    <div className="p-3 sm:p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2.5 w-full max-w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
        <div className="flex items-center gap-2 text-xs text-blue-950 min-w-0">
          <Sparkles className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <span className="font-bold block">
              Comprobantes CFDI 4.0 Asociados ({cfdiUuids.length})
            </span>
            <span className="text-[11px] text-blue-800 block">
              {editingPolizaId
                ? 'Agrega o quita múltiples UUIDs en cabecera o por partida individual.'
                : 'Selecciona un CFDI para autocompletar o vincula múltiples UUIDs a esta póliza.'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto max-w-full min-w-0">
          {availableToLink.length > 0 ? (
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
              className="w-full sm:w-auto max-w-full sm:max-w-xs min-w-0 px-2.5 py-1.5 rounded-xl border border-blue-300 bg-white text-xs font-mono text-slate-800 cursor-pointer"
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
          ) : (
            <span className="text-[11px] text-blue-900/80 bg-white/80 border border-blue-200 rounded-xl px-2.5 py-1.5 max-w-full">
              Sin CFDIs pendientes en ADD (puedes pegar un UUID manual)
            </span>
          )}

          <div className="flex flex-col items-start gap-1 w-full sm:w-auto max-w-full min-w-0">
            <div className="inline-flex flex-wrap items-center gap-1 w-full sm:w-auto max-w-full min-w-0">
              <input
                type="text"
                value={manualUuidInput}
                onChange={(e) => setManualUuidInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLinkManualUuid();
                  }
                }}
                placeholder="Pegar UUID SAT (36 caracteres)..."
                aria-label="Pegar UUID CFDI manual"
                aria-invalid={isManualUuidInvalid}
                aria-describedby={isManualUuidInvalid ? 'manual-uuid-error' : undefined}
                className={`flex-1 sm:flex-initial w-full sm:w-48 min-w-0 max-w-full px-2.5 py-1.5 rounded-xl border bg-white text-[11px] font-mono text-slate-800 uppercase ${
                  isManualUuidInvalid
                    ? 'border-red-500 ring-1 ring-red-500/30'
                    : 'border-blue-300'
                }`}
              />
              <button
                type="button"
                disabled={!hasManualInput || isManualUuidInvalid}
                title={
                  isManualUuidInvalid
                    ? 'Ingresa un UUID SAT válido (8-4-4-4-12 hex)'
                    : 'Vincular UUID a la póliza'
                }
                onClick={handleLinkManualUuid}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="w-3 h-3" aria-hidden="true" />
                Vincular
              </button>
            </div>
            {isManualUuidInvalid && (
              <span id="manual-uuid-error" role="alert" className="text-[10px] font-semibold text-red-700">
                Formato UUID SAT inválido (ej. 550E8400-E29B-41D4-A716-446655440000)
              </span>
            )}
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
                  className="min-w-[24px] min-h-[24px] inline-flex items-center justify-center rounded text-slate-600 hover:text-red-700 hover:bg-red-50 cursor-pointer transition"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
