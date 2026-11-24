import { useEffect, useMemo, useState } from 'react';
import { Check, Code2, Copy, Search } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { parseCfdiPreview } from '../../../shared/cfdi-preview-parser';
import type { CfdiDocument } from '../../../shared/types';

interface CfdiXmlTabProps {
  cfdi: CfdiDocument;
  copiedText: string | null;
  copyToClipboard: (text: string, label: string) => void;
  isLoadingXml?: boolean;
}

export function CfdiXmlTab({ cfdi, copiedText, copyToClipboard, isLoadingXml }: CfdiXmlTabProps) {
  const [fallbackXml, setFallbackXml] = useState<{ id: string; xml: string } | null>(null);
  const [loadingSelf, setLoadingSelf] = useState(false);
  const [viewMode, setViewMode] = useState<'NODES' | 'RAW'>('NODES');
  const [xmlSearch, setXmlSearch] = useState('');

  useEffect(() => {
    if (cfdi.xmlRaw || isLoadingXml !== undefined) {
      setFallbackXml(null);
      setLoadingSelf(false);
      return;
    }
    let cancelled = false;
    setLoadingSelf(true);
    void apiClient.getCfdiXml(cfdi.id).then((xml) => {
      if (!cancelled && xml) setFallbackXml({ id: cfdi.id, xml });
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoadingSelf(false);
    });
    return () => { cancelled = true; };
  }, [cfdi.id, cfdi.xmlRaw, isLoadingXml]);

  const resolvedCfdi =
    !cfdi.xmlRaw && fallbackXml?.id === cfdi.id ? { ...cfdi, xmlRaw: fallbackXml.xml } : cfdi;
  const preview = useMemo(() => parseCfdiPreview(resolvedCfdi), [resolvedCfdi]);
  const isReconstructed = !resolvedCfdi.xmlRaw;
  const loadingNow = Boolean(isLoadingXml ?? loadingSelf);
  const totalRet = preview.impuestos.totalImpuestosRetenidos;
  const retencionesSnippet =
    totalRet > 0
      ? `\n    <cfdi:Retenciones>\n${preview.impuestos.retenciones
          .map((r) => `      <cfdi:Retencion Impuesto="${r.impuesto}" Importe="${r.importe}" />\n`)
          .join('')}    </cfdi:Retenciones>`
      : '';
  const xmlPayload =
    resolvedCfdi.xmlRaw ||
    `<?xml version="1.0" encoding="UTF-8"?>\n<cfdi:Comprobante Version="${preview.comprobante.version}" Serie="${preview.comprobante.serie}" Folio="${preview.comprobante.folio}" Fecha="${preview.comprobante.fecha}" Total="${preview.comprobante.total}" SubTotal="${preview.comprobante.subtotal}" Moneda="${preview.comprobante.moneda}">\n  <cfdi:Emisor Rfc="${preview.emisor.rfc}" Nombre="${preview.emisor.nombre}"${preview.emisor.regimenFiscal ? ` RegimenFiscal="${preview.emisor.regimenFiscal}"` : ''}/>\n  <cfdi:Receptor Rfc="${preview.receptor.rfc}" Nombre="${preview.receptor.nombre}" UsoCFDI="${preview.receptor.usoCfdi}"/>\n  <cfdi:Impuestos TotalImpuestosTrasladados="${preview.impuestos.totalImpuestosTrasladados}"${
      totalRet > 0 ? ` TotalImpuestosRetenidos="${totalRet}"` : ''
    }>${retencionesSnippet}\n  </cfdi:Impuestos>\n</cfdi:Comprobante>`;

  const filteredRawXml = useMemo(() => {
    const q = xmlSearch.trim().toLowerCase();
    if (!q) return xmlPayload;
    const matched = xmlPayload.split('\n').filter((line) => line.toLowerCase().includes(q));
    return matched.length > 0
      ? matched.join('\n')
      : `<!-- Sin coincidencias para "${xmlSearch.trim()}" -->`;
  }, [xmlPayload, xmlSearch]);

  const matchesSearch = (text: string) =>
    !xmlSearch.trim() || text.toLowerCase().includes(xmlSearch.trim().toLowerCase());

  const showComprobante = matchesSearch(
    `Comprobante ${preview.comprobante.version} ${preview.comprobante.serie} ${preview.comprobante.folio} ${preview.comprobante.fecha} ${preview.comprobante.formaPago} ${preview.comprobante.metodoPago} ${preview.comprobante.moneda} ${preview.comprobante.subtotal} ${preview.comprobante.total} ${preview.comprobante.lugarExpedicion}`
  );
  const showEmisor = matchesSearch(
    `Emisor ${preview.emisor.rfc} ${preview.emisor.nombre} ${preview.emisor.regimenFiscal}`
  );
  const showReceptor = matchesSearch(
    `Receptor ${preview.receptor.rfc} ${preview.receptor.nombre} ${preview.receptor.usoCfdi} ${preview.receptor.domicilioFiscalReceptor} ${preview.receptor.regimenFiscalReceptor}`
  );
  const filteredConceptos = preview.conceptos.filter((c) =>
    matchesSearch(
      `Concepto ${c.claveProdServ} ${c.noIdentificacion || ''} ${c.descripcion} ${c.claveUnidad} ${c.unidad || ''} ${c.importe}`
    )
  );
  const showImpuestos = matchesSearch(
    `Impuestos Traslados Retenciones ${preview.impuestos.totalImpuestosTrasladados} ${totalRet} ${preview.impuestos.traslados
      .map((t) => `${t.impuesto} ${t.tipoFactor} ${t.importe}`)
      .join(' ')} ${preview.impuestos.retenciones.map((r) => `${r.impuesto} ${r.importe}`).join(' ')}`
  );
  const showTimbre = matchesSearch(
    `TimbreFiscalDigital ${preview.timbre.uuid} ${preview.timbre.fechaTimbrado} ${preview.timbre.rfcProvCertif} ${preview.timbre.noCertificadoSat} ${preview.timbre.selloCfd || ''} ${preview.timbre.selloSat || ''}`
  );
  const hasAnyMatchingNode =
    showComprobante ||
    showEmisor ||
    showReceptor ||
    filteredConceptos.length > 0 ||
    showImpuestos ||
    showTimbre;

  return (
    <div
      role="region"
      aria-label="Estructura XML del CFDI"
      className="dark-surface bg-slate-950 text-slate-100 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-inner font-mono text-xs space-y-4"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-slate-300 flex-wrap">
          <Code2 className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
          <span className="font-bold text-white font-sans text-sm">
            Estructura Jerárquica del XML CFDI {preview.comprobante.version}
          </span>
          {isReconstructed && (
            <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-200 border border-amber-700/70 font-sans text-[11px] font-semibold">
              Vista reconstruida (sin XML original)
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-900 border border-slate-700 p-0.5 font-sans text-[11px]" role="group" aria-label="Modo de visualización XML">
            <button
              type="button"
              aria-pressed={viewMode === 'NODES'}
              onClick={() => setViewMode('NODES')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition ${
                viewMode === 'NODES' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Nodos clave
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'RAW'}
              onClick={() => setViewMode('RAW')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition ${
                viewMode === 'RAW' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              XML completo
            </button>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(xmlPayload, 'XML_NODES')}
            aria-label="Copiar nodos XML al portapapeles"
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-sans font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            {copiedText === 'XML_NODES' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {copiedText === 'XML_NODES' ? 'XML Copiado' : 'Copiar XML'}
          </button>
          <span className="sr-only" aria-live="polite">
            {copiedText === 'XML_NODES' ? 'Nodos XML copiados al portapapeles' : ''}
          </span>
        </div>
      </div>

      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
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
          placeholder="Buscar etiqueta, atributo, RFC o UUID en el XML..."
          aria-label="Buscar dentro del XML del CFDI"
          className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-cyan-400"
        />
      </div>

      {isReconstructed && (
        <div className="px-3 py-2 rounded-xl bg-amber-950/60 border border-amber-700/60 text-amber-200 text-[11px] font-sans">
          {loadingNow
            ? 'Cargando XML original desde la Bóveda Digital ADD...'
            : 'Nota: El archivo XML original no está almacenado en este registro; esta vista y la copia resumen se reconstruyen con los metadatos fiscales, conceptos y timbre registrados en bóveda.'}
        </div>
      )}

      {viewMode === 'RAW' ? (
        <pre tabIndex={0} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-300 text-[11px] overflow-x-auto max-h-96 leading-relaxed">
          <code>{filteredRawXml}</code>
        </pre>
      ) : (
      <div className="space-y-2.5 overflow-x-auto text-[11px] leading-relaxed">
        {!hasAnyMatchingNode && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-center">
            Sin nodos XML que coincidan con &ldquo;{xmlSearch.trim()}&rdquo;.
          </div>
        )}

        {showComprobante && (
        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
          <span className="text-cyan-400 font-bold">&lt;cfdi:Comprobante</span>
          <div className="pl-4 space-y-0.5 text-slate-300">
            <div>
              Version=<span className="text-emerald-300">"{preview.comprobante.version}"</span> Serie=<span className="text-emerald-300">"{preview.comprobante.serie}"</span> Folio=<span className="text-emerald-300">"{preview.comprobante.folio}"</span> Fecha=<span className="text-emerald-300">"{preview.comprobante.fecha}"</span>
            </div>
            <div>
              FormaPago=<span className="text-emerald-300">"{preview.comprobante.formaPago}"</span> MetodoPago=<span className="text-emerald-300">"{preview.comprobante.metodoPago}"</span> Moneda=<span className="text-emerald-300">"{preview.comprobante.moneda}"</span> TipoCambio=<span className="text-emerald-300">"{preview.comprobante.tipoCambio}"</span>
            </div>
            <div>
              SubTotal=<span className="text-amber-300">"{preview.comprobante.subtotal}"</span>
              {preview.comprobante.descuento > 0 && (
                <> Descuento=<span className="text-amber-300">"{preview.comprobante.descuento}"</span></>
              )} Total=<span className="text-amber-300">"{preview.comprobante.total}"</span> TipoDeComprobante=<span className="text-emerald-300">"{preview.comprobante.tipoDeComprobante}"</span> Exportacion=<span className="text-emerald-300">"{preview.comprobante.exportacion}"</span> LugarExpedicion=<span className="text-emerald-300">"{preview.comprobante.lugarExpedicion}"</span>
              {preview.comprobante.noCertificado && (
                <> NoCertificado=<span className="text-emerald-300">"{preview.comprobante.noCertificado}"</span></>
              )}
            </div>
          </div>
          <span className="text-cyan-400 font-bold">&gt;</span>
        </div>
        )}

        {showEmisor && (
        <div className="pl-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
          <span className="text-blue-400 font-bold">&lt;cfdi:Emisor</span>
          <span className="text-slate-300">
            {' '}Rfc=<span className="text-amber-300">"{preview.emisor.rfc}"</span> Nombre=<span className="text-emerald-300">"{preview.emisor.nombre}"</span> RegimenFiscal=<span className="text-emerald-300">"{preview.emisor.regimenFiscal}"</span>
          </span>
          <span className="text-blue-400 font-bold"> /&gt;</span>
        </div>
        )}

        {showReceptor && (
        <div className="pl-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
          <span className="text-blue-400 font-bold">&lt;cfdi:Receptor</span>
          <span className="text-slate-300">
            {' '}Rfc=<span className="text-amber-300">"{preview.receptor.rfc}"</span> Nombre=<span className="text-emerald-300">"{preview.receptor.nombre}"</span> DomicilioFiscalReceptor=<span className="text-emerald-300">"{preview.receptor.domicilioFiscalReceptor}"</span> RegimenFiscalReceptor=<span className="text-emerald-300">"{preview.receptor.regimenFiscalReceptor}"</span> UsoCFDI=<span className="text-emerald-300">"{preview.receptor.usoCfdi}"</span>
          </span>
          <span className="text-blue-400 font-bold"> /&gt;</span>
        </div>
        )}

        {filteredConceptos.length > 0 && (
        <div className="pl-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
          <span className="text-purple-400 font-bold">&lt;cfdi:Conceptos&gt;</span>
          <div className="pl-4 space-y-1 text-slate-300">
            {filteredConceptos.map((c, idx) => (
              <div key={`${c.claveProdServ}-${c.noIdentificacion || idx}`}>
                <span className="text-purple-400 font-bold">&lt;cfdi:Concepto</span> ClaveProdServ=<span className="text-emerald-300">"{c.claveProdServ}"</span>
                {c.noIdentificacion && (
                  <> NoIdentificacion=<span className="text-emerald-300">"{c.noIdentificacion}"</span></>
                )} Cantidad=<span className="text-amber-300">"{c.cantidad}"</span> ClaveUnidad=<span className="text-emerald-300">"{c.claveUnidad}"</span>
                {c.unidad && (
                  <> Unidad=<span className="text-emerald-300">"{c.unidad}"</span></>
                )} Descripcion=<span className="text-emerald-300">"{c.descripcion}"</span> ValorUnitario=<span className="text-amber-300">"{c.valorUnitario}"</span> Importe=<span className="text-amber-300">"{c.importe}"</span>
                {c.descuento > 0 && (
                  <> Descuento=<span className="text-amber-300">"{c.descuento}"</span></>
                )} ObjetoImp=<span className="text-emerald-300">"{c.objetoImp}"</span> <span className="text-purple-400 font-bold">/&gt;</span>
              </div>
            ))}
          </div>
          <span className="text-purple-400 font-bold">&lt;/cfdi:Conceptos&gt;</span>
        </div>
        )}

        {showImpuestos && (
        <div className="pl-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
          <span className="text-yellow-400 font-bold">&lt;cfdi:Impuestos</span> TotalImpuestosTrasladados=<span className="text-amber-300">"{preview.impuestos.totalImpuestosTrasladados}"</span>
          {totalRet > 0 && (
            <> TotalImpuestosRetenidos=<span className="text-amber-300">"{totalRet}"</span></>
          )}
          <span className="text-yellow-400 font-bold">&gt;</span>
          <div className="pl-4 text-slate-300 space-y-1">
            {preview.impuestos.traslados.length > 0 && (
              <div>
                <span className="text-yellow-400 font-bold">&lt;cfdi:Traslados&gt;</span>
                {preview.impuestos.traslados.map((t, idx) => (
                  <div key={`xml-tras-${t.impuesto}-${idx}`} className="pl-4">
                    <span className="text-yellow-400 font-bold">&lt;cfdi:Traslado</span> Base=<span className="text-amber-300">"{t.base}"</span> Impuesto=<span className="text-emerald-300">"{t.impuesto}"</span> TipoFactor=<span className="text-emerald-300">"{t.tipoFactor}"</span>
                    {t.tasaOCuota && (
                      <> TasaOCuota=<span className="text-emerald-300">"{t.tasaOCuota}"</span></>
                    )} Importe=<span className="text-amber-300">"{t.importe}"</span> <span className="text-yellow-400 font-bold">/&gt;</span>
                  </div>
                ))}
                <span className="text-yellow-400 font-bold">&lt;/cfdi:Traslados&gt;</span>
              </div>
            )}
            {preview.impuestos.retenciones.length > 0 && (
              <div>
                <span className="text-rose-400 font-bold">&lt;cfdi:Retenciones&gt;</span>
                {preview.impuestos.retenciones.map((r, idx) => (
                  <div key={`xml-ret-${r.impuesto}-${idx}`} className="pl-4">
                    <span className="text-rose-400 font-bold">&lt;cfdi:Retencion</span> Impuesto=<span className="text-emerald-300">"{r.impuesto}"</span> Importe=<span className="text-amber-300">"{r.importe}"</span> <span className="text-rose-400 font-bold">/&gt;</span>
                  </div>
                ))}
                <span className="text-rose-400 font-bold">&lt;/cfdi:Retenciones&gt;</span>
              </div>
            )}
          </div>
          <span className="text-yellow-400 font-bold">&lt;/cfdi:Impuestos&gt;</span>
        </div>
        )}

        {showTimbre && (
        <div className="pl-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
          <span className="text-emerald-400 font-bold">&lt;tfd:TimbreFiscalDigital</span>
          <div className="pl-4 space-y-0.5 text-slate-300">
            <div>
              Version=<span className="text-emerald-300">"{preview.timbre.version}"</span> UUID=<span className="text-cyan-300 font-bold">"{preview.timbre.uuid}"</span> FechaTimbrado=<span className="text-emerald-300">"{preview.timbre.fechaTimbrado}"</span>
            </div>
            <div>
              RfcProvCertif=<span className="text-emerald-300">"{preview.timbre.rfcProvCertif}"</span> NoCertificadoSAT=<span className="text-emerald-300">"{preview.timbre.noCertificadoSat}"</span>
              {preview.timbre.selloCfd && (
                <> SelloCFD=<span className="text-emerald-300">"{preview.timbre.selloCfd.slice(0, 40)}{preview.timbre.selloCfd.length > 40 ? '...' : ''}"</span></>
              )}
              {preview.timbre.selloSat && (
                <> SelloSAT=<span className="text-emerald-300">"{preview.timbre.selloSat.slice(0, 40)}{preview.timbre.selloSat.length > 40 ? '...' : ''}"</span></>
              )}
            </div>
          </div>
          <span className="text-emerald-400 font-bold">/&gt;</span>
        </div>
        )}

        {hasAnyMatchingNode && (
          <div className="p-2.5 text-cyan-400 font-bold">&lt;/cfdi:Comprobante&gt;</div>
        )}
      </div>
      )}
    </div>
  );
}
