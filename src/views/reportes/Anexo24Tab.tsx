import { useState } from 'react';
import { Copy, Download, FileCode2, Check } from 'lucide-react';
import type { SatXmlType } from '../../shared/sat-anexo24';

interface Anexo24TabProps {
  satXmlType: SatXmlType;
  setSatXmlType: (type: SatXmlType) => void;
  satXmlData: { xml: string; filename: string; type: string } | undefined;
  isLoadingXml: boolean;
  onDownloadXml: () => void;
}

export function Anexo24Tab({
  satXmlType,
  setSatXmlType,
  satXmlData,
  isLoadingXml,
  onDownloadXml
}: Anexo24TabProps) {
  const [copiedXml, setCopiedXml] = useState(false);

  const handleCopy = () => {
    if (!satXmlData?.xml) return;
    navigator.clipboard?.writeText(satXmlData.xml);
    setCopiedXml(true);
    setTimeout(() => setCopiedXml(false), 1800);
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
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

      {isLoadingXml || !satXmlData ? (
        <div className="p-12 text-center text-xs text-slate-500">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto mb-3" />
          Generando estructura XML Anexo 24 oficial...
        </div>
      ) : (
        <figure className="space-y-2">
          <figcaption className="text-xs font-mono text-slate-600 flex items-center justify-between px-1">
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
