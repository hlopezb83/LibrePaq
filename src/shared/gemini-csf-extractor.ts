import { sanitizeSatCompanyName, type ExtractedCsfCompany } from './sat-csf-types';
import { REGIMENES_FISCALES_SAT } from './sat-constants';

/**
 * Resuelve la clave de API de Gemini desde variables de entorno de Vite o Node/Bun.
 */
export function getGeminiApiKey(): string | null {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
    return String(import.meta.env.VITE_GEMINI_API_KEY).trim();
  }
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      null
    );
  }
  return null;
}

/**
 * Convierte un ArrayBuffer o Uint8Array a string Base64 compatible con navegador y Node.
 */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

const CSF_SYSTEM_INSTRUCTION = `
Eres un asistente fiscal mexicano de alta precisión experto en documentos del SAT (Servicio de Administración Tributaria).
Tu labor es extraer los datos oficiales de la Constancia de Situación Fiscal (CSF) o Cédula de Identificación Fiscal.
Debes devolver ÚNICAMENTE un objeto JSON estrictamente válido con los siguientes campos:
- rfc: RFC oficial del contribuyente (12 caracteres para Persona Moral, 13 caracteres para Persona Física)
- name: Denominación o Razón Social oficial del contribuyente EXACTAMENTE como aparece en la Cédula de Identificación Fiscal / Constancia (en México para CFDI 4.0 y SAT es el nombre simplificado SIN régimen de capital ni tipo societario, por ejemplo "ELOGISTIX SHIPPING" y NUNCA "ELOGISTIX SHIPPING S. DE R.L. DE C.V."). Para Persona Física es el Nombre y Apellidos completos.
- personType: "MORAL" si el RFC es de 12 caracteres, o "FISICA" si es de 13 caracteres.
- codigoPostal: Código postal fiscal de 5 dígitos (ej: "66267").
- regimenFiscal: Clave SAT de 3 dígitos y descripción del régimen fiscal principal (ej: "601 - General de Ley Personas Morales" o "626 - Régimen Simplificado de Confianza").
- curp: CURP de 18 caracteres si es Persona Física, o null si es Persona Moral.
No agregues formato markdown, comillas triples ni texto explicativo. Solo el objeto JSON crudo.
`;

export function normalizeSatRegimenFiscal(
  rawRegimen: string | undefined,
  personType: 'MORAL' | 'FISICA'
): string {
  const trimmed = (rawRegimen || '').trim();
  const codeMatch = trimmed.match(/\b(6\d{2})\b/);
  const satCode = codeMatch?.[1];
  if (satCode) {
    const found = REGIMENES_FISCALES_SAT.find((r) => r.startsWith(satCode));
    if (found) return found;
  }
  if (trimmed) return trimmed;
  return personType === 'MORAL'
    ? (REGIMENES_FISCALES_SAT[0] ?? '601 - General de Ley Personas Morales')
    : '612 - Personas Físicas con Actividades Empresariales y Profesionales';
}

export type CsfEdgeFunctionInvoker = <T>(
  name: string,
  options?: { body: Record<string, unknown> }
) => Promise<{ data: T | null; error: unknown }>;

let customEdgeInvoker: CsfEdgeFunctionInvoker | null = null;

export function setCsfEdgeFunctionInvoker(invoker: CsfEdgeFunctionInvoker | null): void {
  customEdgeInvoker = invoker;
}

/**
 * Extrae datos fiscales desde una CSF en PDF o imagen utilizando la API multimodal de Gemini.
 */
export async function extractCsfWithGemini(
  fileBytes: ArrayBuffer | Uint8Array,
  mimeType: string = 'application/pdf'
): Promise<ExtractedCsfCompany | null> {
  const base64Data = bufferToBase64(fileBytes);
  const normalizedMime =
    mimeType.includes('pdf') ? 'application/pdf' : mimeType.includes('png') ? 'image/png' : 'image/jpeg';

  // 1. Invocar Edge Function registrada (GEMINI_API_KEY protegida en servidor)
  if (customEdgeInvoker) {
    try {
      const { data, error } = await customEdgeInvoker<{
        ok: boolean;
        data?: {
          rfc?: string;
          name?: string;
          personType?: 'MORAL' | 'FISICA';
          codigoPostal?: string;
          regimenFiscal?: string;
          curp?: string | null;
        };
        code?: string;
      }>('extract-csf', {
        body: { data: base64Data, mimeType: normalizedMime }
      });
      if (!error && data?.ok && data.data?.rfc) {
        const d = data.data;
        const rfc = String(d.rfc).toUpperCase().trim();
        const personType: 'MORAL' | 'FISICA' = d.personType || (rfc.length === 12 ? 'MORAL' : 'FISICA');
        return {
          rfc,
          name: personType === 'MORAL' ? sanitizeSatCompanyName(d.name || `Contribuyente ${rfc}`) : String(d.name || `Contribuyente ${rfc}`).trim(),
          personType,
          codigoPostal: String(d.codigoPostal || '00000').trim(),
          regimenFiscal: normalizeSatRegimenFiscal(d.regimenFiscal, personType),
          curp: d.curp ? String(d.curp).trim() : undefined
        };
      }
    } catch (err) {
      console.warn('[Gemini Edge Function Fallback]', err);
    }
  }

  // 2. Entorno Node / Bun / Fallback directo con API Key si está configurada en entorno
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: normalizedMime,
              data: base64Data
            }
          },
          {
            text: 'Extrae los datos fiscales de esta Constancia de Situación Fiscal (CSF) emitida por el SAT.'
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [{ text: CSF_SYSTEM_INSTRUCTION }]
    },
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  };

  const models = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];
  let rawJson: string | undefined;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000)
      });
      if (!res.ok) continue;

      const jsonResponse = (await res.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };
      const text = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        rawJson = text;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!rawJson) return null;

  try {
    let cleanJson = rawJson;
    const fencedMatch = rawJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch && fencedMatch[1]) {
      cleanJson = fencedMatch[1].trim();
    } else {
      const braceMatch = rawJson.match(/\{[\s\S]*\}/);
      if (braceMatch && braceMatch[0]) cleanJson = braceMatch[0].trim();
    }
    const parsed = JSON.parse(cleanJson) as {
      rfc?: string;
      name?: string;
      personType?: 'MORAL' | 'FISICA';
      codigoPostal?: string;
      regimenFiscal?: string;
      curp?: string;
    };

    if (!parsed.rfc) return null;

    const rfc = String(parsed.rfc).toUpperCase().trim();
    const personType: 'MORAL' | 'FISICA' = rfc.length === 12 ? 'MORAL' : 'FISICA';
    const codigoPostal = String(parsed.codigoPostal || '00000').trim();

    // Normalizar clave de régimen fiscal
    const regimenFiscal = normalizeSatRegimenFiscal(parsed.regimenFiscal, personType);

    const rawName = String(parsed.name || `Contribuyente ${rfc}`).trim();
    const name = personType === 'MORAL' ? sanitizeSatCompanyName(rawName) : rawName;

    return {
      rfc,
      name,
      personType,
      codigoPostal,
      regimenFiscal,
      curp: parsed.curp ? String(parsed.curp).trim() : undefined
    };
  } catch (err) {
    console.error('[Gemini CSF Parse Error]', err);
    return null;
  }
}
