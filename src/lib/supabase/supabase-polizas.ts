import { supabase } from '../supabase';
import type { Poliza, PolizaType } from '../../shared/types';
import { MESES_SAT } from '../../shared/sat-catalog';
import { resolvePolizaYearPeriod } from '../../shared/date-utils';
import { validateDoubleEntryMovements } from '../../shared/accounting-engine';

export function mapSupabasePoliza(
  row: Record<string, unknown>,
  movementsRaw: unknown = []
): Poliza {
  const movsList = Array.isArray(movementsRaw) ? (movementsRaw as Array<Record<string, unknown>>) : [];
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

  const totalCargos = movements.reduce((acc, m) => acc + m.cargo, 0);
  const totalAbonos = movements.reduce((acc, m) => acc + m.abono, 0);
  const isBalanced = Math.abs(totalCargos - totalAbonos) < 0.005;

  return {
    id: String(row.id),
    companyId: String(row.company_id),
    tipo: row.tipo as PolizaType,
    folio: Number(row.folio || 1),
    fecha: typeof row.fecha === 'string' ? row.fecha.split('T')[0]! : String(row.fecha),
    ejercicio: Number(row.ejercicio || 2026),
    periodo: Number(row.periodo || 10),
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

export async function assertSupabasePeriodOpen(companyId: string, year: number, period: number): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase
    .from('period_locks')
    .select('is_locked')
    .eq('company_id', companyId)
    .eq('ejercicio', year)
    .eq('periodo', period)
    .maybeSingle();

  if (data?.is_locked) {
    const mesNombre = MESES_SAT.find((m) => m.periodo === period)?.nombre || `Periodo ${period}`;
    throw new Error(
      `El periodo contable ${mesNombre} ${year} está CERRADO con candado fiscal. Ábrelo primero si necesitas registrar, editar o eliminar pólizas.`
    );
  }
}

async function resolveAccountsMap(
  companyId: string,
  movements: ReadonlyArray<{ accountId: string; accountCode?: string; accountName?: string }>
): Promise<Map<string, { code: string; name: string }>> {
  const map = new Map<string, { code: string; name: string }>();
  const missing = movements.some((m) => !m.accountCode || !m.accountName);
  if (missing && supabase) {
    const { data } = await supabase
      .from('accounts')
      .select('id, code, name')
      .eq('company_id', companyId);
    if (data) {
      for (const a of data) {
        map.set(String(a.id), { code: String(a.code || ''), name: String(a.name || '') });
      }
    }
  }
  return map;
}

export const supabasePolizas = {
  async getPolizas(companyId: string, year?: number, period?: number): Promise<Poliza[]> {
    if (!supabase) return [];
    let query = supabase
      .from('polizas')
      .select('*, poliza_movements(*)')
      .eq('company_id', companyId);

    if (year) query = query.eq('ejercicio', year);
    if (period) query = query.eq('periodo', period);

    const { data, error } = await query.order('folio', { ascending: false });
    if (error) {
      console.error('[Supabase] Error al consultar pólizas:', error);
      throw new Error(`[Supabase Error ${error.code || 'UNKNOWN'}]: ${error.message}`);
    }
    return (data || []).map((row) =>
      mapSupabasePoliza(row as Record<string, unknown>, (row as Record<string, unknown>).poliza_movements)
    );
  },

  async createPoliza(payload: {
    companyId: string;
    tipo: PolizaType;
    fecha: string;
    concepto: string;
    cfdiUuid?: string | null;
    origin?: 'MANUAL' | 'ADD_AUTO';
    ejercicio?: number;
    periodo?: number;
    movements: Array<{
      accountId: string;
      accountCode?: string;
      accountName?: string;
      referencia?: string;
      concepto?: string;
      cargo: number;
      abono: number;
    }>;
  }): Promise<Poliza> {
    if (!supabase) throw new Error('Supabase no disponible');

    const resolved = resolvePolizaYearPeriod(payload.fecha, payload.periodo);
    const year = payload.ejercicio || resolved.ejercicio;
    const period = resolved.periodo;

    // Candado Fiscal: Garantizar que el periodo de la póliza no esté cerrado
    await assertSupabasePeriodOpen(payload.companyId, year, period);

    // Validar partida doble contable
    validateDoubleEntryMovements(payload.movements);

    const polizaId = `pol_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const { data: maxRows } = await supabase
      .from('polizas')
      .select('folio')
      .eq('company_id', payload.companyId)
      .eq('tipo', payload.tipo)
      .eq('ejercicio', year)
      .eq('periodo', period)
      .order('folio', { ascending: false })
      .limit(1);

    const nextFolio = (maxRows?.[0]?.folio || 0) + 1;
    const now = new Date().toISOString();

    const { error: polErr } = await supabase.from('polizas').insert({
      id: polizaId,
      company_id: payload.companyId,
      tipo: payload.tipo,
      folio: nextFolio,
      fecha: payload.fecha,
      ejercicio: year,
      periodo: period,
      concepto: payload.concepto.trim(),
      cfdi_uuid: payload.cfdiUuid || null,
      origin: payload.origin || 'MANUAL',
      created_at: now
    });

    if (polErr) throw new Error(polErr.message);

    const accMap = await resolveAccountsMap(payload.companyId, payload.movements);

    const movementsToInsert = payload.movements.map((m, idx) => {
      const cached = accMap.get(m.accountId);
      return {
        id: `mov_${polizaId}_${idx + 1}`, poliza_id: polizaId,
        account_id: m.accountId, account_code: m.accountCode || cached?.code || '',
        account_name: m.accountName || cached?.name || '', referencia: m.referencia || '',
        concepto: m.concepto || payload.concepto, cargo: Number(m.cargo || 0),
        abono: Number(m.abono || 0), cfdi_uuid: payload.cfdiUuid || null
      };
    });

    if (movementsToInsert.length > 0) {
      const { error: movErr } = await supabase.from('poliza_movements').insert(movementsToInsert);
      if (movErr) {
        // Rollback atómico: eliminar cabecera si fallan movimientos para prevenir pólizas huérfanas
        await supabase.from('polizas').delete().eq('id', polizaId);
        throw new Error(movErr.message);
      }
    }

    if (payload.cfdiUuid) {
      await supabase
        .from('cfdi_documents')
        .update({ poliza_id: polizaId })
        .eq('company_id', payload.companyId)
        .eq('uuid', payload.cfdiUuid);
    }

    return mapSupabasePoliza(
      {
        id: polizaId,
        company_id: payload.companyId,
        tipo: payload.tipo,
        folio: nextFolio,
        fecha: payload.fecha,
        ejercicio: year,
        periodo: period,
        concepto: payload.concepto,
        cfdi_uuid: payload.cfdiUuid,
        origin: payload.origin || 'MANUAL',
        created_at: now
      },
      movementsToInsert
    );
  },

  async updatePoliza(
    polizaId: string,
    payload: {
      tipo: PolizaType;
      fecha: string;
      concepto: string;
      cfdiUuid?: string | null;
      movements: Array<{
        accountId: string;
        accountCode?: string;
        accountName?: string;
        referencia?: string;
        concepto?: string;
        cargo: number;
        abono: number;
      }>;
    }
  ): Promise<{ updated: boolean }> {
    if (!supabase) return { updated: false };

    const { data: existingPol } = await supabase
      .from('polizas')
      .select('company_id, ejercicio, periodo')
      .eq('id', polizaId)
      .maybeSingle();

    if (!existingPol) {
      throw new Error('Póliza no encontrada.');
    }

    await assertSupabasePeriodOpen(
      String(existingPol.company_id),
      Number(existingPol.ejercicio),
      Number(existingPol.periodo)
    );

    validateDoubleEntryMovements(payload.movements);

    const currentPeriod = existingPol ? Number(existingPol.periodo) : undefined;
    const resolved = resolvePolizaYearPeriod(payload.fecha, currentPeriod);
    const newYear = resolved.ejercicio;
    const newPeriod = resolved.periodo;

    if (existingPol && (newYear !== existingPol.ejercicio || newPeriod !== existingPol.periodo)) {
      await assertSupabasePeriodOpen(String(existingPol.company_id), newYear, newPeriod);
    }

    const { error: polErr } = await supabase
      .from('polizas')
      .update({
        tipo: payload.tipo,
        concepto: payload.concepto.trim(),
        fecha: payload.fecha,
        ejercicio: newYear,
        periodo: newPeriod,
        cfdi_uuid: payload.cfdiUuid || null
      })
      .eq('id', polizaId);

    if (polErr) throw new Error(polErr.message);

    const { data: oldMovs } = await supabase
      .from('poliza_movements')
      .select('*')
      .eq('poliza_id', polizaId);

    const { error: delErr } = await supabase.from('poliza_movements').delete().eq('poliza_id', polizaId);
    if (delErr) throw new Error(delErr.message);

    const compId = existingPol?.company_id ? String(existingPol.company_id) : '';
    const accMap = await resolveAccountsMap(compId, payload.movements);

    const movementsToInsert = payload.movements.map((m, idx) => {
      const cached = accMap.get(m.accountId);
      return {
        id: `mov_${polizaId}_${idx + 1}`, poliza_id: polizaId,
        account_id: m.accountId, account_code: m.accountCode || cached?.code || '',
        account_name: m.accountName || cached?.name || '', referencia: m.referencia || '',
        concepto: m.concepto || payload.concepto, cargo: Number(m.cargo || 0),
        abono: Number(m.abono || 0), cfdi_uuid: payload.cfdiUuid || null
      };
    });

    if (movementsToInsert.length > 0) {
      const { error: insErr } = await supabase.from('poliza_movements').insert(movementsToInsert);
      if (insErr) {
        if (oldMovs && oldMovs.length > 0) {
          await supabase.from('poliza_movements').insert(oldMovs);
        }
        throw new Error(`Error al insertar nuevos movimientos: ${insErr.message}. Se restauraron los movimientos previos.`);
      }
    }

    return { updated: true };
  },

  async deletePoliza(polizaId: string): Promise<{ deleted: boolean }> {
    if (!supabase) return { deleted: false };

    const { data: existingPol } = await supabase
      .from('polizas')
      .select('company_id, ejercicio, periodo')
      .eq('id', polizaId)
      .maybeSingle();

    if (!existingPol) {
      throw new Error('Póliza no encontrada.');
    }

    await assertSupabasePeriodOpen(
      String(existingPol.company_id),
      Number(existingPol.ejercicio),
      Number(existingPol.periodo)
    );

    await supabase.from('cfdi_documents').update({ poliza_id: null }).eq('poliza_id', polizaId);
    const { data: movs } = await supabase
      .from('poliza_movements')
      .select('id')
      .eq('poliza_id', polizaId);
    const movIds = ((movs || []) as Array<{ id: string }>).map((m) => m.id);
    if (movIds.length > 0) {
      await supabase
        .from('bank_statement_lines')
        .update({ matched_movement_id: null })
        .in('matched_movement_id', movIds);
    }

    const { error } = await supabase.from('polizas').delete().eq('id', polizaId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  }
};
