import { getRequiredSupabase } from '../supabase';
import { toCents } from '../../shared/accounting-engine';
import { fetchAllRows } from './supabase-pagination';
import { assertMovementNotAlreadyMatched } from './supabase-bank-helpers';
import { assertSupabasePeriodOpen } from './supabase-polizas';

export interface VerifiedBankBookMovement {
  id: string;
  polizaId: string;
  accountId: string;
  cargo: number;
  abono: number;
}

export async function fetchAllMatchedMovementIdsAcrossPeriods(
  companyId: string
): Promise<Set<string>> {
  const sb = getRequiredSupabase();
  const [lineRows, n1Rows] = await Promise.all([
    fetchAllRows(async (from, to) =>
      sb
        .from('bank_statement_lines')
        .select('id, matched_movement_id')
        .eq('company_id', companyId)
        .not('matched_movement_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows(async (from, to) =>
      sb
        .from('bank_statement_matches')
        .select('bank_line_id, movement_id')
        .eq('company_id', companyId)
        .order('id', { ascending: true })
        .range(from, to)
    )
  ]);

  const activeLineIds = new Set<string>();
  const matchedIds = new Set<string>();
  for (const r of lineRows as Array<{ id?: unknown; matched_movement_id?: unknown }>) {
    if (r.id) activeLineIds.add(String(r.id));
    if (r.matched_movement_id) matchedIds.add(String(r.matched_movement_id));
  }
  for (const r of n1Rows as Array<{ bank_line_id?: unknown; movement_id?: unknown }>) {
    if (r.bank_line_id && r.movement_id && activeLineIds.has(String(r.bank_line_id))) {
      matchedIds.add(String(r.movement_id));
    }
  }
  return matchedIds;
}

export async function fetchVerifiedMovementsForCompany(
  companyId: string,
  movementIds: readonly string[]
): Promise<Map<string, VerifiedBankBookMovement>> {
  const result = new Map<string, VerifiedBankBookMovement>();
  if (movementIds.length === 0) return result;
  const sb = getRequiredSupabase();
  const uniqueIds = [...new Set(movementIds.filter(Boolean))];
  for (let i = 0; i < uniqueIds.length; i += 200) {
    const chunk = uniqueIds.slice(i, i + 200);
    const { data, error } = await sb
      .from('poliza_movements')
      .select('id, poliza_id, account_id, cargo, abono, polizas!inner(company_id)')
      .in('id', chunk)
      .eq('polizas.company_id', companyId);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      result.set(String(row.id), {
        id: String(row.id),
        polizaId: String(row.poliza_id),
        accountId: String(row.account_id),
        cargo: Number(row.cargo || 0),
        abono: Number(row.abono || 0)
      });
    }
  }
  return result;
}

export function checkBankMovementSignCompatibility(params: {
  cargoBanco: number;
  abonoBanco: number;
  cargoContable: number;
  abonoContable: number;
}): {
  compatible: boolean;
  direction: 'DEPOSIT' | 'WITHDRAWAL' | null;
  bankAmountCents: number;
  bookAmountCents: number;
} {
  const bankCargoCents = toCents(params.cargoBanco);
  const bankAbonoCents = toCents(params.abonoBanco);
  const bookCargoCents = toCents(params.cargoContable);
  const bookAbonoCents = toCents(params.abonoContable);

  if (bankAbonoCents > 0 && bankCargoCents === 0) {
    return {
      compatible: bookCargoCents > 0 && bookAbonoCents === 0,
      direction: 'DEPOSIT',
      bankAmountCents: bankAbonoCents,
      bookAmountCents: bookCargoCents
    };
  }
  if (bankCargoCents > 0 && bankAbonoCents === 0) {
    return {
      compatible: bookAbonoCents > 0 && bookCargoCents === 0,
      direction: 'WITHDRAWAL',
      bankAmountCents: bankCargoCents,
      bookAmountCents: bookAbonoCents
    };
  }
  return { compatible: false, direction: null, bankAmountCents: 0, bookAmountCents: 0 };
}

export async function executeManualBankMatch(
  lineId: string,
  movementId: string
): Promise<{ companyId: string; accountId: string; lineYear: number; linePeriod: number }> {
  const sb = getRequiredSupabase();
  const { data: bLine, error: fetchErr } = await sb
    .from('bank_statement_lines')
    .select('company_id, account_id, ejercicio, periodo, cargo_banco, abono_banco, matched_movement_id')
    .eq('id', lineId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!bLine) throw new Error('Movimiento bancario no encontrado');
  if (bLine.matched_movement_id) throw new Error('La línea bancaria ya está conciliada');

  const companyId = String(bLine.company_id);
  const accountId = String(bLine.account_id);
  const lineYear = Number(bLine.ejercicio) || 2026;
  const linePeriod = Number(bLine.periodo) || 10;
  await assertSupabasePeriodOpen(companyId, lineYear, linePeriod);
  await assertMovementNotAlreadyMatched(companyId, movementId, lineId);

  const movMap = await fetchVerifiedMovementsForCompany(companyId, [movementId]);
  const mov = movMap.get(movementId);
  if (!mov) throw new Error('El movimiento contable no existe o no pertenece a la empresa activa.');
  if (mov.accountId !== accountId) {
    throw new Error('El movimiento contable no pertenece a la cuenta bancaria seleccionada.');
  }
  const signCheck = checkBankMovementSignCompatibility({
    cargoBanco: Number(bLine.cargo_banco || 0),
    abonoBanco: Number(bLine.abono_banco || 0),
    cargoContable: mov.cargo,
    abonoContable: mov.abono
  });
  if (!signCheck.compatible) {
    throw new Error('El signo del movimiento contable no es compatible con el cargo/abono bancario.');
  }

  const { error: updErr } = await sb
    .from('bank_statement_lines')
    .update({ matched_movement_id: movementId })
    .eq('id', lineId)
    .is('matched_movement_id', null);
  if (updErr) throw new Error(updErr.message);

  return { companyId, accountId, lineYear, linePeriod };
}
