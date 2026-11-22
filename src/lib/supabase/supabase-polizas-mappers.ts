import { fromCents, sumCents } from '../../shared/accounting-engine';
import { getCurrentFiscalPeriod } from '../../shared/date-utils';
import { MESES_SAT } from '../../shared/sat-catalog';
import type { Account, Poliza, PolizaType } from '../../shared/types';
import { supabase } from '../supabase';
import { mapSupabaseAccount } from './supabase-mappers';

export interface PolizaMovementInput {
  accountId: string;
  accountCode?: string;
  accountName?: string;
  referencia?: string;
  concepto?: string;
  cargo: number;
  abono: number;
}

export function mapSupabasePoliza(
  row: Record<string, unknown>,
  movementsRaw: unknown = []
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
    cfdiUuid: row.cfdi_uuid ? String(row.cfdi_uuid) : null,
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
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId);
  if (error) {
    throw new Error(`[Supabase Error ${error.code || 'ACCOUNTS'}]: ${error.message}`);
  }
  for (const row of data || []) {
    const mapped = mapSupabaseAccount(row as Record<string, unknown>);
    map.set(mapped.id, mapped);
  }
  return map;
}

export async function syncUpdatedPolizaCfdiLink(
  compId: string,
  polizaId: string,
  prevUuid: string | null | undefined,
  nextUuid: string | null
): Promise<void> {
  if (!supabase) return;
  if (prevUuid && prevUuid !== nextUuid) {
    await supabase
      .from('cfdi_documents')
      .update({ poliza_id: null })
      .eq('company_id', compId)
      .eq('poliza_id', polizaId)
      .eq('uuid', prevUuid);
  }
  if (nextUuid && nextUuid !== prevUuid) {
    await supabase
      .from('cfdi_documents')
      .update({ poliza_id: polizaId })
      .eq('company_id', compId)
      .eq('uuid', nextUuid);
  }
}

export function buildPolizaMovementInsertRows(
  polizaId: string,
  movements: ReadonlyArray<PolizaMovementInput>,
  accMap: ReadonlyMap<string, { code: string; name: string }>,
  defaultConcepto: string,
  cfdiUuid?: string | null
) {
  return movements.map((m, idx) => {
    const cached = accMap.get(m.accountId);
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
      cfdi_uuid: cfdiUuid || null
    };
  });
}
