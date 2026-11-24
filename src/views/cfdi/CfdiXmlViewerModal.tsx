import React, { useEffect, useMemo, useState } from 'react';
import { Check, Code2, Copy, Download } from 'lucide-react';
import { Button, ModalShell, SearchInput } from '../../components/ui';
import { apiClient } from '../../lib/api-client';
import type { CfdiDocument } from '../../shared/types';

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

  const handleCopyXml = () => {
    navigator.clipboard?.writeText(xmlContent);
    setCopiedXml(true);
    setTimeout(() => setCopiedXml(false), 1800);
  };

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={Boolean(selectedCfdi)}
      onClose={handleClose}
      maxWidth="3xl"
      titleId="modal-xml-viewer-title"
      icon={<Code2 className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      title={
        selectedCfdi
          ? `Comprobante Fiscal Digital CFDI 4.0 (${selectedCfdi.serie}-${selectedCfdi.folio})`
          : 'Visor XML CFDI 4.0'
      }
      subtitle={
        selectedCfdi ? (
          <span className="font-mono break-all">UUID: {selectedCfdi.uuid}</span>
        ) : undefined
      }
      closeLabel="Cerrar visor XML"
      headerExtra={
        selectedCfdi ? (
          <Button
            variant="export"
            size="sm"
            onClick={handleDownload}
            leftIcon={<Download className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            Descargar .XML
          </Button>
        ) : undefined
      }
      bodyClassName="space-y-3.5 scrollable-panel"
      footer={
        selectedCfdi ? (
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={handleCopyXml}
              leftIcon={
                copiedXml ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )
              }
            >
              {copiedXml ? 'XML Copiado' : 'Copiar XML'}
            </Button>
            <Button variant="primary" size="md" onClick={handleClose}>
              Cerrar Visor
            </Button>
          </>
        ) : undefined
      }
    >
      {selectedCfdi && (
        <figure className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <figcaption className="text-xs font-semibold text-slate-700">
              Estructura XML Anexo 20 v4.0 con Timbre Fiscal Digital SAT:
            </figcaption>
            <SearchInput
              size="sm"
              value={xmlSearch}
              onChange={setXmlSearch}
              placeholder="Filtrar nodos o atributos..."
              aria-label="Filtrar líneas XML"
              clearLabel="Limpiar filtro XML"
              containerClassName="w-full sm:w-64"
              className="font-mono"
            />
          </div>
          <pre
            tabIndex={0}
            className="dark-surface p-4 rounded-xl bg-[#0A1120] text-emerald-300 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed"
          >
            <code>{displayedXml}</code>
          </pre>
        </figure>
      )}
    </ModalShell>
  );
}
