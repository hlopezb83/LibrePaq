import type { CfdiTaxBreakdown } from './types';
import { findNode, findNodes, getAttr, round2, type XmlNode } from './cfdi-xml-nodes';
export { parsePago20Complement } from './cfdi-xml-pago';

export { findNode, findNodes, getAttr, type XmlNode };

export function parseNomina12Complement(doc: XmlNode, baseSubtotal: number, baseDescuento = 0) {
  const nominaAttrs = findNode(doc, 'Nomina');
  const rawFechaPago = getAttr(nominaAttrs, 'FechaPago');
  const fechaPago = rawFechaPago ? rawFechaPago.slice(0, 10) : null;
  const deduccionesAttrs = findNode(doc, 'Deducciones');
  const rawTotalPercepciones = getAttr(nominaAttrs, 'TotalPercepciones');
  const totalPercepciones =
    rawTotalPercepciones !== '' ? parseFloat(rawTotalPercepciones) || 0 : baseSubtotal;
  const totalOtrosPagos = parseFloat(getAttr(nominaAttrs, 'TotalOtrosPagos') || '0') || 0;
  const totalImpuestosRet =
    parseFloat(getAttr(deduccionesAttrs, 'TotalImpuestosRetenidos') || '0') || 0;
  const totalOtrasDed = parseFloat(getAttr(deduccionesAttrs, 'TotalOtrasDeducciones') || '0') || 0;
  const totalDeducciones = parseFloat(getAttr(nominaAttrs, 'TotalDeducciones') || '0') || 0;

  const subtotal =
    rawTotalPercepciones !== ''
      ? Number((totalPercepciones + totalOtrosPagos).toFixed(2))
      : Number(baseSubtotal.toFixed(2));
  const isrRetenido = Number(totalImpuestosRet.toFixed(2));
  const descuento =
    totalOtrasDed > 0
      ? Number(totalOtrasDed.toFixed(2))
      : totalDeducciones > 0
        ? Number(Math.max(0, totalDeducciones - isrRetenido).toFixed(2))
        : Number(baseDescuento.toFixed(2));
  const total = Number((subtotal - isrRetenido - descuento).toFixed(2));

  return {
    fechaPago,
    subtotal,
    isrRetenido,
    descuento,
    total,
    otrosPagosNomina: Number(totalOtrosPagos.toFixed(2))
  };
}

export function parseStandardImpuestos(doc: XmlNode) {
  const comprobanteNode = findNode(doc, 'Comprobante') ?? doc;
  const directImpuestosRaw = comprobanteNode['Impuestos'];
  const globalImpuestosAttrs: XmlNode | null = Array.isArray(directImpuestosRaw)
    ? ((directImpuestosRaw[directImpuestosRaw.length - 1] as XmlNode) ?? null)
    : directImpuestosRaw && typeof directImpuestosRaw === 'object'
      ? (directImpuestosRaw as XmlNode)
      : null;

  const conceptosNode = comprobanteNode?.['Conceptos'] ?? doc['Conceptos'];
  const conceptImpuestosNodes = conceptosNode ? findNodes(conceptosNode, 'Impuestos') : [];

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
    const conceptTraslados = conceptImpuestosNodes.flatMap((ci) => findNodes(ci, 'Traslado'));
    for (const t of conceptTraslados) {
      const imp = getAttr(t, 'Impuesto');
      const importe = parseFloat(getAttr(t, 'Importe') || '0') || 0;
      if (imp === '002' || !imp) ivaTrasladado += importe;
    }
    if (conceptTraslados.length === 0 && globalImpuestosAttrs) {
      ivaTrasladado =
        parseFloat(getAttr(globalImpuestosAttrs, 'TotalImpuestosTrasladados') || '0') || 0;
    }
  }

  const retencionesNodes = globalImpuestosAttrs ? findNodes(globalImpuestosAttrs, 'Retencion') : [];
  const targetRetenciones =
    retencionesNodes.length > 0
      ? retencionesNodes
      : conceptImpuestosNodes.flatMap((ci) => findNodes(ci, 'Retencion'));
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

