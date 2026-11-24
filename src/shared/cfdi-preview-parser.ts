import { XMLParser } from 'fast-xml-parser';
import { findNode, findNodes, getAttr, round2, type XmlNode } from './cfdi-xml-nodes';
import { SAFETY_BOUNDS } from './sat-constants';
import { stripXmlAddenda } from './xml-utils';
import type { CfdiDocument } from './types';
import {
  extractImpuestosLocales,
  extractNominaComplemento,
  extractPagosComplemento,
  type CfdiPreviewDoctoRelacionado,
  type CfdiPreviewDrTaxItem,
  type CfdiPreviewLocalTaxItem,
  type CfdiPreviewNomina,
  type CfdiPreviewPagoItem
} from './cfdi-preview-complements';

export type {
  CfdiPreviewDoctoRelacionado,
  CfdiPreviewDrTaxItem,
  CfdiPreviewLocalTaxItem,
  CfdiPreviewNomina,
  CfdiPreviewPagoItem
};

export interface CfdiPreviewConcepto {
  claveProdServ: string; noIdentificacion: string; cantidad: number; claveUnidad: string;
  unidad: string; descripcion: string; valorUnitario: number; importe: number;
  descuento: number; objetoImp: string;
}

export interface CfdiPreviewTaxItem {
  base: number; impuesto: string; tipoFactor: string; tasaOCuota: string; importe: number;
}

export interface CfdiPreviewData {
  hasXmlRaw: boolean;
  comprobante: {
    version: string; serie: string; folio: string; fecha: string; formaPago: string;
    metodoPago: string; moneda: string; tipoCambio: string; subtotal: number;
    descuento: number; total: number; tipoDeComprobante: string; exportacion: string;
    lugarExpedicion: string; noCertificado: string; sello: string;
  };
  emisor: { rfc: string; nombre: string; regimenFiscal: string };
  receptor: {
    rfc: string; nombre: string; domicilioFiscalReceptor: string;
    regimenFiscalReceptor: string; usoCfdi: string;
  };
  conceptos: CfdiPreviewConcepto[];
  impuestos: {
    totalImpuestosTrasladados: number; totalImpuestosRetenidos: number;
    traslados: CfdiPreviewTaxItem[]; retenciones: CfdiPreviewTaxItem[];
    locales?: CfdiPreviewLocalTaxItem[];
  };
  timbre: {
    version: string; uuid: string; fechaTimbrado: string; rfcProvCertif: string;
    selloCfd: string; selloSat: string; noCertificadoSat: string;
  };
  pagos?: CfdiPreviewPagoItem[];
  nomina?: CfdiPreviewNomina;
}

let cachedPreviewParser: XMLParser | null = null;
function getPreviewParser(): XMLParser {
  if (!cachedPreviewParser) {
    cachedPreviewParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      removeNSPrefix: true,
      trimValues: true,
      parseAttributeValue: false,
      processEntities: false
    });
  }
  return cachedPreviewParser;
}

