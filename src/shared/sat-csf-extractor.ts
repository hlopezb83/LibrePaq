import { REGIMENES_FISCALES_SAT } from './sat-constants';
import {
  extractCompanyCandidatesFromCfdiXml,
  type CfdiCompanyCandidate
} from './cfdi-company-extractor';
import { extractCsfWithGemini } from './gemini-csf-extractor';
import { sanitizeSatCompanyName, type ExtractedCsfCompany } from './sat-csf-types';

export { sanitizeSatCompanyName, type ExtractedCsfCompany };

export function convertCsfToCandidate(csf: ExtractedCsfCompany): CfdiCompanyCandidate {
  const normalizedName = csf.personType === 'MORAL' ? sanitizeSatCompanyName(csf.name) : csf.name;
  return {
    role: 'EMISOR',
    rfc: csf.rfc,
    name: normalizedName,
    personType: csf.personType,
    regimenFiscal: csf.regimenFiscal,
    codigoPostal: csf.codigoPostal
  };
}

const REGIMEN_KEYWORDS: Array<{ match: RegExp; code: string }> = [
  { match: /simplificado\s+de\s+confianza|resico/i, code: '626' },
  { match: /general\s+de\s+ley\s+personas\s+morales|general\s+de\s+ley/i, code: '601' },
  { match: /personas\s+f[ií]sicas\s+con\s+actividades\s+empresariales/i, code: '612' },
  { match: /actividades\s+empresariales\s+y\s+profesionales/i, code: '612' },
  { match: /sueldos\s+y\s+salarios/i, code: '605' },
  { match: /arrendamiento/i, code: '606' },
  { match: /fines\s+no\s+lucrativos/i, code: '603' },
  { match: /incorporaci[oó]n\s+fiscal/i, code: '621' },
  { match: /plataformas\s+tecnol[oó]gicas/i, code: '625' },
  { match: /agr[ií]colas|ganaderas|silv[ií]colas/i, code: '622' },
  { match: /coordinados/i, code: '624' }
];

function resolveRegimenLabel(text: string, personType: 'MORAL' | 'FISICA'): string {
  // Priorizar sección explícita de Regímenes Fiscales para evitar falsos positivos con números de calle (ej. Reforma 601)
  const regimenSectionMatch = text.match(/Reg[ií]menes?\s*:?[\s\S]{0,400}/i);
  const sectionText = regimenSectionMatch ? regimenSectionMatch[0] : '';

  if (sectionText) {
    const secCodeMatch = sectionText.match(/\b(6\d{2})\b/);
    if (secCodeMatch?.[1]) {
      const found = REGIMENES_FISCALES_SAT.find((r) => r.startsWith(secCodeMatch[1]!));
      if (found) return found;
    }
  }

  // Buscar coincidencia descriptiva por palabras clave oficiales
  for (const item of REGIMEN_KEYWORDS) {
    if (item.match.test(text)) {
      const found = REGIMENES_FISCALES_SAT.find((r) => r.startsWith(item.code));
      if (found) return found;
    }
  }

  // Respaldo por código de 3 dígitos únicamente si no se detectó por sección ni nombre
  const codeMatch = text.match(/\b(6\d{2})\b/);
  if (codeMatch?.[1]) {
    const found = REGIMENES_FISCALES_SAT.find((r) => r.startsWith(codeMatch[1]!));
    if (found) return found;
  }

  return personType === 'MORAL'
    ? (REGIMENES_FISCALES_SAT[0] ?? '601 - General de Ley Personas Morales')
    : '612 - Personas Físicas con Actividades Empresariales y Profesionales';
}

