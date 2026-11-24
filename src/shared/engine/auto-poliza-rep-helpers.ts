import type { Account, CfdiDocument, PolizaType } from '../types';
import { stripXmlAddenda } from '../xml-utils';
import { resolveFiscalAccount } from './auto-poliza-account-resolver';
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
  accounts: readonly Account[]
): Account {
  const findByCodeOrSat = (code: string, sat: string): Account | undefined =>
    accounts.find((a) => a.isAffectable && a.code === code) ??
    accounts.find((a) => a.isAffectable && a.satGroupCode === sat);

  const netSub = Math.max(0, cfdi.subtotal - (cfdi.descuento || 0));
  const rate = netSub > 0 ? cfdi.isrRetenido / netSub : 0;
  const text = `${cfdi.conceptoPrincipal} ${cfdi.emisorNombre}`.toLowerCase();
  const clave = (cfdi.claveProdServ || '').trim();
  const uso = (cfdi.usoCfdi || '').trim().toUpperCase();

  if (Math.abs(rate - 0.0125) < 0.0025 || /resico|r[eé]gimen simplificado/i.test(text)) {
    return findByCodeOrSat('216-01-005', '216.09') ?? resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
  }
  if (
    /arrendamiento|renta|alquiler|inmueble|local comercial|oficina/i.test(text) ||
    clave.startsWith('801315')
  ) {
    return findByCodeOrSat('216-01-003', '216.03') ?? resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
  }
  if (
    Math.abs(rate - 0.1) < 0.01 ||
    /honorario|servicio|profesional|consultor|asesor|contable|legal|m[eé]dic/i.test(text) ||
    /^(801|841|851)/.test(clave) ||
    uso === 'G03'
  ) {
    return findByCodeOrSat('216-01-004', '216.04') ?? resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
  }
  return resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
}

export function findPendingRetentionAccount(
  accounts: readonly Account[],
  kind: 'ISR' | 'IVA'
): Account | undefined {
  const targetCode = kind === 'ISR' ? '216-02-001' : '216-02-002';
  const nameRe = kind === 'ISR' ? /isr/i : /iva/i;
  return (
    accounts.find((a) => a.isAffectable && a.code === targetCode) ??
    accounts.find((a) => a.isAffectable && a.code.startsWith('216-02') && nameRe.test(a.name)) ??
    accounts.find((a) => a.isAffectable && a.code.startsWith('216-') && /pendiente/i.test(a.name) && nameRe.test(a.name))
  );
}

export function resolvePendingIsrRetentionAccount(
  cfdi: CfdiDocument,
  accounts: readonly Account[]
): Account {
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
    if (tipo === '002') continue; // ISR ya viene en isrRetenido
    if (tipo === '001') imssObreroCents += toCents(imp);
    else otherNonIsrDeduccionesCents += toCents(imp);
  }
  return {
    hasOtroPagoTags,
    subsidioCents,
    otherPagosCents,
    hasDeduccionTags,
    imssObreroCents,
    otherNonIsrDeduccionesCents
  };
}

function resolveRepCounterpartyMxnCents(
  cfdi: CfdiDocument,
  bankMxnCents: number,
  overrides?: AutoPolizaOverrides
): number {
  const docs = cfdi.relatedDocs;
  const headerCur = (cfdi.moneda || 'MXN').toUpperCase();
  const headerTc = headerCur !== 'MXN' && cfdi.tipoCambio > 0 ? cfdi.tipoCambio : 1;

  if (!docs || docs.length === 0) {
    if (headerCur !== 'MXN') {
      const relKey = (cfdi.uuidRelacionado || '').trim().toUpperCase();
      const origTc =
        (relKey ? overrides?.relatedOriginalTipoCambioByUuid?.[relKey] : undefined) ??
        overrides?.relatedOriginalTipoCambio;
      if (origTc && origTc > 0) return Math.round(toCents(cfdi.total) * origTc);
    }
    return bankMxnCents;
  }

  let sumCounterCents = 0;
  let hasForeignDoc = false;
  for (const dr of docs) {
    const pCur = (dr.pagoMoneda || headerCur).toUpperCase();
    const pTc =
      dr.pagoTipoCambio && dr.pagoTipoCambio > 0
        ? dr.pagoTipoCambio
        : pCur !== 'MXN'
          ? headerTc
          : 1;
    const drCur = (dr.monedaDr || pCur).toUpperCase();
    if (drCur !== 'MXN' || pCur !== 'MXN') hasForeignDoc = true;
    if (drCur === 'MXN') {
      sumCounterCents += toCents(dr.impPagado);
      continue;
    }
    const docUuid = (dr.idDocumento || '').trim().toUpperCase();
    const origTc =
      (docUuid ? overrides?.relatedOriginalTipoCambioByUuid?.[docUuid] : undefined) ??
      overrides?.relatedOriginalTipoCambio;
    if (origTc && origTc > 0) {
      sumCounterCents += Math.round(toCents(dr.impPagado) * origTc);
      continue;
    }
    if (dr.equivalenciaDr && dr.equivalenciaDr > 0 && Math.abs(dr.equivalenciaDr - 1) > 0.0001) {
      sumCounterCents += Math.round((toCents(dr.impPagado) / dr.equivalenciaDr) * pTc);
    } else if (
      dr.pagoTipoCambio &&
      dr.pagoTipoCambio > 0 &&
      headerTc > 1 &&
      Math.abs(dr.pagoTipoCambio - headerTc) > 0.0001
    ) {
      sumCounterCents += Math.round(toCents(dr.impPagado) * dr.pagoTipoCambio);
    } else {
      sumCounterCents += Math.round(toCents(dr.impPagado) * pTc);
    }
  }
  if (!hasForeignDoc || sumCounterCents <= 0) return bankMxnCents;
  if (Math.abs(bankMxnCents - sumCounterCents) <= 5) return bankMxnCents;
  return sumCounterCents;
}

