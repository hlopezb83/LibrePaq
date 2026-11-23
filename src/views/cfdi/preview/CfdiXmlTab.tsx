import { Check, Code2, Copy } from 'lucide-react';
import type { CfdiDocument } from '../../../shared/types';

interface CfdiXmlTabProps {
  cfdi: CfdiDocument;
  copiedText: string | null;
  copyToClipboard: (text: string, label: string) => void;
}

export function CfdiXmlTab({ cfdi, copiedText, copyToClipboard }: CfdiXmlTabProps) {
  const totalRet = (cfdi.isrRetenido || 0) + (cfdi.ivaRetenido || 0);
  const retencionesSnippet =
    totalRet > 0
      ? `\n    <cfdi:Retenciones>\n${
          cfdi.isrRetenido > 0 ? `      <cfdi:Retencion Impuesto="001" Importe="${cfdi.isrRetenido}" />\n` : ''
        }${
          cfdi.ivaRetenido > 0 ? `      <cfdi:Retencion Impuesto="002" Importe="${cfdi.ivaRetenido}" />\n` : ''
        }    </cfdi:Retenciones>`
      : '';
  const xmlPayload =
    cfdi.xmlRaw ||
    `<?xml version="1.0" encoding="UTF-8"?>\n<cfdi:Comprobante Version="4.0" Serie="${cfdi.serie}" Folio="${cfdi.folio}" Fecha="${cfdi.fecha}" Total="${cfdi.total}" SubTotal="${cfdi.subtotal}" Moneda="${cfdi.moneda}">\n  <cfdi:Emisor Rfc="${cfdi.emisorRfc}" Nombre="${cfdi.emisorNombre}" RegimenFiscal="601"/>\n  <cfdi:Receptor Rfc="${cfdi.receptorRfc}" Nombre="${cfdi.receptorNombre}" UsoCFDI="${cfdi.usoCfdi}"/>\n  <cfdi:Impuestos TotalImpuestosTrasladados="${cfdi.ivaTrasladado}"${
      totalRet > 0 ? ` TotalImpuestosRetenidos="${totalRet}"` : ''
    }>${retencionesSnippet}\n  </cfdi:Impuestos>\n</cfdi:Comprobante>`;

  return (
    <div className="bg-slate-950 text-slate-100 rounded-2xl p-5 border border-slate-800 shadow-inner font-mono text-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-slate-300">
          <Code2 className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          <span className="font-bold text-white font-sans text-sm">Estructura Jerárquica del XML CFDI 4.0</span>
        </div>
        <button
          type="button"
          onClick={() => copyToClipboard(xmlPayload, 'XML_NODES')}
          aria-label="Copiar nodos XML al portapapeles"
          className="px-2.5 py-1 rounded-lg text-[11px] font-sans font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1.5 cursor-pointer"
        >
          {copiedText === 'XML_NODES' ? <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
          {copiedText === 'XML_NODES' ? 'XML Copiado' : 'Copiar Nodos XML'}
        </button>
      </div>

      <div className="space-y-2.5 overflow-x-auto text-[11px] leading-relaxed">
        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
          <span className="text-cyan-400 font-bold">&lt;cfdi:Comprobante</span>
          <div className="pl-4 space-y-0.5 text-slate-300">
            <div>
              Version=<span className="text-emerald-300">"4.0"</span> Serie=<span className="text-emerald-300">"{cfdi.serie}"</span> Folio=<span className="text-emerald-300">"{cfdi.folio}"</span> Fecha=<span className="text-emerald-300">"{cfdi.fecha}T10:00:00"</span>
            </div>
            <div>
              FormaPago=<span className="text-emerald-300">"{cfdi.formaPago}"</span> MetodoPago=<span className="text-emerald-300">"{cfdi.metodoPago}"</span> Moneda=<span className="text-emerald-300">"{cfdi.moneda}"</span> TipoCambio=<span className="text-emerald-300">"{cfdi.tipoCambio}"</span>
            </div>
            <div>
              SubTotal=<span className="text-amber-300">"{cfdi.subtotal}"</span> Total=<span className="text-amber-300">"{cfdi.total}"</span> TipoDeComprobante=<span className="text-emerald-300">"{cfdi.tipoComprobante}"</span> Exportacion=<span className="text-emerald-300">"01"</span>
            </div>
          </div>
          <span className="text-cyan-400 font-bold">&gt;</span>
        </div>

        <div className="pl-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
          <span className="text-blue-400 font-bold">&lt;cfdi:Emisor</span>
          <span className="text-slate-300">
            {' '}Rfc=<span className="text-amber-300">"{cfdi.emisorRfc}"</span> Nombre=<span className="text-emerald-300">"{cfdi.emisorNombre}"</span> RegimenFiscal=<span className="text-emerald-300">"601"</span>
          </span>
          <span className="text-blue-400 font-bold"> /&gt;</span>
        </div>

        <div className="pl-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
          <span className="text-blue-400 font-bold">&lt;cfdi:Receptor</span>
          <span className="text-slate-300">
            {' '}Rfc=<span className="text-amber-300">"{cfdi.receptorRfc}"</span> Nombre=<span className="text-emerald-300">"{cfdi.receptorNombre}"</span> DomicilioFiscalReceptor=<span className="text-emerald-300">"64000"</span> RegimenFiscalReceptor=<span className="text-emerald-300">"601"</span> UsoCFDI=<span className="text-emerald-300">"{cfdi.usoCfdi}"</span>
          </span>
          <span className="text-blue-400 font-bold"> /&gt;</span>
        </div>

        <div className="pl-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
          <span className="text-purple-400 font-bold">&lt;cfdi:Conceptos&gt;</span>
          <div className="pl-4 text-slate-300">
            <span className="text-purple-400 font-bold">&lt;cfdi:Concepto</span> ClaveProdServ=<span className="text-emerald-300">"{cfdi.claveProdServ}"</span> Cantidad=<span className="text-amber-300">"1.00"</span> ClaveUnidad=<span className="text-emerald-300">"E48"</span> Descripcion=<span className="text-emerald-300">"{cfdi.conceptoPrincipal}"</span> ValorUnitario=<span className="text-amber-300">"{cfdi.subtotal}"</span> Importe=<span className="text-amber-300">"{cfdi.subtotal}"</span> ObjetoImp=<span className="text-emerald-300">"02"</span> <span className="text-purple-400 font-bold">/&gt;</span>
          </div>
          <span className="text-purple-400 font-bold">&lt;/cfdi:Conceptos&gt;</span>
        </div>

        <div className="pl-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
          <span className="text-yellow-400 font-bold">&lt;cfdi:Impuestos</span> TotalImpuestosTrasladados=<span className="text-amber-300">"{cfdi.ivaTrasladado}"</span>
          {totalRet > 0 && (
            <> TotalImpuestosRetenidos=<span className="text-amber-300">"{totalRet}"</span></>
          )}
          <span className="text-yellow-400 font-bold">&gt;</span>
          <div className="pl-4 text-slate-300 space-y-1">
            <span className="text-yellow-400 font-bold">&lt;cfdi:Traslados&gt;</span>
            <div className="pl-4">
              <span className="text-yellow-400 font-bold">&lt;cfdi:Traslado</span> Base=<span className="text-amber-300">"{cfdi.subtotal}"</span> Impuesto=<span className="text-emerald-300">"002"</span> TipoFactor=<span className="text-emerald-300">"Tasa"</span> TasaOCuota=<span className="text-emerald-300">"0.160000"</span> Importe=<span className="text-amber-300">"{cfdi.ivaTrasladado}"</span> <span className="text-yellow-400 font-bold">/&gt;</span>
            </div>
            <span className="text-yellow-400 font-bold">&lt;/cfdi:Traslados&gt;</span>
            {totalRet > 0 && (
              <div>
                <span className="text-rose-400 font-bold">&lt;cfdi:Retenciones&gt;</span>
                {cfdi.isrRetenido > 0 && (
                  <div className="pl-4">
                    <span className="text-rose-400 font-bold">&lt;cfdi:Retencion</span> Impuesto=<span className="text-emerald-300">"001"</span> (ISR) Importe=<span className="text-amber-300">"{cfdi.isrRetenido}"</span> <span className="text-rose-400 font-bold">/&gt;</span>
                  </div>
                )}
                {cfdi.ivaRetenido > 0 && (
                  <div className="pl-4">
                    <span className="text-rose-400 font-bold">&lt;cfdi:Retencion</span> Impuesto=<span className="text-emerald-300">"002"</span> (IVA) Importe=<span className="text-amber-300">"{cfdi.ivaRetenido}"</span> <span className="text-rose-400 font-bold">/&gt;</span>
                  </div>
                )}
                <span className="text-rose-400 font-bold">&lt;/cfdi:Retenciones&gt;</span>
              </div>
            )}
          </div>
          <span className="text-yellow-400 font-bold">&lt;/cfdi:Impuestos&gt;</span>
        </div>

        <div className="pl-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
          <span className="text-emerald-400 font-bold">&lt;tfd:TimbreFiscalDigital</span>
          <div className="pl-4 space-y-0.5 text-slate-300">
            <div>Version=<span className="text-emerald-300">"1.1"</span> UUID=<span className="text-cyan-300 font-bold">"{cfdi.uuid}"</span> FechaTimbrado=<span className="text-emerald-300">"{cfdi.fecha}T12:00:00"</span></div>
            <div>RfcProvCertif=<span className="text-emerald-300">"SAT970701NN3"</span> NoCertificadoSAT=<span className="text-emerald-300">"00001000000504465028"</span></div>
          </div>
          <span className="text-emerald-400 font-bold">/&gt;</span>
        </div>

        <div className="p-2.5 text-cyan-400 font-bold">&lt;/cfdi:Comprobante&gt;</div>
      </div>
    </div>
  );
}
