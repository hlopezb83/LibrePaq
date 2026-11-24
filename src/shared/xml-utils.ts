/**
 * Utilidades puras e isomórficas para sanitización y escape de XML CFDI y Anexo 24
 */

/**
 * Elimina nodos `<cfdi:Addenda>` / `<Addenda>` (con o sin prefijo de namespace)
 * antes de parsear un CFDI para evitar que etiquetas propietarias contaminen
 * Conceptos, Impuestos, Pagos o Documentos Relacionados.
 */
export function stripXmlAddenda(xmlRaw: string): string {
  if (!xmlRaw) return '';
  return xmlRaw
    .replace(/<(?:[A-Za-z_][\w.-]*:)?Addenda\b[^>]*>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?Addenda\s*>/gi, '')
    .replace(/<(?:[A-Za-z_][\w.-]*:)?Addenda\b[^>]*\/\s*>/gi, '');
}

/**
 * Extrae FechaPago (YYYY-MM-DD) de XMLs Tipo P (Pago 1.0/2.0) o Tipo N (Nómina 1.2),
 * aislando previamente la Addenda.
 */
export function extractCfdiFechaPago(xmlRaw: unknown, tipoComprobante: unknown): string | null {
  if (typeof xmlRaw !== 'string' || xmlRaw.trim().length === 0) return null;
  const tipo = String(tipoComprobante || '').toUpperCase();
  if (tipo !== 'P' && tipo !== 'N') return null;
  const clean = stripXmlAddenda(xmlRaw);
  const pattern =
    tipo === 'P'
      ? /<(?:[A-Za-z_][\w.-]*:)?Pago\b[^>]*\bFechaPago\s*=\s*["']([^"']+)["']/i
      : /<(?:[A-Za-z_][\w.-]*:)?Nomina\b[^>]*\bFechaPago\s*=\s*["']([^"']+)["']/i;
  const match = pattern.exec(clean);
  if (!match?.[1]) return null;
  const trimmed = match[1].trim();
  return trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed || null;
}

/** Valida que el CFDI pertenezca al RFC de la empresa activa (Emisor o Receptor). */
export function isCfdiBelongingToCompany(
  parsed: { emisorRfc?: string | null; receptorRfc?: string | null },
  companyRfc: string | null | undefined
): boolean {
  const target = (companyRfc ?? '').trim().toUpperCase();
  if (!target) return true;
  const emisor = (parsed.emisorRfc ?? '').trim().toUpperCase();
  const receptor = (parsed.receptorRfc ?? '').trim().toUpperCase();
  return emisor === target || receptor === target;
}

export function escapeXmlAttr(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function decodeXmlEntities(value: string): string {
  if (!value || !value.includes('&')) return value;
  return value
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : _m;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : _m;
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
