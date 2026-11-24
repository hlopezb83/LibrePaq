import type { QueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { downloadCsvFile } from '../../lib/formatters';
import { splitCsvLine } from '../../shared/csv-bank-parser';
import type { AccountNature, AccountType, AccountWithBalance } from '../../shared/types';
import {
  inferLevelFromCode,
  inferParentCodeFromSet,
  isContpaqiCatalogTxt,
  isValidMigrationAccountCode,
  normalizeMigrationAccountCode,
  parseAnexo24XmlCatalogOrBalanza,
  parseContpaqiTxtCatalog,
  type BalanzaValidationSummary,
  type CatalogoFileFormat
} from './catalogoMigrationParsers';

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

export interface CatalogoCsvSkippedRow {
  lineNumber: number;
  rawLine: string;
  reason: string;
}

export interface CatalogoCsvImportPreview {
  fileName: string;
  fileFormat?: CatalogoFileFormat;
  balanzaValidation?: BalanzaValidationSummary;
  fechaInicioOperaciones?: string;
  toCreate: ParsedCatalogoCsvRow[];
  toUpdate: ParsedCatalogoCsvRow[];
  skipped: CatalogoCsvSkippedRow[];
  allValidRows: ParsedCatalogoCsvRow[];
}

const VALID_TYPES = new Set<AccountType>(['ACTIVO', 'PASIVO', 'CAPITAL', 'INGRESOS', 'COSTOS', 'GASTOS', 'ORDEN']);

export const isValidAccountMask = isValidMigrationAccountCode;

function parseBoolColumn(raw: string | undefined): boolean | undefined {
  const val = (raw ?? '').trim().toLowerCase();
  if (!val) return undefined;
  if (['sí', 'si', 's', 'true', '1', 'yes', 'y'].includes(val)) return true;
  if (['no', 'n', 'false', '0'].includes(val)) return false;
  return undefined;
}

function detectCatalogoCsvDelimiter(sampleLine: string): ',' | ';' {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  for (let i = 0; i < sampleLine.length; i += 1) {
    const ch = sampleLine[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === ';') semicolons += 1;
      else if (ch === ',') commas += 1;
    }
  }
  return semicolons > commas ? ';' : ',';
}

