import type { CfdiTipo } from './types';
import { escapeXmlAttr } from './xml-utils';

export interface Cfdi40BuilderInput {
  uuid: string;
  fecha: string;
  tipoComprobante: CfdiTipo;
  serie: string;
  folio: string;
  emisorRfc: string;
  emisorNombre: string;
  receptorRfc: string;
  receptorNombre: string;
  conceptoPrincipal: string;
  claveProdServ: string;
  moneda: string;
  tipoCambio: number;
  subtotal: number;
  descuento: number;
  ivaTrasladado: number;
  isrRetenido: number;
  ivaRetenido: number;
  total: number;
  metodoPago: 'PUE' | 'PPD';
  formaPago: string;
  usoCfdi: string;
  uuidRelacionado?: string | null;
}

export function buildCfdi40Xml(data: Cfdi40BuilderInput): string {
  const serie = escapeXmlAttr(data.serie);
  const folio = escapeXmlAttr(data.folio);
  const fecha = escapeXmlAttr(data.fecha);
  const emisorRfc = escapeXmlAttr(data.emisorRfc);
  const emisorNombre = escapeXmlAttr(data.emisorNombre);
  const receptorRfc = escapeXmlAttr(data.receptorRfc);
  const receptorNombre = escapeXmlAttr(data.receptorNombre);
  const formaPago = escapeXmlAttr(data.formaPago);
  const uuid = escapeXmlAttr(data.uuid);

  if (data.tipoComprobante === 'P') {
    const relatedUuid = escapeXmlAttr(
      data.uuidRelacionado || 'F401A9B2-33C4-4E81-9A11-112233D4E5F4'
    );
    const monedaPago = escapeXmlAttr(
      data.moneda && data.moneda !== 'XXX' ? data.moneda : 'MXN'
    );
    return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Serie="${serie}" Folio="${folio}" Fecha="${fecha}T14:00:00" SubTotal="0" Moneda="XXX" Total="0" TipoDeComprobante="P" Exportacion="01" LugarExpedicion="64000">
  <cfdi:Emisor Rfc="${emisorRfc}" Nombre="${emisorNombre}" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="${receptorRfc}" Nombre="${receptorNombre}" DomicilioFiscalReceptor="64000" RegimenFiscalReceptor="601" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Totales TotalTrasladosBaseIVA16="${data.subtotal.toFixed(2)}" TotalTrasladosImpuestoIVA16="${data.ivaTrasladado.toFixed(2)}" MontoTotalPagos="${data.total.toFixed(2)}"/>
      <pago20:Pago FechaPago="${fecha}T12:00:00" FormaDePagoP="${formaPago}" MonedaP="${monedaPago}" TipoCambioP="${data.tipoCambio || 1}" Monto="${data.total.toFixed(2)}">
        <pago20:DoctoRelacionado IdDocumento="${relatedUuid}" Serie="FAC" Folio="1042" MonedaDR="${monedaPago}" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="${data.total.toFixed(2)}" ImpPagado="${data.total.toFixed(2)}" ImpSaldoInsoluto="0.00" ObjetoImpDR="02"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="${uuid}" FechaTimbrado="${fecha}T14:00:05" RfcProvCertif="SAT970701NN3" SelloCFD="p9K2x..." NoCertificadoSAT="00001000000504465028"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  }

  if (data.tipoComprobante === 'T') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Serie="${serie}" Folio="${folio}" Fecha="${fecha}T12:30:00" SubTotal="0" Moneda="XXX" Total="0" TipoDeComprobante="T" Exportacion="01" LugarExpedicion="64000">
  <cfdi:Emisor Rfc="${emisorRfc}" Nombre="${emisorNombre}" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="${receptorRfc}" Nombre="${receptorNombre}" DomicilioFiscalReceptor="64000" RegimenFiscalReceptor="601" UsoCFDI="S01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="${escapeXmlAttr(data.claveProdServ)}" Cantidad="1" ClaveUnidad="E48" Descripcion="${escapeXmlAttr(data.conceptoPrincipal)}" ValorUnitario="0" Importe="0" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="${uuid}" FechaTimbrado="${fecha}T12:30:05" RfcProvCertif="SAT970701NN3" SelloCFD="f3A9x..." NoCertificadoSAT="00001000000504465028"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  }

  const hasRetenciones = data.isrRetenido > 0 || data.ivaRetenido > 0;
  const retencionesBlock = hasRetenciones
    ? `    <cfdi:Retenciones>
${data.isrRetenido > 0 ? `      <cfdi:Retencion Impuesto="001" Importe="${data.isrRetenido.toFixed(2)}"/>\n` : ''}${data.ivaRetenido > 0 ? `      <cfdi:Retencion Impuesto="002" Importe="${data.ivaRetenido.toFixed(2)}"/>\n` : ''}    </cfdi:Retenciones>\n`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Serie="${serie}" Folio="${folio}" Fecha="${fecha}T12:30:00" FormaPago="${formaPago}" SubTotal="${data.subtotal.toFixed(2)}" Descuento="${data.descuento.toFixed(2)}" Moneda="${escapeXmlAttr(data.moneda)}" TipoCambio="${data.tipoCambio}" Total="${data.total.toFixed(2)}" TipoDeComprobante="${escapeXmlAttr(data.tipoComprobante)}" Exportacion="01" MetodoPago="${escapeXmlAttr(data.metodoPago)}" LugarExpedicion="64000">
  <cfdi:Emisor Rfc="${emisorRfc}" Nombre="${emisorNombre}" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="${receptorRfc}" Nombre="${receptorNombre}" DomicilioFiscalReceptor="64000" RegimenFiscalReceptor="601" UsoCFDI="${escapeXmlAttr(data.usoCfdi)}"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="${escapeXmlAttr(data.claveProdServ)}" Cantidad="1" ClaveUnidad="E48" Unidad="Servicio" Descripcion="${escapeXmlAttr(data.conceptoPrincipal)}" ValorUnitario="${data.subtotal.toFixed(2)}" Importe="${data.subtotal.toFixed(2)}" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="${data.subtotal.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${data.ivaTrasladado.toFixed(2)}"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="${data.ivaTrasladado.toFixed(2)}" TotalImpuestosRetenidos="${(data.isrRetenido + data.ivaRetenido).toFixed(2)}">
${retencionesBlock}    <cfdi:Traslados>
      <cfdi:Traslado Base="${data.subtotal.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${data.ivaTrasladado.toFixed(2)}"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="${uuid}" FechaTimbrado="${fecha}T12:30:05" RfcProvCertif="SAT970701NN3" SelloCFD="f3A9x..." NoCertificadoSAT="00001000000504465028"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}
