import { XMLParser } from 'fast-xml-parser';
import { SAFETY_BOUNDS } from './sat-constants';
import { getTodayLocalIso } from './date-utils';
import type { CfdiRelatedDoc, CfdiTaxBreakdown, CfdiTipo } from './types';
import {
  extractCfdiTaxBreakdown,
  findNode,
  findNodes,
  getAttr,
  parseNomina12Complement,
  parsePago20Complement,
  parseStandardImpuestos,
  type XmlNode
} from './cfdi-xml-complements';

export { escapeXmlAttr, decodeXmlEntities } from './xml-utils';
export { buildCfdi40Xml } from './cfdi-xml-builder';

export interface ParsedCfdiPayload {
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
  uuidsRelacionados?: string[];
  otrosPagosNomina?: number;
  taxBreakdown?: CfdiTaxBreakdown | null;
  relatedDocs?: CfdiRelatedDoc[] | null;
  xmlRaw: string;
}

export function extractNominaOtrosPagos(xmlRaw: string): number {
  if (!xmlRaw || !xmlRaw.includes('TotalOtrosPagos')) return 0;
  const m = /TotalOtrosPagos=["']([0-9]+(?:\.[0-9]+)?)["']/i.exec(xmlRaw);
  return m?.[1] ? Number.parseFloat(m[1]) || 0 : 0;
}

let cachedXmlParser: XMLParser | null = null;

function getXmlParser(): XMLParser {
  if (!cachedXmlParser) {
    cachedXmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      removeNSPrefix: true,
      trimValues: true,
      parseAttributeValue: false,
      processEntities: false
    });
  }
  return cachedXmlParser;
}

