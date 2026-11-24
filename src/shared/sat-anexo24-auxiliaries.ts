import { escapeXmlAttr } from './cfdi-xml';
import type { AccountWithBalance, Company, Poliza } from './types';

export type SatSolicitudTipo = 'AF' | 'FC' | 'DE' | 'CO';

export interface Anexo24AuxCfdiMeta {
  total: number;
  rfcContraparte: string;
  moneda?: string;
  tipoCambio?: number;
  formaPago?: string;
}

export interface Anexo24AuxOptions {
  tipoSolicitud?: SatSolicitudTipo;
  numOrden?: string;
  numTramite?: string;
  counterpartRfc?: string;
  cfdiLookup?: ReadonlyMap<string, Anexo24AuxCfdiMeta>;
}

export const SAT_NUM_ORDEN_REGEX = /^[A-Z]{3}[0-6]\d{6}\/\d{2}$/;
export const SAT_NUM_TRAMITE_REGEX = /^[A-Z]{2}\d{12}$/;

export function isLevel1StructuralRubro(acc: Pick<AccountWithBalance, 'isAffectable' | 'code' | 'satGroupCode' | 'level'>): boolean {
  if (acc.isAffectable) return false;
  const code = (acc.code || '').trim();
  const satCode = (acc.satGroupCode || '').trim();
  return (
    /^[1-6]00-00-000$/.test(code) ||
    /^[1-6]00$/.test(satCode) ||
    (acc.level === 1 && /^[1-6]00/.test(code))
  );
}

export function hasEmptyAnexo24Body(
  satXmlType: 'balanza' | 'catalogo' | 'polizas' | 'auxiliar_folios' | 'auxiliar_cuentas' | string,
  xml: string
): boolean {
  if (!xml) return true;
  switch (satXmlType) {
    case 'catalogo':
      return !/<catalogocuentas:Ctas\b/.test(xml);
    case 'balanza':
      return !/<BCE:Ctas\b/.test(xml);
    case 'polizas':
      return !/<PLZ:Poliza\b/.test(xml);
    case 'auxiliar_folios':
    case 'xf':
      return !/<RepAux:DetAuxFol\b/.test(xml);
    case 'auxiliar_cuentas':
    case 'xc':
      return !/<AuxiliarCtas:Cuenta\b/.test(xml);
    default:
      return false;
  }
}

export function isValidSatNumOrden(value: string): boolean {
  return SAT_NUM_ORDEN_REGEX.test(value.trim().toUpperCase());
}

export function isValidSatNumTramite(value: string): boolean {
  return SAT_NUM_TRAMITE_REGEX.test(value.trim().toUpperCase());
}

export function truncXml(value: string | null | undefined, maxChars: number): string {
  const clean = (value ?? '').trim();
  const sliced = clean.length > maxChars ? clean.slice(0, maxChars) : clean;
  return escapeXmlAttr(sliced);
}

/** Construye los atributos TipoSolicitud + NumOrden / NumTramite exigidos por el XSD v1.3 (sin inyectar valores ficticios). */
export function buildAnexo24SolicitudAttrs(options?: {
  tipoSolicitud?: SatSolicitudTipo;
  numOrden?: string;
  numTramite?: string;
}): { tipoSolicitud: SatSolicitudTipo; reqSolicitudAttr: string; missingRequiredAttr: boolean } {
  const tipoSolicitud: SatSolicitudTipo = options?.tipoSolicitud || 'AF';
  if (tipoSolicitud === 'AF' || tipoSolicitud === 'FC') {
    const captured = options?.numOrden?.trim().toUpperCase();
    if (!captured) {
      return { tipoSolicitud, reqSolicitudAttr: '', missingRequiredAttr: true };
    }
    const numOrden = truncXml(captured, 13);
    return { tipoSolicitud, reqSolicitudAttr: ` NumOrden="${numOrden}"`, missingRequiredAttr: false };
  }
  const captured = options?.numTramite?.trim().toUpperCase();
  if (!captured) {
    return { tipoSolicitud, reqSolicitudAttr: '', missingRequiredAttr: true };
  }
  const numTramite = truncXml(captured, 14);
  return { tipoSolicitud, reqSolicitudAttr: ` NumTramite="${numTramite}"`, missingRequiredAttr: false };
}

