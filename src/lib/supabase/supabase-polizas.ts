import { getRequiredSupabase, supabase } from '../supabase';
import type { Poliza, PolizaType } from '../../shared/types';
import { resolvePolizaYearPeriod } from '../../shared/date-utils';
import { validateDoubleEntryMovements } from '../../shared/accounting-engine';
import { logCompanyAuditEvent } from './audit-logger';
import { chunkArray, fetchAllRows } from './supabase-pagination';
import {
  cleanupDeletedPolizaLinks,
  insertPolizaHeaderWithFolioRetry,
  restorePolizaHeaderRow,
  updatePolizaHeaderWithFolioRetry
} from './supabase-polizas-cfdi-helpers';
import {
  assertSupabasePeriodOpen,
  buildPolizaMovementInsertRows,
  clearSupabaseBankMatchesForPoliza,
  collectPolizaCfdiUuids,
  fetchPolizaCfdisMap,
  mapSupabasePoliza,
  type PolizaMovementInput,
  resolveAccountsMap,
  resolveNextSupabasePolizaFolio,
  syncUpdatedPolizaCfdiLink
} from './supabase-polizas-mappers';

export { mapSupabasePoliza, assertSupabasePeriodOpen };

export const supabasePolizas = {
  async getPolizas(companyId: string, year?: number, period?: number | 'ALL'): Promise<Poliza[]> {
    if (!supabase) return [];
    const data = await fetchAllRows(async (from, to) => {
      let query = getRequiredSupabase()
        .from('polizas')
        .select('*, poliza_movements(*)')
        .eq('company_id', companyId);

      if (year) query = query.eq('ejercicio', year);
      if (typeof period === 'number') query = query.eq('periodo', period);

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
    movements: PolizaMovementInput[];
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
    const now = new Date().toISOString();
    const initialFolio = await resolveNextSupabasePolizaFolio(payload.companyId, payload.tipo, year, period);
    const nextFolio = await insertPolizaHeaderWithFolioRetry({
      polizaId,
      companyId: payload.companyId,
      tipo: payload.tipo,
      initialFolio,
      fecha: payload.fecha,
      year,
      period,
      concepto: payload.concepto.trim(),
      primaryUuid,
      origin: payload.origin || 'MANUAL',
      createdAt: now,
      resolveNextFolio: () => resolveNextSupabasePolizaFolio(payload.companyId, payload.tipo, year, period)
    });

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
      movements: PolizaMovementInput[];
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
    const initialFolio = periodOrTypeChanged
      ? await resolveNextSupabasePolizaFolio(compId, payload.tipo, newYear, newPeriod)
      : Number(existingPol.folio);

    const oldMovs = (await fetchAllRows(async (from, to) =>
      getRequiredSupabase()
        .from('poliza_movements')
        .select('*')
        .eq('poliza_id', polizaId)
        .order('id', { ascending: true })
        .range(from, to)
    )) as Array<Record<string, unknown>>;
    const prevLinksMap = await fetchPolizaCfdisMap([polizaId]);
    const prevUuids = collectPolizaCfdiUuids(
      existingPol.cfdi_uuid ? String(existingPol.cfdi_uuid) : null,
      prevLinksMap.get(polizaId),
      oldMovs.map((m) => ({
        cfdiUuid: m.cfdi_uuid ? String(m.cfdi_uuid) : null
      }))
    );
    const nextUuids = collectPolizaCfdiUuids(
      payload.cfdiUuid,
      payload.cfdiUuids,
      payload.movements
    );
    const primaryNextUuid = payload.cfdiUuid?.trim().toUpperCase() || nextUuids[0] || null;

    const nextFolio = await updatePolizaHeaderWithFolioRetry({
      polizaId,
      tipo: payload.tipo,
      initialFolio,
      concepto: payload.concepto.trim(),
      fecha: payload.fecha,
      year: newYear,
      period: newPeriod,
      primaryUuid: primaryNextUuid,
      allowFolioRetry: periodOrTypeChanged,
      resolveNextFolio: () => resolveNextSupabasePolizaFolio(compId, payload.tipo, newYear, newPeriod)
    });

    const oldMovIds = oldMovs.map((m) => String(m.id));
    const { error: delErr } = await supabase.from('poliza_movements').delete().eq('poliza_id', polizaId);
    if (delErr) {
      await restorePolizaHeaderRow(polizaId, existingPol);
      throw new Error(delErr.message);
    }

    const movementsToInsert = buildPolizaMovementInsertRows(
      polizaId,
      payload.movements,
      accMap,
      payload.concepto,
      primaryNextUuid
    );

    if (movementsToInsert.length > 0) {
      for (const chunk of chunkArray(movementsToInsert, 200)) {
        const { error: insErr } = await supabase.from('poliza_movements').insert(chunk);
        if (insErr) {
          await supabase.from('poliza_movements').delete().eq('poliza_id', polizaId);
          for (const oldChunk of chunkArray(oldMovs, 200)) {
            await supabase.from('poliza_movements').insert(oldChunk);
          }
          await restorePolizaHeaderRow(polizaId, existingPol);
          throw new Error(`Error al insertar nuevos movimientos: ${insErr.message}. Se restauró la póliza previa.`);
        }
      }
    }

    await clearSupabaseBankMatchesForPoliza(polizaId, oldMovIds);
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

    const compId = String(existingPol.company_id);
    await assertSupabasePeriodOpen(
      compId,
      Number(existingPol.ejercicio),
      Number(existingPol.periodo)
    );

    const movIds = await cleanupDeletedPolizaLinks(compId, polizaId);
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
