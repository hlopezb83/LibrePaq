import { getRequiredSupabase } from '../supabase';
import type { BankReconciliationResponse, BankStatementLine, Poliza } from '../../shared/types';
import { fetchAllRows } from './supabase-pagination';

export function mapBankStatementLine(
  l: Record<string, unknown>,
  fallbackAccountId: string
): BankStatementLine {
  return {
    id: String(l.id),
    companyId: String(l.company_id),
    accountId: String(l.account_id || fallbackAccountId),
    fecha: String(l.fecha),
    ejercicio: Number(l.ejercicio),
    periodo: Number(l.periodo),
    referencia: String(l.referencia || ''),
    descripcion: String(l.descripcion || ''),
    cargoBanco: Number(l.cargo_banco || 0),
    abonoBanco: Number(l.abono_banco || 0),
    matchedMovementId: l.matched_movement_id ? String(l.matched_movement_id) : null,
    matchedPolizaFolio: l.matched_poliza_folio ? String(l.matched_poliza_folio) : null
  };
}

/**
 * Consulta paginada a bank_statement_matches para marcar como conciliados TODOS los movement_id (1..N)
 * vinculados a líneas activas en cruces Varios-a-1, incluyendo su mapa por bank_line_id.
 */
export async function fetchActiveN1MatchedMap(
  companyId: string,
  activeStatementLineIds: ReadonlySet<string>
): Promise<{ matchedIds: Set<string>; byLineId: Map<string, string[]> }> {
  const matchedIds = new Set<string>();
  const byLineId = new Map<string, string[]>();
  if (activeStatementLineIds.size === 0) return { matchedIds, byLineId };
  const rows = await fetchAllRows(async (from, to) =>
    getRequiredSupabase()
      .from('bank_statement_matches')
      .select('bank_line_id, movement_id')
      .eq('company_id', companyId)
      .order('id', { ascending: true })
      .range(from, to)
  );

  for (const row of rows as Array<{ bank_line_id?: string; movement_id?: string }>) {
    if (row.bank_line_id && row.movement_id && activeStatementLineIds.has(String(row.bank_line_id))) {
      const lineId = String(row.bank_line_id);
      const movId = String(row.movement_id);
      matchedIds.add(movId);
      const list = byLineId.get(lineId) ?? [];
      list.push(movId);
      byLineId.set(lineId, list);
    }
  }
  return { matchedIds, byLineId };
}

export async function fetchActiveN1MatchedMovementIds(
  companyId: string,
  activeStatementLineIds: ReadonlySet<string>
): Promise<Set<string>> {
  const { matchedIds } = await fetchActiveN1MatchedMap(companyId, activeStatementLineIds);
  return matchedIds;
}

/**
 * Impide asignar el mismo movimiento contable a múltiples líneas bancarias (1-a-1 o Varios-a-1).
 */
export async function assertMovementNotAlreadyMatched(
  companyId: string,
  movementId: string,
  targetLineId: string
): Promise<void> {
  const client = getRequiredSupabase();
  const { data: lineMatches, error: lineErr } = await client
    .from('bank_statement_lines')
    .select('id')
    .eq('company_id', companyId)
    .eq('matched_movement_id', movementId)
    .neq('id', targetLineId)
    .limit(1);
  if (lineErr) throw new Error(lineErr.message);
  if ((lineMatches ?? []).length > 0) {
    throw new Error('Este movimiento contable ya está conciliado con otra línea bancaria.');
  }

  const { data: n1Matches, error: n1Err } = await client
    .from('bank_statement_matches')
    .select('id, bank_line_id')
    .eq('company_id', companyId)
    .eq('movement_id', movementId)
    .neq('bank_line_id', targetLineId)
    .limit(1);
  if (n1Err) throw new Error(n1Err.message);
  if ((n1Matches ?? []).length > 0) {
    throw new Error('Este movimiento contable ya forma parte de un cruce bancario N-a-1.');
  }
}

export interface IncomingBankCsvLine {
  fecha: string;
  referencia: string;
  descripcion: string;
  cargoBanco: number;
  abonoBanco: number;
}