const UUID_V4_LIKE_REGEX = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
const RFC_EXTRACT_REGEX = /[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/i;

/**
 * Generador XSD v1.3 para Auxiliar de Folios de Comprobantes (XF.xml):
 * AuxiliarFolios_1_3.xsd
 */
export function buildAuxiliarFoliosXml(
  company: Company,
  year: number,
  period: number,
  polizas: readonly Poliza[],
  options?: Anexo24AuxOptions
): { filename: string; type: string; xml: string } {
  const mes = Math.max(1, Math.min(12, period));
  const mesStr = String(mes).padStart(2, '0');
  const cleanRfc = (company.rfc || '').trim().toUpperCase();
  const safeRfc = truncXml(cleanRfc, 13);
  const { tipoSolicitud, reqSolicitudAttr } = buildAnexo24SolicitudAttrs(options);

  const detNodes: string[] = [];
  for (const p of polizas) {
    const polId = truncXml(`${p.tipo}-${p.folio}`, 50);
    const fecha = p.fecha ? p.fecha.slice(0, 10) : `${year}-${mesStr}-01`;
    const compNodes: string[] = [];
    const seenUuids = new Set<string>();

    const movements = p.movements || [];
    for (const m of movements) {
      const rawUuid = (m.cfdiUuid || p.cfdiUuid || '').trim();
      const upperUuid = rawUuid.toUpperCase();
      if (!upperUuid || seenUuids.has(upperUuid)) continue;
      seenUuids.add(upperUuid);

      const cfdiInfo = options?.cfdiLookup?.get(upperUuid);
      const extractedRfc =
        m.concepto?.match(RFC_EXTRACT_REGEX)?.[0] ||
        p.concepto?.match(RFC_EXTRACT_REGEX)?.[0];
      const rawRfc = (
        cfdiInfo?.rfcContraparte ||
        m.rfcContraparte ||
        options?.counterpartRfc ||
        extractedRfc ||
        'XAXX010101000'
      ).toUpperCase();
      const thirdPartyRfc =
        rawRfc === company.rfc.toUpperCase() ? 'XAXX010101000' : truncXml(rawRfc, 13);
      const monedaRaw = (cfdiInfo?.moneda || m.cfdiMoneda || 'MXN').toUpperCase();
      const tcVal = cfdiInfo?.tipoCambio || m.cfdiTipoCambio || 1;
      const fxAttrs =
        monedaRaw !== 'MXN' && monedaRaw !== 'XXX'
          ? ` Moneda="${truncXml(monedaRaw, 3)}" TipCamb="${tcVal.toFixed(4)}"`
          : '';
      const montoReal =
        cfdiInfo?.total && cfdiInfo.total > 0
          ? cfdiInfo.total
          : m.cfdiTotal && m.cfdiTotal > 0
            ? m.cfdiTotal
            : m.cargo > 0
              ? m.cargo
              : m.abono;
      const monto = (Number.isFinite(montoReal) ? montoReal : 0).toFixed(2);

      if (UUID_V4_LIKE_REGEX.test(upperUuid)) {
        const realFormaPago = (cfdiInfo?.formaPago || '').trim();
        const metPagoAttr = realFormaPago ? ` MetPagoAux="${truncXml(realFormaPago, 2)}"` : '';
        compNodes.push(
          `    <RepAux:ComprNal UUID_CFDI="${truncXml(upperUuid, 36)}" MontoTotal="${monto}" RFC="${thirdPartyRfc}"${metPagoAttr}${fxAttrs}/>`
        );
      } else {
        const extMoneda = monedaRaw !== 'MXN' && monedaRaw !== 'XXX' ? truncXml(monedaRaw, 3) : 'USD';
        compNodes.push(
          `    <RepAux:ComprExt NumFactExt="${truncXml(rawUuid, 36)}" TaxID="${thirdPartyRfc}" MontoTotal="${monto}" Moneda="${extMoneda}" TipCamb="${tcVal.toFixed(4)}"/>`
        );
      }
    }

    if (compNodes.length > 0) {
      detNodes.push(
        `  <RepAux:DetAuxFol NumUnIdenPol="${polId}" Fecha="${fecha}">\n${compNodes.join('\n')}\n  </RepAux:DetAuxFol>`
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<RepAux:RepAuxFol xmlns:RepAux="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/AuxiliarFolios" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/AuxiliarFolios http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/AuxiliarFolios/AuxiliarFolios_1_3.xsd" Version="1.3" RFC="${safeRfc}" Mes="${mesStr}" Anio="${year}" TipoSolicitud="${tipoSolicitud}"${reqSolicitudAttr}>
${detNodes.join('\n')}
</RepAux:RepAuxFol>`;

  return {
    filename: `${cleanRfc}${year}${mesStr}XF.xml`,
    type: 'Auxiliar de Folios Anexo 24 (1.3)',
    xml
  };
}

/**
 * Generador XSD v1.3 para Auxiliar de Cuentas y Subcuentas (XC.xml):
 * AuxiliarCtas_1_3.xsd
 */
export function buildAuxiliarCuentasXml(
  company: Company,
  year: number,
  period: number,
  trialBalance: readonly AccountWithBalance[],
  polizas: readonly Poliza[],
  options?: Anexo24AuxOptions
): { filename: string; type: string; xml: string } {
  const mes = Math.max(1, Math.min(12, period));
  const mesStr = String(mes).padStart(2, '0');
  const cleanRfc = (company.rfc || '').trim().toUpperCase();
  const safeRfc = truncXml(cleanRfc, 13);
  const { tipoSolicitud, reqSolicitudAttr } = buildAnexo24SolicitudAttrs(options);

  const movsByAccount = new Map<
    string,
    Array<{ fecha: string; polId: string; concepto: string; debe: string; haber: string }>
  >();

  for (const p of polizas) {
    const polId = truncXml(`${p.tipo}-${p.folio}`, 50);
    const fecha = p.fecha ? p.fecha.slice(0, 10) : `${year}-${mesStr}-01`;
    for (const m of p.movements || []) {
      const code = (m.accountCode || '').trim();
      if (!code) continue;
      const list = movsByAccount.get(code) ?? [];
      list.push({
        fecha,
        polId,
        concepto: truncXml(m.concepto || p.concepto || 'Movimiento contable', 300),
        debe: (Number.isFinite(m.cargo) ? m.cargo : 0).toFixed(2),
        haber: (Number.isFinite(m.abono) ? m.abono : 0).toFixed(2)
      });
      movsByAccount.set(code, list);
    }
  }

  const cuentasXml = trialBalance
    .filter((acc) => acc.isAffectable && (movsByAccount.get(acc.code)?.length ?? 0) > 0)
    .map((acc) => {
      const numCta = truncXml(acc.code, 100);
      const desCta = truncXml(acc.name, 200);
      const saldoIni = (Number.isFinite(acc.initialBalanceComputed) ? acc.initialBalanceComputed : 0).toFixed(2);
      const saldoFin = (Number.isFinite(acc.finalBalance) ? acc.finalBalance : 0).toFixed(2);
      const detalles = (movsByAccount.get(acc.code) ?? [])
        .map(
          (d) =>
            `    <AuxiliarCtas:DetalleAux Fecha="${d.fecha}" NumUnIdenPol="${d.polId}" Concepto="${d.concepto}" Debe="${d.debe}" Haber="${d.haber}"/>`
        )
        .join('\n');
      return `  <AuxiliarCtas:Cuenta NumCta="${numCta}" DesCta="${desCta}" SaldoIni="${saldoIni}" SaldoFin="${saldoFin}">\n${detalles}\n  </AuxiliarCtas:Cuenta>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AuxiliarCtas:AuxiliarCtas xmlns:AuxiliarCtas="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/AuxiliarCtas" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/AuxiliarCtas http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/AuxiliarCtas/AuxiliarCtas_1_3.xsd" Version="1.3" RFC="${safeRfc}" Mes="${mesStr}" Anio="${year}" TipoSolicitud="${tipoSolicitud}"${reqSolicitudAttr}>
${cuentasXml}
</AuxiliarCtas:AuxiliarCtas>`;

  return {
    filename: `${cleanRfc}${year}${mesStr}XC.xml`,
    type: 'Auxiliar de Cuentas Anexo 24 (1.3)',
    xml
  };
}
