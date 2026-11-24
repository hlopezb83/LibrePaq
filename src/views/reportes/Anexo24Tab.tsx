import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  FileCode2,
  RefreshCw
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { downloadBlobFile } from '../../lib/formatters';
import {
  isValidSatNumOrden,
  isValidSatNumTramite,
  type SatXmlType
} from '../../shared/sat-anexo24';
import { buildSatAnexo24Zip } from '../../shared/sat-anexo24-zip';
import { Anexo24OptionsBar, type Anexo24UiOptions } from './Anexo24OptionsBar';

interface Anexo24TabProps {
  companyRfc: string;
  ejercicio: number;
  periodo: number;
  satXmlType: SatXmlType;
  setSatXmlType: (type: SatXmlType) => void;
  anexo24Options: Anexo24UiOptions;
  setAnexo24Options: (next: Anexo24UiOptions) => void;
  satXmlData: { xml: string; filename: string; type: string } | undefined;
  isLoadingXml: boolean;
  isErrorXml?: boolean;
  xmlError?: unknown;
  onRetryXml?: () => void;
  onDownloadXml: () => void;
}

const XML_TYPE_BUTTONS: ReadonlyArray<{ id: SatXmlType; label: string }> = [
  { id: 'balanza', label: 'Balanza (BN/BC)' },
  { id: 'catalogo', label: 'Catálogo (CT)' },
  { id: 'polizas', label: 'Pólizas (PL)' },
  { id: 'auxiliar_folios', label: 'Aux. Folios (XF)' },
  { id: 'auxiliar_cuentas', label: 'Aux. Cuentas (XC)' }
];

