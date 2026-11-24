import { getRequiredSupabase } from '../supabase';
import type { BankStatementLine } from '../../shared/types';
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
 * vinculados a líneas activas en cruces Varios-a-1.
 */
export async function fetchActiveN1MatchedMovementIds(
  companyId: string,
  activeStatementLineIds: ReadonlySet<string>
): Promise<Set<string>> {
  const result = new Set<string>();
  if (activeStatementLineIds.size === 0) return result;
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
      result.add(String(row.movement_id));
    }
  }
  return result;
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
