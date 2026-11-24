import { SAFETY_BOUNDS } from '../../shared/sat-constants';
import type { AccountWithBalance } from '../../shared/types';

export function suggestNextCodeForParent(
  pCode: string,
  accounts: AccountWithBalance[]
): string {
  if (!pCode) return '700-00-000';
  const children = accounts.filter((a) => a.parentCode === pCode);
  const parts = pCode.split('-');
  if (parts.length < 2) return `${pCode}-001`;

  // Detect the first all-zero trailing segment to increment, supporting 3- and 4-segment masks
  const firstZeroIdx = parts.findIndex((seg, idx) => idx > 0 && /^0+$/.test(seg));
  if (firstZeroIdx > 0) {
    const segLen = parts[firstZeroIdx]!.length;
    const maxSeg = children.reduce((max, c) => {
      const cSeg = Number(c.code.split('-')[firstZeroIdx] || 0);
      return cSeg > max ? cSeg : max;
    }, 0);
    const nextParts = [...parts];
    nextParts[firstZeroIdx] = String(maxSeg + 1).padStart(segLen, '0');
    return nextParts.join('-');
  }

  // Fallback for level-3 parent creating level-4 subaccount (e.g., 601-01-003 -> 601-01-003-001)
  const maxSub = children.reduce((max, c) => {
    const cParts = c.code.split('-');
    const lastNum = Number(cParts[cParts.length - 1] || 0);
    return lastNum > max ? lastNum : max;
  }, 0);
  return `${pCode}-${String(maxSub + 1).padStart(3, '0')}`;
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
