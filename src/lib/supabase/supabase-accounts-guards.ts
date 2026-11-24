import { MESES_SAT } from '../../shared/sat-constants';
import { getRequiredSupabase } from '../supabase';

export async function assertNoLockedPeriodsInSupabase(
  companyId: string,
  actionDesc = 'realizar cambios estructurales en cuentas'
): Promise<void> {
  const client = getRequiredSupabase();
  const { data, error } = await client
    .from('period_locks')
    .select('ejercicio, periodo')
    .eq('company_id', companyId)
    .eq('is_locked', true)
    .order('ejercicio', { ascending: true })
    .order('periodo', { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`[Supabase Candado] No se pudo verificar el estado de periodos: ${error.message}`);
  }

  const locked = (data || [])[0] as { ejercicio: number; periodo: number } | undefined;
  if (locked) {
    const mesNombre =
      MESES_SAT.find((m) => m.periodo === locked.periodo)?.nombre || `Periodo ${locked.periodo}`;
    throw new Error(
      `El periodo contable ${mesNombre} ${locked.ejercicio} está CERRADO con candado fiscal. Ábrelo primero si necesitas ${actionDesc}.`
    );
  }
}

export async function assertAccountHasNoMovementsInSupabase(accountId: string): Promise<void> {
  const client = getRequiredSupabase();
  const { count, error } = await client
    .from('poliza_movements')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
  if (count && count > 0) {
    throw new Error(
      'No se puede cambiar la naturaleza o rubro de una cuenta que ya tiene movimientos contables registrados.'
    );
  }
}

export async function assertAccountHasNoBankLinesInSupabase(accountId: string): Promise<void> {
  const client = getRequiredSupabase();
  const { count, error } = await client
    .from('bank_statement_lines')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
  if (count && count > 0) {
    throw new Error(
      'No se puede eliminar la cuenta porque tiene movimientos de estado de cuenta bancario registrados.'
    );
  }
}
