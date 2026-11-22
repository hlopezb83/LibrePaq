export interface RfcModulo11Step {
  position: number;
  char: string;
  value: number;
  weight: number;
  product: number;
}

export interface RfcModulo11Result {
  isValidFormat: boolean;
  isValidCheckDigit: boolean;
  isGeneric: boolean;
  expectedCheckDigit: string | null;
  actualCheckDigit: string | null;
  expectedRfc: string | null;
  message: string;
  sum: number;
  remainder: number;
  offset: number;
  steps: RfcModulo11Step[];
}

/**
 * H-18 (SAT Anexo 3 / Módulo 11):
 * Validación algorítmica del RFC con suma ponderada y dígito verificador.
 * Soporta Personas Físicas (13 caracteres), Personas Morales (12 caracteres) y
 * RFCs genéricos oficiales del SAT (XAXX010101000 y XEXX010101000).
 */
export function validateRfcModulo11(rfcRaw: string): RfcModulo11Result {
  const rfc = rfcRaw.trim().toUpperCase();
  const isGeneric = rfc === 'XAXX010101000' || rfc === 'XEXX010101000';
  if (isGeneric) {
    return {
      isValidFormat: true,
      isValidCheckDigit: true,
      isGeneric: true,
      expectedCheckDigit: '0',
      actualCheckDigit: '0',
      expectedRfc: rfc,
      message: 'RFC genérico oficial del SAT (Público en General / Extranjero).',
      sum: 0,
      remainder: 0,
      offset: 0,
      steps: []
    };
  }

  const re = /^([A-ZÑ&]{3,4}) ?(?:- ?)?(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])) ?(?:- ?)?([A-Z\d]{2})([A\d])$/;
  const match = rfc.match(re);
  if (!match) {
    return {
      isValidFormat: false,
      isValidCheckDigit: false,
      isGeneric: false,
      expectedCheckDigit: null,
      actualCheckDigit: null,
      expectedRfc: null,
      message: 'Estructura no válida (12 caracteres para Persona Moral o 13 para Persona Física).',
      sum: 0,
      remainder: 0,
      offset: 0,
      steps: []
    };
  }

  const actualCheckDigit = match[4] ?? rfc.slice(-1);
  const rfcSinDigito = (match[1] ?? '') + (match[2] ?? '') + (match[3] ?? '');
  const len = rfcSinDigito.length;
  const diccionario = '0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ Ñ';
  const indice = len + 1;
  const offset = len === 12 ? 0 : 481; // Persona Moral offset 481 (espacio en pos 13 con valor 37)

  let suma = offset;
  const steps: RfcModulo11Step[] = [];

  for (let i = 0; i < len; i += 1) {
    const char = rfcSinDigito.charAt(i);
    const idx = diccionario.indexOf(char);
    if (idx === -1) {
      return {
        isValidFormat: false,
        isValidCheckDigit: false,
        isGeneric: false,
        expectedCheckDigit: null,
        actualCheckDigit,
        expectedRfc: null,
        message: `Carácter '${char}' no permitido en catálogo SAT.`,
        sum: suma,
        remainder: 0,
        offset,
        steps
      };
    }
    const weight = indice - i;
    const product = idx * weight;
    suma += product;
    steps.push({
      position: i + 1,
      char,
      value: idx,
      weight,
      product
    });
  }

  const rem = suma % 11;
  let expectedCheckDigit = '0';
  if (rem === 0) {
    expectedCheckDigit = '0';
  } else {
    const diff = 11 - rem;
    if (diff === 10) expectedCheckDigit = 'A';
    else if (diff === 11) expectedCheckDigit = '0';
    else expectedCheckDigit = String(diff);
  }

  const isValidCheckDigit = actualCheckDigit === expectedCheckDigit;
  const expectedRfc = rfcSinDigito + expectedCheckDigit;

  return {
    isValidFormat: true,
    isValidCheckDigit,
    isGeneric: false,
    expectedCheckDigit,
    actualCheckDigit,
    expectedRfc,
    message: isValidCheckDigit
      ? 'Estructura SAT y dígito verificador (Módulo 11) válidos.'
      : `Dígito verificador actual '${actualCheckDigit}', el algoritmo SAT calcula '${expectedCheckDigit}'.`,
    sum: suma,
    remainder: rem,
    offset,
    steps
  };
}

/**
 * Calcula únicamente el dígito verificador para un prefijo de RFC (11 caracteres para Moral o 12 para Física).
 */
export function calculateRfcCheckDigit(rfcPrefix: string): string | null {
  const clean = rfcPrefix.trim().toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
  if (clean.length === 11 || clean.length === 12) {
    const res = validateRfcModulo11(clean + '0');
    return res.expectedCheckDigit;
  }
  return null;
}

/**
 * Devuelve el RFC con el dígito verificador corregido según el cálculo Módulo 11 del SAT.
 */
export function fixRfcCheckDigit(rfcRaw: string): string {
  const res = validateRfcModulo11(rfcRaw);
  return res.expectedRfc ?? rfcRaw;
}
