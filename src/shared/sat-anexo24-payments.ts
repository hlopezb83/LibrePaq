import { truncXml, type SatSolicitudTipo } from './sat-anexo24-auxiliaries';
import type { Poliza, PolizaMovement } from './types';

export interface Anexo24CfdiMetadata {
  total: number;
  rfcContraparte: string;
  moneda?: string;
  tipoCambio?: number;
  formaPago?: string;
  ctaDest?: string;
  bancoDestNal?: string;
}

export interface SatAnexo24Options {
  tipoEnvio?: 'N' | 'C';
  fechaModBal?: string;
  balanzaLevel?: 'ALL' | 'N2';
  omitZeroAccounts?: boolean;
  counterpartRfc?: string;
  tipoSolicitud?: SatSolicitudTipo;
  numOrden?: string;
  numTramite?: string;
  strictSolicitud?: boolean;
  cfdiLookup?: ReadonlyMap<string, Anexo24CfdiMetadata>;
}

const RFC_EXTRACT_REGEX = /[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/i;

const BANK_CODE_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/bbva|bancomer/i, '012'],
  [/banamex|citibanamex/i, '002'],
  [/santander/i, '014'],
  [/banorte|ixe/i, '072'],
  [/hsbc/i, '021'],
  [/scotiabank/i, '044'],
  [/inbursa/i, '036'],
  [/banregio/i, '058'],
  [/banbajio|baj[ií]o/i, '030'],
  [/azteca/i, '127'],
  [/bancoppel|coppel/i, '137'],
  [/afirme/i, '062'],
  [/banobras/i, '009'],
  [/mifel/i, '042'],
  [/multiva/i, '132'],
  [/monex/i, '112'],
  [/intercam/i, '136'],
  [/cibanco/i, '143'],
  [/actinver/i, '133']
];

export function inferSatBankCode(accountName: string | null | undefined): string | null {
  const name = accountName || '';
  for (const [pattern, code] of BANK_CODE_PATTERNS) {
    if (pattern.test(name)) return code;
  }
  return null;
}

export function resolveMovementCounterpart(
  companyRfc: string,
  poliza: Poliza,
  mov: PolizaMovement,
  options?: SatAnexo24Options,
  overrideUuid?: string
) {
  const rawUuid = (overrideUuid ?? mov.cfdiUuid ?? poliza.cfdiUuid ?? '').trim();
  const upperUuid = rawUuid.toUpperCase();
  const cfdiInfo = upperUuid ? options?.cfdiLookup?.get(upperUuid) : undefined;
  const extractedRfc =
    mov.concepto?.match(RFC_EXTRACT_REGEX)?.[0] ||
    poliza.concepto?.match(RFC_EXTRACT_REGEX)?.[0];
  const explicitRfc =
    cfdiInfo?.rfcContraparte ||
    mov.beneficiaryRfc ||
    mov.rfcContraparte ||
    options?.counterpartRfc ||
    extractedRfc ||
    '';
  const rawRfc = (explicitRfc || 'XAXX010101000').toUpperCase();
  const matchesOwnCompany = rawRfc === companyRfc.toUpperCase();
  const missingCounterpartRfc = !explicitRfc || matchesOwnCompany;
  const thirdPartyRfc = matchesOwnCompany ? 'XAXX010101000' : truncXml(rawRfc, 13);

  const monedaRaw = (cfdiInfo?.moneda || mov.cfdiMoneda || 'MXN').toUpperCase();
  const tcVal = cfdiInfo?.tipoCambio || mov.cfdiTipoCambio || 1;
  const fxAttrs =
    monedaRaw !== 'MXN' && monedaRaw !== 'XXX'
      ? ` Moneda="${truncXml(monedaRaw, 3)}" TipCamb="${tcVal.toFixed(4)}"`
      : '';

  return {
    rawUuid,
    upperUuid,
    cfdiInfo,
    thirdPartyRfc,
    missingCounterpartRfc,
    monedaRaw,
    tcVal,
    fxAttrs
  };
}

function inferOtherPaymentMethodCode(hint: string, formaPago?: string): string {
  if (/\b(?:EFEC|EFECTIVO)\b/i.test(hint)) return '01';
  if (/\b(?:CHQ|CHEQUE)\b|^CH-?\d+/i.test(hint)) return '02';
  if (/\b(?:SPEI|TRANSF(?:ERENCIA)?|TRF|TEF|DEP)\b|dep[oó]sito/i.test(hint)) return '03';
  if (/\bTDC\b|tarjeta.*cr[eé]dito/i.test(hint)) return '04';
  if (/\b(?:TDD|TARJETA)\b/i.test(hint)) return '28';
  const cleanFp = (formaPago || '').trim();
  if (/^\d{2}$/.test(cleanFp) && cleanFp !== '00') return cleanFp;
  return '99';
}

