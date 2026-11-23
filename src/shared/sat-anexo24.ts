import type { AccountWithBalance, Company, Poliza } from './types';
import { escapeXmlAttr } from './cfdi-xml';
import { getTodayLocalIso } from './date-utils';

export type SatXmlType = 'balanza' | 'catalogo' | 'polizas';

export interface Anexo24CfdiMetadata {
  total: number;
  rfcContraparte: string;
  moneda?: string;
  tipoCambio?: number;
}

export interface SatAnexo24Options {
  tipoEnvio?: 'N' | 'C';
  fechaModBal?: string;
  counterpartRfc?: string;
  tipoSolicitud?: 'AF' | 'FC' | 'DE' | 'CO';
  numOrden?: string;
  numTramite?: string;
  cfdiLookup?: ReadonlyMap<string, Anexo24CfdiMetadata>;
}

export interface SatAnexo24XmlResult {
  filename: string;
  type: string;
  xml: string;
}

function truncXml(value: string | null | undefined, maxChars: number): string {
  const clean = (value ?? '').trim();
  const sliced = clean.length > maxChars ? clean.slice(0, maxChars) : clean;
  return escapeXmlAttr(sliced);
}

const UUID_V4_LIKE_REGEX = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

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
  const safeRfc = truncXml(company.rfc.toUpperCase(), 13);

  // 1. Catálogo de Cuentas (CT.xml — Mes permitido 01..12)
  if (type === 'catalogo') {
    const catMes = Math.max(1, Math.min(12, period));
    const catMesStr = String(catMes).padStart(2, '0');
    const ctasXml = trialBalance
      .map((acc) => {
        const codAgrup = truncXml(acc.satGroupCode || '101.01', 15);
        const numCta = truncXml(acc.code, 100);
        const desc = truncXml(acc.name, 200);
        const subCtaAttr = acc.parentCode ? `SubCtaDe="${truncXml(acc.parentCode, 100)}" ` : '';
        const nivel = acc.level || 1;
        const natur = acc.nature === 'DEUDORA' ? 'D' : 'A';
        return `  <catalogocuentas:Ctas CodAgrup="${codAgrup}" NumCta="${numCta}" Desc="${desc}" ${subCtaAttr}Nivel="${nivel}" Natur="${natur}"/>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<catalogocuentas:Catalogo xmlns:catalogocuentas="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/CatalogoCuentas" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/CatalogoCuentas http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/CatalogoCuentas/CatalogoCuentas_1_3.xsd" Version="1.3" RFC="${safeRfc}" Mes="${catMesStr}" Anio="${year}">
${ctasXml}
</catalogocuentas:Catalogo>`;

    return {
      filename: `${company.rfc}${year}${catMesStr}CT.xml`,
      type: 'Catálogo de Cuentas Anexo 24 (1.3)',
      xml
    };
  }

  // 2. Pólizas del Periodo (PL.xml — Mes permitido 01..12 en XSD v1.3)
  if (type === 'polizas') {
    const polMes = Math.max(1, Math.min(12, period));
    const polMesStr = String(polMes).padStart(2, '0');
    const tipoSolicitud = options?.tipoSolicitud || 'AF';
    let reqSolicitudAttr = '';
    if (tipoSolicitud === 'AF' || tipoSolicitud === 'FC') {
      const numOrden = truncXml(options?.numOrden || 'ABC1234567/01', 13);
      reqSolicitudAttr = ` NumOrden="${numOrden}"`;
    } else if (tipoSolicitud === 'DE' || tipoSolicitud === 'CO') {
      const numTramite = truncXml(options?.numTramite || 'DE000000000001', 14);
      reqSolicitudAttr = ` NumTramite="${numTramite}"`;
    }

    const polizasXml = polizas
      .map((p) => {
        const polId = truncXml(`${p.tipo}-${p.folio}`, 50);
        const fecha = p.fecha ? p.fecha.slice(0, 10) : `${year}-${polMesStr}-01`;
        const concepto = truncXml(p.concepto || `Póliza ${p.tipo} ${p.folio}`, 300);

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

            let compNode = '';
            const rawUuid = (m.cfdiUuid || p.cfdiUuid || '').trim();
            if (rawUuid) {
              const upperUuid = rawUuid.toUpperCase();
              const cfdiInfo = options?.cfdiLookup?.get(upperUuid);
              const rfcRegex = /[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/i;
              const extractedRfc =
                m.concepto?.match(rfcRegex)?.[0] || p.concepto?.match(rfcRegex)?.[0];
              const rawRfc = (
                cfdiInfo?.rfcContraparte ||
                m.rfcContraparte ||
                options?.counterpartRfc ||
                extractedRfc ||
                'XAXX010101000'
              ).toUpperCase();
              const thirdPartyRfc =
                rawRfc === company.rfc.toUpperCase() ? 'XAXX010101000' : truncXml(rawRfc, 13);

              const montoReal =
                cfdiInfo?.total && cfdiInfo.total > 0
                  ? cfdiInfo.total
                  : m.cfdiTotal && m.cfdiTotal > 0
                    ? m.cfdiTotal
                    : m.cargo > 0
                      ? m.cargo
                      : m.abono;
              const monto = montoReal.toFixed(2);

              const monedaRaw = (cfdiInfo?.moneda || m.cfdiMoneda || 'MXN').toUpperCase();
              const tcVal = cfdiInfo?.tipoCambio || m.cfdiTipoCambio || 1;
              const fxAttrs =
                monedaRaw !== 'MXN' && monedaRaw !== 'XXX'
                  ? ` Moneda="${truncXml(monedaRaw, 3)}" TipCamb="${tcVal.toFixed(4)}"`
                  : '';

              if (UUID_V4_LIKE_REGEX.test(upperUuid)) {
                compNode = `\n    <PLZ:CompNal UUID_CFDI="${truncXml(upperUuid, 36)}" RFC="${thirdPartyRfc}" MontoTotal="${monto}"${fxAttrs}/>`;
              } else {
                const extMoneda =
                  monedaRaw !== 'MXN' && monedaRaw !== 'XXX' ? truncXml(monedaRaw, 3) : 'USD';
                compNode = `\n    <PLZ:CompExt NumFactExt="${truncXml(rawUuid, 36)}" TaxID="${thirdPartyRfc}" MontoTotal="${monto}" Moneda="${extMoneda}" TipCamb="${tcVal.toFixed(4)}"/>`;
              }
            }

            return `  <PLZ:Transaccion NumCta="${numCta}" DesCta="${desCta}" Concepto="${movConcepto}" Debe="${debe}" Haber="${haber}">${compNode}\n  </PLZ:Transaccion>`;
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
      filename: `${company.rfc}${year}${polMesStr}PL.xml`,
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
    filename: `${company.rfc}${year}${mesBalStr}${fileSuffix}`,
    type: 'Balanza de Comprobación Anexo 24 (1.3)',
    xml
  };
}
