import { SAFETY_BOUNDS } from '../../shared/sat-constants';
import type { AccountNature, AccountType } from '../../shared/types';
import type { CatalogoCsvSkippedRow, ParsedCatalogoCsvRow } from './catalogoCsvIo';
export { parseAnexo24XmlCatalogOrBalanza } from './catalogoAnexo24XmlParser';

export type CatalogoFileFormat =
  | 'CSV'
  | 'CONTPAQI_TXT'
  | 'ANEXO24_CT_XML'
  | 'ANEXO24_BN_XML';

export interface BalanzaValidationSummary {
  totalDeudor: number;
  totalAcreedor: number;
  totalDebe: number;
  totalHaber: number;
  isBalanced: boolean;
  difference: number;
  anio?: string;
  mes?: string;
  balanceField?: 'SaldoIni' | 'SaldoFin';
}

export interface CatalogoMigrationParseResult {
  format: CatalogoFileFormat;
  rows: ParsedCatalogoCsvRow[];
  skipped: CatalogoCsvSkippedRow[];
  balanzaValidation?: BalanzaValidationSummary;
  fechaInicioOperaciones?: string;
}

export function normalizeMigrationAccountCode(rawInput: string): string {
  const clean = rawInput.trim();
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 8)}`;
  }
  if (/^\d{11}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 7)}-${clean.slice(7, 11)}`;
  }
  return clean;
}

export function isValidMigrationAccountCode(code: string): boolean {
  return /^[A-Za-z0-9]{2,6}(-[A-Za-z0-9]{1,6}){1,4}$/.test(code);
}

/** Clasifica cuentas por prefijo numérico incluyendo 7xx (RIF) en INGRESOS/GASTOS, nunca ORDEN. */
export function inferTypeFromCode(code: string, rawTypeHint?: string): AccountType {
  const hint = (rawTypeHint || '').trim().toUpperCase();
  if (hint && hint !== 'A' && hint !== 'D' && hint !== 'ACREEDORA' && hint !== 'DEUDORA') {
    if (hint === 'ACTIVO' || hint.startsWith('ACT') || /^A[AD]$/.test(hint)) return 'ACTIVO';
    if (hint === 'PASIVO' || hint.startsWith('P')) return 'PASIVO';
    if (hint === 'COSTOS' || hint.startsWith('COSTO')) return 'COSTOS';
    if (hint === 'CAPITAL' || hint.startsWith('C')) return 'CAPITAL';
    if (hint === 'INGRESOS' || hint.startsWith('I')) return 'INGRESOS';
    if (hint === 'GASTOS' || hint.startsWith('E') || hint.startsWith('G')) return 'GASTOS';
    if (hint === 'ORDEN' || hint.startsWith('O')) return 'ORDEN';
  }

  const first = code.charAt(0);
  if (first === '1') return 'ACTIVO';
  if (first === '2') return 'PASIVO';
  if (first === '3') return 'CAPITAL';
  if (first === '4') return 'INGRESOS';
  if (first === '5') return 'COSTOS';
  if (first === '6') return 'GASTOS';
  if (first === '7') {
    const clean3 = code.replace(/[^0-9]/g, '').slice(0, 3);
    return clean3 === '702' || clean3 === '704' ? 'INGRESOS' : 'GASTOS';
  }
  return 'ORDEN';
}

export function inferNatureFromType(type: AccountType, rawNat?: string): AccountNature {
  const n = (rawNat || '').trim().toUpperCase();
  if (n === 'D' || n === 'DEUDORA' || n.endsWith('D')) return 'DEUDORA';
  if (n === 'A' || n === 'ACREEDORA' || n.endsWith('A')) return 'ACREEDORA';
  return type === 'PASIVO' || type === 'CAPITAL' || type === 'INGRESOS'
    ? 'ACREEDORA'
    : 'DEUDORA';
}

const CONTPAQI_TYPE_KEY_MAP: Record<string, { type: AccountType; nature: AccountNature }> = {
  A: { type: 'ACTIVO', nature: 'DEUDORA' },
  B: { type: 'ACTIVO', nature: 'ACREEDORA' },
  C: { type: 'PASIVO', nature: 'DEUDORA' },
  D: { type: 'PASIVO', nature: 'ACREEDORA' },
  E: { type: 'CAPITAL', nature: 'DEUDORA' },
  F: { type: 'CAPITAL', nature: 'ACREEDORA' },
  G: { type: 'INGRESOS', nature: 'ACREEDORA' },
  H: { type: 'GASTOS', nature: 'DEUDORA' },
  I: { type: 'ORDEN', nature: 'DEUDORA' },
  J: { type: 'ORDEN', nature: 'ACREEDORA' },
  K: { type: 'ORDEN', nature: 'DEUDORA' },
  L: { type: 'ORDEN', nature: 'ACREEDORA' }
};

