import { getRequiredSupabase, supabase } from '../supabase';
import type { Poliza, PolizaType } from '../../shared/types';
import { resolvePolizaYearPeriod } from '../../shared/date-utils';
import { validateDoubleEntryMovements } from '../../shared/accounting-engine';
import { chunkArray, fetchAllRows } from './supabase-pagination';
import {
  assertSupabasePeriodOpen,
  buildPolizaMovementInsertRows,
  mapSupabasePoliza,
  resolveAccountsMap,
  resolveNextSupabasePolizaFolio,
  syncUpdatedPolizaCfdiLink
} from './supabase-polizas-mappers';

export { mapSupabasePoliza, assertSupabasePeriodOpen };

export const supabasePolizas = {
  async getPolizas(companyId: string, year?: number, period?: number): Promise<Poliza[]> {
    if (!supabase) return [];
    const data = await fetchAllRows(async (from, to) => {
      let query = getRequiredSupabase()
        .from('polizas')
        .select('*, poliza_movements(*)')
        .eq('company_id', companyId);

      if (year) query = query.eq('ejercicio', year);
      if (period) query = query.eq('periodo', period);

      return query
        .order('folio', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to);
    });
    return data.map((row) =>
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

    const accMap = await resolveAccountsMap(payload.companyId);
    // Validar partida doble contable y existencia de cuentas en catálogo
    validateDoubleEntryMovements(payload.movements, accMap);

    const polizaId = `pol_${crypto.randomUUID().slice(0, 12)}`;
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
      const { error: cfdiErr } = await supabase
        .from('cfdi_documents')
        .update({ poliza_id: polizaId })
        .eq('company_id', payload.companyId)
        .eq('uuid', payload.cfdiUuid);
      if (cfdiErr) throw new Error(cfdiErr.message);
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
      periodo?: number | null;
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
      .select('company_id, ejercicio, periodo, tipo, folio, fecha, concepto, cfdi_uuid')
      .eq('id', polizaId)
      .maybeSingle();

    if (!existingPol) {
      throw new Error('Póliza no encontrada.');
    }

    const compId = String(existingPol.company_id);
    const origYear = Number(existingPol.ejercicio);
    const origPeriod = Number(existingPol.periodo);

    await assertSupabasePeriodOpen(compId, origYear, origPeriod);

    const accMap = await resolveAccountsMap(compId);
    validateDoubleEntryMovements(payload.movements, accMap);

    const explicitPeriodo =
      payload.periodo !== undefined
        ? (payload.periodo ?? undefined)
        : payload.fecha === existingPol.fecha
          ? origPeriod
          : undefined;
    const resolved = resolvePolizaYearPeriod(payload.fecha, explicitPeriodo, origYear, origPeriod);
    const newYear = resolved.ejercicio;
    const newPeriod = resolved.periodo;

    if (newYear !== origYear || newPeriod !== origPeriod) {
      await assertSupabasePeriodOpen(compId, newYear, newPeriod);
    }

    const periodOrTypeChanged =
      payload.tipo !== existingPol.tipo || newYear !== origYear || newPeriod !== origPeriod;
    const nextFolio = periodOrTypeChanged
      ? await resolveNextSupabasePolizaFolio(compId, payload.tipo, newYear, newPeriod)
      : Number(existingPol.folio);

    const { data: oldMovs } = await supabase
      .from('poliza_movements')
      .select('*')
      .eq('poliza_id', polizaId);

    const { error: polErr } = await supabase
      .from('polizas')
      .update({
        tipo: payload.tipo,
        folio: nextFolio,
        concepto: payload.concepto.trim(),
        fecha: payload.fecha,
        ejercicio: newYear,
        periodo: newPeriod,
        cfdi_uuid: payload.cfdiUuid || null
      })
      .eq('id', polizaId);

    if (polErr) throw new Error(polErr.message);

    const oldMovIds = ((oldMovs || []) as Array<{ id: string }>).map((m) => m.id);
    for (const idChunk of chunkArray(oldMovIds, 100)) {
      const { error: unmatchErr } = await supabase
        .from('bank_statement_lines')
        .update({ matched_movement_id: null })
        .in('matched_movement_id', idChunk);
      if (unmatchErr) throw new Error(unmatchErr.message);
    }

    const { error: delErr } = await supabase.from('poliza_movements').delete().eq('poliza_id', polizaId);
    if (delErr) throw new Error(delErr.message);

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
        await supabase
          .from('polizas')
          .update({
            tipo: existingPol.tipo,
            folio: existingPol.folio,
            concepto: existingPol.concepto,
            fecha: existingPol.fecha,
            ejercicio: existingPol.ejercicio,
            periodo: existingPol.periodo,
            cfdi_uuid: existingPol.cfdi_uuid
          })
          .eq('id', polizaId);
        throw new Error(`Error al insertar nuevos movimientos: ${insErr.message}. Se restauró la póliza previa.`);
      }
    }

    await syncUpdatedPolizaCfdiLink(
      compId,
      polizaId,
      existingPol.cfdi_uuid ? String(existingPol.cfdi_uuid) : null,
      payload.cfdiUuid ?? null
    );

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
