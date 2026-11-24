import { strToU8, zipSync } from 'fflate';
import type { SatAnexo24XmlResult, SatXmlType } from './sat-anexo24';
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
    tipoEnvio === 'C' ||
    /BC\.xml$/i.test(xmlResult.filename) ||
    xmlResult.xml.includes('TipoEnvio="C"');
  return {
    mesStr: String(mes).padStart(2, '0'),
    suffix: isComplementaria ? 'BC' : 'BN'
  };
}

/**
 * Empaqueta un XML Anexo 24 v1.3 en archivo .ZIP oficial SAT para Buzón Tributario
 * siguiendo la nomenclatura estricta [RFC][AAAA][MM][CT|BN|BC|PL|XF|XC].zip.
 */
export function buildSatAnexo24Zip(input: BuildSatAnexo24ZipInput): SatAnexo24ZipResult {
  const { company, year, period, type, xmlResult, tipoEnvio } = input;
  const safeRfc = (company.rfc || '').trim().toUpperCase();
  const { mesStr, suffix } = resolveSatArchiveSuffix(type, period, xmlResult, tipoEnvio);
  const baseName = `${safeRfc}${year}${mesStr}${suffix}`;
  const zipFilename = `${baseName}.zip`;
  const rawXmlName = (xmlResult.filename || '').trim();
  const xmlFilename = rawXmlName
    ? rawXmlName.toUpperCase().startsWith(safeRfc)
      ? `${safeRfc}${rawXmlName.slice(safeRfc.length)}`
      : rawXmlName
    : `${baseName}.xml`;

  const zipBytes = zipSync({ [xmlFilename]: strToU8(xmlResult.xml) }, { level: 6 });

  return {
    zipFilename,
    xmlFilename,
    zipBytes
  };
}
