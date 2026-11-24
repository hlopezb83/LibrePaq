import type { AccountWithBalance, Company, Poliza, PolizaMovement } from './types';
import { getTodayLocalIso } from './date-utils';
import {
  buildAnexo24SolicitudAttrs,
  buildAuxiliarCuentasXml,
  buildAuxiliarFoliosXml,
  hasEmptyAnexo24Body,
  isLevel1StructuralRubro,
  isValidSatNumOrden,
  isValidSatNumTramite,
  truncXml,
  type SatSolicitudTipo
} from './sat-anexo24-auxiliaries';

export { hasEmptyAnexo24Body, isValidSatNumOrden, isValidSatNumTramite };

export type SatXmlType =
  | 'balanza'
  | 'catalogo'
  | 'polizas'
  | 'auxiliar_folios'
  | 'auxiliar_cuentas';

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
  counterpartRfc?: string;
  tipoSolicitud?: SatSolicitudTipo;
  numOrden?: string;
  numTramite?: string;
  cfdiLookup?: ReadonlyMap<string, Anexo24CfdiMetadata>;
}

export interface SatAnexo24XmlResult {
  filename: string;
  type: string;
  xml: string;
}

const UUID_V4_LIKE_REGEX = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
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
  [/banbajio|baj[ií]o/i, '030']
];

function inferBankCode(accountName: string | null | undefined): string {
  const name = accountName || '';
  for (const [pattern, code] of BANK_CODE_PATTERNS) {
    if (pattern.test(name)) return code;
  }
  return '999';
}

