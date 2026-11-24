import { AlertTriangle } from 'lucide-react';
import {
  isValidSatNumOrden,
  isValidSatNumTramite,
  type SatXmlType
} from '../../shared/sat-anexo24';
import type { SatSolicitudTipo } from '../../shared/sat-anexo24-auxiliaries';

export interface Anexo24UiOptions {
  tipoEnvio: 'N' | 'C';
  fechaModBal: string;
  tipoSolicitud: SatSolicitudTipo;
  numOrden: string;
  numTramite: string;
}

interface Anexo24OptionsBarProps {
  satXmlType: SatXmlType;
  options: Anexo24UiOptions;
  onChange: (next: Anexo24UiOptions) => void;
}

export function Anexo24OptionsBar({
  satXmlType,
  options,
  onChange
}: Anexo24OptionsBarProps) {
  const needsSolicitud =
    satXmlType === 'polizas' ||
    satXmlType === 'auxiliar_folios' ||
    satXmlType === 'auxiliar_cuentas';

  if (satXmlType === 'catalogo') return null;

  if (satXmlType === 'balanza') {
    return (
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
        <div className="space-y-1">
          <label htmlFor="anexo24-tipo-envio" className="block font-bold text-slate-700">
            Tipo de Envío (SAT)
          </label>
          <select
            id="anexo24-tipo-envio"
            value={options.tipoEnvio}
            onChange={(e) =>
              onChange({ ...options, tipoEnvio: e.target.value === 'C' ? 'C' : 'N' })
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
          >
            <option value="N">N — Normal (BN.xml)</option>
            <option value="C">C — Complementaria (BC.xml)</option>
          </select>
        </div>

        {options.tipoEnvio === 'C' && (
          <div className="space-y-1">
            <label htmlFor="anexo24-fecha-mod-bal" className="block font-bold text-slate-700">
              FechaModBal (Modificación)
            </label>
            <input
              id="anexo24-fecha-mod-bal"
              type="date"
              required
              aria-invalid={!options.fechaModBal.trim() || undefined}
              aria-describedby={!options.fechaModBal.trim() ? 'anexo24-fecha-mod-bal-error' : undefined}
              value={options.fechaModBal}
              onChange={(e) => onChange({ ...options, fechaModBal: e.target.value })}
              className={`rounded-lg border bg-white px-3 py-1.5 text-xs font-mono text-slate-800 ${
                !options.fechaModBal.trim() ? 'border-red-500' : 'border-slate-300'
              }`}
            />
            {!options.fechaModBal.trim() && (
              <p id="anexo24-fecha-mod-bal-error" className="text-[11px] text-red-700 font-semibold">
                FechaModBal requerida para envío Complementario (C).
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!needsSolicitud) return null;

  const isOrden = options.tipoSolicitud === 'AF' || options.tipoSolicitud === 'FC';
  const rawOrden = options.numOrden.trim().toUpperCase();
  const rawTramite = options.numTramite.trim().toUpperCase();
  const ordenMissing = isOrden && rawOrden.length === 0;
  const tramiteMissing = !isOrden && rawTramite.length === 0;
  const ordenInvalid = isOrden && rawOrden.length > 0 && !isValidSatNumOrden(rawOrden);
  const tramiteInvalid = !isOrden && rawTramite.length > 0 && !isValidSatNumTramite(rawTramite);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
        <div className="space-y-1">
          <label htmlFor="anexo24-tipo-solicitud" className="block font-bold text-slate-700">
            TipoSolicitud (XSD v1.3)
          </label>
          <select
            id="anexo24-tipo-solicitud"
            value={options.tipoSolicitud}
            onChange={(e) =>
              onChange({ ...options, tipoSolicitud: e.target.value as SatSolicitudTipo })
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
          >
            <option value="AF">AF — Acto de Fiscalización</option>
            <option value="FC">FC — Fiscalización Compulsa</option>
            <option value="DE">DE — Devolución</option>
            <option value="CO">CO — Compensación</option>
          </select>
        </div>

        {isOrden ? (
          <div className="space-y-1 min-w-[220px]">
            <label htmlFor="anexo24-num-orden" className="block font-bold text-slate-700">
              NumOrden (Formato: [A-Z]&#123;3&#125;[0-6]\d&#123;6&#125;/\d&#123;2&#125;)
            </label>
            <input
              id="anexo24-num-orden"
              type="text"
              maxLength={13}
              value={options.numOrden}
              placeholder="Ej. ABC1234567/01"
              aria-invalid={ordenMissing || ordenInvalid || undefined}
              aria-describedby={ordenMissing || ordenInvalid ? 'anexo24-num-orden-error' : undefined}
              onChange={(e) =>
                onChange({ ...options, numOrden: e.target.value.toUpperCase() })
              }
              className={`w-full rounded-lg border px-3 py-1.5 text-xs font-mono uppercase bg-white ${
                ordenInvalid
                  ? 'border-red-500 text-red-900'
                  : ordenMissing
                    ? 'border-amber-400 text-slate-800'
                    : 'border-slate-300 text-slate-800'
              }`}
            />
            {ordenMissing && (
              <p id="anexo24-num-orden-error" className="text-[11px] text-amber-800 font-semibold">
                Requerido para {options.tipoSolicitud}: captura el NumOrden oficial del SAT.
              </p>
            )}
            {ordenInvalid && (
              <p id="anexo24-num-orden-error" className="text-[11px] text-red-700 font-semibold">
                Debe cumplir patrón SAT XSD 1.3: 3 letras + dígito [0-6] + 6 dígitos + / + 2 dígitos.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1 min-w-[220px]">
            <label htmlFor="anexo24-num-tramite" className="block font-bold text-slate-700">
              NumTramite (Formato: AA000000000000)
            </label>
            <input
              id="anexo24-num-tramite"
              type="text"
              maxLength={14}
              value={options.numTramite}
              placeholder="Ej. DE202600000001"
              aria-invalid={tramiteMissing || tramiteInvalid || undefined}
              aria-describedby={tramiteMissing || tramiteInvalid ? 'anexo24-num-tramite-error' : undefined}
              onChange={(e) =>
                onChange({ ...options, numTramite: e.target.value.toUpperCase() })
              }
              className={`w-full rounded-lg border px-3 py-1.5 text-xs font-mono uppercase bg-white ${
                tramiteInvalid
                  ? 'border-red-500 text-red-900'
                  : tramiteMissing
                    ? 'border-amber-400 text-slate-800'
                    : 'border-slate-300 text-slate-800'
              }`}
            />
            {tramiteMissing && (
              <p id="anexo24-num-tramite-error" className="text-[11px] text-amber-800 font-semibold">
                Requerido para {options.tipoSolicitud}: captura el NumTramite oficial del SAT.
              </p>
            )}
            {tramiteInvalid && (
              <p id="anexo24-num-tramite-error" className="text-[11px] text-red-700 font-semibold">
                Debe cumplir patrón SAT XSD 1.3: 2 letras mayúsculas seguidas de 12 dígitos (ej. DE202600000001).
              </p>
            )}
          </div>
        )}
      </div>

      <div
        role="note"
        className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950"
      >
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          <strong>Requerimiento SAT (PL / XF / XC):</strong> Captura el folio oficial{' '}
          <code className="font-mono font-semibold">{isOrden ? 'NumOrden' : 'NumTramite'}</code>{' '}
          asignado por el SAT antes de descargar el XML o .ZIP para Buzón Tributario.
        </p>
      </div>
    </div>
  );
}