function cleanField(val: string): string {
  return val
    .replace(/[()]/g, '')
    .replace(/\\/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae datos fiscales desde el texto plano de una Constancia de Situación Fiscal (SAT).
 */
export function extractCompanyFromCsfText(rawText: string): ExtractedCsfCompany | null {
  if (!rawText) return null;

  // 1. RFC
  const rfcMatch =
    rawText.match(/(?:RFC|Registro\s+Federal\s+de\s+Contribuyentes)[:\s]+([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i) ||
    rawText.match(/\b([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})\b/);

  if (!rfcMatch || !rfcMatch[1]) return null;
  const rfc = rfcMatch[1].toUpperCase().trim();
  const personType: 'MORAL' | 'FISICA' = rfc.length === 12 ? 'MORAL' : 'FISICA';

  // 2. CURP (en Personas Físicas)
  const curpMatch = rawText.match(/CURP[:\s]+([A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d)/i);
  const curp = curpMatch && curpMatch[1] ? curpMatch[1].toUpperCase().trim() : undefined;

  // 3. Razón Social o Nombre
  let name = '';
  if (personType === 'FISICA') {
    const nombreMatch = rawText.match(/Nombre\s*(?:\(\s*s\s*\))?[:\s]+([^)\r\n]+)/i);
    const primerAp = rawText.match(/Primer\s+Apellido[:\s]+([^)\r\n]+)/i);
    const segundoAp = rawText.match(/Segundo\s+Apellido[:\s]+([^)\r\n]+)/i);

    if (nombreMatch && primerAp) {
      const parts = [
        cleanField(nombreMatch[1] ?? ''),
        cleanField(primerAp[1] ?? ''),
        segundoAp && segundoAp[1] ? cleanField(segundoAp[1]) : ''
      ].filter(Boolean);
      name = parts.join(' ');
    }
  }

  if (!name) {
    const moralMatch =
      rawText.match(/Denominaci[oó]n\s*\/\s*Raz[oó]n\s*Social[:\s]+([^)\r\n]+)/i) ||
      rawText.match(/Denominacion\s*\/\s*Razon\s*Social[:\s]+([^)\r\n]+)/i) ||
      rawText.match(/Raz[oó]n\s*Social[:\s]+([^)\r\n]+)/i);

    if (moralMatch && moralMatch[1]) {
      name = sanitizeSatCompanyName(cleanField(moralMatch[1]));
    }
  }

  if (!name) {
    name = `Contribuyente ${rfc}`;
  }

  // 4. Código Postal
  const cpMatch =
    rawText.match(/C[oó]digo\s+Postal[:\s]+(\d{5})/i) ||
    rawText.match(/Codigo\s+Postal[:\s]+(\d{5})/i) ||
    rawText.match(/C\.?P\.?[:\s]+(\d{5})/i);
  const codigoPostal = cpMatch && cpMatch[1] ? cpMatch[1].trim() : '';

  // 5. Régimen Fiscal
  const regimenFiscal = resolveRegimenLabel(rawText, personType);

  return {
    rfc,
    name,
    personType,
    codigoPostal,
    regimenFiscal,
    curp
  };
}

/**
 * Descomprime un buffer de flujo zlib / FlateDecode usando la Web Stream API nativa.
 */
async function decompressFlate(bytes: Uint8Array): Promise<string> {
  if (bytes.length < 2) return '';
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const zlib = await import(/* @vite-ignore */ 'node:zlib');
      try {
        return zlib.inflateSync(bytes).toString('latin1');
      } catch {
        try {
          return zlib.inflateRawSync(bytes).toString('latin1');
        } catch {
          return '';
        }
      }
    } catch {
      // Fallback a Web Streams en navegador
    }
  }

  for (const format of ['deflate', 'deflate-raw'] as const) {
    try {
      const body = new Blob([bytes as BlobPart]);
      const res = new Response(body);
      if (!res.body) continue;
      const stream = res.body.pipeThrough(new DecompressionStream(format));
      const text = await new Response(stream).text().catch(() => '');
      if (text && text.length > 5) return text;
    } catch {
      // Intentar el siguiente formato
    }
  }
  return '';
}

/**
 * Extrae texto visible de operadores PDF (Tj, TJ, y texto entre paréntesis).
 */
