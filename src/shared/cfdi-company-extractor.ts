import { REGIMENES_FISCALES_SAT } from './sat-constants';
import { decodeXmlEntities } from './cfdi-xml';

export interface CfdiCompanyCandidate {
  role: 'EMISOR' | 'RECEPTOR';
  rfc: string;
  name: string;
  personType: 'MORAL' | 'FISICA';
  regimenFiscal: string;
  codigoPostal: string;
}

const GENERIC_RFCS = new Set(['XAXX010101000', 'XEXX010101000']);

function getAttr(tagContent: string, attrName: string): string {
  if (!tagContent) return '';
  const regex = new RegExp(`\\b${attrName}\\s*=\\s*["']([^"']*)["']`, 'i');
  const match = tagContent.match(regex);
  return match && match[1] !== undefined ? decodeXmlEntities(match[1].trim()) : '';
}

function findTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<(?:\\w+:)?${tagName}\\b([^>]*)>`, 'i');
  const match = xml.match(regex);
  return match && match[1] !== undefined ? match[1] : '';
}

function resolveSatRegimenLabel(codeRaw: string, personType: 'MORAL' | 'FISICA'): string {
  const cleanCode = codeRaw.trim().slice(0, 3);
  if (/^\d{3}$/.test(cleanCode)) {
    const matched = REGIMENES_FISCALES_SAT.find((item) => item.startsWith(`${cleanCode} -`));
    if (matched) return matched;
  }
  return personType === 'MORAL'
    ? (REGIMENES_FISCALES_SAT[0] ?? '601 - General de Ley Personas Morales')
    : '612 - Personas Físicas con Actividades Empresariales y Profesionales';
}

function buildCandidate(
  role: 'EMISOR' | 'RECEPTOR',
  rfcRaw: string,
  nameRaw: string,
  regimenCodeRaw: string,
  cpRaw: string
): CfdiCompanyCandidate | null {
  const rfc = rfcRaw.toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
  if ((rfc.length !== 12 && rfc.length !== 13) || GENERIC_RFCS.has(rfc)) {
    return null;
  }
  const personType: 'MORAL' | 'FISICA' = rfc.length === 12 ? 'MORAL' : 'FISICA';
  const codigoPostal = cpRaw.replace(/\D/g, '').slice(0, 5);
  const name = nameRaw.trim() || `Contribuyente ${rfc}`;
  const regimenFiscal = resolveSatRegimenLabel(regimenCodeRaw, personType);

  return {
    role,
    rfc,
    name,
    personType,
    regimenFiscal,
    codigoPostal
  };
}

/**
 * Extrae automáticamente los datos fiscales de alta de empresa (RFC, Razón Social,
 * Régimen SAT y Código Postal) desde cualquier archivo XML CFDI 3.3 o 4.0.
 */
export function extractCompanyCandidatesFromCfdiXml(xmlRaw: string): {
  primary: CfdiCompanyCandidate | null;
  candidates: CfdiCompanyCandidate[];
} {
  if (!xmlRaw || !xmlRaw.includes('Comprobante')) {
    return { primary: null, candidates: [] };
  }

  const comprobanteAttrs = findTag(xmlRaw, 'Comprobante');
  const emisorAttrs = findTag(xmlRaw, 'Emisor');
  const receptorAttrs = findTag(xmlRaw, 'Receptor');

  const lugarExpedicion = getAttr(comprobanteAttrs, 'LugarExpedicion');

  const emisor = buildCandidate(
    'EMISOR',
    getAttr(emisorAttrs, 'Rfc'),
    getAttr(emisorAttrs, 'Nombre'),
    getAttr(emisorAttrs, 'RegimenFiscal'),
    lugarExpedicion
  );

  const receptor = buildCandidate(
    'RECEPTOR',
    getAttr(receptorAttrs, 'Rfc'),
    getAttr(receptorAttrs, 'Nombre'),
    getAttr(receptorAttrs, 'RegimenFiscalReceptor') || getAttr(receptorAttrs, 'RegimenFiscal'),
    getAttr(receptorAttrs, 'DomicilioFiscalReceptor') || lugarExpedicion
  );

  const candidates: CfdiCompanyCandidate[] = [];
  if (emisor) candidates.push(emisor);
  if (receptor && receptor.rfc !== emisor?.rfc) candidates.push(receptor);

  return {
    primary: candidates[0] ?? null,
    candidates
  };
}
