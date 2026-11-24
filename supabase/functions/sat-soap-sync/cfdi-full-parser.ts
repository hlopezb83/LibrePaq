export interface CfdiTaxBreakdown {
  base16: number;
  iva16: number;
  base8: number;
  iva8: number;
  base0: number;
  baseExento: number;
  ieps: number;
  objetoImp?: string;
  localRetenido?: number;
  localTrasladado?: number;
}

export interface CfdiRelatedDoc {
  idDocumento: string;
  numParcialidad: number;
  impSaldoAnt: number;
  impPagado: number;
  impSaldoInsoluto: number;
  monedaDr?: string;
  equivalenciaDr?: number;
  pagoMoneda?: string;
  pagoTipoCambio?: number;
}

export interface ParsedCfdiFull {
  uuid: string;
  fecha: string;
  tipoComprobante: string;
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
  metodoPago: string;
  formaPago: string;
  usoCfdi: string;
  uuidRelacionado: string | null;
  uuidsRelacionados?: string[];
  taxBreakdown: CfdiTaxBreakdown | null;
  relatedDocs: CfdiRelatedDoc[] | null;
}

interface XmlElementNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlElementNode[];
}

const round2 = (n: number): number => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function decodeXmlEntities(value: string): string {
  if (!value || !value.includes('&')) return value;
  return value
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : _m;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : _m;
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseAttributes(attrText: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(attrText)) !== null) {
    const rawName = m[1] || '';
    const localName = rawName.includes(':') ? rawName.split(':').pop()! : rawName;
    attrs[localName.toLowerCase()] = decodeXmlEntities((m[2] ?? m[3] ?? '').trim());
  }
  return attrs;
}

function parseXmlTree(xmlRaw: string): XmlElementNode {
  const cleaned = xmlRaw
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '');
  const root: XmlElementNode = { name: '__root__', attrs: {}, children: [] };
  const stack: XmlElementNode[] = [root];
  const tagRegex = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[^<>]*?)?)(\/?)>/g;
  let m: RegExpExecArray | null;

  while ((m = tagRegex.exec(cleaned)) !== null) {
    const isClosing = m[1] === '/';
    const rawName = m[2] || '';
    const localName = rawName.includes(':') ? rawName.split(':').pop()! : rawName;
    const attrText = m[3] || '';
    const isSelfClosing = m[4] === '/';

    if (isClosing) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i]!.name.toLowerCase() === localName.toLowerCase()) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const node: XmlElementNode = {
      name: localName,
      attrs: attrText ? parseAttributes(attrText) : {},
      children: []
    };
    stack[stack.length - 1]!.children.push(node);
    if (!isSelfClosing) {
      stack.push(node);
    }
  }
  return root;
}

function findFirst(node: XmlElementNode | null, targetName: string): XmlElementNode | null {
  if (!node) return null;
  const target = targetName.toLowerCase();
  for (const child of node.children) {
    if (child.name.toLowerCase() === target) return child;
  }
  for (const child of node.children) {
    const found = findFirst(child, targetName);
    if (found) return found;
  }
  return null;
}

function findAll(node: XmlElementNode | null, targetName: string, out: XmlElementNode[] = []): XmlElementNode[] {
  if (!node) return out;
  const target = targetName.toLowerCase();
  for (const child of node.children) {
    if (child.name.toLowerCase() === target) out.push(child);
    findAll(child, targetName, out);
  }
  return out;
}

function findDirectChildren(node: XmlElementNode | null, targetName: string): XmlElementNode[] {
  if (!node) return [];
  const target = targetName.toLowerCase();
  return node.children.filter((c) => c.name.toLowerCase() === target);
}

const attr = (node: XmlElementNode | null, key: string): string =>
  node?.attrs[key.toLowerCase()] ?? '';

const numAttr = (node: XmlElementNode | null, key: string): number => {
  const val = parseFloat(attr(node, key));
  return Number.isFinite(val) ? val : 0;
};

