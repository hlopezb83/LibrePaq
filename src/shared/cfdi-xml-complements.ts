import { SAFETY_BOUNDS } from './sat-constants';
import { decodeXmlEntities } from './xml-utils';

export type XmlNode = Record<string, unknown>;
const MAX_XML_TREE_DEPTH = 24;
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function getAttr(node: unknown, attrName: string): string {
  if (!node || typeof node !== 'object') return '';
  const rec = node as XmlNode;
  const attrKey = `@_${attrName}`;
  if (!Object.hasOwn(rec, attrKey)) return '';
  const val = rec[attrKey];
  return typeof val === 'string' || typeof val === 'number'
    ? decodeXmlEntities(String(val).trim())
    : '';
}

export function findNode(node: unknown, targetTag: string, depth = 0): XmlNode | null {
  if (!node || typeof node !== 'object' || depth > MAX_XML_TREE_DEPTH) return null;
  const rec = node as XmlNode;
  if (!UNSAFE_KEYS.has(targetTag) && Object.hasOwn(rec, targetTag) && rec[targetTag]) {
    const val = rec[targetTag];
    return Array.isArray(val) ? ((val[0] as XmlNode) ?? null) : (val as XmlNode);
  }
  for (const k of Object.keys(rec)) {
    if (UNSAFE_KEYS.has(k) || k.startsWith('@_')) continue;
    const child = rec[k];
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findNode(item, targetTag, depth + 1);
        if (found) return found;
      }
    } else if (child && typeof child === 'object') {
      const found = findNode(child, targetTag, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function findNodes(node: unknown, targetTag: string): XmlNode[] {
  const results: XmlNode[] = [];
  function recurse(curr: unknown, depth: number) {
    if (!curr || typeof curr !== 'object' || depth > MAX_XML_TREE_DEPTH) return;
    if (results.length >= SAFETY_BOUNDS.MAX_XML_TAGS) return;
    const rec = curr as XmlNode;
    for (const k of Object.keys(rec)) {
      if (UNSAFE_KEYS.has(k)) continue;
      const v = rec[k];
      if (k === targetTag) {
        if (Array.isArray(v)) {
          for (const item of v) {
            if (item && typeof item === 'object') results.push(item as XmlNode);
          }
        } else if (v && typeof v === 'object') {
          results.push(v as XmlNode);
        }
      } else if (!k.startsWith('@_') && v && typeof v === 'object') {
        if (Array.isArray(v)) {
          for (const item of v) recurse(item, depth + 1);
        } else {
          recurse(v, depth + 1);
        }
      }
    }
  }
  recurse(node, 0);
  return results;
}

export function parsePago20Complement(doc: XmlNode, fallbackUuidRel: string | null) {
  const pagoTotales = findNode(doc, 'Totales');
  const allPagos = findNodes(doc, 'Pago');
  const allDoctosRel = findNodes(doc, 'DoctoRelacionado');

  let montoTotalPagos = parseFloat(getAttr(pagoTotales, 'MontoTotalPagos') || '0') || 0;
  const hasTotalesMxn = pagoTotales !== null && getAttr(pagoTotales, 'MontoTotalPagos') !== '';
  if (montoTotalPagos === 0) {
    for (const p of allPagos) montoTotalPagos += parseFloat(getAttr(p, 'Monto') || '0') || 0;
  }
  if (montoTotalPagos === 0) {
    for (const dr of allDoctosRel) montoTotalPagos += parseFloat(getAttr(dr, 'ImpPagado') || '0') || 0;
  }

  const rawBaseIva16 = getAttr(pagoTotales, 'TotalTrasladosBaseIVA16');
  const rawImpIva16 = getAttr(pagoTotales, 'TotalTrasladosImpuestoIVA16');
  const rawBaseIva8 = getAttr(pagoTotales, 'TotalTrasladosBaseIVA8');
  const rawImpIva8 = getAttr(pagoTotales, 'TotalTrasladosImpuestoIVA8');
  const rawBaseIva0 = getAttr(pagoTotales, 'TotalTrasladosBaseIVA0');
  const rawBaseExento = getAttr(pagoTotales, 'TotalTrasladosBaseIVAExento');

  const hasExplicitBases =
    rawBaseIva16 !== '' || rawBaseIva8 !== '' || rawBaseIva0 !== '' || rawBaseExento !== '';

  const base16 = parseFloat(rawBaseIva16 || '0') || 0;
  const imp16 = parseFloat(rawImpIva16 || '0') || 0;
  const base8 = parseFloat(rawBaseIva8 || '0') || 0;
  const imp8 = parseFloat(rawImpIva8 || '0') || 0;
  const base0 = parseFloat(rawBaseIva0 || '0') || 0;
  const baseExento = parseFloat(rawBaseExento || '0') || 0;

  const subtotal = hasExplicitBases
    ? base16 + base8 + base0 + baseExento
    : Number((montoTotalPagos / 1.16).toFixed(2));
  const ivaTrasladado = hasExplicitBases
    ? imp16 + imp8
    : Number((montoTotalPagos - subtotal).toFixed(2));

  const isrRetenido = parseFloat(getAttr(pagoTotales, 'TotalRetencionesISR') || '0') || 0;
  const ivaRetenido = parseFloat(getAttr(pagoTotales, 'TotalRetencionesIVA') || '0') || 0;

  const firstPago = allPagos[0] ?? null;
  const rawMonedaP = getAttr(firstPago, 'MonedaP').toUpperCase();
  const rawTcP = parseFloat(getAttr(firstPago, 'TipoCambioP') || '1') || 1;
  const moneda = hasTotalesMxn ? 'MXN' : rawMonedaP && rawMonedaP !== 'XXX' ? rawMonedaP : 'MXN';
  const tipoCambio = hasTotalesMxn ? 1 : rawTcP;

  const uuidsRelacionados = allDoctosRel
    .map((dr) => getAttr(dr, 'IdDocumento').toUpperCase())
    .filter(Boolean);
  const uuidRelacionado = uuidsRelacionados[0] || fallbackUuidRel;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    ivaTrasladado: Number(ivaTrasladado.toFixed(2)),
    isrRetenido: Number(isrRetenido.toFixed(2)),
    ivaRetenido: Number(ivaRetenido.toFixed(2)),
    total: Number(montoTotalPagos.toFixed(2)),
    formaPago: getAttr(firstPago, 'FormaDePagoP') || '03',
    moneda,
    tipoCambio,
    uuidRelacionado,
    uuidsRelacionados
  };
}

export function parseNomina12Complement(doc: XmlNode, baseSubtotal: number) {
  const nominaAttrs = findNode(doc, 'Nomina');
  const deduccionesAttrs = findNode(doc, 'Deducciones');
  const totalPercepciones =
    parseFloat(getAttr(nominaAttrs, 'TotalPercepciones') || '0') || baseSubtotal;
  const totalOtrosPagos = parseFloat(getAttr(nominaAttrs, 'TotalOtrosPagos') || '0') || 0;
  const totalImpuestosRet =
    parseFloat(getAttr(deduccionesAttrs, 'TotalImpuestosRetenidos') || '0') || 0;
  const totalOtrasDed = parseFloat(getAttr(deduccionesAttrs, 'TotalOtrasDeducciones') || '0') || 0;

  const subtotal = Number((totalPercepciones + totalOtrosPagos).toFixed(2));
  const isrRetenido = Number(totalImpuestosRet.toFixed(2));
  const descuento = Number(totalOtrasDed.toFixed(2));
  const total = Number((subtotal - isrRetenido - descuento).toFixed(2));

  return {
    subtotal,
    isrRetenido,
    descuento,
    total,
    otrosPagosNomina: Number(totalOtrosPagos.toFixed(2))
  };
}

export function parseStandardImpuestos(doc: XmlNode) {
  const globalImpuestosNodes = findNodes(doc, 'Impuestos');
  const globalImpuestosAttrs =
    globalImpuestosNodes.length > 0 ? globalImpuestosNodes[globalImpuestosNodes.length - 1] : null;

  let ivaTrasladado = 0;
  let isrRetenido = 0;
  let ivaRetenido = 0;

  const trasladosNodes = globalImpuestosAttrs ? findNodes(globalImpuestosAttrs, 'Traslado') : [];
  if (trasladosNodes.length > 0) {
    for (const t of trasladosNodes) {
      const imp = getAttr(t, 'Impuesto');
      const importe = parseFloat(getAttr(t, 'Importe') || '0') || 0;
      if (imp === '002' || !imp) ivaTrasladado += importe;
    }
  } else {
    const allTraslados = findNodes(doc, 'Traslado');
    for (const t of allTraslados) {
      const imp = getAttr(t, 'Impuesto');
      const importe = parseFloat(getAttr(t, 'Importe') || '0') || 0;
      if (imp === '002' || !imp) ivaTrasladado += importe;
    }
    if (ivaTrasladado === 0 && globalImpuestosAttrs) {
      ivaTrasladado =
        parseFloat(getAttr(globalImpuestosAttrs, 'TotalImpuestosTrasladados') || '0') || 0;
    }
  }

  const retencionesNodes = globalImpuestosAttrs ? findNodes(globalImpuestosAttrs, 'Retencion') : [];
  const targetRetenciones =
    retencionesNodes.length > 0 ? retencionesNodes : findNodes(doc, 'Retencion');
  for (const r of targetRetenciones) {
    const imp = getAttr(r, 'Impuesto');
    const importe = parseFloat(getAttr(r, 'Importe') || '0') || 0;
    if (imp === '001') isrRetenido += importe;
    if (imp === '002') ivaRetenido += importe;
  }

  const totalRetenidos =
    parseFloat(getAttr(globalImpuestosAttrs, 'TotalImpuestosRetenidos') || '0') || 0;
  if (isrRetenido === 0 && ivaRetenido === 0 && totalRetenidos > 0) {
    isrRetenido = totalRetenidos;
  }

  return { ivaTrasladado, isrRetenido, ivaRetenido };
}
