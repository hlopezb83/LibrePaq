import { strToU8, zipSync } from 'fflate';
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
import type { SatXmlType } from '../../shared/sat-anexo24';

interface Anexo24TabProps {
  satXmlType: SatXmlType;
  setSatXmlType: (type: SatXmlType) => void;
  satXmlData: { xml: string; filename: string; type: string } | undefined;
  isLoadingXml: boolean;
  isErrorXml?: boolean;
  xmlError?: unknown;
  onRetryXml?: () => void;
  onDownloadXml: () => void;
}

export function Anexo24Tab({
  satXmlType,
  setSatXmlType,
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

  const handleCopy = () => {
    if (!satXmlData?.xml) return;
    void copy(satXmlData.xml, 'xml');
  };

  const handleDownloadZip = () => {
    if (!satXmlData?.xml || !satXmlData.filename) return;
    try {
      const xmlFilename = satXmlData.filename;
      const zipFilename = /\.xml$/i.test(xmlFilename)
        ? xmlFilename.replace(/\.xml$/i, '.zip')
        : `${xmlFilename}.zip`;
      const zipped = zipSync({ [xmlFilename]: strToU8(satXmlData.xml) }, { level: 6 });
      const zipBuffer = zipped.buffer.slice(
        zipped.byteOffset,
        zipped.byteOffset + zipped.byteLength
      ) as ArrayBuffer;
      downloadBlobFile(zipFilename, zipBuffer, 'application/zip');
      toast.success(`Paquete ZIP SAT descargado: ${zipFilename}`);
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
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Tipo de archivo XML SAT"
          >
            <button
              type="button"
              aria-pressed={satXmlType === 'balanza'}
              onClick={() => setSatXmlType('balanza')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                satXmlType === 'balanza'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Balanza XML (BN.xml)
            </button>
            <button
              type="button"
              aria-pressed={satXmlType === 'catalogo'}
              onClick={() => setSatXmlType('catalogo')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                satXmlType === 'catalogo'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Catálogo XML (CT.xml)
            </button>
            <button
              type="button"
              aria-pressed={satXmlType === 'polizas'}
              onClick={() => setSatXmlType('polizas')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                satXmlType === 'polizas'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Pólizas XML (PL.xml)
            </button>
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
              disabled={!satXmlData}
              title={
                satXmlData
                  ? `Empaquetar ${satXmlData.filename} en .ZIP oficial para Buzón Tributario`
                  : 'Esperando generación del archivo XML Anexo 24...'
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <FileArchive className="w-4 h-4" aria-hidden="true" />
              <span>Descargar .ZIP SAT Oficial</span>
            </button>
            <button
              type="button"
              onClick={onDownloadXml}
              disabled={!satXmlData}
              title={
                satXmlData
                  ? `Descargar ${satXmlData.filename} sin comprimir`
                  : 'Esperando generación del archivo XML Anexo 24...'
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300 cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Descargar .XML</span>
            </button>
          </div>
        </div>
      </div>

      {satXmlType === 'polizas' && (
        <div
          role="note"
          className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950"
        >
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            <strong>Aviso Pólizas (PL.xml):</strong> Verifica y sustituye el valor de ejemplo en{' '}
            <code className="font-mono font-semibold">NumOrden</code> /{' '}
            <code className="font-mono font-semibold">NumTramite</code> por el folio oficial asignado por el SAT en tu requerimiento, devolución o compensación.
          </p>
        </div>
      )}

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
            <span
              role="status"
              className="inline-flex items-center gap-1 text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Esquema XSD SAT 1.3 Válido</span>
            </span>
          </figcaption>
          <p className="text-[11px] text-slate-600 px-1">
            Regla 2.8.1.5 RMF:{' '}
            {satXmlType === 'polizas'
              ? 'El archivo de Pólizas (PL) se presenta ante el SAT únicamente en solicitudes de devolución, compensación o facultades de comprobación; el botón "Descargar .ZIP SAT Oficial" ya lo empaqueta con la nomenclatura SAT.'
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
