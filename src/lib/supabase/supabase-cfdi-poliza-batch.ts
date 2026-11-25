import {
  buildAutoPolizaPlan,
  type AutoPolizaOverrides
} from '../../shared/engine/auto-poliza.engine';
import {
  buildConcentratedBatchGroups,
  checkCfdi69BBlock,
  getCfdiAccountingDate,
  getCfdiCounterpartyRfc,
  type BatchPreparedCfdiPlan
} from '../../shared/engine/auto-poliza-batch';
import { clampDeductiblePct } from '../../shared/engine/auto-poliza-deductible';
import { validateDoubleEntryMovements } from '../../shared/engine/invariants-and-math';
import { parseCalendarDate } from '../../shared/date-utils';
import { MESES_SAT } from '../../shared/sat-constants';
import type { CfdiDocument, Poliza } from '../../shared/types';
import { supabase } from '../supabase';
import { logCompanyAuditEvent } from './audit-logger';
import { fetchRelatedCfdiOverrides, mapSupabaseCfdi } from './supabase-cfdi-mappers';
import { chunkArray } from './supabase-pagination';
import { assertSupabasePeriodOpen, mapSupabasePoliza } from './supabase-polizas-mappers';
import {
  preloadAutoPolizaBatchContext,
  runSupabaseAutoPolizaFromCfdi,
  type AutoPolizaBatchContext,
  type AutoPolizaClientOptions
} from './supabase-cfdi-poliza';

async function fetchSat69BSituacionByRfcs(rfcs: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!supabase || rfcs.length === 0) return result;
  for (const chunk of chunkArray(Array.from(new Set(rfcs)), 150)) {
    const { data, error } = await supabase
      .from('sat_efos_69b')
      .select('rfc, situacion')
      .in('rfc', chunk);
    if (error || !data) continue;
    for (const row of data as Array<{ rfc?: string; situacion?: string }>) {
      if (row.rfc && row.situacion) {
        result.set(String(row.rfc).trim().toUpperCase(), String(row.situacion).trim().toUpperCase());
      }
    }
  }
  return result;
}

/**
 * Contabiliza un lote de CFDIs en modo individual (1 póliza/CFDI) o concentrado
 * (por día, por RFC o nómina), validando Art. 69-B EFOS y preservando todos los UUIDs
 * en `poliza_cfdis` y por partida.
 */
