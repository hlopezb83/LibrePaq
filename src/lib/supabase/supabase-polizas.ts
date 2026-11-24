import { getRequiredSupabase, supabase } from '../supabase';
import type { Poliza, PolizaType } from '../../shared/types';
import { resolvePolizaYearPeriod } from '../../shared/date-utils';
import { validateDoubleEntryMovements } from '../../shared/accounting-engine';
import { logCompanyAuditEvent } from './audit-logger';
import { fetchAllRows } from './supabase-pagination';
import {
  assertSupabasePeriodOpen,
  buildPolizaMovementInsertRows,
  clearSupabaseBankMatchesForPoliza,
  collectPolizaCfdiUuids,
  fetchPolizaCfdisMap,
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
    const ids = data.map((r) => String((r as Record<string, unknown>).id));
    const cfdisMap = await fetchPolizaCfdisMap(ids);
    return data.map((row) => {
      const rec = row as Record<string, unknown>;
      const links = (cfdisMap.get(String(rec.id)) ?? []).map((u) => ({ cfdi_uuid: u }));
      return mapSupabasePoliza(rec, rec.poliza_movements, links);
    });
  },

  async createPoliza(payload: {
    companyId: string;
    tipo: PolizaType;
    fecha: string;
    concepto: string;
    cfdiUuid?: string | null;
    cfdiUuids?: string[];
    origin?: 'MANUAL' | 'ADD_AUTO' | 'CIERRE_ANUAL';
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
      cfdiUuid?: string | null;
    }>;
  }): Promise<Poliza> {
    if (!supabase) throw new Error('Supabase no disponible');

    const resolved = resolvePolizaYearPeriod(payload.fecha, payload.periodo, payload.ejercicio);
    const year = resolved.ejercicio;
    const period = resolved.periodo;

    // Candado Fiscal: Garantizar que el periodo de la póliza no esté cerrado
    await assertSupabasePeriodOpen(payload.companyId, year, period);

    const accMap = await resolveAccountsMap(payload.companyId);
    // Validar partida doble contable y existencia de cuentas en catálogo
    validateDoubleEntryMovements(payload.movements, accMap);

    const allUuids = collectPolizaCfdiUuids(payload.cfdiUuid, payload.cfdiUuids, payload.movements);
    const primaryUuid = payload.cfdiUuid?.trim().toUpperCase() || allUuids[0] || null;
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
      cfdi_uuid: primaryUuid,
      origin: payload.origin || 'MANUAL',
      created_at: now
    });

    if (polErr) throw new Error(polErr.message);

    const movementsToInsert = buildPolizaMovementInsertRows(
      polizaId,
      payload.movements,
      accMap,
      payload.concepto,
      primaryUuid
    );

    if (movementsToInsert.length > 0) {
      const { error: movErr } = await supabase.from('poliza_movements').insert(movementsToInsert);
      if (movErr) {
        await supabase.from('polizas').delete().eq('id', polizaId);
        throw new Error(movErr.message);
      }
    }

    await syncUpdatedPolizaCfdiLink(payload.companyId, polizaId, [], allUuids);

    logCompanyAuditEvent({
      companyId: payload.companyId,
      action: 'POLIZA_CREATE',
      entityType: 'poliza',
      entityId: polizaId,
      metadata: { tipo: payload.tipo, folio: nextFolio, ejercicio: year, periodo: period }
    });

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
        cfdi_uuid: primaryUuid,
        origin: payload.origin || 'MANUAL',
        created_at: now
      },
      movementsToInsert,
      allUuids.map((u) => ({ cfdi_uuid: u }))
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
      cfdiUuids?: string[];
      movements: Array<{
        accountId: string;
        accountCode?: string;
        accountName?: string;
        referencia?: string;
        concepto?: string;
        cargo: number;
        abono: number;
        cfdiUuid?: string | null;
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
    const prevLinksMap = await fetchPolizaCfdisMap([polizaId]);
    const prevUuids = collectPolizaCfdiUuids(
      existingPol.cfdi_uuid ? String(existingPol.cfdi_uuid) : null,
      prevLinksMap.get(polizaId),
      ((oldMovs || []) as Array<{ cfdi_uuid?: string | null }>).map((m) => ({
        cfdiUuid: m.cfdi_uuid
      }))
    );
    const nextUuids = collectPolizaCfdiUuids(
      payload.cfdiUuid,
      payload.cfdiUuids,
      payload.movements
    );
    const primaryNextUuid = payload.cfdiUuid?.trim().toUpperCase() || nextUuids[0] || null;

    const { error: polErr } = await supabase
      .from('polizas')
      .update({
        tipo: payload.tipo,
        folio: nextFolio,
        concepto: payload.concepto.trim(),
        fecha: payload.fecha,
        ejercicio: newYear,
        periodo: newPeriod,
        cfdi_uuid: primaryNextUuid
      })
      .eq('id', polizaId);

    if (polErr) throw new Error(polErr.message);

    const oldMovIds = ((oldMovs || []) as Array<{ id: string }>).map((m) => m.id);
    await clearSupabaseBankMatchesForPoliza(polizaId, oldMovIds);

    const { error: delErr } = await supabase.from('poliza_movements').delete().eq('poliza_id', polizaId);
    if (delErr) throw new Error(delErr.message);

    const movementsToInsert = buildPolizaMovementInsertRows(
      polizaId,
      payload.movements,
      accMap,
      payload.concepto,
      primaryNextUuid
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

    await syncUpdatedPolizaCfdiLink(compId, polizaId, prevUuids, nextUuids);

    logCompanyAuditEvent({
      companyId: compId,
      action: 'POLIZA_UPDATE',
      entityType: 'poliza',
      entityId: polizaId,
      metadata: { tipo: payload.tipo, folio: nextFolio, ejercicio: newYear, periodo: newPeriod }
    });

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

    const { error: unlinkErr } = await supabase
      .from('cfdi_documents')
      .update({ poliza_id: null })
      .eq('poliza_id', polizaId);
    if (unlinkErr) throw new Error(unlinkErr.message);

    const { error: unlinkLinksErr } = await supabase
      .from('poliza_cfdis')
      .delete()
      .eq('poliza_id', polizaId);
    if (unlinkLinksErr) throw new Error(unlinkLinksErr.message);

    const { data: movs, error: movSelErr } = await supabase
      .from('poliza_movements')
      .select('id')
      .eq('poliza_id', polizaId);
    if (movSelErr) throw new Error(movSelErr.message);
    const movIds = ((movs || []) as Array<{ id: string }>).map((m) => m.id);
    await clearSupabaseBankMatchesForPoliza(polizaId, movIds);

    const { error } = await supabase.from('polizas').delete().eq('id', polizaId);
    if (error) throw new Error(error.message);
    logCompanyAuditEvent({
      companyId: String(existingPol.company_id),
      action: 'POLIZA_DELETE',
      entityType: 'poliza',
      entityId: polizaId,
      metadata: { ejercicio: Number(existingPol.ejercicio), periodo: Number(existingPol.periodo) }
    });
    return { deleted: true };
  }
};
