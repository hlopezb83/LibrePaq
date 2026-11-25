/**
 * Lógica pura de extracción de CSF con Gemini (sin APIs de Deno) para poder probarla desde Bun.
 * La API key SOLO vive en el servidor (secreto de la Edge Function); nunca llega al navegador.
 */

export type CsfFailureCode =
  | 'INVALID_INPUT'
  | 'FILE_TOO_LARGE'
  | 'AI_UNAVAILABLE'
  | 'NOT_A_CSF'
  | 'AI_NOT_CONFIGURED';

export interface RawCsfFields {
  rfc: string;
  name: string;
  codigoPostal: string;
  regimenFiscal: string;
  curp: string | null;
}

export type CsfExtractionResult =
  | { ok: true; data: RawCsfFields }
  | { ok: false; code: CsfFailureCode };

/** ~8 MB de archivo binario expresados en caracteres Base64. */
export const MAX_BASE64_LENGTH = Math.ceil((8 * 1024 * 1024 * 4) / 3);
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const PER_MODEL_TIMEOUT_MS = 12_000;
const RFC_PATTERN = /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/;

const SYSTEM_INSTRUCTION = `
Eres un asistente fiscal mexicano experto en documentos del SAT.
Extrae los datos de la Constancia de Situación Fiscal (CSF) o Cédula de Identificación Fiscal.
Devuelve ÚNICAMENTE un objeto JSON con estos campos:
- rfc: RFC del contribuyente (12 caracteres Persona Moral, 13 Persona Física).
- name: Denominación/Razón Social EXACTAMENTE como aparece en la constancia, SIN régimen de capital
  (ej. "ELOGISTIX SHIPPING", nunca "ELOGISTIX SHIPPING S. DE R.L. DE C.V."). Persona Física: nombre y apellidos.
- codigoPostal: código postal fiscal de 5 dígitos.
- regimenFiscal: clave SAT de 3 dígitos y descripción del régimen principal (ej. "601 - General de Ley Personas Morales").
- curp: CURP de 18 caracteres si es Persona Física, o null.
Si el documento NO es una Constancia de Situación Fiscal del SAT, devuelve {"rfc": null}.
`;

export function validateCsfRequest(data: unknown, mimeType: unknown): CsfFailureCode | null {
  if (typeof data !== 'string' || data.length === 0) return 'INVALID_INPUT';
  if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.includes(mimeType)) return 'INVALID_INPUT';
  if (data.length > MAX_BASE64_LENGTH) return 'FILE_TOO_LARGE';
  return null;
}

function parseModelJson(text: string): RawCsfFields | null {
  try {
    let clean = text;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced && fenced[1]) {
      clean = fenced[1].trim();
    } else {
      const brace = text.match(/\{[\s\S]*\}/);
      if (brace && brace[0]) clean = brace[0].trim();
    }
    const parsed = JSON.parse(clean) as Record<string, unknown>;
    const rfc = typeof parsed.rfc === 'string' ? parsed.rfc.toUpperCase().replace(/\s/g, '') : '';
    if (!RFC_PATTERN.test(rfc)) return null;
    return {
      rfc,
      name: typeof parsed.name === 'string' ? parsed.name.trim() : '',
      codigoPostal: typeof parsed.codigoPostal === 'string' ? parsed.codigoPostal.trim() : '',
      regimenFiscal: typeof parsed.regimenFiscal === 'string' ? parsed.regimenFiscal.trim() : '',
      curp: typeof parsed.curp === 'string' ? parsed.curp.trim() : null
    };
  } catch {
    return null;
  }
}

/**
 * Envía el documento a Gemini probando modelos en orden. Distingue entre
 * "el servicio de IA no respondió" (AI_UNAVAILABLE) y "el documento no es una CSF" (NOT_A_CSF).
 */
export async function extractCsfFields(
  base64Data: string,
  mimeType: string,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<CsfExtractionResult> {
  if (!apiKey) return { ok: false, code: 'AI_NOT_CONFIGURED' };

  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: 'Extrae los datos fiscales de esta Constancia de Situación Fiscal del SAT.' }
        ]
      }
    ],
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
  });

  let modelAnswered = false;
  for (const model of MODELS) {
    try {
      const res = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body,
          signal: AbortSignal.timeout(PER_MODEL_TIMEOUT_MS)
        }
      );
      if (!res.ok) {
        console.warn(`[extract-csf] ${model} respondió HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
      if (!text) continue;
      modelAnswered = true;
      const fields = parseModelJson(text);
      if (fields) return { ok: true, data: fields };
      // El modelo respondió pero no encontró un RFC válido: no tiene caso reintentar con otro modelo.
      break;
    } catch (err) {
      console.warn(`[extract-csf] ${model} falló:`, err instanceof Error ? err.message : err);
    }
  }
  return { ok: false, code: modelAnswered ? 'NOT_A_CSF' : 'AI_UNAVAILABLE' };
}
