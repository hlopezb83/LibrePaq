import { SAFETY_BOUNDS } from '../../shared/sat-constants';
import type { AccountWithBalance } from '../../shared/types';

export function suggestNextCodeForParent(
  pCode: string,
  accounts: AccountWithBalance[]
): string {
  if (!pCode) return '700-00-000';
  const existingCodes = new Set(accounts.map((a) => a.code));
  const children = accounts.filter((a) => a.parentCode === pCode);
  const parts = pCode.split('-');
  if (parts.length < 2) {
    let n = children.length + 1;
    let candidate = `${pCode}-${String(n).padStart(3, '0')}`;
    for (let guard = 0; guard < 9999 && existingCodes.has(candidate); guard += 1) {
      n += 1;
      candidate = `${pCode}-${String(n).padStart(3, '0')}`;
    }
    return candidate;
  }

  // Detect the first all-zero trailing segment to increment, supporting 3- and 4-segment masks
  const firstZeroIdx = parts.findIndex((seg, idx) => idx > 0 && /^0+$/.test(seg));
  if (firstZeroIdx > 0) {
    const segLen = parts[firstZeroIdx]!.length;
    const prefix = parts.slice(0, firstZeroIdx).join('-') + '-';
    const matchingSiblings = accounts.filter(
      (a) =>
        a.parentCode === pCode ||
        (a.code.startsWith(prefix) && a.code.split('-').length === parts.length)
    );
    const maxSeg = matchingSiblings.reduce((max, c) => {
      const parsed = Number.parseInt(c.code.split('-')[firstZeroIdx] ?? '0', 10);
      return Number.isFinite(parsed) && parsed > max ? parsed : max;
    }, 0);
    let nextNum = maxSeg + 1;
    const makeCandidate = (n: number) => {
      const nextParts = [...parts];
      nextParts[firstZeroIdx] = String(n).padStart(segLen, '0');
      return nextParts.join('-');
    };
    let candidate = makeCandidate(nextNum);
    for (let guard = 0; guard < 9999 && existingCodes.has(candidate); guard += 1) {
      nextNum += 1;
      candidate = makeCandidate(nextNum);
    }
    return candidate;
  }

  // Fallback for level-3 parent creating level-4 subaccount (e.g., 601-01-003 -> 601-01-003-001)
  const subLen = Math.max(3, parts[parts.length - 1]?.length ?? 3);
  const matchingSubChildren = accounts.filter((a) => {
    const cParts = a.code.split('-');
    return (
      (a.parentCode === pCode || a.code.startsWith(`${pCode}-`)) &&
      cParts.length === parts.length + 1
    );
  });
  const maxSub = matchingSubChildren.reduce((max, c) => {
    const cParts = c.code.split('-');
    const lastNum = Number.parseInt(cParts[parts.length] ?? '0', 10);
    return Number.isFinite(lastNum) && lastNum > max ? lastNum : max;
  }, 0);
  let nextSub = maxSub + 1;
  let candidate = `${pCode}-${String(nextSub).padStart(subLen, '0')}`;
  for (let guard = 0; guard < 9999 && existingCodes.has(candidate); guard += 1) {
    nextSub += 1;
    candidate = `${pCode}-${String(nextSub).padStart(subLen, '0')}`;
  }
  return candidate;
}

export function isAncestorCollapsed(
  acc: AccountWithBalance,
  collapsedCodes: Record<string, boolean>,
  byCodeMap: Map<string, AccountWithBalance>
): boolean {
  let currParentCode = acc.parentCode;
  let depth = 0;
  while (currParentCode && depth < SAFETY_BOUNDS.MAX_ACCOUNT_LEVEL) {
    depth += 1;
    if (collapsedCodes[currParentCode]) return true;
    const parentAcc = byCodeMap.get(currParentCode);
    currParentCode = parentAcc?.parentCode || null;
  }
  return false;
}
