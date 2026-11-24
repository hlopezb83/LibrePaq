import type { QueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { downloadCsvFile } from '../../lib/formatters';
import { splitCsvLine } from '../../shared/csv-bank-parser';
import type { AccountNature, AccountType, AccountWithBalance } from '../../shared/types';

export interface ParsedCatalogoCsvRow {
  code: string;
  name: string;
  parentCode?: string | null;
  satGroupCode?: string;
  type?: AccountType;
  nature?: AccountNature;
  level?: number;
  isAffectable?: boolean;
  initialBalance?: number;
}

const VALID_TYPES = new Set<AccountType>(['ACTIVO', 'PASIVO', 'CAPITAL', 'INGRESOS', 'COSTOS', 'GASTOS']);

function normalizeAccountCode(rawInput: string): string {
  const clean = rawInput.trim();
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 8)}`;
  }
  if (/^\d{11}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 7)}-${clean.slice(7, 11)}`;
  }
  return clean;
}

function isValidAccountMask(code: string): boolean {
  return /^[A-Za-z0-9]{2,6}(-[A-Za-z0-9]{1,6}){1,4}$/.test(code);
}

function inferLevelFromMask(code: string): number {
  const parts = code.split('-');
  if (parts.length <= 1) return 1;
  let nonZeroCount = 0;
  for (const seg of parts) {
    if (!/^0+$/.test(seg)) nonZeroCount += 1;
  }
  return Math.max(1, Math.min(4, nonZeroCount));
}

function inferParentFromCode(code: string, knownCodes: Set<string>): string | null {
  const parts = code.split('-');
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    if (/^0+$/.test(parts[i]!)) continue;
    const candidateParts = parts.map((seg, idx) => (idx >= i ? '0'.repeat(seg.length) : seg));
    const candidate = candidateParts.join('-');
    if (candidate !== code && knownCodes.has(candidate)) {
      return candidate;
    }
  }
  if (parts.length > 3) {
    const truncated = parts.slice(0, parts.length - 1).join('-');
    if (knownCodes.has(truncated)) return truncated;
  }
  return null;
}

function parseBoolColumn(raw: string | undefined): boolean | undefined {
  const val = (raw ?? '').trim().toLowerCase();
  if (!val) return undefined;
  if (['sí', 'si', 's', 'true', '1', 'yes', 'y'].includes(val)) return true;
  if (['no', 'n', 'false', '0'].includes(val)) return false;
  return undefined;
}

