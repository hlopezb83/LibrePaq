import type { CfdiRelatedDoc, CfdiTaxBreakdown } from './types';
import { findNodes, getAttr, round2, type XmlNode } from './cfdi-xml-nodes';

interface ExplicitTaxAccum {
  hasExplicit: boolean;
  base16: number;
  iva16: number;
  base8: number;
  iva8: number;
  base0: number;
  baseExento: number;
  isrRet: number;
  ivaRet: number;
}

function collectExplicitNodeTaxes(
  pagoGroups: Array<{ pNode: XmlNode | null; pagoMoneda: string; pagoTipoCambio: number }>,
  headerMoneda: string
): ExplicitTaxAccum {
  const acc: ExplicitTaxAccum = {
    hasExplicit: false,
    base16: 0,
    iva16: 0,
    base8: 0,
    iva8: 0,
    base0: 0,
    baseExento: 0,
    isrRet: 0,
    ivaRet: 0
  };
  for (const g of pagoGroups) {
    if (!g.pNode) continue;
    const mult = headerMoneda === 'MXN' && g.pagoMoneda !== 'MXN' ? g.pagoTipoCambio : 1;
    const pTras = [...findNodes(g.pNode, 'TrasladoP'), ...findNodes(g.pNode, 'Traslado')];
    const drTras = pTras.length === 0 ? findNodes(g.pNode, 'TrasladoDR') : [];
    for (const t of [...pTras, ...drTras]) {
      acc.hasExplicit = true;
      const imp = getAttr(t, 'ImpuestoP') || getAttr(t, 'ImpuestoDR') || getAttr(t, 'Impuesto');
      const factor = getAttr(t, 'TipoFactorP') || getAttr(t, 'TipoFactorDR') || getAttr(t, 'TipoFactor');
      const tasa = parseFloat(getAttr(t, 'TasaOCuotaP') || getAttr(t, 'TasaOCuotaDR') || getAttr(t, 'TasaOCuota') || '0') || 0;
      const base = (parseFloat(getAttr(t, 'BaseP') || getAttr(t, 'BaseDR') || getAttr(t, 'Base') || '0') || 0) * mult;
      const importe = (parseFloat(getAttr(t, 'ImporteP') || getAttr(t, 'ImporteDR') || getAttr(t, 'Importe') || '0') || 0) * mult;
      if (imp !== '002' && imp !== '') continue;
      if (factor === 'Exento') {
        acc.baseExento += base;
      } else if (Math.abs(tasa - 0.16) < 0.005) {
        acc.iva16 += importe;
        acc.base16 += base > 0 ? base : importe / 0.16;
      } else if (Math.abs(tasa - 0.08) < 0.005) {
        acc.iva8 += importe;
        acc.base8 += base > 0 ? base : importe / 0.08;
      } else if (factor === 'Tasa' && tasa === 0) {
        acc.base0 += base;
      } else if (importe > 0) {
        acc.iva16 += importe;
        acc.base16 += base > 0 ? base : importe / 0.16;
      }
    }
    const pRet = [...findNodes(g.pNode, 'RetencionP'), ...findNodes(g.pNode, 'Retencion')];
    const drRet = pRet.length === 0 ? findNodes(g.pNode, 'RetencionDR') : [];
    for (const r of [...pRet, ...drRet]) {
      const imp = getAttr(r, 'ImpuestoP') || getAttr(r, 'ImpuestoDR') || getAttr(r, 'Impuesto');
      const importe = (parseFloat(getAttr(r, 'ImporteP') || getAttr(r, 'ImporteDR') || getAttr(r, 'Importe') || '0') || 0) * mult;
      if (imp === '001') acc.isrRet += importe;
      else if (imp === '002') acc.ivaRet += importe;
    }
  }
  return acc;
}

export function parsePago20Complement(doc: XmlNode, fallbackUuidRel: string | null) {
  const pagoTotales = findNodes(doc, 'Totales')[0] ?? null;
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
    return {
      pNode,
      pagoMoneda,
      pagoTipoCambio,
      monto,
      drNodes: idx === 0 && pNode && drNodes.length === 0 ? allDoctosRel : drNodes
    };
  });

  const firstPago = allPagos[0] ?? null;
  const rawFechaPago = getAttr(firstPago, 'FechaPago');
  const fechaPago = rawFechaPago ? rawFechaPago.slice(0, 10) : null;

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
  const tipoCambio = moneda === 'MXN' ? 1 : (pagoGroups[0]?.pagoTipoCambio ?? 1);

  let isrRetenido = parseFloat(getAttr(pagoTotales, 'TotalRetencionesISR') || '0') || 0;
  let ivaRetenido = parseFloat(getAttr(pagoTotales, 'TotalRetencionesIVA') || '0') || 0;

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
          ? monedaDr === g.pagoMoneda || !monedaDr
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

  const nodeTaxes = !hasExplicitBases ? collectExplicitNodeTaxes(pagoGroups, moneda) : null;
  if (isrRetenido === 0 && ivaRetenido === 0 && nodeTaxes) {
    isrRetenido = nodeTaxes.isrRet;
    ivaRetenido = nodeTaxes.ivaRet;
  }

  let subtotal: number;
  let ivaTrasladado: number;
  let taxBreakdown: CfdiTaxBreakdown;

  if (hasExplicitBases) {
    const effectiveBaseExento = rawBaseExento !== '' ? baseExento : exentoDrFallback;
    subtotal = base16 + base8 + base0 + effectiveBaseExento;
    ivaTrasladado = imp16 + imp8;
    taxBreakdown = {
      base16: round2(base16),
      iva16: round2(imp16),
      base8: round2(base8),
      iva8: round2(imp8),
      base0: round2(base0),
      baseExento: round2(effectiveBaseExento),
      ieps: 0
    };
  } else if (nodeTaxes?.hasExplicit) {
    const effectiveExento = nodeTaxes.baseExento > 0 ? nodeTaxes.baseExento : exentoDrFallback;
    ivaTrasladado = nodeTaxes.iva16 + nodeTaxes.iva8;
    const baseSum = nodeTaxes.base16 + nodeTaxes.base8 + nodeTaxes.base0 + effectiveExento;
    subtotal = baseSum > 0 ? baseSum : Math.max(0, montoTotalPagos - ivaTrasladado);
    taxBreakdown = {
      base16: round2(nodeTaxes.base16),
      iva16: round2(nodeTaxes.iva16),
      base8: round2(nodeTaxes.base8),
      iva8: round2(nodeTaxes.iva8),
      base0: round2(nodeTaxes.base0),
      baseExento: round2(effectiveExento),
      ieps: 0
    };
  } else {
    // Pago 1.0 o Pago sin Totales ni impuestos explícitos: NO fabricar IVA 16%
    subtotal = montoTotalPagos;
    ivaTrasladado = 0;
    const baseEx = round2(exentoDrFallback);
    taxBreakdown = {
      base16: 0,
      iva16: 0,
      base8: 0,
      iva8: 0,
      base0: round2(Math.max(0, subtotal - baseEx)),
      baseExento: baseEx,
      ieps: 0
    };
  }

  return {
    fechaPago,
    subtotal: round2(subtotal),
    ivaTrasladado: round2(ivaTrasladado),
    isrRetenido: round2(isrRetenido),
    ivaRetenido: round2(ivaRetenido),
    total: round2(montoTotalPagos),
    formaPago: getAttr(firstPago, 'FormaDePagoP') || '03',
    moneda,
    tipoCambio,
    uuidRelacionado,
    uuidsRelacionados,
    relatedDocs,
    taxBreakdown
  };
}
