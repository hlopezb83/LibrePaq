import React, { useState, useEffect } from 'react';
import { Copy, Download, X } from 'lucide-react';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import type { CfdiDocument } from '../../shared/types';
import { apiClient } from '../../lib/api-client';

export interface CfdiXmlViewerModalProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  selectedCfdi: CfdiDocument | null;
  onClose: () => void;
  onDownloadXml: () => void;
}

export function CfdiXmlViewerModal({
  dialogRef,
  selectedCfdi,
  onClose,
  onDownloadXml
}: CfdiXmlViewerModalProps) {
  useDialogLightDismiss(dialogRef, onClose);
  const [xmlContent, setXmlContent] = useState<string>(selectedCfdi?.xmlRaw || '');

  useEffect(() => {
    if (!selectedCfdi) {
      setXmlContent('');
      return;
    }
    if (selectedCfdi.xmlRaw) {
      setXmlContent(selectedCfdi.xmlRaw);
    } else {
      setXmlContent('<!-- Cargando XML desde la Bóveda SAT... -->');
      void apiClient
        .getCfdiXml(selectedCfdi.id)
        .then((xml) => setXmlContent(xml || '<!-- XML no disponible -->'))
        .catch(() => setXmlContent('<!-- Error al cargar XML del comprobante -->'));
    }
  }, [selectedCfdi]);

  const handleDownload = () => {
    if (!xmlContent || xmlContent.startsWith('<!--')) {
      onDownloadXml();
      return;
    }
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedCfdi?.uuid || 'cfdi'}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="modal-xml-viewer-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-3xl overflow-hidden"
    >
      {selectedCfdi && (
        <div className="p-4 sm:p-5 max-h-[86dvh] overflow-y-auto overscroll-contain space-y-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 id="modal-xml-viewer-title" className="text-base font-bold text-slate-900">
                Comprobante Fiscal Digital CFDI 4.0 ({selectedCfdi.serie}-{selectedCfdi.folio})
              </h2>
              <p className="text-xs font-mono text-slate-500">UUID: {selectedCfdi.uuid}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Descargar .XML
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar visor XML"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <figure>
            <figcaption className="text-xs font-semibold text-slate-600 mb-2">
              Estructura XML Anexo 20 v4.0 con Timbre Fiscal Digital SAT:
            </figcaption>
            <pre
              tabIndex={0}
              className="p-4 rounded-xl bg-[#0A1120] text-emerald-300 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed"
            >
              <code>{xmlContent}</code>
            </pre>
          </figure>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(xmlContent)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              Copiar XML
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0A1120] text-white hover:bg-slate-800 cursor-pointer"
            >
              Cerrar Visor
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