export function parseCatalogoCsvWithReport(text: string): {
  rows: ParsedCatalogoCsvRow[];
  skipped: CatalogoCsvSkippedRow[];
} {
  const cleanText = text.replace(/^\uFEFF/, '');
  const rawLines = cleanText.split(/\r?\n/);
  const indexedLines = rawLines
    .map((l, idx) => ({ text: l.trim(), lineNumber: idx + 1 }))
    .filter((entry) => Boolean(entry.text));
  if (indexedLines.length === 0) return { rows: [], skipped: [] };

  const delimiter = detectCatalogoCsvDelimiter(indexedLines[0]!.text);
  const firstCols = splitCsvLine(indexedLines[0]!.text, delimiter).map((c) => c.trim().toLowerCase());
  const hasHeader =
    firstCols[0]?.includes('código') ||
    firstCols[0]?.includes('codigo') ||
    firstCols[0]?.includes('cuenta');
  const startIdx = hasHeader ? 1 : 0;

  const findCol = (patterns: string[], fallbackIdx: number) => {
    if (!hasHeader) return fallbackIdx;
    for (const p of patterns) {
      const exactIdx = firstCols.findIndex((h) => h === p);
      if (exactIdx >= 0) return exactIdx;
      const partialIdx = firstCols.findIndex((h) => h.includes(p));
      if (partialIdx >= 0) return partialIdx;
    }
    return fallbackIdx;
  };

  const colCode = findCol(['código cuenta', 'codigo cuenta', 'codigo', 'cuenta'], 0);
  const colName = findCol(['nombre'], 1);
  const colSat = findCol(['agrupador', 'sat'], 2);
  const colType = findCol(['rubro', 'tipo'], 3);
  const colNature = findCol(['naturaleza'], 4);
  const colLevel = findCol(['nivel'], 5);
  const colAffectable = findCol(['afectable'], 6);
  const colBalance = findCol(['saldo apertura enero', 'apertura enero', 'saldo inicial', 'inicial'], 7);
  const colParent = hasHeader
    ? firstCols.findIndex((h) => h.includes('padre') || h.includes('parent'))
    : 11;

  const tempRows: ParsedCatalogoCsvRow[] = [];
  const skipped: CatalogoCsvSkippedRow[] = [];
  for (let i = startIdx; i < indexedLines.length; i += 1) {
    const { text: rawLine, lineNumber } = indexedLines[i]!;
    const cols = splitCsvLine(rawLine, delimiter);
    const rawCode = normalizeMigrationAccountCode(cols[colCode] ?? '');
    const rawName = (cols[colName] ?? '').trim();
    if (!isValidAccountMask(rawCode)) {
      skipped.push({
        lineNumber,
        rawLine,
        reason: `Código inválido "${cols[colCode] ?? ''}" (usa formato jerárquico ej. 601-01-001)`
      });
      continue;
    }
    if (!rawName) {
      skipped.push({
        lineNumber,
        rawLine,
        reason: `Falta el nombre de la cuenta para el código ${rawCode}`
      });
      continue;
    }

    const rawType = (cols[colType] ?? '').trim().toUpperCase() as AccountType;
    const parsedType = VALID_TYPES.has(rawType) ? rawType : undefined;
    const rawNature = (cols[colNature] ?? '').trim().toUpperCase();
    const parsedNature: AccountNature | undefined =
      rawNature === 'ACREEDORA' || rawNature === 'ACREEDOR' || rawNature === 'A'
        ? 'ACREEDORA'
        : rawNature === 'DEUDORA' || rawNature === 'DEUDOR' || rawNature === 'D'
          ? 'DEUDORA'
          : undefined;

    const parsedLevelNum = Number((cols[colLevel] ?? '').trim());
    const level =
      Number.isInteger(parsedLevelNum) && parsedLevelNum >= 1 && parsedLevelNum <= 5
        ? parsedLevelNum
        : inferLevelFromCode(rawCode);

    const parsedAff = parseBoolColumn(cols[colAffectable]);
    const isAffectable = parsedAff !== undefined ? parsedAff : level >= 3;

    const rawBalText = (cols[colBalance] ?? '').trim();
    const isParenNeg = /^\(.*\)$/.test(rawBalText);
    const cleanedBalText = rawBalText.replace(/[$,()\s]/g, '');
    const parsedBal = cleanedBalText ? Number(cleanedBalText) : 0;
    const rawBalVal = Number.isFinite(parsedBal) ? (isParenNeg ? -Math.abs(parsedBal) : parsedBal) : 0;
    const rawParent = colParent >= 0 ? normalizeMigrationAccountCode(cols[colParent] ?? '') : '';

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
  const rows = tempRows.map((r) => ({
    ...r,
    parentCode: r.parentCode !== undefined ? r.parentCode : inferParentCodeFromSet(r.code, knownCodes)
  }));
  return { rows, skipped };
}

export function parseCatalogoCsvText(text: string): ParsedCatalogoCsvRow[] {
  const clean = text.replace(/^\uFEFF/, '').trimStart();
  if (clean.startsWith('<')) {
    return parseAnexo24XmlCatalogOrBalanza(clean).rows;
  }
  if (isContpaqiCatalogTxt(clean)) {
    return parseContpaqiTxtCatalog(clean).rows;
  }
  return parseCatalogoCsvWithReport(text).rows;
}

export function buildCatalogoImportPreview(
  fileName: string,
  text: string,
  existingAccounts: AccountWithBalance[]
): CatalogoCsvImportPreview {
  const trimmed = text.replace(/^\uFEFF/, '').trimStart();
  const isXml = fileName.toLowerCase().endsWith('.xml') || trimmed.startsWith('<');
  let fileFormat: CatalogoFileFormat = 'CSV';
  let rows: ParsedCatalogoCsvRow[] = [];
  let skipped: CatalogoCsvSkippedRow[] = [];
  let balanzaValidation: BalanzaValidationSummary | undefined;
  let fechaInicioOperaciones: string | undefined;

  if (isXml) {
    const parsedXml = parseAnexo24XmlCatalogOrBalanza(trimmed, existingAccounts);
    fileFormat = parsedXml.format;
    rows = parsedXml.rows;
    skipped = parsedXml.skipped;
    balanzaValidation = parsedXml.balanzaValidation;
    fechaInicioOperaciones = parsedXml.fechaInicioOperaciones;
  } else if (isContpaqiCatalogTxt(trimmed)) {
    const parsedTxt = parseContpaqiTxtCatalog(trimmed);
    fileFormat = parsedTxt.format;
    rows = parsedTxt.rows;
    skipped = parsedTxt.skipped;
  } else {
    const parsedCsv = parseCatalogoCsvWithReport(text);
    rows = parsedCsv.rows;
    skipped = parsedCsv.skipped;
  }

  const existingCodes = new Set(existingAccounts.map((a) => a.code));
  const toCreate: ParsedCatalogoCsvRow[] = [];
  const toUpdate: ParsedCatalogoCsvRow[] = [];
  for (const row of rows) {
    if (existingCodes.has(row.code)) {
      toUpdate.push(row);
    } else {
      toCreate.push(row);
    }
  }
  return {
    fileName,
    fileFormat,
    balanzaValidation,
    fechaInicioOperaciones,
    toCreate,
    toUpdate,
    skipped,
    allValidRows: rows
  };
}

export function downloadCatalogoTemplateCsv() {
  const headers = [
    'Código Cuenta',
    'Nombre de la Cuenta',
    'Código Agrupador SAT',
    'Rubro',
    'Naturaleza',
    'Nivel',
    'Afectable',
    'Saldo Inicial',
    'Cuenta Padre'
  ];
  const rows = [
    ['601-00-000', 'Gastos Generales', '601.01', 'GASTOS', 'DEUDORA', 2, 'No', 0, '600-00-000'],
    ['601-01-099', 'Gastos de Publicidad Digital', '601.84', 'GASTOS', 'DEUDORA', 3, 'Sí', 0, '601-00-000']
  ];
  downloadCsvFile('Plantilla_Catalogo_Cuentas_SAT.csv', headers, rows);
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
    'Saldo Apertura Enero',
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
    a.initialBalance,
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

export async function confirmImportCatalogoRows(
  parsedRows: ParsedCatalogoCsvRow[],
  companyId: string,
  queryClient: QueryClient,
  toast: { success: (title: string, desc?: string) => void; error: (title: string, desc?: string) => void }
) {
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

export async function importCatalogoCsvFile(
  file: File,
  companyId: string,
  queryClient: QueryClient,
  toast: { success: (title: string, desc?: string) => void; error: (title: string, desc?: string) => void }
) {
  const parsedRows = parseCatalogoCsvText(await file.text());
  await confirmImportCatalogoRows(parsedRows, companyId, queryClient, toast);
}
