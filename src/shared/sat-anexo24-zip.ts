import { strToU8, zipSync } from 'fflate';
import type { SatAnexo24XmlResult, SatXmlType } from './sat-anexo24';
import {
  hasEmptyAnexo24Body,
  isValidSatNumOrden,
  isValidSatNumTramite,
  type SatSolicitudTipo
} from './sat-anexo24-auxiliaries';
import type { Company } from './types';

export interface BuildSatAnexo24ZipInput {
  company: Pick<Company, 'rfc'>;
  year: number;
  period: number;
  type: SatXmlType | string;
  xmlResult: SatAnexo24XmlResult;
  tipoEnvio?: 'N' | 'C';
}

export interface SatAnexo24ZipResult {
  zipFilename: string;
  xmlFilename: string;
  zipBytes: Uint8Array;
}

export interface Anexo24XsdValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const INVALID_ROOT_COD_AGRUP = new Set(['100', '200', '300', '400', '500', '600', '800']);

function resolveSatArchiveSuffix(
  type: SatXmlType | string,
  period: number,
  xmlResult: SatAnexo24XmlResult,
  tipoEnvio?: 'N' | 'C'
): { mesStr: string; suffix: 'CT' | 'PL' | 'BN' | 'BC' | 'XF' | 'XC' } {
  if (type === 'catalogo') {
    const mes = Math.max(1, Math.min(12, period));
    return { mesStr: String(mes).padStart(2, '0'), suffix: 'CT' };
  }
  if (type === 'polizas') {
    const mes = Math.max(1, Math.min(12, period));
    return { mesStr: String(mes).padStart(2, '0'), suffix: 'PL' };
  }
  if (type === 'auxiliar_folios' || type === 'xf' || /XF\.xml$/i.test(xmlResult.filename)) {
    const mes = Math.max(1, Math.min(12, period));
    return { mesStr: String(mes).padStart(2, '0'), suffix: 'XF' };
  }
  if (type === 'auxiliar_cuentas' || type === 'xc' || /XC\.xml$/i.test(xmlResult.filename)) {
    const mes = Math.max(1, Math.min(12, period));
    return { mesStr: String(mes).padStart(2, '0'), suffix: 'XC' };
  }
  const mes = Math.max(1, Math.min(13, period));
  const isComplementaria =
    tipoEnvio === 'C' || /BC\.xml$/i.test(xmlResult.filename) || xmlResult.xml.includes('TipoEnvio="C"');
  return { mesStr: String(mes).padStart(2, '0'), suffix: isComplementaria ? 'BC' : 'BN' };
}

/**
 * Empaqueta un XML Anexo 24 v1.3 en archivo .ZIP oficial SAT para Buzón Tributario.
 */
export function buildSatAnexo24Zip(input: BuildSatAnexo24ZipInput): SatAnexo24ZipResult {
  const { company, year, period, type, xmlResult, tipoEnvio } = input;
  const safeRfc = (company.rfc || '').trim().toUpperCase();
  const { mesStr, suffix } = resolveSatArchiveSuffix(type, period, xmlResult, tipoEnvio);
  const baseName = `${safeRfc}${year}${mesStr}${suffix}`;
  const zipFilename = `${baseName}.zip`;
  const xmlFilename = `${baseName}.xml`;
  const zipBytes = zipSync({ [xmlFilename]: strToU8(xmlResult.xml) }, { level: 6 });
  return { zipFilename, xmlFilename, zipBytes };
}

/** Aplica filtros de Nivel N2 y Omitir $0.00 al XML de Balanza BN/BC para previsualización y descarga. */
export function filterBalanzaXmlClientSide(
  xml: string,
  options?: { balanzaLevel?: 'ALL' | 'N2'; omitZeroAccounts?: boolean }
): string {
  if (!xml || (!options?.omitZeroAccounts && options?.balanzaLevel !== 'N2')) return xml;
  const lines = xml.split('\n');
  const filtered = lines.filter((line) => {
    if (!line.includes('<BCE:Ctas ')) return true;
    if (options?.balanzaLevel === 'N2') {
      const m = /NumCta="([^"]+)"/.exec(line);
      const numCta = m?.[1] ?? '';
      if (/^\d{3}-\d{2}-\d{3}$/.test(numCta) && !numCta.endsWith('-000')) {
        return false;
      }
    }
    if (options?.omitZeroAccounts) {
      const sIni = Number(/SaldoIni="([^"]+)"/.exec(line)?.[1] ?? '0');
      const debe = Number(/Debe="([^"]+)"/.exec(line)?.[1] ?? '0');
      const haber = Number(/Haber="([^"]+)"/.exec(line)?.[1] ?? '0');
      const sFin = Number(/SaldoFin="([^"]+)"/.exec(line)?.[1] ?? '0');
      if (Math.abs(sIni) < 0.005 && Math.abs(debe) < 0.005 && Math.abs(haber) < 0.005 && Math.abs(sFin) < 0.005) {
        return false;
      }
    }
    return true;
  });
  return filtered.join('\n');
}