function parseNum(raw: string, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function mapTaxNode(node: XmlNode): CfdiPreviewTaxItem {
  return {
    base: round2(parseNum(getAttr(node, 'Base'), 0)),
    impuesto: getAttr(node, 'Impuesto') || '002',
    tipoFactor: getAttr(node, 'TipoFactor') || 'Tasa',
    tasaOCuota: getAttr(node, 'TasaOCuota'),
    importe: round2(parseNum(getAttr(node, 'Importe'), 0))
  };
}

function buildFallbackPreview(cfdi: CfdiDocument): CfdiPreviewData {
  const traslados: CfdiPreviewTaxItem[] =
    cfdi.ivaTrasladado > 0
      ? [{ base: cfdi.subtotal, impuesto: '002', tipoFactor: 'Tasa', tasaOCuota: '0.160000', importe: cfdi.ivaTrasladado }]
      : [];
  const retenciones: CfdiPreviewTaxItem[] = [];
  if (cfdi.isrRetenido > 0) retenciones.push({ base: cfdi.subtotal, impuesto: '001', tipoFactor: 'Tasa', tasaOCuota: '', importe: cfdi.isrRetenido });
  if (cfdi.ivaRetenido > 0) retenciones.push({ base: cfdi.subtotal, impuesto: '002', tipoFactor: 'Tasa', tasaOCuota: '', importe: cfdi.ivaRetenido });

  return {
    hasXmlRaw: false,
    comprobante: {
      version: '4.0', serie: cfdi.serie, folio: cfdi.folio, fecha: cfdi.fecha,
      formaPago: cfdi.formaPago, metodoPago: cfdi.metodoPago, moneda: cfdi.moneda,
      tipoCambio: String(cfdi.tipoCambio), subtotal: cfdi.subtotal, descuento: cfdi.descuento || 0,
      total: cfdi.total, tipoDeComprobante: cfdi.tipoComprobante, exportacion: '01',
      lugarExpedicion: '', noCertificado: '', sello: ''
    },
    emisor: { rfc: cfdi.emisorRfc, nombre: cfdi.emisorNombre, regimenFiscal: '' },
    receptor: {
      rfc: cfdi.receptorRfc, nombre: cfdi.receptorNombre, domicilioFiscalReceptor: '',
      regimenFiscalReceptor: '', usoCfdi: cfdi.usoCfdi
    },
    conceptos: [{
      claveProdServ: cfdi.claveProdServ, noIdentificacion: '', cantidad: 1, claveUnidad: 'E48',
      unidad: 'Servicio', descripcion: cfdi.conceptoPrincipal, valorUnitario: cfdi.subtotal,
      importe: cfdi.subtotal, descuento: cfdi.descuento || 0, objetoImp: '02'
    }],
    impuestos: {
      totalImpuestosTrasladados: cfdi.ivaTrasladado,
      totalImpuestosRetenidos: round2((cfdi.isrRetenido || 0) + (cfdi.ivaRetenido || 0)),
      traslados,
      retenciones
    },
    timbre: {
      version: '1.1', uuid: cfdi.uuid, fechaTimbrado: '',
      rfcProvCertif: '', selloCfd: '', selloSat: '', noCertificadoSat: ''
    }
  };
}

export function parseCfdiPreview(cfdi: CfdiDocument): CfdiPreviewData {
  const fb = buildFallbackPreview(cfdi);
  const raw = (cfdi.xmlRaw || '').trim();
  if (!raw || raw.length > SAFETY_BOUNDS.MAX_XML_BYTES) return fb;

  let parsed: XmlNode;
  try {
    parsed = getPreviewParser().parse(stripXmlAddenda(raw)) as XmlNode;
  } catch {
    return fb;
  }

  const comprobante = findNode(parsed, 'Comprobante');
  if (!comprobante) return fb;

  const emisor = findNode(comprobante, 'Emisor');
  const receptor = findNode(comprobante, 'Receptor');
  const timbre = findNode(comprobante, 'TimbreFiscalDigital');
  const conceptosNodes = findNodes(comprobante, 'Concepto').slice(0, SAFETY_BOUNDS.MAX_XML_CONCEPTOS);

  const conceptos: CfdiPreviewConcepto[] = conceptosNodes.map((c) => ({
    claveProdServ: getAttr(c, 'ClaveProdServ') || cfdi.claveProdServ,
    noIdentificacion: getAttr(c, 'NoIdentificacion'),
    cantidad: parseNum(getAttr(c, 'Cantidad'), 1),
    claveUnidad: getAttr(c, 'ClaveUnidad') || 'E48',
    unidad: getAttr(c, 'Unidad'),
    descripcion: getAttr(c, 'Descripcion') || cfdi.conceptoPrincipal,
    valorUnitario: parseNum(getAttr(c, 'ValorUnitario'), 0),
    importe: parseNum(getAttr(c, 'Importe'), 0),
    descuento: parseNum(getAttr(c, 'Descuento'), 0),
    objetoImp: getAttr(c, 'ObjetoImp') || '02'
  }));

  const tipoComp = getAttr(comprobante, 'TipoDeComprobante').toUpperCase() || fb.comprobante.tipoDeComprobante;
  const rawImp = Object.hasOwn(comprobante, 'Impuestos') ? comprobante.Impuestos : null;
  const compImp = Array.isArray(rawImp) ? ((rawImp[0] as XmlNode) ?? null) : (rawImp && typeof rawImp === 'object' ? (rawImp as XmlNode) : null);
  const locales = extractImpuestosLocales(comprobante);
  let impuestos: CfdiPreviewData['impuestos'] =
    !compImp && (tipoComp === 'P' || tipoComp === 'N')
      ? {
          totalImpuestosTrasladados: 0,
          totalImpuestosRetenidos: 0,
          traslados: [],
          retenciones: [],
          ...(locales.length > 0 ? { locales } : {})
        }
      : { ...fb.impuestos, ...(locales.length > 0 ? { locales } : {}) };
  if (compImp) {
    const traslados = compImp.Traslados ? findNodes(compImp.Traslados, 'Traslado').map(mapTaxNode) : [];
    const retenciones = compImp.Retenciones ? findNodes(compImp.Retenciones, 'Retencion').map(mapTaxNode) : [];
    const rawTotTras = getAttr(compImp, 'TotalImpuestosTrasladados');
    const rawTotRet = getAttr(compImp, 'TotalImpuestosRetenidos');
    impuestos = {
      totalImpuestosTrasladados: rawTotTras !== '' ? round2(parseNum(rawTotTras, 0)) : round2(traslados.reduce((s, t) => s + t.importe, 0)),
      totalImpuestosRetenidos: rawTotRet !== '' ? round2(parseNum(rawTotRet, 0)) : round2(retenciones.reduce((s, r) => s + r.importe, 0)),
      traslados,
      retenciones,
      ...(locales.length > 0 ? { locales } : {})
    };
  }

  const selloComp = getAttr(comprobante, 'Sello');
  const attr = (node: XmlNode | null, k: string, def = '') => getAttr(node, k) || def;
  return {
    hasXmlRaw: true,
    comprobante: {
      version: attr(comprobante, 'Version', '4.0'),
      serie: attr(comprobante, 'Serie', fb.comprobante.serie),
      folio: attr(comprobante, 'Folio', fb.comprobante.folio),
      fecha: attr(comprobante, 'Fecha', fb.comprobante.fecha),
      formaPago: attr(comprobante, 'FormaPago', fb.comprobante.formaPago),
      metodoPago: attr(comprobante, 'MetodoPago', fb.comprobante.metodoPago),
      moneda: attr(comprobante, 'Moneda', fb.comprobante.moneda),
      tipoCambio: attr(comprobante, 'TipoCambio', fb.comprobante.tipoCambio),
      subtotal: parseNum(getAttr(comprobante, 'SubTotal'), fb.comprobante.subtotal),
      descuento: parseNum(getAttr(comprobante, 'Descuento'), fb.comprobante.descuento),
      total: parseNum(getAttr(comprobante, 'Total'), fb.comprobante.total),
      tipoDeComprobante: attr(comprobante, 'TipoDeComprobante', fb.comprobante.tipoDeComprobante),
      exportacion: attr(comprobante, 'Exportacion', '01'),
      lugarExpedicion: attr(comprobante, 'LugarExpedicion', ''),
      noCertificado: getAttr(comprobante, 'NoCertificado'),
      sello: selloComp
    },
    emisor: {
      rfc: attr(emisor, 'Rfc', fb.emisor.rfc),
      nombre: attr(emisor, 'Nombre', fb.emisor.nombre),
      regimenFiscal: attr(emisor, 'RegimenFiscal', '')
    },
    receptor: {
      rfc: attr(receptor, 'Rfc', fb.receptor.rfc),
      nombre: attr(receptor, 'Nombre', fb.receptor.nombre),
      domicilioFiscalReceptor: attr(receptor, 'DomicilioFiscalReceptor', ''),
      regimenFiscalReceptor: attr(receptor, 'RegimenFiscalReceptor', ''),
      usoCfdi: attr(receptor, 'UsoCFDI', fb.receptor.usoCfdi)
    },
    conceptos: conceptos.length > 0 ? conceptos : fb.conceptos,
    impuestos,
    timbre: {
      version: attr(timbre, 'Version', '1.1'),
      uuid: attr(timbre, 'UUID', fb.timbre.uuid).toUpperCase(),
      fechaTimbrado: attr(timbre, 'FechaTimbrado', ''),
      rfcProvCertif: attr(timbre, 'RfcProvCertif', ''),
      selloCfd: attr(timbre, 'SelloCFD', selloComp),
      selloSat: getAttr(timbre, 'SelloSAT'),
      noCertificadoSat: attr(timbre, 'NoCertificadoSAT', '')
    },
    pagos: extractPagosComplemento(comprobante),
    nomina: extractNominaComplemento(comprobante)
  };
}
