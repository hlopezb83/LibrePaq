import type { AccountWithBalance, Company, Poliza } from './types';
import { getTodayLocalIso } from './date-utils';
import {
  assertSolicitudAttrsIfStrict,
  buildAnexo24SolicitudAttrs,
  buildAuxiliarCuentasXml,
  buildAuxiliarFoliosXml,
  computeCatalogoRetainedTree,
  hasEmptyAnexo24Body,
  isLevel1StructuralRubro,
  isValidSatNumOrden,
  isValidSatNumTramite,
  truncXml
} from './sat-anexo24-auxiliaries';
import {
  buildBankPaymentNode,
  resolveMovementCounterpart,
  type Anexo24CfdiMetadata,
  type SatAnexo24Options
} from './sat-anexo24-payments';

export {
  hasEmptyAnexo24Body,
  isValidSatNumOrden,
  isValidSatNumTramite,
  type Anexo24CfdiMetadata,
  type SatAnexo24Options
};

export type SatXmlType =
  | 'balanza'
  | 'catalogo'
  | 'polizas'
  | 'auxiliar_folios'
  | 'auxiliar_cuentas';

export interface SatAnexo24XmlResult {
  filename: string;
  type: string;
  xml: string;
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
  const cleanRfc = (company.rfc || '').trim().toUpperCase();
  const safeRfc = truncXml(cleanRfc, 13);

  // 1. Catálogo de Cuentas (CT.xml — Mes permitido 01..12)
  if (type === 'catalogo') {
    const catMes = Math.max(1, Math.min(12, period));
    const catMesStr = String(catMes).padStart(2, '0');
    const ctasXml = computeCatalogoRetainedTree(trialBalance)
      .map(({ acc, nivel, subCtaDe }) => {
        const codAgrup = truncXml(acc.satGroupCode || '101.01', 15);
        const numCta = truncXml(acc.code, 100);
        const desc = truncXml(acc.name, 200);
        const subCtaAttr = subCtaDe ? `SubCtaDe="${truncXml(subCtaDe, 100)}" ` : '';
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
    const solicitudAttrs = buildAnexo24SolicitudAttrs(options);
    assertSolicitudAttrsIfStrict(solicitudAttrs, options?.strictSolicitud);
    const { tipoSolicitud, reqSolicitudAttr } = solicitudAttrs;

    const polizasXml = polizas
      .map((p) => {
        const polId = truncXml(`${p.tipo}-${p.folio}`, 50);
        const fecha = p.fecha ? p.fecha.slice(0, 10) : `${year}-${polMesStr}-01`;
        const concepto = truncXml(p.concepto || `Póliza ${p.tipo} ${p.folio}`, 300);
        const emittedPolizaUuids = new Set<string>();
        const movements = p.movements || [];
        const headerUuids = Array.from(
          new Set([...(p.cfdiUuids || []), ...(p.cfdiUuid ? [p.cfdiUuid] : [])].map((u) => u.trim().toUpperCase()).filter(Boolean))
        );
        const movExplicitSet = new Set(
          movements.map((mv) => mv.cfdiUuid?.trim().toUpperCase() || '').filter(Boolean)
        );
        const unassignedHeaderUuids = headerUuids.filter((u) => !movExplicitSet.has(u));
        const firstUnlinkedIdx = movements.findIndex((mv) => !mv.cfdiUuid?.trim());
        const attachHeaderIdx = firstUnlinkedIdx >= 0 ? firstUnlinkedIdx : 0;

        const transaccionesXml = movements
          .map((m, idx) => {
            const numCta = truncXml(m.accountCode, 100);
            const desCta = truncXml(m.accountName, 200);
            const movConcepto = truncXml(m.concepto || p.concepto || 'Movimiento contable', 300);
            const fmtVal = (n: number) => (Number.isFinite(n) && n !== 0 ? n : 0).toFixed(2);
            const debe = fmtVal(m.cargo || 0);
            const haber = fmtVal(m.abono || 0);

            const uuidsForMov = [
              ...(m.cfdiUuid?.trim() ? [m.cfdiUuid.trim().toUpperCase()] : []),
              ...(idx === attachHeaderIdx ? unassignedHeaderUuids : [])
            ];

            let compNodes = '';
            for (const candUuid of uuidsForMov) {
              if (!candUuid || emittedPolizaUuids.has(candUuid)) continue;
              emittedPolizaUuids.add(candUuid);
              const resolved = resolveMovementCounterpart(cleanRfc, p, m, options, candUuid);
              const montoReal =
                resolved.cfdiInfo?.total && resolved.cfdiInfo.total > 0
                  ? resolved.cfdiInfo.total
                  : m.cfdiTotal && m.cfdiTotal > 0
                    ? m.cfdiTotal
                    : m.cargo > 0
                      ? m.cargo
                      : m.abono;
              const monto = montoReal.toFixed(2);
              if (UUID_V4_LIKE_REGEX.test(candUuid)) {
                compNodes += `\n    <PLZ:CompNal UUID_CFDI="${truncXml(candUuid, 36)}" RFC="${resolved.thirdPartyRfc}" MontoTotal="${monto}"${resolved.fxAttrs}/>`;
              } else {
                compNodes += `\n    <PLZ:CompExt NumFactExt="${truncXml(candUuid, 36)}" TaxID="${resolved.thirdPartyRfc}" MontoTotal="${monto}"${resolved.fxAttrs}/>`;
              }
            }

            const primaryCounterpart = resolveMovementCounterpart(cleanRfc, p, m, options);
            const paymentNode = buildBankPaymentNode(
              fecha,
              p,
              m,
              primaryCounterpart.thirdPartyRfc,
              primaryCounterpart.fxAttrs,
              primaryCounterpart.cfdiInfo
            );

            return `  <PLZ:Transaccion NumCta="${numCta}" DesCta="${desCta}" Concepto="${movConcepto}" Debe="${debe}" Haber="${haber}">${compNodes}${paymentNode}\n  </PLZ:Transaccion>`;
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
    .filter((acc) => !isLevel1StructuralRubro(acc))
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