function parsePago20(comprobante: XmlElementNode, fallbackUuidRel: string | null) {
  const pagoTotales = findFirst(comprobante, 'Totales');
  const allPagos = findAll(comprobante, 'Pago');
  const allDoctosRel = findAll(comprobante, 'DoctoRelacionado');

  const pagoGroups = (allPagos.length > 0 ? allPagos : [null]).map((pNode, idx) => {
    const rawMonedaP = attr(pNode, 'MonedaP').toUpperCase();
    const pagoMoneda = rawMonedaP && rawMonedaP !== 'XXX' ? rawMonedaP : 'MXN';
    const parsedTcP = parseFloat(attr(pNode, 'TipoCambioP'));
    const pagoTipoCambio =
      pagoMoneda === 'MXN' ? 1 : Number.isFinite(parsedTcP) && parsedTcP > 0 ? parsedTcP : 1;
    const monto = numAttr(pNode, 'Monto');
    const drNodes = pNode ? findAll(pNode, 'DoctoRelacionado') : allDoctosRel;
    return {
      pNode,
      pagoMoneda,
      pagoTipoCambio,
      monto,
      drNodes: idx === 0 && pNode && drNodes.length === 0 ? allDoctosRel : drNodes
    };
  });

  const firstPago = allPagos[0] ?? null;
  const distinctCurrencies = new Set(pagoGroups.map((g) => g.pagoMoneda));
  const hasMixedCurrencies = distinctCurrencies.size > 1;
  const hasTotalesMxn = pagoTotales !== null && attr(pagoTotales, 'MontoTotalPagos') !== '';

  let montoTotalPagos = numAttr(pagoTotales, 'MontoTotalPagos');
  if (montoTotalPagos === 0) {
    for (const g of pagoGroups) {
      montoTotalPagos +=
        (hasTotalesMxn || hasMixedCurrencies) && g.pagoMoneda !== 'MXN'
          ? g.monto * g.pagoTipoCambio
          : g.monto;
    }
  }

  const rawBase16 = attr(pagoTotales, 'TotalTrasladosBaseIVA16');
  const rawBase8 = attr(pagoTotales, 'TotalTrasladosBaseIVA8');
  const rawBase0 = attr(pagoTotales, 'TotalTrasladosBaseIVA0');
  const rawBaseExento = attr(pagoTotales, 'TotalTrasladosBaseIVAExento');
  const hasExplicitBases =
    rawBase16 !== '' || rawBase8 !== '' || rawBase0 !== '' || rawBaseExento !== '';

  const base16 = numAttr(pagoTotales, 'TotalTrasladosBaseIVA16');
  const imp16 = numAttr(pagoTotales, 'TotalTrasladosImpuestoIVA16');
  const base8 = numAttr(pagoTotales, 'TotalTrasladosBaseIVA8');
  const imp8 = numAttr(pagoTotales, 'TotalTrasladosImpuestoIVA8');
  const base0 = numAttr(pagoTotales, 'TotalTrasladosBaseIVA0');
  const baseExento = numAttr(pagoTotales, 'TotalTrasladosBaseIVAExento');

  const singleCurrency = pagoGroups[0]?.pagoMoneda ?? 'MXN';
  const moneda = hasTotalesMxn || hasMixedCurrencies ? 'MXN' : singleCurrency;
  const tipoCambio = moneda === 'MXN' ? 1 : (pagoGroups[0]?.pagoTipoCambio ?? 1);
  const isrRetenido = numAttr(pagoTotales, 'TotalRetencionesISR');
  const ivaRetenido = numAttr(pagoTotales, 'TotalRetencionesIVA');

  const uuidsRel = allDoctosRel.map((dr) => attr(dr, 'IdDocumento').toUpperCase()).filter(Boolean);
  const uuidRelacionado = uuidsRel[0] || fallbackUuidRel;

  const relatedDocs: CfdiRelatedDoc[] = [];
  let exentoDrFallback = 0;
  let drImpPagadoSum = 0;

  for (const g of pagoGroups) {
    for (const dr of g.drNodes) {
      const idDocumento = attr(dr, 'IdDocumento').toUpperCase();
      if (!idDocumento) continue;
      const numParcialidad = Number.parseInt(attr(dr, 'NumParcialidad') || '1', 10) || 1;
      const impSaldoAnt = round2(numAttr(dr, 'ImpSaldoAnt'));
      const impPagado = round2(numAttr(dr, 'ImpPagado'));
      const impSaldoInsoluto = round2(numAttr(dr, 'ImpSaldoInsoluto'));
      const monedaDr = attr(dr, 'MonedaDR').toUpperCase() || undefined;
      const rawEq = attr(dr, 'EquivalenciaDR') || attr(dr, 'TipoCambioDR');
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
      const objetoImpDr = attr(dr, 'ObjetoImpDR');
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
      : round2(montoTotalPagos / 1.16);
  const ivaTrasladado = hasExplicitBases
    ? imp16 + imp8
    : pagoTotales !== null
      ? 0
      : round2(montoTotalPagos - subtotal);

  const taxBreakdown: CfdiTaxBreakdown = hasExplicitBases
    ? {
        base16: round2(base16),
        iva16: round2(imp16),
        base8: round2(base8),
        iva8: round2(imp8),
        base0: round2(base0),
        baseExento: round2(baseExento),
        ieps: 0
      }
    : {
        base16: ivaTrasladado > 0 ? round2(subtotal) : 0,
        iva16: ivaTrasladado > 0 ? round2(ivaTrasladado) : 0,
        base8: 0,
        iva8: 0,
        base0: ivaTrasladado === 0 && exentoDrFallback === 0 ? round2(subtotal) : 0,
        baseExento: round2(exentoDrFallback),
        ieps: 0
      };

  return {
    subtotal: round2(subtotal),
    ivaTrasladado: round2(ivaTrasladado),
    isrRetenido: round2(isrRetenido),
    ivaRetenido: round2(ivaRetenido),
    total: round2(montoTotalPagos),
    formaPago: attr(firstPago, 'FormaDePagoP') || '03',
    moneda,
    tipoCambio,
    uuidRelacionado,
    taxBreakdown,
    relatedDocs
  };
}

function parseNomina12(comprobante: XmlElementNode, baseSubtotal: number, baseDescuento: number, baseTotal: number) {
  const nomina = findFirst(comprobante, 'Nomina');
  const deducciones = findFirst(nomina, 'Deducciones');
  const rawTotalPercep = attr(nomina, 'TotalPercepciones');
  const totalPercep = rawTotalPercep !== '' ? parseFloat(rawTotalPercep) || 0 : baseSubtotal;
  const totalOtrosPagos = numAttr(nomina, 'TotalOtrosPagos');
  const totalImpuestosRet = numAttr(deducciones, 'TotalImpuestosRetenidos');
  const totalOtrasDed = numAttr(deducciones, 'TotalOtrasDeducciones');
  const totalDeducciones = numAttr(nomina, 'TotalDeducciones');

  const subtotal =
    rawTotalPercep !== '' ? round2(totalPercep + totalOtrosPagos) : round2(baseSubtotal);
  const isrRetenido = round2(totalImpuestosRet);
  const descuento =
    totalOtrasDed > 0
      ? round2(totalOtrasDed)
      : totalDeducciones > 0
        ? round2(Math.max(0, totalDeducciones - isrRetenido))
        : round2(baseDescuento);
  const total =
    baseTotal > 0 && rawTotalPercep === '' ? round2(baseTotal) : round2(subtotal - isrRetenido - descuento);

  return { subtotal, isrRetenido, descuento, total };
}

function parseStandardImpuestosAndBreakdown(comprobante: XmlElementNode, netSubtotal: number) {
  const rootImpuestosList = findDirectChildren(comprobante, 'Impuestos');
  const globalImp = rootImpuestosList[rootImpuestosList.length - 1] ?? null;
  const conceptosNode = findFirst(comprobante, 'Conceptos');
  const conceptos = findDirectChildren(conceptosNode, 'Concepto');

  const rootTraslados = globalImp ? findAll(globalImp, 'Traslado') : [];
  const conceptTraslados =
    rootTraslados.length > 0
      ? []
      : conceptos.flatMap((c) => findAll(findFirst(c, 'Impuestos'), 'Traslado'));
  const traslados = rootTraslados.length > 0 ? rootTraslados : conceptTraslados;

  let ivaTrasladado = 0;
  let base16 = 0;
  let iva16 = 0;
  let base8 = 0;
  let iva8 = 0;
  let base0 = 0;
  let baseExento = 0;
  let ieps = 0;

  for (const t of traslados) {
    const imp = attr(t, 'Impuesto');
    const factor = attr(t, 'TipoFactor');
    const tasa = numAttr(t, 'TasaOCuota');
    const base = numAttr(t, 'Base');
    const importe = numAttr(t, 'Importe');

    if (imp === '003') {
      ieps += importe;
    } else if (imp === '002' || !imp) {
      if (factor === 'Exento') {
        baseExento += base;
      } else if (Math.abs(tasa - 0.16) < 0.005) {
        ivaTrasladado += importe;
        iva16 += importe;
        base16 += base > 0 ? base : importe / 0.16;
      } else if (Math.abs(tasa - 0.08) < 0.005) {
        ivaTrasladado += importe;
        iva8 += importe;
        base8 += base > 0 ? base : importe / 0.08;
      } else if (factor === 'Tasa' && tasa === 0) {
        base0 += base;
      } else if (importe > 0) {
        ivaTrasladado += importe;
        iva16 += importe;
        base16 += base > 0 ? base : importe / 0.16;
      }
    }
  }

  if (traslados.length === 0 && globalImp) {
    ivaTrasladado = numAttr(globalImp, 'TotalImpuestosTrasladados');
  }

  const hasRootExento = rootTraslados.some(
    (t) => (attr(t, 'Impuesto') === '002' || !attr(t, 'Impuesto')) && attr(t, 'TipoFactor') === 'Exento'
  );
  let firstObjetoImp: string | undefined;
  for (const c of conceptos) {
    const obj = attr(c, 'ObjetoImp');
    if (!firstObjetoImp && obj) firstObjetoImp = obj;
    const cTraslados = findAll(c, 'Traslado');
    const netImp = Math.max(0, numAttr(c, 'Importe') - numAttr(c, 'Descuento'));
    if ((obj === '01' || obj === '03' || obj === '04') && cTraslados.length === 0) {
      baseExento += netImp;
    } else if (rootTraslados.length > 0 && !hasRootExento && cTraslados.length > 0) {
      for (const ct of cTraslados) {
        const ctImp = attr(ct, 'Impuesto');
        if ((ctImp === '002' || !ctImp) && attr(ct, 'TipoFactor') === 'Exento') {
          baseExento += numAttr(ct, 'Base') || netImp;
        }
      }
    }
  }

  if (base16 === 0 && iva16 === 0 && base8 === 0 && iva8 === 0 && base0 === 0 && baseExento === 0) {
    const netSub = Math.max(0, netSubtotal);
    if (ivaTrasladado > 0) {
      const ratio = netSub > 0 ? ivaTrasladado / netSub : 0.16;
      if (Math.abs(ratio - 0.08) < 0.015) {
        base8 = netSub;
        iva8 = ivaTrasladado;
      } else {
        base16 = netSub;
        iva16 = ivaTrasladado;
      }
    } else if (netSub > 0) {
      if (firstObjetoImp === '01' || firstObjetoImp === '03' || firstObjetoImp === '04') baseExento = netSub;
      else base0 = netSub;
    }
  }

  const localRetenido = findAll(comprobante, 'RetencionesLocales').reduce(
    (sum, n) => sum + numAttr(n, 'Importe'),
    0
  );
  const localTrasladado = findAll(comprobante, 'TrasladosLocales').reduce(
    (sum, n) => sum + numAttr(n, 'Importe'),
    0
  );

  const rootRetenciones = globalImp ? findAll(globalImp, 'Retencion') : [];
  const retenciones =
    rootRetenciones.length > 0
      ? rootRetenciones
      : conceptos.flatMap((c) => findAll(findFirst(c, 'Impuestos'), 'Retencion'));

  let isrRetenido = 0;
  let ivaRetenido = 0;
  for (const r of retenciones) {
    const imp = attr(r, 'Impuesto');
    const importe = numAttr(r, 'Importe');
    if (imp === '001') isrRetenido += importe;
    else if (imp === '002') ivaRetenido += importe;
  }
  const totalRetenidos = numAttr(globalImp, 'TotalImpuestosRetenidos');
  if (isrRetenido === 0 && ivaRetenido === 0 && totalRetenidos > 0) {
    isrRetenido = totalRetenidos;
  }

  const taxBreakdown: CfdiTaxBreakdown = {
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
  };

  return {
    ivaTrasladado: round2(ivaTrasladado),
    isrRetenido: round2(isrRetenido),
    ivaRetenido: round2(ivaRetenido),
    taxBreakdown
  };
}

/** Parser CFDI 4.0/3.3 completo (Deno-compatible) con entidades XML, multi-tasa, Pagos 2.0 y Nómina 1.2. */
export function parseCfdiFull(xmlRaw: string): ParsedCfdiFull | null {
  if (typeof xmlRaw !== 'string' || xmlRaw.trim().length === 0) return null;
  const tree = parseXmlTree(xmlRaw);
  const comprobante = findFirst(tree, 'Comprobante');
  if (!comprobante) return null;

  const timbre = findFirst(comprobante, 'TimbreFiscalDigital');
  const uuid = attr(timbre, 'UUID').toUpperCase();
  if (!uuid) return null;

  const emisor = findFirst(comprobante, 'Emisor');
  const receptor = findFirst(comprobante, 'Receptor');
  const conceptos = findAll(findFirst(comprobante, 'Conceptos'), 'Concepto');
  const firstConcepto = conceptos[0] ?? null;

  const tipoComprobante = (attr(comprobante, 'TipoDeComprobante') || 'I').toUpperCase();
  const rawFecha = attr(comprobante, 'Fecha');
  const fecha = rawFecha ? rawFecha.slice(0, 10) : new Date().toISOString().slice(0, 10);

  let subtotal = numAttr(comprobante, 'SubTotal');
  let descuento = numAttr(comprobante, 'Descuento');
  let total = numAttr(comprobante, 'Total');
  let ivaTrasladado = 0;
  let isrRetenido = 0;
  let ivaRetenido = 0;
  let rawMetodo = (attr(comprobante, 'MetodoPago') || 'PUE').toUpperCase();
  let formaPago = attr(comprobante, 'FormaPago') || '03';
  const rawMoneda = attr(comprobante, 'Moneda').toUpperCase();
  let moneda = rawMoneda && rawMoneda !== 'XXX' ? rawMoneda : 'MXN';
  let tipoCambio = numAttr(comprobante, 'TipoCambio') || 1;

  const cfdiRelNodes = findAll(comprobante, 'CfdiRelacionado');
  const uuidsRelacionados = cfdiRelNodes
    .map((n) => attr(n, 'UUID').toUpperCase())
    .filter(Boolean);
  let uuidRelacionado: string | null = uuidsRelacionados[0] || null;
  let taxBreakdown: CfdiTaxBreakdown | null = null;
  let relatedDocs: CfdiRelatedDoc[] | null = null;

  if (tipoComprobante === 'P') {
    const p20 = parsePago20(comprobante, uuidRelacionado);
    subtotal = p20.subtotal;
    ivaTrasladado = p20.ivaTrasladado;
    isrRetenido = p20.isrRetenido;
    ivaRetenido = p20.ivaRetenido;
    total = p20.total;
    formaPago = p20.formaPago;
    moneda = p20.moneda;
    tipoCambio = p20.tipoCambio;
    uuidRelacionado = p20.uuidRelacionado;
    taxBreakdown = p20.taxBreakdown;
    relatedDocs = p20.relatedDocs;
    rawMetodo = 'PUE';
  } else if (tipoComprobante === 'N') {
    const nom = parseNomina12(comprobante, subtotal, descuento, total);
    subtotal = nom.subtotal;
    isrRetenido = nom.isrRetenido;
    descuento = nom.descuento;
    total = nom.total;
    rawMetodo = 'PUE';
    formaPago = '99';
  } else if (tipoComprobante === 'T') {
    subtotal = 0;
    descuento = 0;
    total = 0;
    rawMetodo = 'PUE';
    formaPago = '99';
  } else {
    const imp = parseStandardImpuestosAndBreakdown(comprobante, subtotal - descuento);
    ivaTrasladado = imp.ivaTrasladado;
    isrRetenido = imp.isrRetenido;
    ivaRetenido = imp.ivaRetenido;
    taxBreakdown = imp.taxBreakdown;
  }

  const descriptions = conceptos.map((c) => attr(c, 'Descripcion')).filter(Boolean);
  const metodoPago = rawMetodo === 'PPD' ? 'PPD' : 'PUE';

  return {
    uuid,
    fecha,
    tipoComprobante,
    serie: attr(comprobante, 'Serie'),
    folio: attr(comprobante, 'Folio'),
    emisorRfc: attr(emisor, 'Rfc').toUpperCase(),
    emisorNombre: attr(emisor, 'Nombre') || 'EMISOR SAT',
    receptorRfc: attr(receptor, 'Rfc').toUpperCase(),
    receptorNombre: attr(receptor, 'Nombre') || 'RECEPTOR SAT',
    conceptoPrincipal:
      descriptions.join(' + ') ||
      (tipoComprobante === 'P'
        ? 'Complemento de Recepción de Pagos 2.0'
        : tipoComprobante === 'T'
          ? 'CFDI de Traslado / Carta Porte'
          : 'Operación comercial'),
    claveProdServ: attr(firstConcepto, 'ClaveProdServ') || '01010101',
    moneda,
    tipoCambio,
    subtotal: round2(subtotal),
    descuento: round2(descuento),
    ivaTrasladado: round2(ivaTrasladado),
    isrRetenido: round2(isrRetenido),
    ivaRetenido: round2(ivaRetenido),
    total: round2(total),
    metodoPago,
    formaPago,
    usoCfdi:
      attr(receptor, 'UsoCFDI') ||
      (tipoComprobante === 'P' ? 'CP01' : tipoComprobante === 'T' ? 'S01' : 'G03'),
    uuidRelacionado,
    ...(uuidsRelacionados.length > 0 ? { uuidsRelacionados } : {}),
    taxBreakdown,
    relatedDocs
  };
}
