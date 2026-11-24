import { fromCents, sumCents } from '../../shared/accounting-engine';
import { getCurrentFiscalPeriod } from '../../shared/date-utils';
import { MESES_SAT } from '../../shared/sat-constants';
import type { Account, Poliza, PolizaType } from '../../shared/types';
import { getRequiredSupabase, supabase } from '../supabase';
import { chunkArray, fetchAllRows } from './supabase-pagination';
import { mapSupabaseAccount } from './supabase-mappers';

export interface PolizaMovementInput {
  accountId: string;
  accountCode?: string;
  accountName?: string;
  referencia?: string;
  concepto?: string;
  cargo: number;
  abono: number;
  cfdiUuid?: string | null;
}

export function collectPolizaCfdiUuids(
  headerCfdiUuid?: string | null,
  headerCfdiUuids?: ReadonlyArray<string> | null,
  movements?: ReadonlyArray<{ cfdiUuid?: string | null }>
): string[] {
  const seen = new Set<string>();
  const add = (val?: string | null) => {
    const clean = val?.trim().toUpperCase();
    if (clean) seen.add(clean);
  };
  if (headerCfdiUuids) {
    for (const u of headerCfdiUuids) add(u);
  }
  add(headerCfdiUuid);
  if (movements) {
    for (const m of movements) add(m.cfdiUuid);
  }
  return Array.from(seen);
}

export function mapSupabasePoliza(
  row: Record<string, unknown>,
  movementsRaw: unknown = [],
  cfdiLinksRaw?: unknown
): Poliza {
  const movsList = Array.isArray(movementsRaw)
    ? (movementsRaw as Array<Record<string, unknown>>)
    : [];
  const movements = movsList.map((m, idx: number) => ({
    id: String(m.id || `mov_${idx}`),
    polizaId: String(m.poliza_id || row.id),
    accountId: String(m.account_id || ''),
    accountCode: String(m.account_code || ''),
    accountName: String(m.account_name || ''),
    referencia: String(m.referencia || ''),
    concepto: String(m.concepto || ''),
    cargo: Number(m.cargo || 0),
    abono: Number(m.abono || 0),
    cfdiUuid: m.cfdi_uuid ? String(m.cfdi_uuid) : null
  }));

  const rawLinks = Array.isArray(cfdiLinksRaw)
    ? cfdiLinksRaw
    : Array.isArray(row.poliza_cfdis)
      ? (row.poliza_cfdis as Array<Record<string, unknown>>)
      : [];
  const linkUuids = rawLinks
    .map((l) => (l && typeof l === 'object' ? (l as { cfdi_uuid?: unknown }).cfdi_uuid : null))
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  const cfdiUuids = collectPolizaCfdiUuids(
    row.cfdi_uuid ? String(row.cfdi_uuid) : null,
    linkUuids,
    movements
  );

  const totalCargosCents = sumCents(movements.map((m) => m.cargo));
  const totalAbonosCents = sumCents(movements.map((m) => m.abono));
  const totalCargos = fromCents(totalCargosCents);
  const totalAbonos = fromCents(totalAbonosCents);
  const isBalanced = totalCargosCents === totalAbonosCents && totalCargosCents > 0;
  const fallbackPeriod = getCurrentFiscalPeriod();

  return {
    id: String(row.id),
    companyId: String(row.company_id),
    tipo: row.tipo as PolizaType,
    folio: Number(row.folio || 1),
    fecha: typeof row.fecha === 'string' ? row.fecha.split('T')[0]! : String(row.fecha),
    ejercicio: Number(row.ejercicio || fallbackPeriod.year),
    periodo: Number(row.periodo || fallbackPeriod.period),
    concepto: String(row.concepto || ''),
    cfdiUuid: row.cfdi_uuid ? String(row.cfdi_uuid) : (cfdiUuids[0] ?? null),
    cfdiUuids,
    origin: (row.origin as 'MANUAL' | 'ADD_AUTO') || 'MANUAL',
    totalCargos,
    totalAbonos,
    isBalanced,
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
    movements
  };
}