function resolveMovementCounterpart(
  companyRfc: string,
  poliza: Poliza,
  mov: PolizaMovement,
  options?: SatAnexo24Options
) {
  const rawUuid = (mov.cfdiUuid || poliza.cfdiUuid || '').trim();
  const upperUuid = rawUuid.toUpperCase();
  const cfdiInfo = upperUuid ? options?.cfdiLookup?.get(upperUuid) : undefined;
  const extractedRfc =
    mov.concepto?.match(RFC_EXTRACT_REGEX)?.[0] ||
    poliza.concepto?.match(RFC_EXTRACT_REGEX)?.[0];
  const rawRfc = (
    cfdiInfo?.rfcContraparte ||
    mov.rfcContraparte ||
    options?.counterpartRfc ||
    extractedRfc ||
    'XAXX010101000'
  ).toUpperCase();
  const thirdPartyRfc =
    rawRfc === companyRfc.toUpperCase() ? 'XAXX010101000' : truncXml(rawRfc, 13);

  const monedaRaw = (cfdiInfo?.moneda || mov.cfdiMoneda || 'MXN').toUpperCase();
  const tcVal = cfdiInfo?.tipoCambio || mov.cfdiTipoCambio || 1;
  const fxAttrs =
    monedaRaw !== 'MXN' && monedaRaw !== 'XXX'
      ? ` Moneda="${truncXml(monedaRaw, 3)}" TipCamb="${tcVal.toFixed(4)}"`
      : '';

  return { rawUuid, upperUuid, cfdiInfo, thirdPartyRfc, monedaRaw, tcVal, fxAttrs };
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

function buildBankPaymentNode(
  fecha: string,
  poliza: Poliza,
  mov: PolizaMovement,
  thirdPartyRfc: string,
  fxAttrs: string,
  cfdiInfo?: Anexo24CfdiMetadata
): string {
  const isBankAccount = (mov.accountCode || '').trim().startsWith('102');
  const ref = (mov.referencia || '').trim();
  const rawAmount = mov.cargo > 0 ? mov.cargo : mov.abono;
  if (!isBankAccount || (!ref && rawAmount <= 0)) return '';

  const safeFecha = truncXml(fecha, 10);
  const benef = truncXml(mov.concepto || poliza.concepto || mov.accountName || 'Contraparte', 300);
  const monto = (Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0).toFixed(2);
  const ctaOri = truncXml(mov.accountCode, 50);
  const bancoOri = inferBankCode(mov.accountName);
  const hint = `${ref} ${mov.concepto || ''} ${poliza.concepto || ''}`;

  if (/\b(?:CHQ|CHEQUE)\b|^CH-?\d+/i.test(hint)) {
    if (ref && !/^S\/N$/i.test(ref)) {
      const numCheque = truncXml(ref, 20);
      return `\n    <PLZ:Cheque Num="${numCheque}" BanEmisNal="${bancoOri}" CtaOri="${ctaOri}" Fecha="${safeFecha}" Benef="${benef}" RFC="${thirdPartyRfc}" Monto="${monto}"${fxAttrs}/>`;
    }
    return `\n    <PLZ:OtrMetodoPago MetPagoPol="02" Fecha="${safeFecha}" Benef="${benef}" RFC="${thirdPartyRfc}" Monto="${monto}"${fxAttrs}/>`;
  }

  if (/\b(?:SPEI|TRANSF(?:ERENCIA)?|TRF|TEF)\b/i.test(hint)) {
    const rawCtaDest = (cfdiInfo?.ctaDest || (ref && !/^0+$/.test(ref) ? ref : '')).trim();
    const rawBancoDest = (cfdiInfo?.bancoDestNal || '').trim();
    if (rawCtaDest && rawBancoDest) {
      return `\n    <PLZ:Transferencia CtaOri="${ctaOri}" BancoOriNal="${bancoOri}" CtaDest="${truncXml(rawCtaDest, 50)}" BancoDestNal="${truncXml(rawBancoDest, 3)}" Fecha="${safeFecha}" Benef="${benef}" RFC="${thirdPartyRfc}" Monto="${monto}"${fxAttrs}/>`;
    }
    return `\n    <PLZ:OtrMetodoPago MetPagoPol="03" Fecha="${safeFecha}" Benef="${benef}" RFC="${thirdPartyRfc}" Monto="${monto}"${fxAttrs}/>`;
  }

  const metPago = inferOtherPaymentMethodCode(hint, cfdiInfo?.formaPago);
  return `\n    <PLZ:OtrMetodoPago MetPagoPol="${metPago}" Fecha="${safeFecha}" Benef="${benef}" RFC="${thirdPartyRfc}" Monto="${monto}"${fxAttrs}/>`;
}

/**
 * Generador Oficial de Archivos XML de Contabilidad Electrónica SAT (Anexo 24 v1.3).
 * Cumple con los esquemas XSD oficiales v1.3 del SAT (sin el atributo obsoleto TotalCtas):
 * - CatalogoCuentas_1_3.xsd (CT.xml)
 * - BalanzaComprobacion_1_3.xsd (BN.xml / BC.xml)
 * - PolizasPeriodo_1_3.xsd (PL.xml)
 */
export function buildSatAnexo24Xml(
  company: Company,
  year: number,
  period: number,
  type: SatXmlType | string,
  trialBalance: readonly AccountWithBalance[],
  polizas: readonly Poliza[] = [],
  options?: SatAnexo24Options
): SatAnexo24XmlResult {
  const safePeriodBal = Math.max(1, Math.min(13, period));
  const mesBalStr = String(safePeriodBal).padStart(2, '0');
  const cleanRfc = (company.rfc || '').trim().toUpperCase();
  const safeRfc = truncXml(cleanRfc, 13);

  // 1. Catálogo de Cuentas (CT.xml — Mes permitido 01..12)
  if (type === 'catalogo') {
    const catMes = Math.max(1, Math.min(12, period));
    const catMesStr = String(catMes).padStart(2, '0');
    const excludedParentCodes = new Set(
      trialBalance.filter((acc) => isLevel1StructuralRubro(acc)).map((acc) => acc.code)
    );
    const ctasXml = trialBalance
      .filter((acc) => !isLevel1StructuralRubro(acc))
      .map((acc) => {
        const codAgrup = truncXml(acc.satGroupCode || '101.01', 15);
        const numCta = truncXml(acc.code, 100);
        const desc = truncXml(acc.name, 200);
        const parentExcluded = Boolean(acc.parentCode && excludedParentCodes.has(acc.parentCode));
        const subCtaAttr =
          acc.parentCode && !parentExcluded
            ? `SubCtaDe="${truncXml(acc.parentCode, 100)}" `
            : '';
        const nivel = parentExcluded
          ? Math.max(1, (acc.level || 1) - 1)
          : acc.level || 1;
        const natur = acc.nature === 'DEUDORA' ? 'D' : 'A';
        return `  <catalogocuentas:Ctas CodAgrup="${codAgrup}" NumCta="${numCta}" Desc="${desc}" ${subCtaAttr}Nivel="${nivel}" Natur="${natur}"/>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<catalogocuentas:Catalogo xmlns:catalogocuentas="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/CatalogoCuentas" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/CatalogoCuentas http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/CatalogoCuentas/CatalogoCuentas_1_3.xsd" Version="1.3" RFC="${safeRfc}" Mes="${catMesStr}" Anio="${year}">
${ctasXml}
</catalogocuentas:Catalogo>`;

    return {
      filename: `${cleanRfc}${year}${catMesStr}CT.xml`,
      type: 'Catálogo de Cuentas Anexo 24 (1.3)',
      xml
    };
  }

  // 2. Auxiliar de Folios (XF.xml) y Auxiliar de Cuentas (XC.xml)
  if (type === 'auxiliar_folios' || type === 'xf') {
    return buildAuxiliarFoliosXml(company, year, period, polizas, options);
  }
  if (type === 'auxiliar_cuentas' || type === 'xc') {
    return buildAuxiliarCuentasXml(company, year, period, trialBalance, polizas, options);
  }

  // 3. Pólizas del Periodo (PL.xml — Mes permitido 01..12 en XSD v1.3)
  if (type === 'polizas') {
    const polMes = Math.max(1, Math.min(12, period));
    const polMesStr = String(polMes).padStart(2, '0');
    const { tipoSolicitud, reqSolicitudAttr } = buildAnexo24SolicitudAttrs(options);

    const polizasXml = polizas
      .map((p) => {
        const polId = truncXml(`${p.tipo}-${p.folio}`, 50);
        const fecha = p.fecha ? p.fecha.slice(0, 10) : `${year}-${polMesStr}-01`;
        const concepto = truncXml(p.concepto || `Póliza ${p.tipo} ${p.folio}`, 300);
        const emittedPolizaUuids = new Set<string>();

        const transaccionesXml = (p.movements || [])
          .map((m) => {
            const numCta = truncXml(m.accountCode, 100);
            const desCta = truncXml(m.accountName, 200);
            const movConcepto = truncXml(m.concepto || p.concepto || 'Movimiento contable', 300);
            const fmtVal = (n: number) => {
              const safe = Number.isFinite(n) && n !== 0 ? n : 0;
              return safe.toFixed(2);
            };
            const debe = fmtVal(m.cargo || 0);
            const haber = fmtVal(m.abono || 0);

            const {
              rawUuid,
              upperUuid,
              cfdiInfo,
              thirdPartyRfc,
              monedaRaw,
              tcVal,
              fxAttrs
            } = resolveMovementCounterpart(cleanRfc, p, m, options);

            let compNode = '';
            if (rawUuid && !emittedPolizaUuids.has(upperUuid)) {
              emittedPolizaUuids.add(upperUuid);
              const montoReal =
                cfdiInfo?.total && cfdiInfo.total > 0
                  ? cfdiInfo.total
                  : m.cfdiTotal && m.cfdiTotal > 0
                    ? m.cfdiTotal
                    : m.cargo > 0
                      ? m.cargo
                      : m.abono;
              const monto = montoReal.toFixed(2);

              if (UUID_V4_LIKE_REGEX.test(upperUuid)) {
                compNode = `\n    <PLZ:CompNal UUID_CFDI="${truncXml(upperUuid, 36)}" RFC="${thirdPartyRfc}" MontoTotal="${monto}"${fxAttrs}/>`;
              } else {
                const extMoneda =
                  monedaRaw !== 'MXN' && monedaRaw !== 'XXX' ? truncXml(monedaRaw, 3) : 'USD';
                compNode = `\n    <PLZ:CompExt NumFactExt="${truncXml(rawUuid, 36)}" TaxID="${thirdPartyRfc}" MontoTotal="${monto}" Moneda="${extMoneda}" TipCamb="${tcVal.toFixed(4)}"/>`;
              }
            }

            const paymentNode = buildBankPaymentNode(fecha, p, m, thirdPartyRfc, fxAttrs, cfdiInfo);

            return `  <PLZ:Transaccion NumCta="${numCta}" DesCta="${desCta}" Concepto="${movConcepto}" Debe="${debe}" Haber="${haber}">${compNode}${paymentNode}\n  </PLZ:Transaccion>`;
          })
          .join('\n');

        return `  <PLZ:Poliza NumUnIdenPol="${polId}" Fecha="${fecha}" Concepto="${concepto}">\n${transaccionesXml}\n  </PLZ:Poliza>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PLZ:Polizas xmlns:PLZ="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/PolizasPeriodo" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/PolizasPeriodo http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/PolizasPeriodo/PolizasPeriodo_1_3.xsd" Version="1.3" RFC="${safeRfc}" Mes="${polMesStr}" Anio="${year}" TipoSolicitud="${tipoSolicitud}"${reqSolicitudAttr}>
${polizasXml}
</PLZ:Polizas>`;

    return {
      filename: `${cleanRfc}${year}${polMesStr}PL.xml`,
      type: 'Pólizas del Periodo Anexo 24 (1.3)',
      xml
    };
  }

  // 3. Balanza de Comprobación (BN.xml / BC.xml — Mes permitido 01..13)
  const tipoEnvio = options?.tipoEnvio || 'N';
  const fechaModBalAttr =
    tipoEnvio === 'C'
      ? ` FechaModBal="${truncXml(options?.fechaModBal || getTodayLocalIso(), 10)}"`
      : '';
  const fileSuffix = `B${tipoEnvio}.xml`;

  const balanzaCtasXml = trialBalance
    .map((acc) => {
      const numCta = truncXml(acc.code, 100);
      const fmtVal = (n: number) => {
        const safe = Number.isFinite(n) && n !== 0 ? n : 0;
        return safe.toFixed(2);
      };
      const saldoIni = fmtVal(acc.initialBalanceComputed || 0);
      const debe = fmtVal(acc.periodCharges || 0);
      const haber = fmtVal(acc.periodCredits || 0);
      const saldoFin = fmtVal(acc.finalBalance || 0);
      return `  <BCE:Ctas NumCta="${numCta}" SaldoIni="${saldoIni}" Debe="${debe}" Haber="${haber}" SaldoFin="${saldoFin}"/>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<BCE:Balanza xmlns:BCE="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/BalanzaComprobacion" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/BalanzaComprobacion http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/BalanzaComprobacion/BalanzaComprobacion_1_3.xsd" Version="1.3" RFC="${safeRfc}" Mes="${mesBalStr}" Anio="${year}" TipoEnvio="${tipoEnvio}"${fechaModBalAttr}>
${balanzaCtasXml}
</BCE:Balanza>`;

  return {
    filename: `${cleanRfc}${year}${mesBalStr}${fileSuffix}`,
    type: 'Balanza de Comprobación Anexo 24 (1.3)',
    xml
  };
}