export function parseCfdiXmlString(
  xmlRaw: string,
  opts?: { requireStamp?: boolean }
): ParsedCfdiPayload {
  if (typeof xmlRaw !== 'string' || xmlRaw.trim().length === 0) {
    throw new Error('CFDI_XML_EMPTY: El contenido XML está vacío.');
  }
  if (xmlRaw.length > SAFETY_BOUNDS.MAX_XML_BYTES) {
    throw new Error('CFDI_XML_TOO_LARGE: El archivo XML excede el límite de seguridad de 5 MB.');
  }

  const parsed = getXmlParser().parse(xmlRaw) as XmlNode;
  const comprobante = findNode(parsed, 'Comprobante') || parsed;
  const emisor = findNode(comprobante, 'Emisor');
  const receptor = findNode(comprobante, 'Receptor');
  const timbre = findNode(comprobante, 'TimbreFiscalDigital');
  const conceptos = findNodes(comprobante, 'Concepto').slice(0, SAFETY_BOUNDS.MAX_XML_CONCEPTOS);

  const rawFecha = getAttr(comprobante, 'Fecha') || getTodayLocalIso();
  const fecha = rawFecha.slice(0, 10);
  const rawTipo = (getAttr(comprobante, 'TipoDeComprobante') || 'I').toUpperCase();
  const tipoComprobante: CfdiTipo = (
    ['I', 'E', 'P', 'N', 'T'].includes(rawTipo) ? rawTipo : 'I'
  ) as CfdiTipo;

  const timbreUuid = getAttr(timbre, 'UUID').toUpperCase();
  if (opts?.requireStamp && !timbreUuid) {
    throw new Error('CFDI_NOT_STAMPED: El comprobante no contiene el nodo oficial TimbreFiscalDigital emitido por el SAT.');
  }
  const uuid = timbreUuid || crypto.randomUUID().toUpperCase();

  let subtotal = parseFloat(getAttr(comprobante, 'SubTotal') || '0') || 0;
  let descuento = parseFloat(getAttr(comprobante, 'Descuento') || '0') || 0;
  let total = parseFloat(getAttr(comprobante, 'Total') || '0') || 0;
  let ivaTrasladado = 0;
  let isrRetenido = 0;
  let ivaRetenido = 0;
  let otrosPagosNomina = 0;
  let rawMetodo = (getAttr(comprobante, 'MetodoPago') || 'PUE').toUpperCase();
  let formaPago = getAttr(comprobante, 'FormaPago') || '03';
  const rawMonedaHeader = getAttr(comprobante, 'Moneda').toUpperCase();
  let moneda = rawMonedaHeader && rawMonedaHeader !== 'XXX' ? rawMonedaHeader : 'MXN';
  let tipoCambio = parseFloat(getAttr(comprobante, 'TipoCambio') || '1') || 1;

  const cfdiRelNodes = findNodes(comprobante, 'CfdiRelacionado');
  const headerUuidsRel = cfdiRelNodes
    .map((n) => getAttr(n, 'UUID').toUpperCase())
    .filter(Boolean);
  let uuidRelacionado: string | null = headerUuidsRel[0] || null;
  let uuidsRelacionados: string[] | undefined =
    headerUuidsRel.length > 0 ? headerUuidsRel : undefined;
  let taxBreakdown: CfdiTaxBreakdown | null = null;
  let relatedDocs: CfdiRelatedDoc[] | null = null;

  if (tipoComprobante === 'P') {
    const pago = parsePago20Complement(comprobante, uuidRelacionado);
    subtotal = pago.subtotal;
    ivaTrasladado = pago.ivaTrasladado;
    isrRetenido = pago.isrRetenido;
    ivaRetenido = pago.ivaRetenido;
    total = pago.total;
    formaPago = pago.formaPago;
    moneda = pago.moneda;
    tipoCambio = pago.tipoCambio;
    uuidRelacionado = pago.uuidRelacionado;
    uuidsRelacionados = pago.uuidsRelacionados.length > 0 ? pago.uuidsRelacionados : uuidsRelacionados;
    taxBreakdown = pago.taxBreakdown;
    relatedDocs = pago.relatedDocs;
    rawMetodo = 'PUE';
  } else if (tipoComprobante === 'N') {
    const nom = parseNomina12Complement(comprobante, subtotal, descuento);
    subtotal = nom.subtotal;
    isrRetenido = nom.isrRetenido;
    descuento = nom.descuento;
    total = nom.total;
    otrosPagosNomina = nom.otrosPagosNomina;
    rawMetodo = 'PUE';
    formaPago = '99';
  } else if (tipoComprobante === 'T') {
    subtotal = 0;
    descuento = 0;
    total = 0;
    rawMetodo = 'PUE';
    formaPago = '99';
  } else {
    const imp = parseStandardImpuestos(comprobante);
    ivaTrasladado = imp.ivaTrasladado;
    isrRetenido = imp.isrRetenido;
    ivaRetenido = imp.ivaRetenido;
    taxBreakdown = extractCfdiTaxBreakdown(comprobante, subtotal - descuento, ivaTrasladado);
  }

  const firstConcepto = conceptos[0] ?? null;
  const descriptions = conceptos.map((c) => getAttr(c, 'Descripcion')).filter(Boolean);
  const metodoPago = (rawMetodo === 'PPD' ? 'PPD' : 'PUE') as 'PUE' | 'PPD';

  return {
    uuid,
    fecha,
    tipoComprobante,
    serie: getAttr(comprobante, 'Serie'),
    folio: getAttr(comprobante, 'Folio'),
    emisorRfc: getAttr(emisor, 'Rfc').toUpperCase() || 'XAXX010101000',
    emisorNombre: getAttr(emisor, 'Nombre') || 'Emisor CFDI',
    receptorRfc: getAttr(receptor, 'Rfc').toUpperCase() || 'XAXX010101000',
    receptorNombre: getAttr(receptor, 'Nombre') || 'Receptor CFDI',
    conceptoPrincipal:
      descriptions.join(' + ') ||
      (tipoComprobante === 'P'
        ? 'Complemento de Recepción de Pagos 2.0'
        : tipoComprobante === 'T'
          ? 'CFDI de Traslado / Carta Porte'
          : 'Operación comercial amparada por CFDI 4.0'),
    claveProdServ: getAttr(firstConcepto, 'ClaveProdServ') || '80101500',
    moneda,
    tipoCambio,
    subtotal: Number(subtotal.toFixed(2)),
    descuento: Number(descuento.toFixed(2)),
    ivaTrasladado: Number(ivaTrasladado.toFixed(2)),
    isrRetenido: Number(isrRetenido.toFixed(2)),
    ivaRetenido: Number(ivaRetenido.toFixed(2)),
    total: Number(total.toFixed(2)),
    metodoPago,
    formaPago,
    usoCfdi:
      getAttr(receptor, 'UsoCFDI') ||
      (tipoComprobante === 'P' ? 'CP01' : tipoComprobante === 'T' ? 'S01' : 'G03'),
    uuidRelacionado,
    uuidsRelacionados,
    otrosPagosNomina,
    taxBreakdown,
    relatedDocs,
    xmlRaw
  };
}
