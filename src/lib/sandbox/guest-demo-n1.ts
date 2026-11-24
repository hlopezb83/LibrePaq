import { findManyToOneBankMatches } from '../../shared/engine/bank-n1-matcher';
import type { BankReconciliationResponse } from '../../shared/types';
import type {
  BankN1ApplyItem,
  BankN1ApplyResponse,
  BankN1MatchProposal,
  BankN1MatchRecord,
  BankN1ProposeResponse
} from '../../shared/types/bank-n1.types';
import { getGuestDemoState } from './guest-demo-store';

export function proposeDemoBankN1Matches(
  companyId: string,
  recon: BankReconciliationResponse,
  maxGroupSize = 5,
  toleranceCents = 5
): BankN1ProposeResponse {
  const s = getGuestDemoState();
  const matches = s.bankMatches.filter((m) => m.companyId === companyId);
  const proposals = findManyToOneBankMatches(recon.statementLines, recon.bookMovements, maxGroupSize, toleranceCents);
  return { proposals, matches };
}

export function applyDemoBankN1Matches(
  companyId: string,
  recon: BankReconciliationResponse,
  items: ReadonlyArray<BankN1ApplyItem | BankN1MatchProposal>
): { appliedCount: number; matchedLineIds: string[]; matches: BankN1MatchRecord[] } {
  const s = getGuestDemoState();
  const bookById = new Map(recon.bookMovements.map((b) => [b.movementId, b]));
  const created: BankN1MatchRecord[] = [];
  const matchedLineIds: string[] = [];

  for (const item of items) {
    const line = s.bankLines.find((l) => l.id === item.bankLineId && l.companyId === companyId);
    if (!line || line.matchedMovementId) continue;
    const movIds = 'movementIds' in item ? item.movementIds : item.movements.map((m) => m.movementId);
    const uniqueIds = [...new Set(movIds.filter(Boolean))];
    if (uniqueIds.length < 2) continue;

    const rows: BankN1MatchRecord[] = uniqueIds.map((movId) => {
      const book = bookById.get(movId);
      const amt = book ? Math.max(book.cargoContable, book.abonoContable) : 0;
      return {
        id: `bm_${crypto.randomUUID().slice(0, 8)}`,
        companyId,
        bankLineId: line.id,
        movementId: movId,
        polizaId: book?.polizaId ?? '',
        matchedAmount: amt,
        createdAt: new Date().toISOString()
      };
    });
    line.matchedMovementId = uniqueIds[0] ?? null;
    line.matchedPolizaFolio = bookById.get(uniqueIds[0] ?? '')?.polizaFolio ?? null;
    s.bankMatches.push(...rows);
    created.push(...rows);
    matchedLineIds.push(line.id);
  }

  return { appliedCount: matchedLineIds.length, matchedLineIds, matches: created };
}

export type { BankN1ApplyItem, BankN1ApplyResponse, BankN1MatchProposal, BankN1ProposeResponse };
