import { supabase } from '../supabase';
import type { Poliza, PolizaType } from '../../shared/types';
import { resolvePolizaYearPeriod } from '../../shared/date-utils';
import { validateDoubleEntryMovements } from '../../shared/accounting-engine';
import {
  assertSupabasePeriodOpen,
  buildPolizaMovementInsertRows,
  mapSupabasePoliza,
  resolveAccountsMap,
  resolveNextSupabasePolizaFolio
} from './supabase-polizas-mappers';

export { mapSupabasePoliza, assertSupabasePeriodOpen };

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
    const nextFolio = await resolveNextSupabasePolizaFolio(payload.companyId, payload.tipo, year, period);
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

    const accMap = await resolveAccountsMap(payload.companyId);
    const movementsToInsert = buildPolizaMovementInsertRows(
      polizaId,
      payload.movements,
      accMap,
      payload.concepto,
      payload.cfdiUuid
    );

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
    if (!supabase) throw new Error('Supabase no disponible');

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
    const accMap = await resolveAccountsMap(compId);
    const movementsToInsert = buildPolizaMovementInsertRows(
      polizaId,
      payload.movements,
      accMap,
      payload.concepto,
      payload.cfdiUuid
    );

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
