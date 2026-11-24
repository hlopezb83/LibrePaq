import type { Account, CfdiDocument, CfdiRelatedDocMeta, PolizaType } from '../types';
import { stripXmlAddenda } from '../xml-utils';
import { resolveFiscalAccount } from './auto-poliza-account-resolver';
import { computeRepDocBreakdown, extractRegimenEmisorFromXml } from './auto-poliza-related';
import type { AutoPolizaMovementDraft, AutoPolizaOverrides } from './auto-poliza-types';
import { fromCents, toCents } from './invariants-and-math';

export function makeDraft(
  acc: Account,
  referencia: string,
  cargoCents: number,
  abonoCents: number,
  concepto: string
): AutoPolizaMovementDraft {
  return {
    accountId: acc.id,
    accountCode: acc.code,
    accountName: acc.name,
    referencia,
    cargo: fromCents(cargoCents),
    abono: fromCents(abonoCents),
    concepto
  };
}

export function toMxnCents(amount: number, cfdi: CfdiDocument): number {
  const rate =
    cfdi.moneda && cfdi.moneda.toUpperCase() !== 'MXN' && cfdi.tipoCambio && cfdi.tipoCambio > 0
      ? cfdi.tipoCambio
      : 1;
  return Math.round(toCents(amount) * rate);
}

export function resolveRecibidoIsrRetentionAccount(
  cfdi: CfdiDocument,
  accounts: readonly Account[],
  relatedMeta?: CfdiRelatedDocMeta
): Account {
  const findByCodeOrSat = (code: string, sat: string): Account | undefined =>
    accounts.find((a) => a.isAffectable && a.code === code) ??
    accounts.find((a) => a.isAffectable && a.satGroupCode === sat);

  const regimen = (relatedMeta?.regimenEmisor || extractRegimenEmisorFromXml(cfdi.xmlRaw) || '').trim();
  const netSub =
    relatedMeta?.subtotalMxn && relatedMeta.subtotalMxn > 0
      ? relatedMeta.subtotalMxn
      : relatedMeta?.totalMxn && relatedMeta.totalMxn > 0
        ? (relatedMeta.totalMxn + (relatedMeta.isrRetenidoMxn ?? 0) + (relatedMeta.ivaRetenidoMxn ?? 0)) / 1.16
        : Math.max(0, cfdi.subtotal - (cfdi.descuento || 0));
  const isrAmount = relatedMeta?.isrRetenidoMxn !== undefined ? relatedMeta.isrRetenidoMxn : cfdi.isrRetenido;
  const rate = netSub > 0 ? isrAmount / netSub : 0;
  const text = `${relatedMeta?.conceptoPrincipal || cfdi.conceptoPrincipal} ${relatedMeta?.emisorNombre || cfdi.emisorNombre}`.toLowerCase();
  const clave = (relatedMeta?.claveProdServ || cfdi.claveProdServ || '').trim();
  const uso = (relatedMeta?.usoCfdi || cfdi.usoCfdi || '').trim().toUpperCase();

  if (regimen === '626' || Math.abs(rate - 0.0125) < 0.0025 || /resico|r[eé]gimen simplificado/i.test(text)) {
    return findByCodeOrSat('216-01-005', '216.09') ?? resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
  }
  if (regimen === '606' || /arrendamiento|renta|alquiler|inmueble|local comercial|oficina/i.test(text) || clave.startsWith('801315')) {
    return findByCodeOrSat('216-01-003', '216.03') ?? resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
  }
  if (Math.abs(rate - 0.1) < 0.01 || /honorario|servicio|profesional|consultor|asesor|contable|legal|m[eé]dic/i.test(text) || /^(801|841|851)/.test(clave) || uso === 'G03') {
    return findByCodeOrSat('216-01-004', '216.04') ?? resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
  }
  return resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
}

export function findPendingRetentionAccount(accounts: readonly Account[], kind: 'ISR' | 'IVA'): Account | undefined {
  const targetCode = kind === 'ISR' ? '216-02-001' : '216-02-002';
  const nameRe = kind === 'ISR' ? /isr/i : /iva/i;
  return (
    accounts.find((a) => a.isAffectable && a.code === targetCode) ??
    accounts.find((a) => a.isAffectable && a.code.startsWith('216-02') && nameRe.test(a.name)) ??
    accounts.find((a) => a.isAffectable && a.code.startsWith('216-') && /pendiente/i.test(a.name) && nameRe.test(a.name))
  );
}

