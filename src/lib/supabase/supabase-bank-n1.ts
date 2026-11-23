import { getRequiredSupabase } from '../supabase';
import { findManyToOneBankMatches } from '../../shared/engine/bank-n1-matcher';
import type { BankReconciliationResponse } from '../../shared/types/fiscal.types';
import type {
  BankN1ApplyItem,
  BankN1ApplyResponse,
  BankN1MatchProposal,
  BankN1MatchRecord,
  BankN1ProposeResponse,
  ExtractBankPdfResponse
} from '../../shared/types/bank-n1.types';
import type { ImportBankPdfLineInput } from '../api/bank-n1.api';
import { supabaseBank } from './supabase-bank';
import { supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { assertSupabasePeriodOpen } from './supabase-polizas';

function mapSupabaseMatch(r: Record<string, unknown>): BankN1MatchRecord {
  return {
    id: String(r.id),
    companyId: String(r.company_id),
    bankLineId: String(r.bank_line_id),
    movementId: String(r.movement_id),
    polizaId: String(r.poliza_id),
    matchedAmount: Number(r.matched_amount || 0),
    createdAt: String(r.created_at || '')
  };
}

async function fetchMatches(companyId: string): Promise<BankN1MatchRecord[]> {
  const { data, error } = await getRequiredSupabase()
    .from('bank_statement_matches')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapSupabaseMatch(r as Record<string, unknown>));
}

export const supabaseBankN1 = {
  async extractBankPdfStatement(
    _companyId: string,
    data: string,
    mimeType = 'application/pdf'
  ): Promise<ExtractBankPdfResponse> {
    const { data: resData, error } = await getRequiredSupabase().functions.invoke<ExtractBankPdfResponse>(
      'extract-bank-statement',
      { body: { data, mimeType } }
    );
    if (error) {
      return {
        ok: false,
        code: 'AI_UNAVAILABLE',
        error: error instanceof Error ? error.message : 'Error invocando extract-bank-statement'
      };
    }
    return resData ?? { ok: false, code: 'AI_UNAVAILABLE' };
  },

  async proposeBankN1Matches(
    companyId: string,
    accountId: string,
    year?: number,
    period?: number,
    maxGroupSize = 5,
    toleranceCents = 5
  ): Promise<BankN1ProposeResponse> {
    const recon = await supabaseBank.getBankReconciliation(companyId, accountId, year, period);
    const matches = await fetchMatches(companyId);
    const activeLineIds = new Set(recon.statementLines.filter((l) => l.matchedMovementId).map((l) => l.id));
    const activeMovIds = new Set(matches.filter((m) => activeLineIds.has(m.bankLineId)).map((m) => m.movementId));
    const books = recon.bookMovements.map((b) => ({
      ...b,
      isMatched: b.isMatched || activeMovIds.has(b.movementId)
    }));
    const proposals = findManyToOneBankMatches(recon.statementLines, books, maxGroupSize, toleranceCents);
    return { proposals, matches };
  },

  async applyBankN1Matches(
    companyId: string,
    accountId: string,
    items: ReadonlyArray<BankN1ApplyItem | BankN1MatchProposal>,
    year?: number,
    period?: number
  ): Promise<BankN1ApplyResponse> {
    const supabase = getRequiredSupabase();
    const comp = (await supabaseCompaniesAndAccounts.getCompanies()).find((c) => c.id === companyId);
    const effY = year || comp?.currentYear || 2026;
    const effP = period || comp?.currentPeriod || 10;
    await assertSupabasePeriodOpen(companyId, effY, effP);

    const recon = await supabaseBank.getBankReconciliation(companyId, accountId, effY, effP);
    const existingMatches = await fetchMatches(companyId);
    const lineById = new Map(recon.statementLines.map((l) => [l.id, l]));
    const activeLineIds = new Set(recon.statementLines.filter((l) => l.matchedMovementId).map((l) => l.id));
    const activeMatchedMovIds = new Set<string>([
      ...recon.bookMovements.filter((b) => b.isMatched).map((b) => b.movementId),
      ...existingMatches.filter((m) => activeLineIds.has(m.bankLineId)).map((m) => m.movementId)
    ]);
    const bookById = new Map(recon.bookMovements.map((b) => [b.movementId, b]));
    const newlyMatchedLineIds = new Set<string>();
    const newlyMatchedMovIds = new Set<string>();
    const matchedLineIds: string[] = [];

    for (const item of items) {
      const line = lineById.get(item.bankLineId);
      if (!line || line.matchedMovementId || newlyMatchedLineIds.has(item.bankLineId)) continue;

      const movIds = 'movementIds' in item ? item.movementIds : item.movements.map((m) => m.movementId);
      const uniqueIds = [...new Set(movIds.filter(Boolean))];
      if (uniqueIds.length < 2) continue;

      const hasAlreadyMatchedMov = uniqueIds.some((movId) => {
        const book = bookById.get(movId);
        return !book || book.isMatched || activeMatchedMovIds.has(movId) || newlyMatchedMovIds.has(movId);
      });
      if (hasAlreadyMatchedMov) continue;

      const rowsToInsert = uniqueIds
        .map((movId) => {
          const book = bookById.get(movId);
          if (!book) return null;
          return {
            id: `bsm_${crypto.randomUUID().slice(0, 12)}`,
            company_id: companyId,
            bank_line_id: item.bankLineId,
            movement_id: movId,
            poliza_id: book.polizaId,
            matched_amount: book.cargoContable > 0 ? book.cargoContable : book.abonoContable
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (rowsToInsert.length < 2) continue;

      const { error: insErr } = await supabase
        .from('bank_statement_matches')
        .upsert(rowsToInsert, { onConflict: 'bank_line_id,movement_id' });
      if (insErr) throw new Error(insErr.message);

      const { error: updErr } = await supabase
        .from('bank_statement_lines')
        .update({ matched_movement_id: rowsToInsert[0]?.movement_id ?? null })
        .eq('id', item.bankLineId)
        .eq('company_id', companyId);
      if (updErr) throw new Error(updErr.message);

      newlyMatchedLineIds.add(item.bankLineId);
      for (const movId of uniqueIds) newlyMatchedMovIds.add(movId);
      matchedLineIds.push(item.bankLineId);
    }

    return {
      appliedCount: matchedLineIds.length,
      matchedLineIds,
      matches: await fetchMatches(companyId),
      reconciliation: await supabaseBank.getBankReconciliation(companyId, accountId, effY, effP)
    };
  },

  async importBankPdfLines(
    companyId: string,
    accountId: string,
    lines: ReadonlyArray<ImportBankPdfLineInput>
  ): Promise<BankReconciliationResponse> {
    return supabaseBank.addBankStatementLines({
      companyId,
      accountId,
      lines: lines.map((l) => ({
        fecha: l.fecha,
        referencia: l.referencia || 'MOV-BANCO',
        descripcion: l.descripcion || 'Movimiento PDF bancario',
        cargoBanco: Number(l.cargoBanco ?? l.cargo ?? 0),
        abonoBanco: Number(l.abonoBanco ?? l.abono ?? 0)
      }))
    });
  }
};