export function Anexo24Tab({
  companyRfc,
  ejercicio,
  periodo,
  satXmlType,
  setSatXmlType,
  anexo24Options,
  setAnexo24Options,
  satXmlData,
  isLoadingXml,
  isErrorXml,
  xmlError,
  onRetryXml,
  onDownloadXml
}: Anexo24TabProps) {
  const toast = useToast();
  const { copiedKey, copy } = useCopyToClipboard<'xml'>(1800);
  const copiedXml = copiedKey === 'xml';

  const needsSolicitud =
    satXmlType === 'polizas' ||
    satXmlType === 'auxiliar_folios' ||
    satXmlType === 'auxiliar_cuentas';
  const isOrdenSolicitud =
    anexo24Options.tipoSolicitud === 'AF' || anexo24Options.tipoSolicitud === 'FC';
  const capturedFolio = isOrdenSolicitud
    ? anexo24Options.numOrden.trim()
    : anexo24Options.numTramite.trim();
  const missingSolicitudFolio = needsSolicitud && capturedFolio.length === 0;
  const invalidSolicitudFolio =
    needsSolicitud &&
    capturedFolio.length > 0 &&
    (isOrdenSolicitud
      ? !isValidSatNumOrden(capturedFolio)
      : !isValidSatNumTramite(capturedFolio));
  const hasSolicitudWarning = missingSolicitudFolio || invalidSolicitudFolio;
  const isMissingFechaModBal =
    satXmlType === 'balanza' &&
    anexo24Options.tipoEnvio === 'C' &&
    !anexo24Options.fechaModBal.trim();
  const isDownloadBlocked = !satXmlData || hasSolicitudWarning || isMissingFechaModBal;
  const blockedDownloadTitle = !satXmlData
    ? 'Esperando generación del archivo XML Anexo 24...'
    : isMissingFechaModBal
      ? 'Captura la FechaModBal requerida para envío Complementario (C)'
      : missingSolicitudFolio
        ? `Captura ${isOrdenSolicitud ? 'NumOrden' : 'NumTramite'} requerido para ${anexo24Options.tipoSolicitud}`
        : `Corrige el formato de ${isOrdenSolicitud ? 'NumOrden' : 'NumTramite'} antes de descargar`;

  const handleCopy = () => {
    if (!satXmlData?.xml) return;
    void copy(satXmlData.xml, 'xml');
  };

  const handleDownloadZip = () => {
    if (!satXmlData?.xml || !satXmlData.filename) return;
    try {
      const zipRes = buildSatAnexo24Zip({
        company: { rfc: companyRfc },
        year: ejercicio,
        period: periodo,
        type: satXmlType,
        xmlResult: satXmlData,
        tipoEnvio: anexo24Options.tipoEnvio
      });
      const zipBuffer = zipRes.zipBytes.buffer.slice(
        zipRes.zipBytes.byteOffset,
        zipRes.zipBytes.byteOffset + zipRes.zipBytes.byteLength
      ) as ArrayBuffer;
      downloadBlobFile(zipRes.zipFilename, zipBuffer, 'application/zip');
      toast.success(`Paquete ZIP SAT descargado: ${zipRes.zipFilename}`);
    } catch {
      toast.error('No se pudo empaquetar el archivo .ZIP para el SAT');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-5 sm:p-6 space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
            <span>Generador de Contabilidad Electrónica SAT (Anexo 24 v1.3)</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Archivos XML validados con la nomenclatura y estructura XSD oficial del SAT para buzón tributario
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tipo de archivo XML SAT">
            {XML_TYPE_BUTTONS.map((btn) => (
              <button
                key={btn.id}
                type="button"
                aria-pressed={satXmlType === btn.id}
                onClick={() => setSatXmlType(btn.id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                  satXmlType === btn.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {satXmlData && (
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 cursor-pointer shadow-2xs transition"
              >
                {copiedXml ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                    <span>XML Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copiar XML</span>
                  </>
                )}
              </button>
            )}
            <span className="visually-hidden" aria-live="polite">
              {copiedXml ? 'Código XML copiado al portapapeles' : ''}
            </span>
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={isDownloadBlocked}
              title={
                isDownloadBlocked
                  ? blockedDownloadTitle
                  : `Empaquetar ${satXmlData.filename} en .ZIP oficial para Buzón Tributario`
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <FileArchive className="w-4 h-4" aria-hidden="true" />
              <span>Descargar .ZIP SAT Oficial</span>
            </button>
            <button
              type="button"
              onClick={onDownloadXml}
              disabled={isDownloadBlocked}
              title={
                isDownloadBlocked
                  ? blockedDownloadTitle
                  : `Descargar ${satXmlData.filename} sin comprimir`
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300 cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Descargar .XML</span>
            </button>
          </div>
        </div>
      </div>

      <Anexo24OptionsBar
        satXmlType={satXmlType}
        options={anexo24Options}
        onChange={setAnexo24Options}
      />

      {isErrorXml ? (
        <div
          role="alert"
          className="p-8 text-center rounded-xl border border-red-200 bg-red-50/70 space-y-3"
        >
          <AlertCircle className="w-6 h-6 text-red-600 mx-auto" aria-hidden="true" />
          <div className="text-xs font-semibold text-red-900">
            No se pudo generar el XML Anexo 24
          </div>
          <p className="text-xs text-red-700">
            {xmlError instanceof Error ? xmlError.message : 'Error de conexión al generar el XML.'}
          </p>
          {onRetryXml && (
            <button
              type="button"
              onClick={onRetryXml}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Reintentar XML
            </button>
          )}
        </div>
      ) : isLoadingXml || !satXmlData ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="p-12 text-center text-xs text-slate-600"
        >
          <div
            className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto mb-3"
            aria-hidden="true"
          />
          Generando estructura XML Anexo 24 oficial...
        </div>
      ) : (
        <figure className="space-y-2">
          <figcaption className="text-xs font-mono text-slate-700 flex flex-wrap items-center justify-between gap-2 px-1">
            <span>
              Archivo oficial: <strong className="text-blue-700 break-all">{satXmlData.filename}</strong> ({satXmlData.type})
            </span>
            {hasSolicitudWarning || isMissingFechaModBal ? (
              <span
                role="status"
                className="inline-flex items-center gap-1 text-amber-900 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                <span>
                  {isMissingFechaModBal
                    ? 'Captura FechaModBal requerida para envío Complementario (C)'
                    : missingSolicitudFolio
                      ? `Captura ${isOrdenSolicitud ? 'NumOrden' : 'NumTramite'} requerido para ${anexo24Options.tipoSolicitud}`
                      : `${isOrdenSolicitud ? 'NumOrden' : 'NumTramite'} con formato inválido`}
                </span>
              </span>
            ) : (
              <span
                role="status"
                className="inline-flex items-center gap-1 text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Esquema XSD SAT 1.3 Válido</span>
              </span>
            )}
          </figcaption>
          <p className="text-[11px] text-slate-600 px-1">
            Regla 2.8.1.5 RMF:{' '}
            {satXmlType === 'polizas' || satXmlType === 'auxiliar_folios' || satXmlType === 'auxiliar_cuentas'
              ? 'Los archivos PL, XF y XC se presentan ante el SAT en solicitudes de devolución, compensación o facultades de comprobación; el botón "Descargar .ZIP SAT Oficial" ya los empaqueta con la nomenclatura SAT.'
              : 'El botón "Descargar .ZIP SAT Oficial" ya empaqueta este XML dentro de un comprimido .ZIP conservando exactamente la nomenclatura oficial del SAT para enviarlo por Buzón Tributario.'}
          </p>
          <pre
            tabIndex={0}
            role="region"
            aria-label="Vista previa del código XML Anexo 24"
            className="p-4 rounded-xl bg-[#0A1120] text-emerald-300 text-xs font-mono overflow-x-auto max-h-[460px] leading-relaxed border border-slate-800 shadow-inner"
          >
            <code>{satXmlData.xml}</code>
          </pre>
        </figure>
      )}
    </div>
  );
}
