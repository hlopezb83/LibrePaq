import type { Account, AccountWithBalance } from '../../shared/types';

export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeCodeSearchText(input: string): string {
  return normalizeSearchText(input).replace(/[-.\s]/g, '');
}

export function filterAccountPickerOptions<T extends Account | AccountWithBalance>(
  accounts: T[],
  query: string
): T[] {
  const q = normalizeSearchText(query);
  if (!q) return accounts;
  const compactQ = normalizeCodeSearchText(query);

  return accounts.filter((a) => {
    const normCode = normalizeSearchText(a.code);
    const compactCode = normalizeCodeSearchText(a.code);
    const normName = normalizeSearchText(a.name);
    const normSat = a.satGroupCode ? normalizeSearchText(a.satGroupCode) : '';
    const compactSat = a.satGroupCode ? normalizeCodeSearchText(a.satGroupCode) : '';

    return (
      normCode.includes(q) ||
      (compactQ.length > 0 && compactCode.includes(compactQ)) ||
      normName.includes(q) ||
      normSat.includes(q) ||
      (compactQ.length > 0 && compactSat.includes(compactQ))
    );
  });
}