export function extractCfdiTaxBreakdown(
  doc: XmlNode,
  subtotalFallback: number,
  ivaFallback: number
): CfdiTaxBreakdown {
  const comprobanteNode = findNode(doc, 'Comprobante') ?? doc;
  const directImpuestosRaw = comprobanteNode['Impuestos'];
  const globalImpuestos: XmlNode | null = Array.isArray(directImpuestosRaw)
    ? ((directImpuestosRaw[directImpuestosRaw.length - 1] as XmlNode) ?? null)
    : directImpuestosRaw && typeof directImpuestosRaw === 'object'
      ? (directImpuestosRaw as XmlNode)
      : null;

  const conceptosNode = comprobanteNode['Conceptos'] ?? doc['Conceptos'];
  const conceptos = conceptosNode ? findNodes(conceptosNode, 'Concepto') : [];
  const rootTraslados = globalImpuestos ? findNodes(globalImpuestos, 'Traslado') : [];
  const conceptTraslados =
    rootTraslados.length > 0
      ? []
      : (conceptosNode ? findNodes(conceptosNode, 'Impuestos') : []).flatMap((ci) =>
          findNodes(ci, 'Traslado')
        );
  const traslados = rootTraslados.length > 0 ? rootTraslados : conceptTraslados;

  let base16 = 0;
  let iva16 = 0;
  let base8 = 0;
  let iva8 = 0;
  let base0 = 0;
  let baseExento = 0;
  let ieps = 0;

  for (const t of traslados) {
    const imp = getAttr(t, 'Impuesto');
    const factor = getAttr(t, 'TipoFactor');
    const tasa = parseFloat(getAttr(t, 'TasaOCuota') || '0') || 0;
    const base = parseFloat(getAttr(t, 'Base') || '0') || 0;
    const importe = parseFloat(getAttr(t, 'Importe') || '0') || 0;
    if (imp === '003') {
      ieps += importe;
    } else if (imp === '002' || !imp) {
      if (factor === 'Exento') {
        baseExento += base;
      } else if (Math.abs(tasa - 0.16) < 0.005) {
        iva16 += importe;
        base16 += base > 0 ? base : importe / 0.16;
      } else if (Math.abs(tasa - 0.08) < 0.005) {
        iva8 += importe;
        base8 += base > 0 ? base : importe / 0.08;
      } else if (factor === 'Tasa' && tasa === 0) {
        base0 += base;
      } else if (importe > 0) {
        iva16 += importe;
        base16 += base > 0 ? base : importe / 0.16;
      }
    }
  }

  const hasRootExento = rootTraslados.some(
    (t) => (getAttr(t, 'Impuesto') === '002' || !getAttr(t, 'Impuesto')) && getAttr(t, 'TipoFactor') === 'Exento'
  );
  const hasRootBase0 = base0 > 0;
  let firstObjetoImp: string | undefined;
  for (const c of conceptos) {
    const obj = getAttr(c, 'ObjetoImp');
    if (!firstObjetoImp && obj) firstObjetoImp = obj;
    const cTraslados = findNodes(c, 'Traslado');
    const netImp = Math.max(
      0,
      (parseFloat(getAttr(c, 'Importe') || '0') || 0) - (parseFloat(getAttr(c, 'Descuento') || '0') || 0)
    );
    if ((obj === '01' || obj === '03' || obj === '04') && cTraslados.length === 0) {
      baseExento += netImp;
    } else if (rootTraslados.length > 0 && cTraslados.length > 0) {
      for (const ct of cTraslados) {
        const ctImp = getAttr(ct, 'Impuesto');
        if (ctImp !== '002' && ctImp !== '') continue;
        const ctFactor = getAttr(ct, 'TipoFactor');
        const ctTasa = parseFloat(getAttr(ct, 'TasaOCuota') || '0') || 0;
        const ctBase = parseFloat(getAttr(ct, 'Base') || '0') || 0;
        if (!hasRootExento && ctFactor === 'Exento') {
          baseExento += ctBase || netImp;
        } else if (!hasRootBase0 && ctFactor === 'Tasa' && ctTasa === 0) {
          base0 += ctBase || netImp;
        }
      }
    }
  }

  if (base16 === 0 && iva16 === 0 && base8 === 0 && iva8 === 0 && base0 === 0 && baseExento === 0) {
    const netSub = Math.max(0, subtotalFallback);
    if (ivaFallback > 0) {
      const ratio = netSub > 0 ? ivaFallback / netSub : 0.16;
      if (Math.abs(ratio - 0.08) < 0.015) {
        base8 = netSub;
        iva8 = ivaFallback;
      } else {
        base16 = netSub;
        iva16 = ivaFallback;
      }
    } else if (netSub > 0) {
      if (firstObjetoImp === '01' || firstObjetoImp === '03' || firstObjetoImp === '04') baseExento = netSub;
      else base0 = netSub;
    }
  }

  const localRetenido = findNodes(comprobanteNode, 'RetencionesLocales').reduce(
    (sum, n) => sum + (parseFloat(getAttr(n, 'Importe') || '0') || 0),
    0
  );
  const localTrasladado = findNodes(comprobanteNode, 'TrasladosLocales').reduce(
    (sum, n) => sum + (parseFloat(getAttr(n, 'Importe') || '0') || 0),
    0
  );

  return {
    base16: round2(base16),
    iva16: round2(iva16),
    base8: round2(base8),
    iva8: round2(iva8),
    base0: round2(base0),
    baseExento: round2(baseExento),
    ieps: round2(ieps),
    ...(firstObjetoImp ? { objetoImp: firstObjetoImp } : {}),
    ...(localRetenido > 0 ? { localRetenido: round2(localRetenido) } : {}),
    ...(localTrasladado > 0 ? { localTrasladado: round2(localTrasladado) } : {})
  } as CfdiTaxBreakdown & { localRetenido?: number; localTrasladado?: number };
}
