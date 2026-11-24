import React, { useState, useEffect, useMemo } from 'react';
import { Check, Copy, Download, Search, X } from 'lucide-react';
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
  const [xmlSearch, setXmlSearch] = useState('');
  const [copiedXml, setCopiedXml] = useState(false);

  const displayedXml = useMemo(() => {
    const q = xmlSearch.trim().toLowerCase();
    if (!q) return xmlContent;
    const matched = xmlContent
      .split('\n')
      .filter((line) => line.toLowerCase().includes(q));
    return matched.length > 0
      ? matched.join('\n')
      : `<!-- Sin coincidencias para "${xmlSearch.trim()}" -->`;
  }, [xmlContent, xmlSearch]);

  useEffect(() => {
    if (!selectedCfdi) {
      setXmlContent('');
      return;
    }
    if (selectedCfdi.xmlRaw) {
      setXmlContent(selectedCfdi.xmlRaw);
      return;
    }
    let cancelled = false;
    setXmlContent('<!-- Cargando XML desde la Bóveda SAT... -->');
    void apiClient
      .getCfdiXml(selectedCfdi.id)
      .then((xml) => {
        if (!cancelled) setXmlContent(xml || '<!-- XML no disponible -->');
      })
      .catch(() => {
        if (!cancelled) setXmlContent('<!-- Error al cargar XML del comprobante -->');
      });
    return () => {
      cancelled = true;
    };
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

  const handleClose = () => {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    } else {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="modal-xml-viewer-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-3xl open:flex open:flex-col max-h-[92dvh] overflow-hidden p-0 m-auto backdrop:bg-slate-900/60"
    >
      {selectedCfdi && (
        <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3.5 scrollable-panel">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div className="min-w-0">
              <h2 id="modal-xml-viewer-title" className="text-base font-bold text-slate-900">
                Comprobante Fiscal Digital CFDI 4.0 ({selectedCfdi.serie}-{selectedCfdi.folio})
              </h2>
              <p className="text-xs font-mono text-slate-600 break-all">UUID: {selectedCfdi.uuid}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                onClick={handleClose}
                aria-label="Cerrar visor XML"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <figure className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <figcaption className="text-xs font-semibold text-slate-700">
                Estructura XML Anexo 20 v4.0 con Timbre Fiscal Digital SAT:
              </figcaption>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  type="search"
                  value={xmlSearch}
                  onChange={(e) => setXmlSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && xmlSearch) {
                      e.preventDefault();
                      e.stopPropagation();
                      setXmlSearch('');
                    }
                  }}
                  placeholder="Filtrar nodos o atributos..."
                  aria-label="Filtrar líneas XML"
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
            <pre
              tabIndex={0}
              className="dark-surface p-4 rounded-xl bg-[#0A1120] text-emerald-300 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed"
            >
              <code>{displayedXml}</code>
            </pre>
          </figure>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(xmlContent);
                setCopiedXml(true);
                setTimeout(() => setCopiedXml(false), 1800);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              {copiedXml ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {copiedXml ? 'XML Copiado' : 'Copiar XML'}
            </button>
            <button
              type="button"
              onClick={handleClose}
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
