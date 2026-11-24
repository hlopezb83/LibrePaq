import type { SupabaseClient } from '@supabase/supabase-js';
import { fromCents, toCents } from '../../shared/accounting-engine';
import type { AccountNature, AccountType } from '../../shared/types';
import { chunkArray, fetchAllRows } from './supabase-pagination';
import { assertSupabasePeriodOpen } from './supabase-polizas';

export type BatchImportAccountRow = {
  id?: string;
  code: string;
  name: string;
  parentCode?: string | null;
  type?: string;
  nature?: string;
  level?: number;
  satGroupCode?: string;
  isAffectable?: boolean;
  currency?: 'MXN' | 'USD';
  initialBalance?: number;
};

export async function batchImportAccountsWithClient(
  client: SupabaseClient,
  companyId: string,
  rows: BatchImportAccountRow[],
  checkPeriodOpen: (cid: string, yr: number, per: number) => Promise<void> = assertSupabasePeriodOpen
): Promise<{ importedCount: number; updatedCount: number }> {
  if (!rows || rows.length === 0) return { importedCount: 0, updatedCount: 0 };

  const [existingRows, compRes] = await Promise.all([
    fetchAllRows((from, to) =>
      client
        .from('accounts')
        .select('id, code, parent_code, initial_balance, nature, currency, is_affectable')
        .eq('company_id', companyId)
        .order('id')
        .range(from, to)
    ),
    client.from('companies').select('current_year').eq('id', companyId).maybeSingle()
  ]);
  if (compRes.error) throw new Error(compRes.error.message);

  const compYear = Number((compRes.data as { current_year?: number } | null)?.current_year || 2026);
  const existingByCode = new Map<
    string,
    {
      id: string;
      parentCode: string | null;
      initialBalance: number;
      nature: string;
      currency: 'MXN' | 'USD';
      isAffectable: boolean;
    }
  >();
  const parentCodesWithChildren = new Set<string>();
  const existingIds: string[] = [];

  for (const row of existingRows as Array<Record<string, unknown>>) {
    const c = String(row.code ?? '').trim();
    if (!c) continue;
    const id = String(row.id);
    const parentCode = row.parent_code ? String(row.parent_code).trim() : null;
    if (parentCode) parentCodesWithChildren.add(parentCode);
    existingIds.push(id);
    existingByCode.set(c, {
      id,
      parentCode,
      initialBalance: Number(row.initial_balance ?? 0),
      nature: String(row.nature ?? ''),
      currency: row.currency === 'USD' ? 'USD' : 'MXN',
      isAffectable: Boolean(row.is_affectable)
    });
  }

  for (const r of rows) {
    const incomingParent = r?.parentCode ? String(r.parentCode).trim() : '';
    if (incomingParent) parentCodesWithChildren.add(incomingParent);
  }

  const accountsWithMovements = new Set<string>();
  for (const idChunk of chunkArray(existingIds, 150)) {
    const { data: movRows, error: movErr } = await client
      .from('poliza_movements')
      .select('account_id')
      .in('account_id', idChunk);
    if (!movErr && movRows) {
      for (const m of movRows as Array<{ account_id?: string }>) {
        if (m.account_id) accountsWithMovements.add(String(m.account_id));
      }
    }
  }

  let needsPeriodCheck = false;
  let importedCount = 0;
  let updatedCount = 0;
  const dedupedByCode = new Map<string, Record<string, unknown>>();

  for (const r of rows) {
    if (!r || !r.code || !r.name) continue;
    const code = r.code.trim();
    const codeDigits = code.replace(/[^0-9]/g, '');
    const firstDigit = codeDigits[0] || '1';
    const dType: AccountType =
      firstDigit === '1'
        ? 'ACTIVO'
        : firstDigit === '2'
          ? 'PASIVO'
          : firstDigit === '3'
            ? 'CAPITAL'
            : firstDigit === '4'
              ? 'INGRESOS'
              : firstDigit === '5'
                ? 'COSTOS'
                : 'GASTOS';
    const dNat: AccountNature =
      dType === 'ACTIVO' || dType === 'COSTOS' || dType === 'GASTOS' ? 'DEUDORA' : 'ACREEDORA';
    const nature = (r.nature as AccountNature) || dNat;
    const initialBalance = fromCents(toCents(Number(r.initialBalance || 0)));
    const level =
      r.level !== undefined && Number(r.level) >= 1
        ? Number(r.level)
        : code.includes('-')
          ? Math.max(
              1,
              Math.min(
                4,
                code.split('-').filter((seg) => !/^0+$/.test(seg)).length
              )
            )
          : 3;

    const prev = existingByCode.get(code);
    if (prev) {
      const diffBal = toCents(prev.initialBalance) !== toCents(initialBalance);
      const diffNat = prev.nature !== nature;
      if (diffBal || diffNat) needsPeriodCheck = true;
    } else if (toCents(initialBalance) !== 0) {
      needsPeriodCheck = true;
    }

    const hasChildren = parentCodesWithChildren.has(code);
    const hasMovements = prev ? accountsWithMovements.has(prev.id) : false;
    const isAffectable = hasChildren
      ? false
      : hasMovements
        ? true
        : r.isAffectable !== undefined
          ? r.isAffectable
          : prev
            ? prev.isAffectable
            : level >= 3;

    const incomingParent =
      r.parentCode !== undefined && r.parentCode !== null && String(r.parentCode).trim() !== ''
        ? String(r.parentCode).trim()
        : null;
    const resolvedParentCode = incomingParent ?? prev?.parentCode ?? null;
    const resolvedCurrency = r.currency === 'USD' ? 'USD' : r.currency === 'MXN' ? 'MXN' : prev?.currency ?? 'MXN';
    const resolvedId = prev?.id || r.id || `${companyId}_${code}`;

    if (!dedupedByCode.has(code)) {
      if (prev) updatedCount += 1;
      else importedCount += 1;
    }

    dedupedByCode.set(code, {
      id: resolvedId,
      company_id: companyId,
      code,
      name: r.name.trim(),
      parent_code: resolvedParentCode,
      level,
      type: (r.type as AccountType) || dType,
      nature,
      sat_group_code: r.satGroupCode?.trim() || code.slice(0, 3),
      is_affectable: isAffectable,
      currency: resolvedCurrency,
      initial_balance: initialBalance
    });
  }

  if (needsPeriodCheck) {
    await checkPeriodOpen(companyId, compYear, 1);
  }

  const accountsToUpsert = Array.from(dedupedByCode.values());
  for (const chunk of chunkArray(accountsToUpsert, 200)) {
    const { error } = await client.from('accounts').upsert(chunk, {
      onConflict: 'company_id,code'
    });
    if (error) throw new Error(error.message);
  }

  return { importedCount, updatedCount };
}