export function buildPaymentRepMovements(
  cfdi: CfdiDocument,
  accounts: readonly Account[],
  overrides?: AutoPolizaOverrides
): { polizaType: PolizaType; polizaConcept: string; movements: AutoPolizaMovementDraft[] } {
  const esRecibido = cfdi.direction === 'RECIBIDO';
  const ref = `${cfdi.serie}-${cfdi.folio}`;
  const totalCents = toMxnCents(cfdi.total, cfdi);
  const counterpartyCents = resolveRepCounterpartyMxnCents(cfdi, totalCents, overrides);
  const ivaCents = toMxnCents(cfdi.ivaTrasladado, cfdi);
  const historicalIvaCents =
    ivaCents > 0 && totalCents > 0 && counterpartyCents !== totalCents
      ? Math.round(ivaCents * (counterpartyCents / totalCents))
      : ivaCents;
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
    if (ivaCents > 0) {
      movements.push(
        makeDraft(accIvaPagado, ref, ivaCents, 0, `IVA Efectivamente Pagado REP ${ref}`),
        makeDraft(accIvaPorAcreditar, ref, 0, historicalIvaCents, `Reclasificación IVA Pendiente REP ${ref}`)
      );
    }

    // Reclasificación proporcional de retenciones PPD pendientes (216-02-* -> 216-01-*)
    const ratio =
      overrides?.relatedPpdTotal && overrides.relatedPpdTotal > 0
        ? Math.min(1, Math.max(0, counterpartyCents / toCents(overrides.relatedPpdTotal)))
        : 1;
    const isrRetCents =
      cfdi.isrRetenido > 0
        ? toMxnCents(cfdi.isrRetenido, cfdi)
        : overrides?.relatedPpdIsrRetenido
          ? Math.round(toCents(overrides.relatedPpdIsrRetenido) * ratio)
          : 0;
    const ivaRetCents =
      cfdi.ivaRetenido > 0
        ? toMxnCents(cfdi.ivaRetenido, cfdi)
        : overrides?.relatedPpdIvaRetenido
          ? Math.round(toCents(overrides.relatedPpdIvaRetenido) * ratio)
          : 0;

    if (isrRetCents > 0) {
      const accPendIsr = findPendingRetentionAccount(accounts, 'ISR');
      if (accPendIsr) {
        const accPayIsr = resolveRecibidoIsrRetentionAccount(cfdi, accounts);
        movements.push(
          makeDraft(accPendIsr, ref, isrRetCents, 0, `Reclasificación ISR Retenido Pagado REP ${ref}`),
          makeDraft(accPayIsr, ref, 0, isrRetCents, `ISR Retenido Exigible REP ${ref}`)
        );
      }
    }
    if (ivaRetCents > 0) {
      const accPendIva = findPendingRetentionAccount(accounts, 'IVA');
      if (accPendIva) {
        const accPayIva = resolveFiscalAccount(accounts, 'IVA_RETENIDO_POR_PAGAR');
        movements.push(
          makeDraft(accPendIva, ref, ivaRetCents, 0, `Reclasificación IVA Retenido Pagado REP ${ref}`),
          makeDraft(accPayIva, ref, 0, ivaRetCents, `IVA Retenido Exigible REP ${ref}`)
        );
      }
    }

    const fxDiffCents = counterpartyCents + ivaCents - (totalCents + historicalIvaCents);
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
