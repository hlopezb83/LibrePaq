import { AlertTriangle } from 'lucide-react';
import { AlertBanner, FormField, Input, Select } from '../../components/ui';
import {
  isValidSatNumOrden,
  isValidSatNumTramite,
  type SatXmlType
} from '../../shared/sat-anexo24';
import type { SatSolicitudTipo } from '../../shared/sat-anexo24-auxiliaries';

export interface Anexo24UiOptions {
  tipoEnvio: 'N' | 'C';
  fechaModBal: string;
  balanzaLevel?: 'ALL' | 'N2';
  omitZeroAccounts?: boolean;
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
    const missingFechaMod = !options.fechaModBal.trim();
    return (
      <div className="flex flex-wrap items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <FormField label="Tipo de Envío (SAT)" htmlFor="anexo24-tipo-envio">
          <Select
            id="anexo24-tipo-envio"
            size="sm"
            value={options.tipoEnvio}
            onChange={(e) =>
              onChange({ ...options, tipoEnvio: e.target.value === 'C' ? 'C' : 'N' })
            }
            className="font-semibold text-slate-800"
          >
            <option value="N">N — Normal (BN.xml)</option>
            <option value="C">C — Complementaria (BC.xml)</option>
          </Select>
        </FormField>

        {options.tipoEnvio === 'C' && (
          <FormField
            label="FechaModBal (Modificación)"
            htmlFor="anexo24-fecha-mod-bal"
            required
            error={missingFechaMod ? 'FechaModBal requerida para envío Complementario (C).' : undefined}
          >
            <Input
              id="anexo24-fecha-mod-bal"
              size="sm"
              type="date"
              required
              aria-invalid={missingFechaMod || undefined}
              value={options.fechaModBal}
              onChange={(e) => onChange({ ...options, fechaModBal: e.target.value })}
              className={`font-mono ${missingFechaMod ? 'border-red-500' : ''}`}
            />
          </FormField>
        )}

        <FormField label="Nivel en Balanza XML" htmlFor="anexo24-balanza-level">
          <Select
            id="anexo24-balanza-level"
            size="sm"
            value={options.balanzaLevel ?? 'ALL'}
            onChange={(e) =>
              onChange({ ...options, balanzaLevel: e.target.value === 'N2' ? 'N2' : 'ALL' })
            }
            className="font-semibold text-slate-800"
          >
            <option value="ALL">Todas las cuentas (N1–N3)</option>
            <option value="N2">Solo Subcuentas (Hasta N2)</option>
          </Select>
        </FormField>

        <label
          htmlFor="anexo24-omit-zero"
          className="inline-flex items-center gap-1.5 self-end pb-1.5 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
        >
          <input
            id="anexo24-omit-zero"
            type="checkbox"
            checked={Boolean(options.omitZeroAccounts)}
            onChange={(e) => onChange({ ...options, omitZeroAccounts: e.target.checked })}
            className="rounded text-blue-700"
          />
          <span>Omitir cuentas en $0.00</span>
        </label>
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
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <FormField label="TipoSolicitud (XSD v1.3)" htmlFor="anexo24-tipo-solicitud">
          <Select
            id="anexo24-tipo-solicitud"
            size="sm"
            value={options.tipoSolicitud}
            onChange={(e) =>
              onChange({ ...options, tipoSolicitud: e.target.value as SatSolicitudTipo })
            }
            className="font-semibold text-slate-800"
          >
            <option value="AF">AF — Acto de Fiscalización</option>
            <option value="FC">FC — Fiscalización Compulsa</option>
            <option value="DE">DE — Devolución</option>
            <option value="CO">CO — Compensación</option>
          </Select>
        </FormField>

        {isOrden ? (
          <FormField
            label="Número de Orden SAT (3 letras, 7 dígitos, / y 2 dígitos)"
            htmlFor="anexo24-num-orden"
            className="min-w-[260px]"
            error={
              ordenInvalid
                ? 'Formato SAT inválido: inicia con 3 letras, 1 dígito del 0 al 6, 6 dígitos más, diagonal y 2 dígitos finales (ej. ABC1234567/01).'
                : undefined
            }
            hint={
              ordenMissing ? (
                <span className="text-amber-800 font-semibold">
                  Requerido para {options.tipoSolicitud}: captura el Número de Orden oficial del citatorio u oficio SAT.
                </span>
              ) : undefined
            }
          >
            <Input
              id="anexo24-num-orden"
              size="sm"
              type="text"
              maxLength={13}
              value={options.numOrden}
              placeholder="Ej. ABC1234567/01"
              aria-invalid={ordenMissing || ordenInvalid || undefined}
              onChange={(e) =>
                onChange({ ...options, numOrden: e.target.value.toUpperCase() })
              }
              className={`font-mono uppercase ${
                ordenInvalid ? 'border-red-500 text-red-900' : ordenMissing ? 'border-amber-400' : ''
              }`}
            />
          </FormField>
        ) : (
          <FormField
            label="Número de Trámite SAT (2 letras + 12 dígitos)"
            htmlFor="anexo24-num-tramite"
            className="min-w-[260px]"
            error={
              tramiteInvalid
                ? 'Formato SAT inválido: captura 2 letras mayúsculas seguidas de 12 dígitos numéricos (ej. DE202600000001).'
                : undefined
            }
            hint={
              tramiteMissing ? (
                <span className="text-amber-800 font-semibold">
                  Requerido para {options.tipoSolicitud}: captura el folio de trámite asignado por el SAT.
                </span>
              ) : undefined
            }
          >
            <Input
              id="anexo24-num-tramite"
              size="sm"
              type="text"
              maxLength={14}
              value={options.numTramite}
              placeholder="Ej. DE202600000001"
              aria-invalid={tramiteMissing || tramiteInvalid || undefined}
              onChange={(e) =>
                onChange({ ...options, numTramite: e.target.value.toUpperCase() })
              }
              className={`font-mono uppercase ${
                tramiteInvalid ? 'border-red-500 text-red-900' : tramiteMissing ? 'border-amber-400' : ''
              }`}
            />
          </FormField>
        )}
      </div>

      <AlertBanner tone="warning" icon={<AlertTriangle className="w-4 h-4" aria-hidden="true" />}>
        <strong>Requerimiento SAT (PL / XF / XC):</strong> Captura el folio oficial{' '}
        <code className="font-mono font-semibold">{isOrden ? 'NumOrden' : 'NumTramite'}</code>{' '}
        asignado por el SAT antes de descargar el XML o .ZIP para Buzón Tributario.
      </AlertBanner>
    </div>
  );
}