export function buildBankPaymentNode(
  fecha: string,
  poliza: Poliza,
  mov: PolizaMovement,
  thirdPartyRfc: string,
  fxAttrs: string,
  cfdiInfo?: Anexo24CfdiMetadata
): string {
  const isBankAccount = (mov.accountCode || '').trim().startsWith('102');
  const isEgreso = Number(mov.abono || 0) > 0 && Number(mov.cargo || 0) <= 0;
  const rawAmount = mov.cargo > 0 ? mov.cargo : mov.abono;
  if (!isBankAccount || !Number.isFinite(rawAmount) || rawAmount <= 0) return '';

  const ref = (mov.referencia || '').trim();
  const safeFecha = truncXml(fecha, 10);
  const benef = truncXml(
    mov.beneficiaryName?.trim() || mov.concepto || poliza.concepto || mov.accountName || 'Contraparte',
    300
  );
  const rfcAttr = truncXml((mov.beneficiaryRfc?.trim() || thirdPartyRfc).toUpperCase(), 13);
  const monto = rawAmount.toFixed(2);
  const ctaOri = truncXml(mov.accountOri?.trim() || mov.accountCode, 50);
  const bancoOri = mov.bankCodeOri?.trim() || inferSatBankCode(mov.accountName);
  const hint = `${ref} ${mov.concepto || ''} ${poliza.concepto || ''}`;

  // XSD Anexo 24 v1.3: Cheque y Transferencia solo aplican en egresos (abonos a 102-*)
  if (isEgreso) {
    const isCheque =
      Boolean(mov.chequeNum?.trim()) ||
      mov.paymentMethodSat === '02' ||
      /\b(?:CHQ|CHEQUE)\b|^CH-?\d+/i.test(hint);
    if (isCheque) {
      const rawCheque = mov.chequeNum?.trim() || (ref && !/^S\/N$/i.test(ref) ? ref : '');
      if (rawCheque && bancoOri) {
        const numCheque = truncXml(rawCheque, 20);
        return `\n    <PLZ:Cheque Num="${numCheque}" BanEmisNal="${truncXml(bancoOri, 3)}" CtaOri="${ctaOri}" Fecha="${safeFecha}" Benef="${benef}" RFC="${rfcAttr}" Monto="${monto}"${fxAttrs}/>`;
      }
      return `\n    <PLZ:OtrMetodoPago MetPagoPol="02" Fecha="${safeFecha}" Benef="${benef}" RFC="${rfcAttr}" Monto="${monto}"${fxAttrs}/>`;
    }

    const isTransfer =
      Boolean(mov.accountDest?.trim() && mov.bankCodeDest?.trim()) ||
      mov.paymentMethodSat === '03' ||
      /\b(?:SPEI|TRANSF(?:ERENCIA)?|TRF|TEF)\b/i.test(hint);
    if (isTransfer) {
      const rawCtaDest = (
        mov.accountDest ||
        cfdiInfo?.ctaDest ||
        (ref && !/^0+$/.test(ref) ? ref : '')
      ).trim();
      const rawBancoDest = (mov.bankCodeDest || cfdiInfo?.bancoDestNal || '').trim();
      if (rawCtaDest && rawBancoDest && bancoOri) {
        return `\n    <PLZ:Transferencia CtaOri="${ctaOri}" BancoOriNal="${truncXml(bancoOri, 3)}" CtaDest="${truncXml(rawCtaDest, 50)}" BancoDestNal="${truncXml(rawBancoDest, 3)}" Fecha="${safeFecha}" Benef="${benef}" RFC="${rfcAttr}" Monto="${monto}"${fxAttrs}/>`;
      }
      return `\n    <PLZ:OtrMetodoPago MetPagoPol="03" Fecha="${safeFecha}" Benef="${benef}" RFC="${rfcAttr}" Monto="${monto}"${fxAttrs}/>`;
    }
  }

  const metPago =
    mov.paymentMethodSat && /^\d{2}$/.test(mov.paymentMethodSat.trim())
      ? mov.paymentMethodSat.trim()
      : inferOtherPaymentMethodCode(hint, cfdiInfo?.formaPago);
  return `\n    <PLZ:OtrMetodoPago MetPagoPol="${metPago}" Fecha="${safeFecha}" Benef="${benef}" RFC="${rfcAttr}" Monto="${monto}"${fxAttrs}/>`;
}