export function resolvePendingIsrRetentionAccount(cfdi: CfdiDocument, accounts: readonly Account[]): Account {
  return findPendingRetentionAccount(accounts, 'ISR') ?? resolveRecibidoIsrRetentionAccount(cfdi, accounts);
}

export function resolvePendingIvaRetentionAccount(accounts: readonly Account[]): Account {
  return findPendingRetentionAccount(accounts, 'IVA') ?? resolveFiscalAccount(accounts, 'IVA_RETENIDO_POR_PAGAR');
}

export function extractNominaPayrollSplits(xmlRaw: string): {
  hasOtroPagoTags: boolean;
  subsidioCents: number;
  otherPagosCents: number;
  hasDeduccionTags: boolean;
  imssObreroCents: number;
  otherNonIsrDeduccionesCents: number;
} {
  const clean = stripXmlAddenda(xmlRaw || '');
  let hasOtroPagoTags = false;
  let subsidioCents = 0;
  let otherPagosCents = 0;
  const otroRe = /<(?:[a-z0-9_]+:)?OtroPago\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = otroRe.exec(clean)) !== null) {
    hasOtroPagoTags = true;
    const attrs = m[1] ?? '';
    const tipo = /TipoOtroPago=["']([^"']+)["']/i.exec(attrs)?.[1] ?? '';
    const imp = Number.parseFloat(/Importe=["']([0-9]+(?:\.[0-9]+)?)["']/i.exec(attrs)?.[1] ?? '0') || 0;
    if (tipo === '002') subsidioCents += toCents(imp);
    else otherPagosCents += toCents(imp);
  }

  let hasDeduccionTags = false;
  let imssObreroCents = 0;
  let otherNonIsrDeduccionesCents = 0;
  const dedRe = /<(?:[a-z0-9_]+:)?Deduccion\b([^>]*)\/?>/gi;
  while ((m = dedRe.exec(clean)) !== null) {
    hasDeduccionTags = true;
    const attrs = m[1] ?? '';
    const tipo = /TipoDeduccion=["']([^"']+)["']/i.exec(attrs)?.[1] ?? '';
    const imp = Number.parseFloat(/Importe=["']([0-9]+(?:\.[0-9]+)?)["']/i.exec(attrs)?.[1] ?? '0') || 0;
    if (tipo === '002') continue;
    if (tipo === '001') imssObreroCents += toCents(imp);
    else otherNonIsrDeduccionesCents += toCents(imp);
  }
  return { hasOtroPagoTags, subsidioCents, otherPagosCents, hasDeduccionTags, imssObreroCents, otherNonIsrDeduccionesCents };
}

function appendRepRetentions(
  cfdi: CfdiDocument,
  accounts: readonly Account[],
  movements: AutoPolizaMovementDraft[],
  ref: string,
  totalCents: number,
  counterpartyCents: number,
  breakdown: ReturnType<typeof computeRepDocBreakdown>,
  overrides?: AutoPolizaOverrides
): { histIsr: number; payIsr: number; histIva: number; payIva: number } {
  const accPendIsr = findPendingRetentionAccount(accounts, 'ISR');
  const accPendIva = findPendingRetentionAccount(accounts, 'IVA');
  let histIsr = 0;
  let payIsr = 0;
  let histIva = 0;
  let payIva = 0;

  const pushPair = (
    pend: Account | undefined,
    payAcc: Account,
    hCents: number,
    pCents: number,
    label: string,
    isIsr: boolean
  ) => {
    if (!pend || (hCents <= 0 && pCents <= 0)) return;
    movements.push(
      makeDraft(pend, ref, hCents, 0, `Reclasificación ${label} Retenido Pagado REP ${ref}`),
      makeDraft(payAcc, ref, 0, pCents, `${label} Retenido Exigible REP ${ref}`)
    );
    if (isIsr) {
      histIsr += hCents;
      payIsr += pCents;
    } else {
      histIva += hCents;
      payIva += pCents;
    }
  };

  const hasPerDocRetMeta = breakdown.entries.some(
    (e) => (e.meta?.isrRetenidoMxn ?? 0) > 0 || (e.meta?.ivaRetenidoMxn ?? 0) > 0
  );

  if (hasPerDocRetMeta) {
    const singleDoc = breakdown.entries.length === 1;
    for (const e of breakdown.entries) {
      const docRatio =
        e.meta?.totalMxn && e.meta.totalMxn > 0
          ? Math.min(1, Math.max(0, e.histMxnCents / toCents(e.meta.totalMxn)))
          : 1;
      const fxScale = e.histMxnCents > 0 ? e.payMxnCents / e.histMxnCents : 1;
      const rawIsrMxn = e.meta?.isrRetenidoMxn ?? 0;
      const rawIvaMxn = e.meta?.ivaRetenidoMxn ?? 0;

      if (rawIsrMxn > 0 || (singleDoc && cfdi.isrRetenido > 0)) {
        const p = singleDoc && cfdi.isrRetenido > 0 ? toMxnCents(cfdi.isrRetenido, cfdi) : Math.round(toCents(rawIsrMxn) * docRatio * fxScale);
        const h = singleDoc && cfdi.isrRetenido > 0 && e.payMxnCents > 0 ? Math.round(p * (e.histMxnCents / e.payMxnCents)) : Math.round(toCents(rawIsrMxn) * docRatio);
        pushPair(accPendIsr, resolveRecibidoIsrRetentionAccount(cfdi, accounts, e.meta), h, p, 'ISR', true);
      }
      if (rawIvaMxn > 0 || (singleDoc && cfdi.ivaRetenido > 0)) {
        const p = singleDoc && cfdi.ivaRetenido > 0 ? toMxnCents(cfdi.ivaRetenido, cfdi) : Math.round(toCents(rawIvaMxn) * docRatio * fxScale);
        const h = singleDoc && cfdi.ivaRetenido > 0 && e.payMxnCents > 0 ? Math.round(p * (e.histMxnCents / e.payMxnCents)) : Math.round(toCents(rawIvaMxn) * docRatio);
        pushPair(accPendIva, resolveFiscalAccount(accounts, 'IVA_RETENIDO_POR_PAGAR'), h, p, 'IVA', false);
      }
    }
    return { histIsr, payIsr, histIva, payIva };
  }

  const singleMeta =
    breakdown.entries[0]?.meta ??
    (cfdi.uuidRelacionado ? overrides?.relatedDocsMetaByUuid?.[cfdi.uuidRelacionado.trim().toUpperCase()] : undefined);
  const ratio =
    overrides?.relatedPpdTotal && overrides.relatedPpdTotal > 0
      ? Math.min(1, Math.max(0, counterpartyCents / toCents(overrides.relatedPpdTotal)))
      : 1;
  const payScale = counterpartyCents > 0 ? totalCents / counterpartyCents : 1;
  const histScale = totalCents > 0 ? counterpartyCents / totalCents : 1;

  const pIsr = cfdi.isrRetenido > 0 ? toMxnCents(cfdi.isrRetenido, cfdi) : overrides?.relatedPpdIsrRetenido ? Math.round(toCents(overrides.relatedPpdIsrRetenido) * ratio * payScale) : 0;
  const hIsr = cfdi.isrRetenido > 0 ? Math.round(pIsr * histScale) : overrides?.relatedPpdIsrRetenido ? Math.round(toCents(overrides.relatedPpdIsrRetenido) * ratio) : 0;
  const pIva = cfdi.ivaRetenido > 0 ? toMxnCents(cfdi.ivaRetenido, cfdi) : overrides?.relatedPpdIvaRetenido ? Math.round(toCents(overrides.relatedPpdIvaRetenido) * ratio * payScale) : 0;
  const hIva = cfdi.ivaRetenido > 0 ? Math.round(pIva * histScale) : overrides?.relatedPpdIvaRetenido ? Math.round(toCents(overrides.relatedPpdIvaRetenido) * ratio) : 0;

  pushPair(accPendIsr, resolveRecibidoIsrRetentionAccount(cfdi, accounts, singleMeta), hIsr, pIsr, 'ISR', true);
  pushPair(accPendIva, resolveFiscalAccount(accounts, 'IVA_RETENIDO_POR_PAGAR'), hIva, pIva, 'IVA', false);
  return { histIsr, payIsr, histIva, payIva };
}

export function buildPaymentRepMovements(
  cfdi: CfdiDocument,
  accounts: readonly Account[],
  overrides?: AutoPolizaOverrides
): { polizaType: PolizaType; polizaConcept: string; movements: AutoPolizaMovementDraft[] } {
  const esRecibido = cfdi.direction === 'RECIBIDO';
  const ref = `${cfdi.serie}-${cfdi.folio}`;
  const totalCents = toMxnCents(cfdi.total, cfdi);
  const ivaCents = toMxnCents(cfdi.ivaTrasladado, cfdi);
  const breakdown = computeRepDocBreakdown(cfdi, totalCents, ivaCents, overrides);
  const counterpartyCents = breakdown.counterpartyCents;
  const historicalIvaCents = breakdown.totalHistIvaCents;
  const counterOverride = overrides?.counterAccountCode ?? overrides?.bankOrCounterpartyAccountId;
  const opOverride = overrides?.operationAccountCode ?? overrides?.expenseOrIncomeAccountId;

  const accBancos = resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL', counterOverride);
  const movements: AutoPolizaMovementDraft[] = [];

  if (esRecibido) {
    const accProveedores = resolveFiscalAccount(accounts, 'PROVEEDORES_NACIONALES', opOverride);
    const accIvaPagado = resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO');
    const accIvaPorAcreditar = resolveFiscalAccount(accounts, 'IVA_PENDIENTE_PAGO');

    movements.push(
      makeDraft(accProveedores, ref, counterpartyCents, 0, `Liquidación a proveedor REP ${ref} - ${cfdi.emisorNombre}`),
      makeDraft(accBancos, ref, 0, totalCents, `Pago bancario REP ${ref}`)
    );
    if (breakdown.deductiblePayIvaCents > 0 || breakdown.deductibleHistIvaCents > 0) {
      movements.push(
        makeDraft(accIvaPagado, ref, breakdown.deductiblePayIvaCents, 0, `IVA Efectivamente Pagado REP ${ref}`),
        makeDraft(accIvaPorAcreditar, ref, 0, breakdown.deductibleHistIvaCents, `Reclasificación IVA Pendiente REP ${ref}`)
      );
    }

    const ret = appendRepRetentions(cfdi, accounts, movements, ref, totalCents, counterpartyCents, breakdown, overrides);
    const fxDiffCents =
      counterpartyCents + breakdown.deductiblePayIvaCents + ret.histIsr + ret.histIva -
      (totalCents + breakdown.deductibleHistIvaCents + ret.payIsr + ret.payIva);
    if (fxDiffCents < 0) {
      movements.push(makeDraft(resolveFiscalAccount(accounts, 'PERDIDA_CAMBIARIA'), ref, Math.abs(fxDiffCents), 0, `Pérdida cambiaria realizada REP ${ref}`));
    } else if (fxDiffCents > 0) {
      movements.push(makeDraft(resolveFiscalAccount(accounts, 'UTILIDAD_CAMBIARIA'), ref, 0, fxDiffCents, `Utilidad cambiaria realizada REP ${ref}`));
    }
    return {
      polizaType: overrides?.polizaType ?? 'EGRESO',
      polizaConcept: `Complemento de Pago ${ref} - ${cfdi.emisorNombre}`,
      movements
    };
  }

  const accClientes = resolveFiscalAccount(accounts, 'CLIENTES_NACIONALES', opOverride);
  const accIvaTrasCobrado = resolveFiscalAccount(accounts, 'IVA_TRASLADADO_COBRADO');
  const accIvaTrasNoCobrado = resolveFiscalAccount(accounts, 'IVA_TRASLADADO_NO_COBRADO');

  movements.push(
    makeDraft(accBancos, ref, totalCents, 0, `Cobro REP ${ref} - ${cfdi.receptorNombre}`),
    makeDraft(accClientes, ref, 0, counterpartyCents, `Liquidación factura PPD (${cfdi.uuidRelacionado || ref})`)
  );
  if (ivaCents > 0) {
    movements.push(
      makeDraft(accIvaTrasNoCobrado, ref, historicalIvaCents, 0, `Cancelación IVA Pendiente por cobro REP ${ref}`),
      makeDraft(accIvaTrasCobrado, ref, 0, ivaCents, `IVA Efectivamente Cobrado REP ${ref}`)
    );
  }
  const fxDiffCents = totalCents + historicalIvaCents - (counterpartyCents + ivaCents);
  if (fxDiffCents > 0) {
    movements.push(makeDraft(resolveFiscalAccount(accounts, 'UTILIDAD_CAMBIARIA'), ref, 0, fxDiffCents, `Utilidad cambiaria realizada REP ${ref}`));
  } else if (fxDiffCents < 0) {
    movements.push(makeDraft(resolveFiscalAccount(accounts, 'PERDIDA_CAMBIARIA'), ref, Math.abs(fxDiffCents), 0, `Pérdida cambiaria realizada REP ${ref}`));
  }
  return {
    polizaType: overrides?.polizaType ?? 'INGRESO',
    polizaConcept: `Complemento de Pago ${ref} - ${cfdi.receptorNombre}`,
    movements
  };
}