/** Resuelve rubro y naturaleza en CONTPAQi TXT soportando claves oficiales A–L y hints de 2 letras (AD/PA/etc.). */
export function resolveContpaqiTypeAndNature(
  code: string,
  rawHint?: string
): { type: AccountType; nature: AccountNature } {
  const hint = (rawHint || '').trim().toUpperCase();
  const mapped = CONTPAQI_TYPE_KEY_MAP[hint];
  if (mapped) {
    if (hint === 'H' && code.startsWith('5')) {
      return { type: 'COSTOS', nature: 'DEUDORA' };
    }
    if ((hint === 'G' || hint === 'H') && code.startsWith('7')) {
      return { type: hint === 'G' ? 'INGRESOS' : 'GASTOS', nature: mapped.nature };
    }
    return mapped;
  }
  const type = inferTypeFromCode(code, hint);
  const nature = inferNatureFromType(type, hint);
  return { type, nature };
}

export function inferLevelFromCode(code: string): number {
  const parts = code.split(/[-.]/);
  if (parts.length <= 1) return 1;
  let nonZeroCount = 0;
  for (const seg of parts) {
    if (!/^0+$/.test(seg)) nonZeroCount += 1;
  }
  return Math.max(1, Math.min(SAFETY_BOUNDS.MAX_ACCOUNT_LEVEL, nonZeroCount));
}

export function inferParentCodeFromSet(code: string, knownCodes: ReadonlySet<string>): string | null {
  const sep = code.includes('.') && !code.includes('-') ? '.' : '-';
  const parts = code.split(sep);
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    if (/^0+$/.test(parts[i]!)) continue;
    const candidate = parts.map((seg, idx) => (idx >= i ? '0'.repeat(seg.length) : seg)).join(sep);
    if (candidate !== code && knownCodes.has(candidate)) {
      return candidate;
    }
  }
  if (parts.length > 3) {
    const truncated = parts.slice(0, parts.length - 1).join(sep);
    if (knownCodes.has(truncated)) return truncated;
  }
  return null;
}

export function isContpaqiCatalogTxt(text: string): boolean {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.some((l) => /^C(?:\t|\|| +)[A-Za-z0-9-]{3,}/i.test(l));
}

function parseContpaqiSpaceLine(rawLine: string): {
  rawCode: string;
  rawName: string;
  rawParent: string;
  rawSat: string;
  rawTypeOrNat: string;
  rawBal: string;
} {
  const body = rawLine.replace(/^C\s+/i, '');
  const segments = body.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  let rawCode = '';
  let rawName = '';
  let tailTokens: string[] = [];

  if (segments.length >= 2) {
    const firstParts = segments[0]!.match(/^(\S+)\s+(.+)$/);
    if (firstParts) {
      rawCode = normalizeMigrationAccountCode(firstParts[1] ?? '');
      rawName = firstParts[2]!.trim();
      tailTokens = segments.slice(1).flatMap((s) => s.split(/\s+/)).filter(Boolean);
    } else {
      rawCode = normalizeMigrationAccountCode(segments[0]!);
      rawName = segments[1] ?? '';
      tailTokens = segments.slice(2).flatMap((s) => s.split(/\s+/)).filter(Boolean);
    }
  } else {
    const match = rawLine.match(/^C\s+(\S+)\s+(.+)$/i);
    if (match) {
      rawCode = normalizeMigrationAccountCode(match[1] ?? '');
      const words = (match[2] ?? '').trim().split(/\s+/);
      const peeled: string[] = [];
      while (words.length > 1) {
        const last = words[words.length - 1]!;
        const isSat = /^\d{3}\.\d{2}(?:\.\d+)?$/.test(last);
        const isType = /^(?:[A-L]|A[AD]|P[AD]|C[AD]|I[AD]|E[AD]|G[AD]|O[AD])$/i.test(last);
        const isBal = /^-?\$?[\d,]+(?:\.\d+)?$/.test(last) && !/^(?:19|20)\d{6}$/.test(last);
        const normLast = normalizeMigrationAccountCode(last);
        const isParent =
          !/^(?:19|20)\d{6}$/.test(last) &&
          (last.includes('-') || /^\d{8}$/.test(last) || /^\d{11}$/.test(last)) &&
          isValidMigrationAccountCode(normLast);
        if (isSat || isType || isBal || isParent) {
          peeled.unshift(words.pop()!);
        } else {
          break;
        }
      }
      rawName = words.join(' ').trim();
      tailTokens = peeled;
    }
  }

  let rawParent = '';
  let rawSat = '';
  let rawTypeOrNat = '';
  let rawBal = '';

  for (const tok of tailTokens) {
    if (/^\d{3}\.\d{2}(?:\.\d+)?$/.test(tok)) {
      rawSat = tok;
    } else if (/^(?:[A-L]|A[AD]|P[AD]|C[AD]|I[AD]|E[AD]|G[AD]|O[AD])$/i.test(tok)) {
      rawTypeOrNat = tok;
    } else if (/^(?:19|20)\d{6}$/.test(tok)) {
      continue;
    } else if (
      !rawParent &&
      (tok.includes('-') || /^\d{8}$/.test(tok) || /^\d{11}$/.test(tok)) &&
      isValidMigrationAccountCode(normalizeMigrationAccountCode(tok))
    ) {
      rawParent = normalizeMigrationAccountCode(tok);
    } else if (/^-?\$?[\d,]+(?:\.\d+)?$/.test(tok)) {
      const cleaned = tok.replace(/[$,]/g, '');
      if (tok.includes('.') || Number(cleaned) > 10 || !rawBal) {
        rawBal = tok;
      }
    }
  }

  return { rawCode, rawName, rawParent, rawSat, rawTypeOrNat, rawBal };
}

