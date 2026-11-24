import { getRequiredSupabase } from '../supabase';
import { fromCents } from '../../shared/accounting-engine';
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
import {
  checkBankMovementSignCompatibility,
  fetchAllMatchedMovementIdsAcrossPeriods,
  fetchVerifiedMovementsForCompany
} from './supabase-bank-validation';
import { supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { fetchAllRows } from './supabase-pagination';
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
  const rows = await fetchAllRows(async (from, to) =>
    getRequiredSupabase()
      .from('bank_statement_matches')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to)
  );
  return rows.map((r) => mapSupabaseMatch(r as Record<string, unknown>));
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
    const [recon, matches, allMatchedMovIds] = await Promise.all([
      supabaseBank.getBankReconciliation(companyId, accountId, year, period),
      fetchMatches(companyId),
      fetchAllMatchedMovementIdsAcrossPeriods(companyId)
    ]);
    const books = recon.bookMovements.map((b) => ({
      ...b,
      isMatched: b.isMatched || allMatchedMovIds.has(b.movementId)
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

    const allRequestedMovIds = items.flatMap((item) =>
      'movementIds' in item ? item.movementIds : item.movements.map((m) => m.movementId)
    );
    const [recon, allMatchedMovIds, verifiedMovs] = await Promise.all([
      supabaseBank.getBankReconciliation(companyId, accountId, effY, effP),
      fetchAllMatchedMovementIdsAcrossPeriods(companyId),
      fetchVerifiedMovementsForCompany(companyId, allRequestedMovIds)
    ]);
    const lineById = new Map(recon.statementLines.map((l) => [l.id, l]));
    const bookById = new Map(recon.bookMovements.map((b) => [b.movementId, b]));
    for (const b of recon.bookMovements) {
      if (b.isMatched) allMatchedMovIds.add(b.movementId);
    }
    const newlyMatchedLineIds = new Set<string>();
    const newlyMatchedMovIds = new Set<string>();
    const matchedLineIds: string[] = [];

    for (const item of items) {
      const line = lineById.get(item.bankLineId);
      if (!line || line.accountId !== accountId || line.matchedMovementId || newlyMatchedLineIds.has(item.bankLineId)) {
        continue;
      }

      const movIds = 'movementIds' in item ? item.movementIds : item.movements.map((m) => m.movementId);
      const uniqueIds = [...new Set(movIds.filter(Boolean))];
      if (uniqueIds.length < 2) continue;

      const lineSign = checkBankMovementSignCompatibility({
        cargoBanco: line.cargoBanco,
        abonoBanco: line.abonoBanco,
        cargoContable: line.abonoBanco > 0 ? 1 : 0,
        abonoContable: line.cargoBanco > 0 ? 1 : 0
      });
      if (!lineSign.direction || lineSign.bankAmountCents <= 0) continue;

      const resolvedMovs: Array<{ movementId: string; polizaId: string; amount: number; cents: number }> = [];
      let allValid = true;
      for (const movId of uniqueIds) {
        if (allMatchedMovIds.has(movId) || newlyMatchedMovIds.has(movId)) {
          allValid = false;
          break;
        }
        const verified = verifiedMovs.get(movId);
        const book = bookById.get(movId);
        if (!verified || verified.accountId !== accountId || (book && book.isMatched)) {
          allValid = false;
          break;
        }
        const signCheck = checkBankMovementSignCompatibility({
          cargoBanco: line.cargoBanco,
          abonoBanco: line.abonoBanco,
          cargoContable: verified.cargo,
          abonoContable: verified.abono
        });
        if (!signCheck.compatible || signCheck.bookAmountCents <= 0) {
          allValid = false;
          break;
        }
        resolvedMovs.push({
          movementId: movId,
          polizaId: verified.polizaId,
          amount: fromCents(signCheck.bookAmountCents),
          cents: signCheck.bookAmountCents
        });
      }
      if (!allValid || resolvedMovs.length < 2) continue;

      const totalMovCents = resolvedMovs.reduce((acc, m) => acc + m.cents, 0);
      if (Math.abs(totalMovCents - lineSign.bankAmountCents) > 5) continue;

      await assertSupabasePeriodOpen(companyId, line.ejercicio, line.periodo);

      const rowsToInsert = resolvedMovs.map((mov) => ({
        id: `bsm_${crypto.randomUUID().slice(0, 12)}`,
        company_id: companyId,
        bank_line_id: item.bankLineId,
        movement_id: mov.movementId,
        poliza_id: mov.polizaId,
        matched_amount: mov.amount
      }));

      const { error: updErr } = await supabase
        .from('bank_statement_lines')
        .update({ matched_movement_id: rowsToInsert[0]?.movement_id ?? null })
        .eq('id', item.bankLineId)
        .eq('company_id', companyId)
        .is('matched_movement_id', null);
      if (updErr) throw new Error(updErr.message);

      const { error: insErr } = await supabase
        .from('bank_statement_matches')
        .upsert(rowsToInsert, { onConflict: 'bank_line_id,movement_id' });
      if (insErr) {
        await supabase
          .from('bank_statement_lines')
          .update({ matched_movement_id: null })
          .eq('id', item.bankLineId)
          .eq('company_id', companyId);
        throw new Error(insErr.message);
      }

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
