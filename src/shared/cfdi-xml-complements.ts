import type { CfdiRelatedDoc, CfdiTaxBreakdown } from './types';
import { findNode, findNodes, getAttr, round2, type XmlNode } from './cfdi-xml-nodes';

export { findNode, findNodes, getAttr, type XmlNode };

export function parsePago20Complement(doc: XmlNode, fallbackUuidRel: string | null) {
  const pagoTotales = findNode(doc, 'Totales');
  const allPagos = findNodes(doc, 'Pago');
  const allDoctosRel = findNodes(doc, 'DoctoRelacionado');

  const pagoGroups = (allPagos.length > 0 ? allPagos : [null]).map((pNode, idx) => {
    const rawMonedaP = getAttr(pNode, 'MonedaP').toUpperCase();
    const pagoMoneda = rawMonedaP && rawMonedaP !== 'XXX' ? rawMonedaP : 'MXN';
    const parsedTcP = parseFloat(getAttr(pNode, 'TipoCambioP') || '');
    const pagoTipoCambio =
      pagoMoneda === 'MXN' ? 1 : Number.isFinite(parsedTcP) && parsedTcP > 0 ? parsedTcP : 1;
    const monto = parseFloat(getAttr(pNode, 'Monto') || '0') || 0;
    const drNodes = pNode ? findNodes(pNode, 'DoctoRelacionado') : allDoctosRel;
    return { pNode, pagoMoneda, pagoTipoCambio, monto, drNodes: idx === 0 && pNode && drNodes.length === 0 ? allDoctosRel : drNodes };
  });
  const firstPago = allPagos[0] ?? null;
  const distinctCurrencies = new Set(pagoGroups.map((g) => g.pagoMoneda));
  const hasMixedCurrencies = distinctCurrencies.size > 1;
  const hasTotalesMxn = pagoTotales !== null && getAttr(pagoTotales, 'MontoTotalPagos') !== '';

  let montoTotalPagos = parseFloat(getAttr(pagoTotales, 'MontoTotalPagos') || '0') || 0;
  if (montoTotalPagos === 0) {
    for (const g of pagoGroups) {
      montoTotalPagos +=
        (hasTotalesMxn || hasMixedCurrencies) && g.pagoMoneda !== 'MXN'
          ? g.monto * g.pagoTipoCambio
          : g.monto;
    }
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

  const singleCurrency = pagoGroups[0]?.pagoMoneda ?? 'MXN';
  const moneda = hasTotalesMxn || hasMixedCurrencies ? 'MXN' : singleCurrency;
  const tipoCambio =
    moneda === 'MXN' ? 1 : pagoGroups[0]?.pagoTipoCambio ?? 1;

  const isrRetenido = parseFloat(getAttr(pagoTotales, 'TotalRetencionesISR') || '0') || 0;
  const ivaRetenido = parseFloat(getAttr(pagoTotales, 'TotalRetencionesIVA') || '0') || 0;

  const uuidsRelacionados = allDoctosRel
    .map((dr) => getAttr(dr, 'IdDocumento').toUpperCase())
    .filter(Boolean);
  const uuidRelacionado = uuidsRelacionados[0] || fallbackUuidRel;

  const relatedDocs: CfdiRelatedDoc[] = [];
  let exentoDrFallback = 0;
  let drImpPagadoSum = 0;
  for (const g of pagoGroups) {
    for (const dr of g.drNodes) {
      const idDocumento = getAttr(dr, 'IdDocumento').toUpperCase();
      if (!idDocumento) continue;
      const numParcialidad = Number.parseInt(getAttr(dr, 'NumParcialidad') || '1', 10) || 1;
      const impSaldoAnt = round2(parseFloat(getAttr(dr, 'ImpSaldoAnt') || '0') || 0);
      const impPagado = round2(parseFloat(getAttr(dr, 'ImpPagado') || '0') || 0);
      const impSaldoInsoluto = round2(parseFloat(getAttr(dr, 'ImpSaldoInsoluto') || '0') || 0);
      const monedaDr = getAttr(dr, 'MonedaDR').toUpperCase() || undefined;
      const rawEq = getAttr(dr, 'EquivalenciaDR') || getAttr(dr, 'TipoCambioDR');
      const parsedEq = rawEq ? parseFloat(rawEq) : NaN;
      const equivalenciaDr = Number.isFinite(parsedEq) && parsedEq > 0 ? parsedEq : undefined;
      const impInHeaderCur =
        moneda === 'MXN' && (monedaDr || g.pagoMoneda) !== 'MXN'
          ? (monedaDr === g.pagoMoneda || !monedaDr)
            ? impPagado * g.pagoTipoCambio
            : equivalenciaDr
              ? (impPagado / equivalenciaDr) * g.pagoTipoCambio
              : impPagado * g.pagoTipoCambio
          : moneda !== 'MXN' && monedaDr && monedaDr !== g.pagoMoneda && equivalenciaDr
            ? impPagado / equivalenciaDr
            : impPagado;
      drImpPagadoSum += impInHeaderCur;
      const objetoImpDr = getAttr(dr, 'ObjetoImpDR');
      if (objetoImpDr === '01' || objetoImpDr === '03' || objetoImpDr === '04') {
        exentoDrFallback += impInHeaderCur;
      }
      relatedDocs.push({
        idDocumento,
        numParcialidad,
        impSaldoAnt,
        impPagado,
        impSaldoInsoluto,
        ...(monedaDr ? { monedaDr } : {}),
        ...(equivalenciaDr !== undefined ? { equivalenciaDr } : {}),
        ...(g.pagoMoneda !== 'MXN'
          ? { pagoMoneda: g.pagoMoneda, pagoTipoCambio: g.pagoTipoCambio }
          : {})
      });
    }
  }
  if (montoTotalPagos === 0) montoTotalPagos = drImpPagadoSum;

  const subtotal = hasExplicitBases
    ? base16 + base8 + base0 + baseExento
    : pagoTotales !== null
      ? montoTotalPagos
      : Number((montoTotalPagos / 1.16).toFixed(2));
  const ivaTrasladado = hasExplicitBases
    ? imp16 + imp8
    : pagoTotales !== null
      ? 0
      : Number((montoTotalPagos - subtotal).toFixed(2));

  const taxBreakdown: CfdiTaxBreakdown = hasExplicitBases
    ? { base16: round2(base16), iva16: round2(imp16), base8: round2(base8), iva8: round2(imp8), base0: round2(base0), baseExento: round2(baseExento), ieps: 0 }
    : { base16: ivaTrasladado > 0 ? round2(subtotal) : 0, iva16: ivaTrasladado > 0 ? round2(ivaTrasladado) : 0, base8: 0, iva8: 0, base0: ivaTrasladado === 0 && exentoDrFallback === 0 ? round2(subtotal) : 0, baseExento: round2(exentoDrFallback), ieps: 0 };

  return {
    subtotal: round2(subtotal), ivaTrasladado: round2(ivaTrasladado),
    isrRetenido: round2(isrRetenido), ivaRetenido: round2(ivaRetenido),
    total: round2(montoTotalPagos), formaPago: getAttr(firstPago, 'FormaDePagoP') || '03',
    moneda, tipoCambio, uuidRelacionado, uuidsRelacionados, relatedDocs, taxBreakdown
  };
}

export function parseNomina12Complement(doc: XmlNode, baseSubtotal: number, baseDescuento = 0) {
  const nominaAttrs = findNode(doc, 'Nomina');
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
    if (ivaTrasladado === 0 && globalImpuestosAttrs) {
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
    } else if (rootTraslados.length > 0 && !hasRootExento && cTraslados.length > 0) {
      for (const ct of cTraslados) {
        const ctImp = getAttr(ct, 'Impuesto');
        if ((ctImp === '002' || !ctImp) && getAttr(ct, 'TipoFactor') === 'Exento') {
          baseExento += (parseFloat(getAttr(ct, 'Base') || '0') || 0) || netImp;
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