export function parseContpaqiTxtCatalog(text: string): CatalogoMigrationParseResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const tempRows: ParsedCatalogoCsvRow[] = [];
  const skipped: CatalogoCsvSkippedRow[] = [];

  for (let idx = 0; idx < lines.length; idx += 1) {
    const rawLine = lines[idx]?.trim() ?? '';
    if (!rawLine || !/^C(?:\t|\|| +)/i.test(rawLine)) continue;

    const delimiter = rawLine.includes('\t') ? '\t' : rawLine.includes('|') ? '|' : null;
    let rawCode = '';
    let rawName = '';
    let rawParent = '';
    let rawSat = '';
    let rawTypeOrNat = '';
    let rawBal = '';

    if (delimiter) {
      const cols = rawLine.split(delimiter).map((c) => c.trim());
      rawCode = normalizeMigrationAccountCode(cols[1] ?? '');
      rawName = cols[2] ?? '';
      const c3 = cols[3] ?? '';
      const c4 = cols[4] ?? '';
      const c5 = cols[5] ?? '';
      const c6 = cols[6] ?? '';
      if (/^\d{3}\.\d{2}/.test(c3)) {
        rawSat = c3;
        rawTypeOrNat = c4;
        rawBal = c5;
      } else {
        rawParent = normalizeMigrationAccountCode(c3);
        rawTypeOrNat = c4;
        const c5IsSat = /^\d{3}\.\d{2}/.test(c5);
        const c6IsSat = !c5IsSat && /^\d{3}\.\d{2}/.test(c6);
        rawSat = c5IsSat ? c5 : c6IsSat ? c6 : '';
        rawBal = c5IsSat ? c6 : c6IsSat ? '' : c5 || c6;
      }
    } else {
      ({ rawCode, rawName, rawParent, rawSat, rawTypeOrNat, rawBal } = parseContpaqiSpaceLine(rawLine));
    }

    if (!isValidMigrationAccountCode(rawCode)) {
      skipped.push({ lineNumber: idx + 1, rawLine, reason: `Código CONTPAQi inválido "${rawCode}"` });
      continue;
    }
    if (!rawName) {
      skipped.push({ lineNumber: idx + 1, rawLine, reason: `Falta el nombre de la cuenta ${rawCode}` });
      continue;
    }

    const { type, nature } = resolveContpaqiTypeAndNature(rawCode, rawTypeOrNat);
    const level = inferLevelFromCode(rawCode);
    const parsedBal = Number(rawBal.replace(/[$,\s]/g, ''));

    tempRows.push({
      code: rawCode,
      name: rawName,
      parentCode: rawParent && isValidMigrationAccountCode(rawParent) ? rawParent : undefined,
      satGroupCode: rawSat || undefined,
      type,
      nature,
      level,
      initialBalance: Number.isFinite(parsedBal) ? parsedBal : 0
    });
  }

  const knownCodes = new Set(tempRows.map((r) => r.code));
  const withParents = tempRows.map((r) => ({
    ...r,
    parentCode: r.parentCode !== undefined ? r.parentCode : inferParentCodeFromSet(r.code, knownCodes)
  }));
  const parentSet = new Set(withParents.map((r) => r.parentCode).filter((p): p is string => Boolean(p)));
  const rows = withParents.map((r) => ({
    ...r,
    isAffectable: (r.level ?? 1) >= 3 || ((r.level ?? 1) === 2 && !parentSet.has(r.code))
  }));

  return { format: 'CONTPAQI_TXT', rows, skipped };
}
