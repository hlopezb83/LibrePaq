export interface ExtractedCsfCompany {
  rfc: string;
  name: string;
  personType: 'MORAL' | 'FISICA';
  codigoPostal: string;
  regimenFiscal: string;
  curp?: string;
}

/**
 * Limpia y normaliza la Razón Social para personas morales según el estándar SAT CFDI 4.0 / Anexo 20.
 * El SAT exige que el nombre se registre sin régimen de capital (sin S.A. de C.V., S. de R.L. de C.V., etc.).
 */
export function sanitizeSatCompanyName(name: string): string {
  let cleaned = name.trim();
  const corporateRegimes = [
    /\bSOCIEDAD\s+AN[OÓ]NIMA\s+PROMOTORA\s+DE\s+INVERSI[OÓ]N\s+(?:DE\s+CAPITAL\s+VARIABLE)?\b/gi,
    /\bSOCIEDAD\s+AN[OÓ]NIMA\s+DE\s+CAPITAL\s+VARIABLE\b/gi,
    /\bSOCIEDAD\s+DE\s+RESPONSABILIDAD\s+LIMITADA\s+DE\s+CAPITAL\s+VARIABLE\b/gi,
    /\bSOCIEDAD\s+POR\s+ACCIONES\s+SIMPLIFICADA\s+DE\s+CAPITAL\s+VARIABLE\b/gi,
    /\bSOCIEDAD\s+POR\s+ACCIONES\s+SIMPLIFICADA\b/gi,
    /\bSOCIEDAD\s+DE\s+RESPONSABILIDAD\s+LIMITADA\b/gi,
    /\bSOCIEDAD\s+AN[OÓ]NIMA\b/gi,
    /\bS\.?\s*A\.?\s*P\.?\s*I\.?\s*(?:DE\s+C\.?\s*V\.?)?\b/gi,
    /\bS\.?\s*A\.?\s*DE\s+C\.?\s*V\.?\b/gi,
    /\bS\.?\s*DE\s+R\.?\s*L\.?\s*DE\s+C\.?\s*V\.?\b/gi,
    /\bS\.?\s*A\.?\s*P\.?\s*I\.?\b/gi,
    /\bS\.?\s*A\.?\s*S\.?\s*(?:DE\s+C\.?\s*V\.?)?\b/gi,
    /\bS\.?\s*A\.?\s*S\.?\b/gi,
    /\bS\.?\s*DE\s+R\.?\s*L\.?\b/gi,
    /\bS\.?\s*A\.?\b/gi,
    /\bS\.?\s*C\.?\b/gi,
    /\bA\.?\s*C\.?\b/gi
  ];

  for (const reg of corporateRegimes) {
    cleaned = cleaned.replace(reg, '');
  }

  return cleaned
    .replace(/[,\.\-\_]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toUpperCase();
}
