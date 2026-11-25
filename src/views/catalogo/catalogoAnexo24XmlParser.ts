import { XMLParser } from 'fast-xml-parser';
import { fromCents, toCents } from '../../shared/accounting-engine';
import { SAFETY_BOUNDS } from '../../shared/sat-constants';
import type { AccountWithBalance } from '../../shared/types';
import type { CatalogoCsvSkippedRow, ParsedCatalogoCsvRow } from './catalogoCsvIo';
import {
  inferLevelFromCode,
  inferNatureFromType,
  inferParentCodeFromSet,
  inferTypeFromCode,
  normalizeMigrationAccountCode,
  type CatalogoMigrationParseResult
} from './catalogoMigrationParsers';

function isValidAnexo24AccountCode(code: string): boolean {
  return (
    /^[A-Za-z0-9]{1,8}(?:[.-][A-Za-z0-9]{1,8}){1,4}$/.test(code) ||
    /^[A-Za-z0-9]{2,20}$/.test(code)
  );
}

function asArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export function parseAnexo24XmlCatalogOrBalanza(
  xmlText: string,
  existingAccounts: readonly AccountWithBalance[] = [],
  options?: { bnBalanceField?: 'SaldoIni' | 'SaldoFin' }
): CatalogoMigrationParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    isArray: (name) => name === 'Ctas'
  });
  const parsed = parser.parse(xmlText) as Record<string, unknown>;

  if (parsed.Catalogo && typeof parsed.Catalogo === 'object') {
    const cat = parsed.Catalogo as Record<string, unknown>;
    const anio = cat['@_Anio'] ? String(cat['@_Anio']) : undefined;
    const mes = cat['@_Mes'] ? String(cat['@_Mes']).padStart(2, '0') : undefined;
    const ctas = asArray(cat.Ctas as Record<string, unknown>[]);
    const rawRows: ParsedCatalogoCsvRow[] = [];
    const skipped: CatalogoCsvSkippedRow[] = [];

    ctas.forEach((node, idx) => {
      const code = normalizeMigrationAccountCode(String(node['@_NumCta'] ?? ''));
      const name = String(node['@_Desc'] ?? '').trim();
      if (!isValidAnexo24AccountCode(code) || !name) {
        skipped.push({
          lineNumber: idx + 1,
          rawLine: `${code} ${name}`.trim(),
          reason: 'Nodo Ctas de CT.xml sin NumCta válido o Desc'
        });
        return;
      }
      const subCtaDe = node['@_SubCtaDe']
        ? normalizeMigrationAccountCode(String(node['@_SubCtaDe']))
        : null;
      const nivelNum = Number(node['@_Nivel'] ?? 0);
      const level =
        Number.isInteger(nivelNum) && nivelNum >= 1 && nivelNum <= SAFETY_BOUNDS.MAX_ACCOUNT_LEVEL
          ? nivelNum
          : inferLevelFromCode(code);
      const type = inferTypeFromCode(code);
      const nature = inferNatureFromType(type, String(node['@_Natur'] ?? ''));

      rawRows.push({
        code,
        name,
        parentCode: subCtaDe,
        satGroupCode: node['@_CodAgrup'] ? String(node['@_CodAgrup']).trim() : undefined,
        type,
        nature,
        level,
        initialBalance: 0
      });
    });

    const parentSet = new Set(rawRows.map((r) => r.parentCode).filter((p): p is string => Boolean(p)));
    const rows = rawRows.map((r) => ({
      ...r,
      isAffectable: !parentSet.has(r.code) && (r.level ?? 1) >= 2
    }));

    return {
      format: 'ANEXO24_CT_XML',
      rows,
      skipped,
      fechaInicioOperaciones: anio && mes ? `${anio}-${mes}` : undefined
    };
  }

  if (parsed.Balanza && typeof parsed.Balanza === 'object') {
    const bal = parsed.Balanza as Record<string, unknown>;
    const anio = bal['@_Anio'] ? String(bal['@_Anio']) : undefined;
    const mes = bal['@_Mes'] ? String(bal['@_Mes']).padStart(2, '0') : undefined;
    const ctas = asArray(bal.Ctas as Record<string, unknown>[]);
    const existingByCode = new Map(existingAccounts.map((a) => [a.code, a]));

    const balanceField = options?.bnBalanceField ?? 'SaldoIni';
    const parsedNodes: Array<{
      row: ParsedCatalogoCsvRow;
      selectedBalCents: number;
      debeCents: number;
      haberCents: number;
      hasExplicitAffectable: boolean;
    }> = [];
    const skipped: CatalogoCsvSkippedRow[] = [];

    ctas.forEach((node, idx) => {
      const code = normalizeMigrationAccountCode(String(node['@_NumCta'] ?? ''));
      if (!isValidAnexo24AccountCode(code)) {
        skipped.push({
          lineNumber: idx + 1,
          rawLine: String(node['@_NumCta'] ?? ''),
          reason: 'Nodo Ctas de BN.xml sin NumCta válido'
        });
        return;
      }
      const ex = existingByCode.get(code);
      const type = ex?.type ?? inferTypeFromCode(code);
      const nature = ex?.nature ?? inferNatureFromType(type);
      const level = ex?.level ?? inferLevelFromCode(code);
      const saldoIniCents = toCents(Number(node['@_SaldoIni'] ?? 0));
      const saldoFinCents = toCents(Number(node['@_SaldoFin'] ?? node['@_SaldoIni'] ?? 0));
      const selectedBalCents = balanceField === 'SaldoFin' ? saldoFinCents : saldoIniCents;
      const debeCents = toCents(Number(node['@_Debe'] ?? 0));
      const haberCents = toCents(Number(node['@_Haber'] ?? 0));

      parsedNodes.push({
        row: {
          code,
          name: ex?.name ?? `Cuenta ${code}`,
          parentCode: ex?.parentCode ?? undefined,
          satGroupCode: ex?.satGroupCode ?? code.slice(0, 3),
          type,
          nature,
          level,
          isAffectable: ex?.isAffectable,
          initialBalance: fromCents(selectedBalCents)
        },
        selectedBalCents,
        debeCents,
        haberCents,
        hasExplicitAffectable: ex !== undefined
      });
    });

    const knownCodes = new Set(parsedNodes.map((n) => n.row.code));
    const parentInXml = new Set<string>();
    for (const n of parsedNodes) {
      const inferredParent = n.row.parentCode ?? inferParentCodeFromSet(n.row.code, knownCodes);
      if (inferredParent) parentInXml.add(inferredParent);
      n.row.parentCode = inferredParent;
    }
    for (const n of parsedNodes) {
      if (!n.hasExplicitAffectable) {
        const lvl = n.row.level ?? 1;
        n.row.isAffectable = !parentInXml.has(n.row.code) && lvl >= 2;
      }
    }

    const leafNodes = parsedNodes.filter(
      (n) => !parentInXml.has(n.row.code) && n.row.isAffectable !== false
    );
    const nodesForBalance = leafNodes.length > 0 ? leafNodes : parsedNodes;

    let totalDeudorCents = 0;
    let totalAcreedorCents = 0;
    let totalDebeCents = 0;
    let totalHaberCents = 0;
    for (const n of nodesForBalance) {
      if (n.row.nature === 'DEUDORA') totalDeudorCents += n.selectedBalCents;
      else totalAcreedorCents += n.selectedBalCents;
      totalDebeCents += n.debeCents;
      totalHaberCents += n.haberCents;
    }

    const maxDiff = Math.max(
      Math.abs(totalDeudorCents - totalAcreedorCents),
      Math.abs(totalDebeCents - totalHaberCents)
    );

    return {
      format: 'ANEXO24_BN_XML',
      rows: parsedNodes.map((n) => n.row),
      skipped,
      fechaInicioOperaciones: anio && mes ? `${anio}-${mes}` : undefined,
      balanzaValidation: {
        totalDeudor: fromCents(totalDeudorCents),
        totalAcreedor: fromCents(totalAcreedorCents),
        totalDebe: fromCents(totalDebeCents),
        totalHaber: fromCents(totalHaberCents),
        isBalanced: maxDiff === 0,
        difference: fromCents(maxDiff),
        anio,
        mes,
        balanceField
      }
    };
  }

  return {
    format: 'ANEXO24_CT_XML',
    rows: [],
    skipped: [{ lineNumber: 1, rawLine: '', reason: 'El XML no corresponde a un Catálogo de Cuentas (CT.xml) ni Balanza de Comprobación (BN.xml) Anexo 24 del SAT.' }]
  };
}