export async function runSupabaseBatchAutoPoliza(
  cfdiIds: string[],
  options?: AutoPolizaClientOptions,
  onProgress?: (current: number, total: number) => void
): Promise<{
  createdPolizas: Poliza[];
  count: number;
  failedCount: number;
  errors: Array<{ cfdiId: string; uuid?: string; error: string }>;
}> {
  const createdPolizas: Poliza[] = [];
  const errors: Array<{ cfdiId: string; uuid?: string; error: string }> = [];
  const uuidById = new Map<string, string>();
  const cfdiById = new Map<string, CfdiDocument>();
  const contextByCompanyId = new Map<string, AutoPolizaBatchContext>();
  const groupingMode = options?.groupingMode ?? 'PER_CFDI';

  if (supabase && cfdiIds.length > 0) {
    for (const idChunk of chunkArray(cfdiIds, 100)) {
      const { data: metaRows } = await supabase
        .from('cfdi_documents')
        .select('*')
        .in('id', idChunk);
      for (const r of (metaRows || []) as Array<Record<string, unknown>>) {
        const mapped = mapSupabaseCfdi(r);
        cfdiById.set(mapped.id, mapped);
        if (mapped.uuid) uuidById.set(mapped.id, mapped.uuid);
      }
    }

    const uniqueCompanyIds = Array.from(new Set(Array.from(cfdiById.values()).map((c) => c.companyId)));
    for (const cid of uniqueCompanyIds) {
      contextByCompanyId.set(cid, await preloadAutoPolizaBatchContext(cid));
    }
  }

  const allRfcs = Array.from(cfdiById.values()).map((c) => getCfdiCounterpartyRfc(c)).filter(Boolean);
  const sat69bMap = options?.allowEfos69B ? new Map<string, string>() : await fetchSat69BSituacionByRfcs(allRfcs);

  if (groupingMode === 'PER_CFDI') {
    for (let i = 0; i < cfdiIds.length; i++) {
      const id = cfdiIds[i]!;
      try {
        const doc = cfdiById.get(id);
        const batchCtx = doc ? contextByCompanyId.get(doc.companyId) : undefined;
        if (doc && !options?.allowEfos69B) {
          const rfc = getCfdiCounterpartyRfc(doc);
          const efos = checkCfdi69BBlock(doc, batchCtx?.thirdParties?.get(rfc)?.estatus69B, sat69bMap.get(rfc));
          if (efos.isBlocked) throw new Error(efos.reason);
        }
        createdPolizas.push(await runSupabaseAutoPolizaFromCfdi(id, options, batchCtx));
      } catch (e) {
        errors.push({ cfdiId: id, uuid: uuidById.get(id), error: e instanceof Error ? e.message : String(e) });
      }
      onProgress?.(i + 1, cfdiIds.length);
    }
    return { createdPolizas, count: createdPolizas.length, failedCount: errors.length, errors };
  }

  if (!supabase) return { createdPolizas, count: 0, failedCount: 0, errors };

  const preparedByCompany = new Map<string, BatchPreparedCfdiPlan[]>();
  for (let i = 0; i < cfdiIds.length; i++) {
    const id = cfdiIds[i]!;
    const cfdi = cfdiById.get(id);
    if (!cfdi) {
      errors.push({ cfdiId: id, error: 'CFDI no encontrado en el ADD' });
      continue;
    }
    try {
      if (cfdi.polizaId) throw new Error('Este CFDI ya tiene una póliza contable asociada');
      if (cfdi.tipoComprobante === 'T') throw new Error('Los comprobantes de Traslado (T) no generan póliza');
      if (cfdi.statusSat === 'CANCELADO') throw new Error('No se pueden contabilizar comprobantes cancelados ante el SAT');
      if (cfdi.total <= 0 && cfdi.subtotal <= 0) throw new Error('Los comprobantes en $0.00 no generan póliza');

      const batchCtx = contextByCompanyId.get(cfdi.companyId);
      const rfc = getCfdiCounterpartyRfc(cfdi);
      if (!options?.allowEfos69B) {
        const efos = checkCfdi69BBlock(cfdi, batchCtx?.thirdParties?.get(rfc)?.estatus69B, sat69bMap.get(rfc));
        if (efos.isBlocked) throw new Error(efos.reason);
      }
      const accounts = batchCtx?.accounts ?? [];
      const relatedOverrides = await fetchRelatedCfdiOverrides(supabase, cfdi);
      const plan = buildAutoPolizaPlan(cfdi, accounts, {
        ...(options as AutoPolizaOverrides),
        rules: batchCtx?.rules ?? [],
        thirdParty: batchCtx?.thirdParties?.get(rfc) ?? null,
        ...relatedOverrides
      });
      if (!plan.isBalanced) throw new Error(`Póliza descuadrada para ${cfdi.uuid}`);
      validateDoubleEntryMovements(plan.movements, new Map(accounts.map((a) => [a.id, a])));

      const accountingDate = getCfdiAccountingDate(cfdi);
      const { year, month: period } = parseCalendarDate(accountingDate);
      const lockKey = `${year}-${period}`;
      if (batchCtx?.periodLocks?.has(lockKey)) {
        if (batchCtx.periodLocks.get(lockKey)) {
          const mesNombre = MESES_SAT.find((m) => m.periodo === period)?.nombre || `Periodo ${period}`;
          throw new Error(`El periodo contable ${mesNombre} ${year} está CERRADO con candado fiscal.`);
        }
      } else {
        await assertSupabasePeriodOpen(cfdi.companyId, year, period);
      }

      const list = preparedByCompany.get(cfdi.companyId) ?? [];
      list.push({ cfdi, plan, accountingDate, year, period, counterpartyRfc: rfc });
      preparedByCompany.set(cfdi.companyId, list);
    } catch (e) {
      errors.push({ cfdiId: id, uuid: cfdi.uuid, error: e instanceof Error ? e.message : String(e) });
    }
  }

  let processedCount = errors.length;
  for (const [companyId, items] of preparedByCompany.entries()) {
    const groups = buildConcentratedBatchGroups(items, groupingMode);
    for (const grp of groups) {
      try {
        const polizaId = `pol_${crypto.randomUUID().slice(0, 12)}`;
        const now = new Date().toISOString();
        const { data: maxRows, error: maxErr } = await supabase
          .from('polizas')
          .select('folio')
          .eq('company_id', companyId)
          .eq('tipo', grp.polizaType)
          .eq('ejercicio', grp.year)
          .eq('periodo', grp.period)
          .order('folio', { ascending: false })
          .limit(1);
        if (maxErr) throw new Error(maxErr.message);

        const nextFolio = Number(maxRows?.[0]?.folio || 0) + 1;
        const polRow = {
          id: polizaId,
          company_id: companyId,
          tipo: grp.polizaType,
          folio: nextFolio,
          fecha: grp.accountingDate,
          ejercicio: grp.year,
          periodo: grp.period,
          concepto: grp.concepto,
          cfdi_uuid: grp.primaryUuid || null,
          origin: 'ADD_AUTO' as const,
          created_at: now
        };
        const { error: polErr } = await supabase.from('polizas').insert(polRow);
        if (polErr) throw new Error(polErr.message);

        const movRows = grp.movements.map((m, idx) => ({
          id: `mov_${polizaId}_${idx + 1}`,
          poliza_id: polizaId,
          account_id: m.accountId,
          account_code: m.accountCode,
          account_name: m.accountName,
          referencia: m.referencia || '',
          concepto: m.concepto || grp.concepto,
          cargo: Number(m.cargo || 0),
          abono: Number(m.abono || 0),
          cfdi_uuid: m.cfdiUuid
        }));
        for (const movChunk of chunkArray(movRows, 200)) {
          const { error: movErr } = await supabase.from('poliza_movements').insert(movChunk);
          if (movErr) {
            await supabase.from('polizas').delete().eq('id', polizaId);
            throw new Error(movErr.message);
          }
        }

        const { error: linkErr } = await supabase
          .from('cfdi_documents')
          .update({
            poliza_id: polizaId,
            ...(options?.deductiblePct !== undefined
              ? { deductible_pct: clampDeductiblePct(options.deductiblePct) }
              : {})
          })
          .in('id', grp.cfdiIds)
          .is('poliza_id', null);
        if (linkErr) {
          await supabase.from('polizas').delete().eq('id', polizaId);
          throw new Error(linkErr.message);
        }

        const pcRows = grp.cfdiUuids.map((u) => ({
          id: `pc_${crypto.randomUUID().slice(0, 12)}`,
          company_id: companyId,
          poliza_id: polizaId,
          cfdi_uuid: u
        }));
        try {
          for (const pcChunk of chunkArray(pcRows, 200)) {
            await supabase.from('poliza_cfdis').insert(pcChunk);
          }
        } catch {
          // Ignorar si poliza_cfdis no está disponible en instancias previas
        }

        logCompanyAuditEvent({
          companyId,
          action: 'POLIZA_CREATE',
          entityType: 'poliza',
          entityId: polizaId,
          metadata: { origin: 'ADD_AUTO', groupingMode, cfdiUuids: grp.cfdiUuids, folio: nextFolio }
        });
        createdPolizas.push(mapSupabasePoliza(polRow, movRows, pcRows));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        for (const cid of grp.cfdiIds) {
          errors.push({ cfdiId: cid, uuid: uuidById.get(cid), error: msg });
        }
      }
      processedCount += grp.cfdiIds.length;
      onProgress?.(Math.min(cfdiIds.length, processedCount), cfdiIds.length);
    }
  }

  return { createdPolizas, count: createdPolizas.length, failedCount: errors.length, errors };
}