export function parseCatalogoCsvText(text: string): ParsedCatalogoCsvRow[] {
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const firstCols = splitCsvLine(lines[0]!).map((c) => c.trim().toLowerCase());
  const hasHeader =
    firstCols[0]?.includes('código') ||
    firstCols[0]?.includes('codigo') ||
    firstCols[0]?.includes('cuenta');
  const startIdx = hasHeader ? 1 : 0;

  const findCol = (patterns: string[], fallbackIdx: number) => {
    if (!hasHeader) return fallbackIdx;
    const idx = firstCols.findIndex((h) => patterns.some((p) => h.includes(p)));
    return idx >= 0 ? idx : fallbackIdx;
  };

  const colCode = findCol(['código cuenta', 'codigo cuenta', 'codigo', 'cuenta'], 0);
  const colName = findCol(['nombre'], 1);
  const colSat = findCol(['agrupador', 'sat'], 2);
  const colType = findCol(['rubro', 'tipo'], 3);
  const colNature = findCol(['naturaleza'], 4);
  const colLevel = findCol(['nivel'], 5);
  const colAffectable = findCol(['afectable'], 6);
  const colBalance = findCol(['saldo inicial', 'inicial'], 7);
  const colParent = hasHeader
    ? firstCols.findIndex((h) => h.includes('padre') || h.includes('parent'))
    : 11;

  const tempRows: ParsedCatalogoCsvRow[] = [];
  for (let i = startIdx; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]!);
    const rawCode = normalizeAccountCode(cols[colCode] ?? '');
    const rawName = (cols[colName] ?? '').trim();
    if (!isValidAccountMask(rawCode) || !rawName) continue;

    const rawType = (cols[colType] ?? '').trim().toUpperCase() as AccountType;
    const parsedType = VALID_TYPES.has(rawType) ? rawType : undefined;
    const rawNature = (cols[colNature] ?? '').trim().toUpperCase();
    const parsedNature: AccountNature | undefined =
      rawNature === 'ACREEDORA' ? 'ACREEDORA' : rawNature === 'DEUDORA' ? 'DEUDORA' : undefined;

    const parsedLevelNum = Number((cols[colLevel] ?? '').trim());
    const level =
      Number.isInteger(parsedLevelNum) && parsedLevelNum >= 1 && parsedLevelNum <= 5
        ? parsedLevelNum
        : inferLevelFromMask(rawCode);

    const parsedAff = parseBoolColumn(cols[colAffectable]);
    const isAffectable = parsedAff !== undefined ? parsedAff : level >= 3;

    const rawBalVal = cols[colBalance] !== undefined ? Number(cols[colBalance]) : 0;
    const rawParent = colParent >= 0 ? normalizeAccountCode(cols[colParent] ?? '') : '';

    tempRows.push({
      code: rawCode,
      name: rawName,
      parentCode: rawParent || undefined,
      satGroupCode: (cols[colSat] ?? '').trim() || undefined,
      type: parsedType,
      nature: parsedNature,
      level,
      isAffectable,
      initialBalance: Number.isFinite(rawBalVal) ? rawBalVal : 0
    });
  }

  const knownCodes = new Set(tempRows.map((r) => r.code));
  return tempRows.map((r) => ({
    ...r,
    parentCode: r.parentCode !== undefined ? r.parentCode : inferParentFromCode(r.code, knownCodes)
  }));
}

export function exportCatalogoCsv(
  accounts: AccountWithBalance[],
  rfcOrId: string,
  year?: number,
  period?: number
) {
  const headers = [
    'Código Cuenta',
    'Nombre de la Cuenta',
    'Código Agrupador SAT',
    'Rubro',
    'Naturaleza',
    'Nivel',
    'Afectable',
    'Saldo Inicial Acumulado',
    'Cargos del Periodo',
    'Abonos del Periodo',
    'Saldo Final',
    'Cuenta Padre'
  ];
  const rows = accounts.map((a) => [
    a.code,
    a.name,
    a.satGroupCode,
    a.type,
    a.nature,
    a.level,
    a.isAffectable ? 'Sí' : 'No',
    a.initialBalanceComputed,
    a.periodCharges,
    a.periodCredits,
    a.finalBalance,
    a.parentCode || ''
  ]);
  const pStr = period ? `_P${String(period).padStart(2, '0')}` : '';
  downloadCsvFile(
    `Catalogo_Cuentas_${rfcOrId}_${year || 2026}${pStr}.csv`,
    headers,
    rows
  );
}

export async function importCatalogoCsvFile(
  file: File,
  companyId: string,
  queryClient: QueryClient,
  toast: { success: (title: string, desc?: string) => void; error: (title: string, desc?: string) => void }
) {
  const parsedRows = parseCatalogoCsvText(await file.text());

  if (parsedRows.length === 0) {
    toast.error(
      'Importación fallida',
      'No se detectaron cuentas válidas (ej. XXX-XX-XXX o XXXX-XXX-XXXX) en el archivo CSV.'
    );
    return;
  }

  const res = await apiClient.batchImportAccounts(companyId, parsedRows);
  invalidateAccountingQueries(queryClient, ['accounts', 'reports', 'dashboard']);
  toast.success(
    'Catálogo Importado',
    `Importación completada: ${res.importedCount} cuentas creadas (${res.updatedCount} actualizadas).`
  );
}
