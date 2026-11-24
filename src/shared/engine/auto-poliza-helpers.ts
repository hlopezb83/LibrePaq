import type { Account, CfdiDocument } from '../types';
import { resolveFiscalAccount } from './auto-poliza-account-resolver';
import type { AutoPolizaOverrides } from './auto-poliza-types';
import { toMxnCents } from './auto-poliza-rep-helpers';

export {
  buildPaymentRepMovements,
  extractNominaPayrollSplits,
  makeDraft,
  resolvePendingIsrRetentionAccount,
  resolvePendingIvaRetentionAccount,
  resolveRecibidoIsrRetentionAccount,
  toMxnCents
} from './auto-poliza-rep-helpers';

export const CREDIT_NOTE_NON_CASH_FORMAS = new Set(['15', '17', '30', '99']);

export function isNonCashCreditNote(
  cfdi: Pick<CfdiDocument, 'tipoComprobante' | 'metodoPago' | 'formaPago'>,
  overrides?: Pick<AutoPolizaOverrides, 'relatedIsPpd'>
): boolean {
  if (cfdi.tipoComprobante !== 'E') return false;
  return (
    cfdi.metodoPago === 'PPD' ||
    CREDIT_NOTE_NON_CASH_FORMAS.has((cfdi.formaPago || '').trim()) ||
    Boolean(overrides?.relatedIsPpd)
  );
}

export function extractCfdiRuleContext(cfdi: CfdiDocument, overrides?: AutoPolizaOverrides) {
  const subtotalNetoCents = toMxnCents(cfdi.subtotal, cfdi) - toMxnCents(cfdi.descuento, cfdi);
  const ivaCents = toMxnCents(cfdi.ivaTrasladado, cfdi);
  const isrRetCents = toMxnCents(cfdi.isrRetenido, cfdi);
  const ivaRetCents = toMxnCents(cfdi.ivaRetenido, cfdi);
  const totalCents = toMxnCents(cfdi.total, cfdi);
  const { localTrasladadoCents: explicitLocalTrasCents, localRetenidoCents } =
    extractLocalTaxCents(cfdi);
  const nonIvaTaxCents = computeNonIvaTaxCents(
    cfdi, subtotalNetoCents, ivaCents, isrRetCents, ivaRetCents, totalCents, localRetenidoCents
  );
  const explicitIepsCents = cfdi.taxBreakdown?.ieps
    ? Math.max(0, toMxnCents(cfdi.taxBreakdown.ieps, cfdi))
    : 0;
  const localTrasladadoCents = Math.min(nonIvaTaxCents, explicitLocalTrasCents);
  const iepsCents = Math.min(nonIvaTaxCents - localTrasladadoCents, explicitIepsCents);
  const esPagado =
    cfdi.tipoComprobante === 'E'
      ? !isNonCashCreditNote(cfdi, overrides)
      : cfdi.metodoPago === 'PUE';

  return {
    esRecibido: cfdi.direction === 'RECIBIDO',
    esPagado,
    ref: `${cfdi.serie}-${cfdi.folio}`,
    ivaCents,
    isrRetCents,
    ivaRetCents,
    totalCents,
    localRetenidoCents,
    iepsCents,
    localTrasladadoCents,
    effectiveSubtotalCents: subtotalNetoCents + nonIvaTaxCents,
    emitidaSubtotalCents: subtotalNetoCents + (nonIvaTaxCents - iepsCents - localTrasladadoCents),
    opOverride: overrides?.operationAccountCode ?? overrides?.expenseOrIncomeAccountId,
    counterOverride: overrides?.counterAccountCode ?? overrides?.bankOrCounterpartyAccountId
  };
}

export function extractLocalTaxCents(cfdi: CfdiDocument): {
  localTrasladadoCents: number;
  localRetenidoCents: number;
} {
  const tb = cfdi.taxBreakdown as
    | { localTrasladado?: number; localRetenido?: number }
    | null
    | undefined;
  return {
    localTrasladadoCents: tb?.localTrasladado ? Math.max(0, toMxnCents(tb.localTrasladado, cfdi)) : 0,
    localRetenidoCents: tb?.localRetenido ? Math.max(0, toMxnCents(tb.localRetenido, cfdi)) : 0
  };
}

export function resolveLocalTaxLiabilityAccount(accounts: readonly Account[]): Account {
  const exact213009 = accounts.find((a) => a.isAffectable && a.code === '213-01-009');
  if (exact213009) return exact213009;
  const preferred = accounts.find(
    (a) =>
      a.isAffectable &&
      (a.satGroupCode === '213.09' ||
        a.code === '213-01-003' ||
        a.code === '213-02-001' ||
        (a.code.startsWith('213-') && /local|estatal|ish|hospedaje/i.test(a.name)))
  );
  if (preferred) return preferred;
  const nonIva213 = accounts.find(
    (a) => a.isAffectable && a.code.startsWith('213-') && a.code !== '213-01-001' && a.code !== '213-01-002'
  );
  return nonIva213 ?? accounts.find((a) => a.isAffectable && a.code.startsWith('213-')) ?? resolveFiscalAccount(accounts, 'PROVISION_IVA_POR_PAGAR');
}

export function computeNonIvaTaxCents(
  cfdi: CfdiDocument,
  subtotalNetoCents: number,
  ivaCents: number,
  isrRetCents: number,
  ivaRetCents: number,
  totalCents: number,
  localRetCents = 0
): number {
  const rawFiscalDiffCents =
    totalCents + isrRetCents + ivaRetCents + localRetCents - (subtotalNetoCents + ivaCents);
  if (rawFiscalDiffCents <= 0) return 0;

  const explicitIepsCents = cfdi.taxBreakdown?.ieps
    ? Math.max(0, toMxnCents(cfdi.taxBreakdown.ieps, cfdi))
    : 0;
  const { localTrasladadoCents } = extractLocalTaxCents(cfdi);
  const explicitTotalCents = explicitIepsCents + localTrasladadoCents;

  if (explicitTotalCents > 0) {
    return rawFiscalDiffCents;
  }

  return rawFiscalDiffCents > 5 ? rawFiscalDiffCents : 0;
}

export function resolveEmployeeReceivableAccount(
  accounts: readonly Account[],
  fallbackBank: Account
): Account {
  return (
    accounts.find(
      (a) =>
        a.isAffectable &&
        (a.code.startsWith('107-') || (a.satGroupCode ?? '').startsWith('107'))
    ) ?? fallbackBank
  );
}
