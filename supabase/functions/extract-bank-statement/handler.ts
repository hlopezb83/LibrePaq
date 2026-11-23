/**
 * Lógica pura de extracción de estados de cuenta bancarios PDF con Gemini Flash
 * (sin APIs de Deno) para poder probarla directamente desde Bun y reutilizarla.
 */

export type BankPdfFailureCode =
  | 'INVALID_INPUT'
  | 'FILE_TOO_LARGE'
  | 'AI_NOT_CONFIGURED'
  | 'AI_UNAVAILABLE'
  | 'INVALID_DOCUMENT';

export interface ExtractedBankMovement {
  fecha: string;
  referencia: string;
  descripcion: string;
  cargo: number;
  abono: number;
}

export interface ExtractedBankStatementData {
  banco: string;
  cuenta: string;
  moneda: string;
  periodo: string;
  movimientos: ExtractedBankMovement[];
}

export type BankPdfExtractionResult =
  | { ok: true } & ExtractedBankStatementData
  | { ok: false; code: BankPdfFailureCode };

/** 10 MB expresados en caracteres Base64. */
export const MAX_BASE64_LENGTH = 10 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const GEMINI_MODEL = 'gemini-2.5-flash';
const TIMEOUT_MS = 25_000;

const MONTH_ABBR: Record<string, string> = {
  ENE: '01', JAN: '01',
  FEB: '02',
  MAR: '03',
  ABR: '04', APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AGO: '08', AUG: '08',
  SEP: '09', SET: '09',
  OCT: '10',
  NOV: '11',
  DIC: '12', DEC: '12'
};

const SYSTEM_INSTRUCTION = `
Eres un analista contable y de tesorería bancaria en México (BBVA, Santander, Banorte, Citibanamex, HSBC, Scotiabank, Inbursa).
Extrae los movimientos del estado de cuenta bancario adjunto y devuelve ÚNICAMENTE un objeto JSON válido con la estructura:
{
  "banco": "Nombre del banco",
  "cuenta": "Número o últimos dígitos de cuenta / CLABE",
  "moneda": "MXN o USD",
  "periodo": "YYYY-MM",
  "movimientos": [
    {
      "fecha": "YYYY-MM-DD",
      "referencia": "Folio o referencia bancaria",
      "descripcion": "Concepto del movimiento",
      "cargo": 0,
      "abono": 0
    }
  ]
}
Reglas estrictas:
- Normaliza todas las fechas a formato ISO YYYY-MM-DD.
- cargo (retiro/salida) y abono (depósito/entrada) deben ser números no negativos (>= 0).
- Si el documento NO es un estado de cuenta bancario, devuelve {"banco": null, "movimientos": []}.
`;

export function validateBankPdfRequest(data: unknown, mimeType: unknown): BankPdfFailureCode | null {
  if (typeof data !== 'string' || data.trim().length === 0) return 'INVALID_INPUT';
  if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.includes(mimeType)) return 'INVALID_INPUT';
  if (data.length > MAX_BASE64_LENGTH) return 'FILE_TOO_LARGE';
  return null;
}

export function normalizeBankDate(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const clean = raw.trim();
  if (!clean) return '';

  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(clean);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const dmyNum = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(clean);
  if (dmyNum) {
    const d = Number(dmyNum[1]);
    const m = Number(dmyNum[2]);
    const y = Number(dmyNum[3]);
    if (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const dmyWord = /^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{2,4})$/.exec(clean);
  if (dmyWord) {
    const d = Number(dmyWord[1]);
    const mStr = MONTH_ABBR[(dmyWord[2] ?? '').toUpperCase()];
    const rawY = dmyWord[3] ?? '';
    const y = rawY.length === 2 ? 2000 + Number(rawY) : Number(rawY);
    if (mStr && y >= 1990 && y <= 2100 && d >= 1 && d <= 31) {
      return `${y}-${mStr}-${String(d).padStart(2, '0')}`;
    }
  }

  return '';
}

export function normalizeNonNegativeAmount(raw: unknown): number {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.round((raw + Number.EPSILON) * 100) / 100;
  }
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[$,\s]/g, '');
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.round((parsed + Number.EPSILON) * 100) / 100;
  }
  return 0;
}

function parseGeminiBankJson(text: string): ExtractedBankStatementData | null {
  try {
    let clean = text;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      clean = fenced[1].trim();
    } else {
      const brace = text.match(/\{[\s\S]*\}/);
      if (brace?.[0]) clean = brace[0].trim();
    }
    const parsed = JSON.parse(clean) as Record<string, unknown>;
    if (parsed.banco === null && Array.isArray(parsed.movimientos) && parsed.movimientos.length === 0) {
      return null;
    }
    const rawMoves = Array.isArray(parsed.movimientos) ? parsed.movimientos : [];
    const movimientos: ExtractedBankMovement[] = [];
    for (const item of rawMoves) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const cargo = normalizeNonNegativeAmount(row.cargo);
      const abono = normalizeNonNegativeAmount(row.abono);
      if (cargo === 0 && abono === 0) continue;

      const fecha = normalizeBankDate(row.fecha);
      if (!fecha) continue;

      const referencia = typeof row.referencia === 'string' && row.referencia.trim()
        ? row.referencia.trim().slice(0, 64)
        : 'MOV-BANCO';
      const descripcion = typeof row.descripcion === 'string' && row.descripcion.trim()
        ? row.descripcion.trim().slice(0, 240)
        : 'Movimiento bancario';

      movimientos.push({ fecha, referencia, descripcion, cargo, abono });
    }

    return {
      banco: typeof parsed.banco === 'string' ? parsed.banco.trim() : '',
      cuenta: typeof parsed.cuenta === 'string' ? parsed.cuenta.trim() : '',
      moneda: typeof parsed.moneda === 'string' && parsed.moneda.trim()
        ? parsed.moneda.trim().toUpperCase()
        : 'MXN',
      periodo: typeof parsed.periodo === 'string' ? parsed.periodo.trim() : '',
      movimientos
    };
  } catch {
    return null;
  }
}

export async function extractBankStatementMovements(
  base64Data: string,
  mimeType: string,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<BankPdfExtractionResult> {
  if (!apiKey) return { ok: false, code: 'AI_NOT_CONFIGURED' };

  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: base64Data } },
          { text: 'Extrae banco, cuenta, moneda, periodo y todos los movimientos del estado de cuenta.' }
        ]
      }
    ],
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    generation_config: { response_mime_type: 'application/json', temperature: 0.1 }
  });

  try {
    const res = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS)
      }
    );
    if (!res.ok) {
      return { ok: false, code: 'AI_UNAVAILABLE' };
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
    if (!text) return { ok: false, code: 'AI_UNAVAILABLE' };

    const extracted = parseGeminiBankJson(text);
    if (!extracted) return { ok: false, code: 'INVALID_DOCUMENT' };
    return { ok: true, ...extracted };
  } catch {
    return { ok: false, code: 'AI_UNAVAILABLE' };
  }
}
