import { getRequiredSupabase } from '../supabase';
import type { BankStatementLine } from '../../shared/types';

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
 * Consulta bank_statement_matches para marcar como conciliados TODOS los movement_id (1..N)
 * vinculados a líneas activas en cruces Varios-a-1.
 */
export async function fetchActiveN1MatchedMovementIds(
  companyId: string,
  activeStatementLineIds: ReadonlySet<string>
): Promise<Set<string>> {
  const result = new Set<string>();
  if (activeStatementLineIds.size === 0) return result;
  const { data, error } = await getRequiredSupabase()
    .from('bank_statement_matches')
    .select('bank_line_id, movement_id')
    .eq('company_id', companyId);

  if (error || !data) return result;
  for (const row of data as Array<{ bank_line_id?: string; movement_id?: string }>) {
    if (row.bank_line_id && row.movement_id && activeStatementLineIds.has(String(row.bank_line_id))) {
      result.add(String(row.movement_id));
    }
  }
  return result;
}
