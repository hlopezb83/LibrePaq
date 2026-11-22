import { SAFETY_BOUNDS } from '../../shared/sat-catalog';
import type { AccountWithBalance } from '../../shared/types';

export function suggestNextCodeForParent(
  pCode: string,
  accounts: AccountWithBalance[]
): string {
  if (!pCode) return '700-00-000';
  const children = accounts.filter((a) => a.parentCode === pCode);
  const parts = pCode.split('-');
  if (parts.length !== 3) return `${pCode}-001`;

  if (parts[1] === '00' && parts[2] === '000' && pCode.endsWith('00-00-000')) {
    const prefixNum = Number(parts[0]);
    const maxChildPrefix = children.reduce((max, c) => {
      const cNum = Number(c.code.split('-')[0] || 0);
      return cNum > max ? cNum : max;
    }, prefixNum);
    return `${String(maxChildPrefix + 1).padStart(3, '0')}-00-000`;
  }

  const maxSuffix = children.reduce((max, c) => {
    const cParts = c.code.split('-');
    const lastNum = Number(cParts[2] || 0);
    return lastNum > max ? lastNum : max;
  }, 0);
  const midSegment = children[0]?.code.split('-')[1] || '01';
  return `${parts[0]}-${midSegment}-${String(maxSuffix + 1).padStart(3, '0')}`;
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
