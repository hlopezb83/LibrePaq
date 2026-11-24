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
      const match = rawLine.match(/^C\s+(\S+)\s+(.+)$/i);
      if (match) {
        rawCode = normalizeMigrationAccountCode(match[1] ?? '');
        const rest = (match[2] ?? '').trim();
        const satTrail = rest.match(/\s+(\d{3}\.\d{2})$/);
        if (satTrail) {
          rawSat = satTrail[1] ?? '';
          rawName = rest.slice(0, satTrail.index).trim();
        } else {
          rawName = rest;
        }
      }
    }

    if (!isValidMigrationAccountCode(rawCode)) {
      skipped.push({ lineNumber: idx + 1, rawLine, reason: `Código CONTPAQi inválido "${rawCode}"` });
      continue;
    }
    if (!rawName) {
      skipped.push({ lineNumber: idx + 1, rawLine, reason: `Falta el nombre de la cuenta ${rawCode}` });
      continue;
    }

    const type = inferTypeFromCode(rawCode, rawTypeOrNat);
    const nature = inferNatureFromType(type, rawTypeOrNat);
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
      isAffectable: level >= 3,
      initialBalance: Number.isFinite(parsedBal) ? parsedBal : 0
    });
  }

  const knownCodes = new Set(tempRows.map((r) => r.code));
  const rows = tempRows.map((r) => ({
    ...r,
    parentCode: r.parentCode !== undefined ? r.parentCode : inferParentCodeFromSet(r.code, knownCodes)
  }));

  return { format: 'CONTPAQI_TXT', rows, skipped };
}
