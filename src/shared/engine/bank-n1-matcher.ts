import { parseCalendarDate } from '../date-utils';
import type { BankReconciliationResponse, BankStatementLine } from '../types/fiscal.types';
import type { BankN1Direction, BankN1MatchProposal } from '../types/bank-n1.types';
import { fromCents, toCents } from './invariants-and-math';

const DATE_WINDOW_DAYS = 45;
const MAX_CANDIDATES_PER_LINE = 24;
const MAX_DFS_STEPS = 4000;

type BookMovementItem = BankReconciliationResponse['bookMovements'][number];

interface CandidateMovement {
  item: BookMovementItem;
  amountCents: number;
  dayDiff: number;
}

function toDayNumber(fecha: string | null | undefined): number | null {
  if (!fecha || !/^\d{4}-\d{1,2}-\d{1,2}/.test(fecha.trim())) return null;
  const { year, month, day } = parseCalendarDate(fecha);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function maxAddableSum(
  candidates: readonly CandidateMovement[],
  startIdx: number,
  slotsRemaining: number
): number {
  let sum = 0;
  const limit = Math.min(candidates.length, startIdx + slotsRemaining);
  for (let i = startIdx; i < limit; i += 1) {
    const cand = candidates[i];
    if (cand) sum += cand.amountCents;
  }
  return sum;
}

function searchBestGroup(
  candidates: readonly CandidateMovement[],
  targetCents: number,
  safeMaxGroup: number,
  toleranceCents: number
): { indices: number[]; diffCents: number } | null {
  let steps = 0;
  let best: { indices: number[]; diffCents: number } | null = null;
  const picked: number[] = [];

  const dfs = (startIdx: number, currentSum: number): void => {
    if (best?.diffCents === 0 || steps >= MAX_DFS_STEPS) return;

    if (picked.length >= 2) {
      const diff = Math.abs(currentSum - targetCents);
      if (diff <= toleranceCents) {
        if (
          !best ||
          diff < best.diffCents ||
          (diff === best.diffCents && picked.length < best.indices.length)
        ) {
          best = { indices: [...picked], diffCents: diff };
          if (diff === 0) return;
        }
      }
    }

    if (picked.length >= safeMaxGroup) return;
    const slotsRemaining = safeMaxGroup - picked.length;

    for (let i = startIdx; i < candidates.length; i += 1) {
      steps += 1;
      if (steps > MAX_DFS_STEPS) return;

      const cand = candidates[i];
      if (!cand) continue;

      if (currentSum + maxAddableSum(candidates, i, slotsRemaining) < targetCents - toleranceCents) {
        break;
      }
      if (currentSum + cand.amountCents > targetCents + toleranceCents) {
        continue;
      }

      picked.push(i);
      dfs(i + 1, currentSum + cand.amountCents);
      picked.pop();

      if (best?.diffCents === 0) return;
    }
  };

  dfs(0, 0);
  return best;
}

/**
 * Busca combinaciones N-a-1 (2..maxGroupSize movimientos contables del mismo signo)
 * cuya suma coincida con una línea bancaria pendiente dentro de `toleranceCents`,
 * acotado por ventana de fecha y tamaño de ventana para rendimiento O(N).
 */
export function findManyToOneBankMatches(
  statementLines: readonly BankStatementLine[],
  bookMovements: ReadonlyArray<BookMovementItem>,
  maxGroupSize = 5,
  toleranceCents = 5
): BankN1MatchProposal[] {
  const safeMaxGroup = Math.max(2, Math.min(10, Math.floor(maxGroupSize)));
  const safeTolerance = Math.max(0, Math.floor(toleranceCents));

  const unmatchedBank = statementLines.filter((s) => !s.matchedMovementId);
  const availableBooks = bookMovements.filter((b) => !b.isMatched);
  if (unmatchedBank.length === 0 || availableBooks.length < 2) return [];

  const bookDayCache = new Map<string, number | null>();
  for (const bm of availableBooks) {
    bookDayCache.set(bm.movementId, toDayNumber(bm.fecha));
  }

  const usedMovementIds = new Set<string>();
  const proposals: BankN1MatchProposal[] = [];

  for (const bLine of unmatchedBank) {
    const abonoCents = toCents(bLine.abonoBanco);
    const cargoCents = toCents(bLine.cargoBanco);

    let direction: BankN1Direction;
    let targetCents: number;
    if (abonoCents > 0 && cargoCents === 0) {
      direction = 'DEPOSIT';
      targetCents = abonoCents;
    } else if (cargoCents > 0 && abonoCents === 0) {
      direction = 'WITHDRAWAL';
      targetCents = cargoCents;
    } else {
      continue;
    }

    const bankDay = toDayNumber(bLine.fecha);
    const candidates: CandidateMovement[] = [];

    for (const bm of availableBooks) {
      if (usedMovementIds.has(bm.movementId)) continue;

      const bmCargo = toCents(bm.cargoContable);
      const bmAbono = toCents(bm.abonoContable);
      const amountCents =
        direction === 'DEPOSIT'
          ? bmAbono === 0 ? bmCargo : 0
          : bmCargo === 0 ? bmAbono : 0;

      if (amountCents <= 0 || amountCents >= targetCents + safeTolerance) continue;

      const bookDay = bookDayCache.get(bm.movementId) ?? null;
      const dayDiff = bankDay !== null && bookDay !== null ? Math.abs(bookDay - bankDay) : 0;
      if (bankDay !== null && bookDay !== null && dayDiff > DATE_WINDOW_DAYS) continue;

      candidates.push({ item: bm, amountCents, dayDiff });
    }

    if (candidates.length < 2) continue;

    candidates.sort((a, b) => a.dayDiff - b.dayDiff || b.amountCents - a.amountCents);
    const boundedWindow = candidates.slice(0, MAX_CANDIDATES_PER_LINE);
    boundedWindow.sort((a, b) => b.amountCents - a.amountCents);

    const best = searchBestGroup(boundedWindow, targetCents, safeMaxGroup, safeTolerance);
    if (!best) continue;

    let booksTotalCents = 0;
    const matchedMovements = best.indices
      .map((idx) => boundedWindow[idx])
      .filter((c): c is CandidateMovement => Boolean(c))
      .map((c) => {
        usedMovementIds.add(c.item.movementId);
        booksTotalCents += c.amountCents;
        return {
          movementId: c.item.movementId,
          polizaId: c.item.polizaId,
          polizaFolio: c.item.polizaFolio,
          fecha: c.item.fecha,
          referencia: c.item.referencia,
          concepto: c.item.concepto,
          amount: fromCents(c.amountCents)
        };
      });

    proposals.push({
      bankLineId: bLine.id,
      bankFecha: bLine.fecha,
      bankReferencia: bLine.referencia,
      bankDescripcion: bLine.descripcion,
      direction,
      bankAmount: fromCents(targetCents),
      booksTotalAmount: fromCents(booksTotalCents),
      diffCents: best.diffCents,
      movements: matchedMovements
    });
  }

  return proposals;
}