export async function assertSupabasePeriodOpen(
  companyId: string,
  year: number,
  period: number
): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('period_locks')
    .select('is_locked')
    .eq('company_id', companyId)
    .eq('ejercicio', year)
    .eq('periodo', period)
    .maybeSingle();

  if (error) {
    throw new Error(`[Supabase Candado] No se pudo verificar el estado del periodo: ${error.message}`);
  }

  if (data?.is_locked) {
    const mesNombre = MESES_SAT.find((m) => m.periodo === period)?.nombre || `Periodo ${period}`;
    throw new Error(
      `El periodo contable ${mesNombre} ${year} está CERRADO con candado fiscal. Ábrelo primero si necesitas registrar, editar o eliminar pólizas.`
    );
  }
}

export async function resolveNextSupabasePolizaFolio(
  companyId: string,
  tipo: PolizaType,
  year: number,
  period: number
): Promise<number> {
  if (!supabase) return 1;
  const { data, error } = await supabase
    .from('polizas')
    .select('folio')
    .eq('company_id', companyId)
    .eq('tipo', tipo)
    .eq('ejercicio', year)
    .eq('periodo', period)
    .order('folio', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return Number(data?.[0]?.folio || 0) + 1;
}

export async function resolveAccountsMap(
  companyId: string
): Promise<Map<string, Account>> {
  const map = new Map<string, Account>();
  if (!supabase || !companyId) return map;
  const data = await fetchAllRows(async (from, to) =>
    getRequiredSupabase()
      .from('accounts')
      .select('*')
      .eq('company_id', companyId)
      .order('code', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  );
  for (const row of data) {
    const mapped = mapSupabaseAccount(row as Record<string, unknown>);
    map.set(mapped.id, mapped);
  }
  return map;
}

export async function syncUpdatedPolizaCfdiLink(
  compId: string,
  polizaId: string,
  prevUuidsInput: string | null | undefined | ReadonlyArray<string>,
  nextUuidsInput: string | null | ReadonlyArray<string>
): Promise<void> {
  if (!supabase) return;
  const toList = (v: string | null | undefined | ReadonlyArray<string>): string[] =>
    Array.isArray(v)
      ? Array.from(new Set(v.map((u) => u.trim().toUpperCase()).filter(Boolean)))
      : typeof v === 'string' && v.trim()
        ? [v.trim().toUpperCase()]
        : [];
  const prevUuids = toList(prevUuidsInput);
  const nextUuids = toList(nextUuidsInput);
  const nextSet = new Set(nextUuids);
  const removedUuids = prevUuids.filter((u) => !nextSet.has(u));

  if (removedUuids.length > 0) {
    const { error: clearCfdiErr } = await supabase
      .from('cfdi_documents')
      .update({ poliza_id: null })
      .eq('company_id', compId)
      .eq('poliza_id', polizaId)
      .in('uuid', removedUuids);
    if (clearCfdiErr) throw new Error(clearCfdiErr.message);
  }

  const { error: delLinksErr } = await supabase
    .from('poliza_cfdis')
    .delete()
    .eq('poliza_id', polizaId);
  if (delLinksErr) throw new Error(delLinksErr.message);

  if (nextUuids.length > 0) {
    const linkRows = nextUuids.map((u) => ({
      id: `pc_${crypto.randomUUID().slice(0, 12)}`,
      company_id: compId,
      poliza_id: polizaId,
      cfdi_uuid: u
    }));
    const { error: pcErr } = await supabase.from('poliza_cfdis').insert(linkRows);
    if (pcErr) throw new Error(pcErr.message);

    const { error: cfdiErr } = await supabase
      .from('cfdi_documents')
      .update({ poliza_id: polizaId })
      .eq('company_id', compId)
      .in('uuid', nextUuids);
    if (cfdiErr) throw new Error(cfdiErr.message);
  }
}

export function buildPolizaMovementInsertRows(
  polizaId: string,
  movements: ReadonlyArray<PolizaMovementInput>,
  accMap: ReadonlyMap<string, { code: string; name: string }>,
  defaultConcepto: string,
  cfdiUuid?: string | null
) {
  const headerUuid = cfdiUuid?.trim().toUpperCase() || null;
  return movements.map((m, idx) => {
    const cached = accMap.get(m.accountId);
    const explicitMovUuid = m.cfdiUuid?.trim().toUpperCase() || null;
    const movUuid = explicitMovUuid ?? headerUuid;
    return {
      id: `mov_${polizaId}_${idx + 1}`,
      poliza_id: polizaId,
      account_id: m.accountId,
      account_code: m.accountCode || cached?.code || '',
      account_name: m.accountName || cached?.name || '',
      referencia: m.referencia || '',
      concepto: m.concepto || defaultConcepto,
      cargo: Number(m.cargo || 0),
      abono: Number(m.abono || 0),
      cfdi_uuid: movUuid
    };
  });
}

export async function fetchPolizaCfdisMap(
  polizaIds: readonly string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!supabase || polizaIds.length === 0) return map;
  for (const chunk of chunkArray(polizaIds, 150)) {
    const { data, error } = await supabase
      .from('poliza_cfdis')
      .select('poliza_id, cfdi_uuid')
      .in('poliza_id', chunk);
    if (error || !data) continue;
    for (const row of data as Array<{ poliza_id?: string; cfdi_uuid?: string }>) {
      if (!row.poliza_id || !row.cfdi_uuid) continue;
      const list = map.get(row.poliza_id) ?? [];
      list.push(row.cfdi_uuid);
      map.set(row.poliza_id, list);
    }
  }
  return map;
}

export async function clearSupabaseBankMatchesForPoliza(
  polizaId: string,
  movIds: readonly string[]
): Promise<void> {
  if (!supabase) return;

  const affectedLineIds = new Set<string>();
  const { data: byPoliza, error: byPolErr } = await supabase
    .from('bank_statement_matches')
    .select('bank_line_id')
    .eq('poliza_id', polizaId);
  if (byPolErr) throw new Error(byPolErr.message);
  for (const row of (byPoliza || []) as Array<{ bank_line_id?: string }>) {
    if (row.bank_line_id) affectedLineIds.add(String(row.bank_line_id));
  }

  for (const idChunk of chunkArray(movIds, 100)) {
    const { data: byMov, error: byMovErr } = await supabase
      .from('bank_statement_matches')
      .select('bank_line_id')
      .in('movement_id', idChunk);
    if (byMovErr) throw new Error(byMovErr.message);
    for (const row of (byMov || []) as Array<{ bank_line_id?: string }>) {
      if (row.bank_line_id) affectedLineIds.add(String(row.bank_line_id));
    }

    const { error: unmatchMovErr } = await supabase
      .from('bank_statement_lines')
      .update({ matched_movement_id: null })
      .in('matched_movement_id', idChunk);
    if (unmatchMovErr) throw new Error(unmatchMovErr.message);
  }

  const lineIdList = Array.from(affectedLineIds);
  for (const lineChunk of chunkArray(lineIdList, 100)) {
    const { error: unmatchLineErr } = await supabase
      .from('bank_statement_lines')
      .update({ matched_movement_id: null })
      .in('id', lineChunk);
    if (unmatchLineErr) throw new Error(unmatchLineErr.message);

    const { error: delLineMatchErr } = await supabase
      .from('bank_statement_matches')
      .delete()
      .in('bank_line_id', lineChunk);
    if (delLineMatchErr) throw new Error(delLineMatchErr.message);
  }

  const { error: delPolMatchErr } = await supabase
    .from('bank_statement_matches')
    .delete()
    .eq('poliza_id', polizaId);
  if (delPolMatchErr) throw new Error(delPolMatchErr.message);
}