function extractTextFromPdfStream(streamContent: string): string {
  const chunks: string[] = [];
  const parenRegex = /\(((?:[^()\\]|\\.)+)\)\s*(?:Tj|'|")/g;
  const unescapePdf = (s: string) => s.replace(/\\([()\\])/g, '$1');
  let match: RegExpExecArray | null;

  while ((match = parenRegex.exec(streamContent)) !== null) {
    if (match[1]) {
      chunks.push(unescapePdf(match[1]));
    }
  }

  // También buscar bloques TJ: [ (Texto) -12 (Otro) ] TJ
  const tjRegex = /\[([^\]]+)\]\s*TJ/g;
  while ((match = tjRegex.exec(streamContent)) !== null) {
    if (match[1]) {
      const subParens = match[1].match(/\(((?:[^()\\]|\\.)+)\)/g);
      if (subParens) {
        chunks.push(subParens.map((s) => unescapePdf(s.slice(1, -1))).join(''));
      }
    }
  }

  return chunks.length > 0 ? chunks.join('\n') : streamContent;
}

/**
 * Extrae datos fiscales desde un archivo binario de Constancia SAT (PDF o texto).
 */
export async function extractCompanyFromCsfFile(
  fileBytes: ArrayBuffer | Uint8Array
): Promise<ExtractedCsfCompany | null> {
  const uint8 = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes);
  const rawString = new TextDecoder('latin1').decode(uint8);

  // Si no es un PDF (por ejemplo, archivo de texto o exportación de CIF)
  if (!rawString.startsWith('%PDF')) {
    return extractCompanyFromCsfText(rawString);
  }

  let consolidatedText = rawString;

  // Buscar todos los bloques de stream ... endstream
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch: RegExpExecArray | null;

  while ((streamMatch = streamPattern.exec(rawString)) !== null) {
    const rawContent = streamMatch[1];
    if (!rawContent) continue;

    const streamStartIndex = streamMatch.index + streamMatch[0].indexOf(rawContent);
    const streamEndIndex = streamStartIndex + rawContent.length;
    const streamBytes = uint8.subarray(streamStartIndex, streamEndIndex);

    // Intentar descompresión FlateDecode
    const decompressed = await decompressFlate(streamBytes);
    if (decompressed) {
      const extracted = extractTextFromPdfStream(decompressed);
      consolidatedText += `\n${extracted}`;
    } else {
      const extracted = extractTextFromPdfStream(rawContent);
      consolidatedText += `\n${extracted}`;
    }
  }

  const local = extractCompanyFromCsfText(consolidatedText);
  if (local && local.rfc) return local;

  // Fallback con Gemini Vision para PDFs escaneados, imágenes o texto vectorizado
  return extractCsfWithGemini(uint8, 'application/pdf');
}

export interface UploadedCompanyParseResult {
  primary: CfdiCompanyCandidate | null;
  candidates: CfdiCompanyCandidate[];
  source: 'CFDI' | 'CSF';
}

/**
 * Procesa un archivo subido (Factura XML CFDI 4.0 o Constancia SAT en PDF / Imagen / Texto)
 * para autocompletar la empresa en el asistente de alta.
 */
export async function parseUploadedCompanyFile(file: File): Promise<UploadedCompanyParseResult> {
  const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);

  if (isPdf || isImage) {
    const buffer = await file.arrayBuffer();
    const csf = isPdf
      ? await extractCompanyFromCsfFile(buffer)
      : await extractCsfWithGemini(buffer, file.type || 'image/jpeg');

    if (csf && csf.rfc) {
      const cand = convertCsfToCandidate(csf);
      return { primary: cand, candidates: [cand], source: 'CSF' };
    }
    return { primary: null, candidates: [], source: 'CSF' };
  }

  const rawText = await file.text();
  if (rawText.includes('<Comprobante') || rawText.includes('<cfdi:Comprobante')) {
    const { primary, candidates } = extractCompanyCandidatesFromCfdiXml(rawText);
    return { primary, candidates, source: 'CFDI' };
  }

  const csf = extractCompanyFromCsfText(rawText);
  if (csf && csf.rfc) {
    const cand = convertCsfToCandidate(csf);
    return { primary: cand, candidates: [cand], source: 'CSF' };
  }

  return { primary: null, candidates: [], source: 'CFDI' };
}

