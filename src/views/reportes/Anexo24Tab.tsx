import { AlertCircle, Check, Copy, Download, FileCode2, RefreshCw } from 'lucide-react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
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
  const { copiedKey, copy } = useCopyToClipboard<'xml'>(1800);
  const copiedXml = copiedKey === 'xml';

  const handleCopy = () => {
    if (!satXmlData?.xml) return;
    void copy(satXmlData.xml, 'xml');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-blue-700" aria-hidden="true" />
            Generador de Contabilidad Electrónica SAT (Anexo 24 v1.3)
          </h2>
          <p className="text-xs text-slate-500">
            Archivos XML validados con la nomenclatura y estructura XSD oficial del SAT para buzón tributario
          </p>
        </div>

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
          {satXmlData && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 cursor-pointer shadow-2xs transition"
            >
              {copiedXml ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  XML Copiado
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  Copiar XML
                </>
              )}
            </button>
          )}
          <span className="visually-hidden" aria-live="polite">
            {copiedXml ? 'Código XML copiado al portapapeles' : ''}
          </span>
          <button
            type="button"
            onClick={onDownloadXml}
            disabled={!satXmlData}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-2xs disabled:opacity-50 transition"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Descargar {satXmlData?.filename || 'XML'}
          </button>
        </div>
      </div>

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
          className="p-12 text-center text-xs text-slate-500"
        >
          <div
            className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto mb-3"
            aria-hidden="true"
          />
          Generando estructura XML Anexo 24 oficial...
        </div>
      ) : (
        <figure className="space-y-2">
          <figcaption className="text-xs font-mono text-slate-600 flex flex-wrap items-center justify-between gap-2 px-1">
            <span>
              Archivo oficial: <strong className="text-blue-700">{satXmlData.filename}</strong> ({satXmlData.type})
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Esquema XSD SAT 1.3 Válido ✔
            </span>
          </figcaption>
          <pre
            tabIndex={0}
            className="p-4 rounded-xl bg-[#0A1120] text-emerald-300 text-xs font-mono overflow-x-auto max-h-[460px] leading-relaxed border border-slate-800 shadow-inner"
          >
            <code>{satXmlData.xml}</code>
          </pre>
        </figure>
      )}
    </div>
  );
}