/** Pre-validador XSD real de Anexo 24 v1.3 para CT, BN/BC, PL, XF y XC. */
export function validateAnexo24XmlXsd(
  satXmlType: SatXmlType | string,
  xml: string,
  options?: {
    tipoEnvio?: 'N' | 'C';
    fechaModBal?: string;
    tipoSolicitud?: SatSolicitudTipo;
    numOrden?: string;
    numTramite?: string;
  }
): Anexo24XsdValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!xml.trim()) return { isValid: false, errors: ['XML vacío.'], warnings };

  if (!xml.includes('Version="1.3"')) errors.push('Falta atributo obligatorio Version="1.3".');
  const rfcMatch = /\bRFC="([^"]*)"/.exec(xml);
  if (!rfcMatch?.[1] || !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfcMatch[1])) {
    errors.push('Atributo RFC inválido o ausente en el nodo raíz.');
  }
  const mesMatch = /\bMes="(\d{2})"/.exec(xml);
  const mes = Number(mesMatch?.[1] ?? '0');
  if (satXmlType === 'balanza') {
    if (mes < 1 || mes > 13) errors.push('Mes inválido en Balanza (permitido 01..13).');
  } else if (mes < 1 || mes > 12) {
    errors.push('Mes inválido en CT/PL/XF/XC (XSD v1.3 solo permite 01..12).');
  }

  if (hasEmptyAnexo24Body(satXmlType, xml)) {
    errors.push('Archivo XML sin nodos de detalle requeridos por el XSD SAT 1.3.');
  }

  if (satXmlType === 'catalogo') {
    const codMatches = xml.matchAll(/<catalogocuentas:Ctas[^>]*CodAgrup="([^"]+)"/g);
    for (const m of codMatches) {
      if (INVALID_ROOT_COD_AGRUP.has(m[1] ?? '')) {
        errors.push(`Código agrupador inválido "${m[1]}" en CT.xml (usa subcuentas oficiales SAT).`);
        break;
      }
    }
  }

  if (satXmlType === 'balanza') {
    const isComp = options?.tipoEnvio === 'C' || xml.includes('TipoEnvio="C"');
    const fechaModMatch = /\bFechaModBal="(\d{4}-\d{2}-\d{2})"/.exec(xml);
    if (isComp && (!fechaModMatch || (options?.fechaModBal !== undefined && !options.fechaModBal.trim()))) {
      errors.push('Envío Complementario (C) exige FechaModBal="AAAA-MM-DD".');
    }
    if (mes === 13) {
      const ctas = xml.matchAll(/<BCE:Ctas\s+NumCta="([^"]+)"[^>]*SaldoFin="([^"]+)"/g);
      const openResults: string[] = [];
      for (const m of ctas) {
        const numCta = m[1] ?? '';
        const saldoFin = Number(m[2] ?? '0');
        if (/^[4-7]\d{2}/.test(numCta) && Math.abs(saldoFin) >= 0.01) {
          openResults.push(`${numCta} ($${saldoFin.toFixed(2)})`);
        }
      }
      if (openResults.length > 0) {
        errors.push(
          `Mes 13 tiene ${openResults.length} cuenta(s) de resultados abiertas (${openResults.slice(0, 3).join(', ')}); ejecuta la Póliza de Cierre Anual.`
        );
      }
    }
  }

  if (satXmlType === 'polizas' || satXmlType === 'auxiliar_folios' || satXmlType === 'auxiliar_cuentas') {
    const solType = options?.tipoSolicitud ?? ((/\bTipoSolicitud="(AF|FC|DE|CO)"/.exec(xml)?.[1] as SatSolicitudTipo) || 'AF');
    if (solType === 'AF' || solType === 'FC') {
      const numOrden = (options?.numOrden ?? /\bNumOrden="([^"]+)"/.exec(xml)?.[1] ?? '').trim();
      if (!numOrden) errors.push(`Captura NumOrden requerido para TipoSolicitud="${solType}".`);
      else if (!isValidSatNumOrden(numOrden)) errors.push('Formato de NumOrden inválido (ej. ABC1234567/01).');
    } else {
      const numTramite = (options?.numTramite ?? /\bNumTramite="([^"]+)"/.exec(xml)?.[1] ?? '').trim();
      if (!numTramite) errors.push(`Captura NumTramite requerido para TipoSolicitud="${solType}".`);
      else if (!isValidSatNumTramite(numTramite)) errors.push('Formato de NumTramite inválido (ej. DE202600000001).');
    }
  }

  if (satXmlType === 'polizas') {
    if (/\bRFC="XAXX010101000"/.test(xml)) {
      warnings.push('Se detectó RFC genérico XAXX010101000; confirma que corresponda a público en general o asigna el RFC del tercero.');
    }
    const polMatches = xml.matchAll(/<PLZ:Poliza\s+NumUnIdenPol="([^"]+)"[\s\S]*?<\/PLZ:Poliza>/g);
    for (const pm of polMatches) {
      let debeSum = 0;
      let haberSum = 0;
      for (const tx of pm[0].matchAll(/Debe="([^"]+)"\s+Haber="([^"]+)"/g)) {
        debeSum += Number(tx[1] ?? 0);
        haberSum += Number(tx[2] ?? 0);
      }
      if (Math.abs(debeSum - haberSum) >= 0.02) {
        errors.push(`Póliza ${pm[1]} descuadrada en PL.xml (Debe ${debeSum.toFixed(2)} != Haber ${haberSum.toFixed(2)}).`);
        break;
      }
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}