function bankLineOccurrenceKey(item: {
  fecha: unknown;
  concepto: unknown;
  cargo: unknown;
  abono: unknown;
}): string {
  const fecha = String(item.fecha || '').slice(0, 10);
  const concepto = String(item.concepto || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const cargo = Number(item.cargo || 0).toFixed(2);
  const abono = Number(item.abono || 0).toFixed(2);
  return `${fecha}|${concepto}|${cargo}|${abono}`;
}

/**
 * Deduplica movimientos bancarios por conteo de ocurrencias sobre `(fecha, concepto, cargo, abono)`,
 * preservando cargos/abonos repetidos legítimos en el mismo día (ej. dos comisiones o retiros idénticos).
 */
export function deduplicateBankLinesByOccurrence<T extends IncomingBankCsvLine>(
  incoming: readonly T[],
  existing: ReadonlyArray<{
    fecha?: unknown;
    descripcion?: unknown;
    cargo_banco?: unknown;
    abono_banco?: unknown;
  }>
): T[] {
  const existingCounts = new Map<string, number>();
  for (const row of existing) {
    const key = bankLineOccurrenceKey({
      fecha: row.fecha,
      concepto: row.descripcion,
      cargo: row.cargo_banco,
      abono: row.abono_banco
    });
    existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
  }
  const result: T[] = [];
  for (const line of incoming) {
    const key = bankLineOccurrenceKey({
      fecha: line.fecha,
      concepto: line.descripcion,
      cargo: line.cargoBanco,
      abono: line.abonoBanco
    });
    const remaining = existingCounts.get(key) ?? 0;
    if (remaining > 0) {
      existingCounts.set(key, remaining - 1);
    } else {
      result.push(line);
    }
  }
  return result;
}

export async function fetchBankClosureBalance(
  companyId: string,
  accountId: string,
  ejercicio: number,
  periodo: number
): Promise<number | null> {
  const { data, error } = await getRequiredSupabase()
    .from('bank_reconciliation_closures')
    .select('saldo_banco_cierre')
    .eq('company_id', companyId)
    .eq('account_id', accountId)
    .eq('ejercicio', ejercicio)
    .eq('periodo', periodo)
    .maybeSingle();
  if (error || !data || data.saldo_banco_cierre == null) return null;
  const n = Number(data.saldo_banco_cierre);
  return Number.isFinite(n) ? n : null;
}

export async function upsertBankClosureBalance(
  companyId: string,
  accountId: string,
  ejercicio: number,
  periodo: number,
  saldoBancoCierre: number
): Promise<void> {
  const { error } = await getRequiredSupabase()
    .from('bank_reconciliation_closures')
    .upsert(
      {
        id: `bclose_${companyId}_${accountId}_${ejercicio}_${periodo}`,
        company_id: companyId,
        account_id: accountId,
        ejercicio,
        periodo,
        saldo_banco_cierre: saldoBancoCierre,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'company_id,account_id,ejercicio,periodo' }
    );
  if (error) throw new Error(error.message);
}

export function buildBankReconciliationViewRows(params: {
  allMappedLines: BankStatementLine[];
  allPolizas: Poliza[];
  n1MatchedIds: ReadonlySet<string>;
  n1MovsByLineId?: ReadonlyMap<string, string[]>;
  accountId: string;
  accountCode: string;
  currentYear: number;
  currentPeriod: number;
}): {
  statementLines: BankStatementLine[];
  bookMovements: BankReconciliationResponse['bookMovements'];
} {
  const { allMappedLines, allPolizas, n1MatchedIds, n1MovsByLineId, accountId, accountCode, currentYear, currentPeriod } = params;
  const isPrior = (y: number, p: number) => y < currentYear || (y === currentYear && p < currentPeriod);
  const isCurrent = (y: number, p: number) => y === currentYear && p === currentPeriod;

  const matchedMovementIds = new Set<string>([
    ...(allMappedLines.map((l) => l.matchedMovementId).filter(Boolean) as string[]),
    ...n1MatchedIds
  ]);

  const polizasUpToPeriod = allPolizas.filter(
    (p) => isCurrent(p.ejercicio, p.periodo) || isPrior(p.ejercicio, p.periodo)
  );
  const currentPeriodMovIds = new Set<string>();
  const movementFolioMap = new Map<string, string>();
  for (const p of polizasUpToPeriod) {
    const pFolio = `${p.tipo} #${p.folio}`;
    const inCurrent = isCurrent(p.ejercicio, p.periodo);
    for (const m of p.movements) {
      movementFolioMap.set(m.id, pFolio);
      if (inCurrent) currentPeriodMovIds.add(m.id);
    }
  }

  const statementLines = allMappedLines.filter(
    (l) =>
      isCurrent(l.ejercicio, l.periodo) ||
      !l.matchedMovementId ||
      currentPeriodMovIds.has(l.matchedMovementId) ||
      (n1MovsByLineId?.get(l.id) ?? []).some((mid) => currentPeriodMovIds.has(mid))
  );
  const matchedInCurrentLineMovIds = new Set<string>();
  for (const l of statementLines) {
    if (!isCurrent(l.ejercicio, l.periodo) || !l.matchedMovementId) continue;
    matchedInCurrentLineMovIds.add(l.matchedMovementId);
    for (const mid of n1MovsByLineId?.get(l.id) ?? []) matchedInCurrentLineMovIds.add(mid);
  }

  const bookMovements: BankReconciliationResponse['bookMovements'] = [];
  for (const p of polizasUpToPeriod) {
    const pFolio = `${p.tipo} #${p.folio}`;
    const inCurrent = isCurrent(p.ejercicio, p.periodo);
    for (const m of p.movements) {
      if (m.accountId !== accountId && m.accountCode !== accountCode) continue;
      const isMatched = matchedMovementIds.has(m.id);
      if (!inCurrent && isMatched && !matchedInCurrentLineMovIds.has(m.id)) continue;
      bookMovements.push({
        movementId: m.id,
        polizaId: p.id,
        polizaFolio: pFolio,
        fecha: p.fecha,
        referencia: m.referencia || '',
        concepto: m.concepto || p.concepto,
        cargoContable: Number(m.cargo || 0),
        abonoContable: Number(m.abono || 0),
        isMatched
      });
    }
  }

  for (const line of statementLines) {
    if (line.matchedMovementId && !line.matchedPolizaFolio) {
      line.matchedPolizaFolio = movementFolioMap.get(line.matchedMovementId) ?? null;
    }
  }

  return { statementLines, bookMovements };
}
