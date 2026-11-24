import { isGuestDemoMode } from '../sandbox/guest-demo-mode';
import { isSupabaseConfigured, supabase } from '../supabase';
import { chunkArray } from '../../shared/array-utils';
import { computeCxcCxpAging } from '../../shared/accounting-engine';
import { merge69BCloudMatches, type Sat69BRecord } from '../../shared/sat-69b';
import type { CxcCxpAgingResponse, Efos69BStatus, SatBatchVerifyResult } from '../../shared/types';
import { supabaseCfdi } from './supabase-cfdi';

interface SatVerifyEdgeItemResult {
  cfdiId: string;
  uuid: string;
  ok: boolean;
  statusSat: string | null;
  validacionEfos: string | null;
  polizaId: string | null;
  cancelledWithPoliza: boolean;
  updated: boolean;
  error?: string;
}

export interface SatBatchVerifyResultWithErrors extends SatBatchVerifyResult {
  failedCount: number;
  errors: Array<{ cfdiId: string; uuid: string; error: string }>;
}

interface SatVerifyEdgeResponse {
  ok: boolean;
  error?: string;
  results?: SatVerifyEdgeItemResult[];
}

export interface Cloud69BMatch {
  rfc: string;
  nombre: string | null;
  situacion: string;
  estatus69b: Efos69BStatus;
  fechaOficio: string | null;
  publicacionDof: string | null;
}

interface Check69BEdgeResponse {
  ok: boolean;
  error?: string;
  checkedCount?: number;
  foundCount?: number;
  matches?: Cloud69BMatch[];
  updatedThirdPartiesCount?: number;
}

interface Upsert69BEdgeResponse {
  ok: boolean;
  error?: string;
  upsertedCount?: number;
}

async function extractEdgeErrorMessage(edgeError: unknown): Promise<string> {
  let errorMsg = edgeError instanceof Error ? edgeError.message : String(edgeError);
  try {
    const ctxJson = await (edgeError as { context?: Response }).context?.json();
    if (ctxJson?.error) errorMsg = String(ctxJson.error);
  } catch {
    // ignore
  }
  return errorMsg;
}

/** Consulta RFCs en `public.sat_efos_69b` via Edge Function `sat-status-verify` y fusiona en memoria local. */
export async function checkRfcsAgainstCloud69B(
  rfcs: string[],
  companyId?: string
): Promise<{ checkedCount: number; matches: Cloud69BMatch[] }> {
  if (!isSupabaseConfigured || !supabase || isGuestDemoMode()) {
    return { checkedCount: 0, matches: [] };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    return { checkedCount: 0, matches: [] };
  }
  const normalized = Array.from(
    new Set(
      rfcs
        .map((r) => String(r || '').trim().toUpperCase().replace(/[^A-Z0-9&Ñ]/g, ''))
        .filter((r) => r.length >= 12)
    )
  );
  if (normalized.length === 0) return { checkedCount: 0, matches: [] };

  const allMatches: Cloud69BMatch[] = [];
  for (const rfcChunk of chunkArray(normalized, 500)) {
    const { data, error } = await supabase.functions.invoke<Check69BEdgeResponse>('sat-status-verify', {
      body: {
        action: 'CHECK_69B',
        ...(companyId ? { companyId } : {}),
        rfcs: rfcChunk
      }
    });
    if (error) throw new Error(await extractEdgeErrorMessage(error));
    if (data && !data.ok) throw new Error(data.error || 'Error consultando padrón 69-B en la nube');
    if (data?.matches && data.matches.length > 0) {
      allMatches.push(...data.matches);
    }
  }

  merge69BCloudMatches(allMatches);
  return { checkedCount: normalized.length, matches: allMatches };
}

/** Sube el padrón completo 69-B en lotes de ~1,000 RFCs a `public.sat_efos_69b`. */
export async function upsert69BBatchToCloud(
  records: Sat69BRecord[],
  opts?: { companyId?: string; onProgress?: (done: number, total: number) => void }
): Promise<{ upsertedCount: number }> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase Cloud no está configurado en este entorno.');
  }
  const batches = chunkArray(records, 1000);
  let upsertedCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const chunk = batches[i]!;
    const { data, error } = await supabase.functions.invoke<Upsert69BEdgeResponse>(
      'sat-status-verify',
      {
        body: {
          action: 'UPSERT_69B_BATCH',
          ...(opts?.companyId ? { companyId: opts.companyId } : {}),
          records: chunk.map((r) => ({
            rfc: r.rfc,
            nombre: r.nombre,
            situacion: r.situacion,
            publicacionDof: r.publicacionDof ?? null
          }))
        }
      }
    );
    if (error) throw new Error(await extractEdgeErrorMessage(error));
    if (data && !data.ok) throw new Error(data.error || 'Error guardando padrón 69-B en la nube');
    upsertedCount += data?.upsertedCount ?? chunk.length;
    opts?.onProgress?.(Math.min((i + 1) * 1000, records.length), records.length);
  }

  return { upsertedCount };
}

export const supabaseCxcSat = {
  async getCxcCxpAging(companyId: string, asOfIso?: string): Promise<CxcCxpAgingResponse> {
    const cfdis = await supabaseCfdi.getCfdis(companyId, { includeXml: false });
    return computeCxcCxpAging({ companyId, cfdis, asOfIso });
  },

  checkRfcsAgainstCloud69B,

  async verifyCfdisSatBatch(
    companyId: string,
    cfdiIds: string[]
  ): Promise<SatBatchVerifyResultWithErrors> {
    if (!supabase) throw new Error('Supabase no disponible');

    const uniqueIds = Array.from(
      new Set(cfdiIds.map((id) => String(id || '').trim()).filter(Boolean))
    );
    if (uniqueIds.length === 0) {
      return { checkedCount: 0, updatedCount: 0, cancelledWithPolizaCount: 0, failedCount: 0, errors: [], items: [] };
    }

    const cfdiRows: Array<{
      id: string;
      uuid: string;
      emisor_rfc: string;
      receptor_rfc: string;
      total: number;
      poliza_id: string | null;
      tipo_comprobante?: string | null;
      status_sat?: string | null;
    }> = [];

    for (const idChunk of chunkArray(uniqueIds, 100)) {
      const { data, error } = await supabase
        .from('cfdi_documents')
        .select('id, uuid, emisor_rfc, receptor_rfc, total, poliza_id, tipo_comprobante, status_sat')
        .eq('company_id', companyId)
        .in('id', idChunk);
      if (error) throw new Error(error.message);
      if (data) cfdiRows.push(...(data as typeof cfdiRows));
    }

    if (cfdiRows.length === 0) {
      return { checkedCount: 0, updatedCount: 0, cancelledWithPolizaCount: 0, failedCount: 0, errors: [], items: [] };
    }

    const polizaById = new Map(cfdiRows.map((r) => [r.id, Boolean(r.poliza_id)]));
    const existingStatusById = new Map(cfdiRows.map((r) => [r.id, String(r.status_sat || '').toUpperCase()]));
    const allItems: SatBatchVerifyResultWithErrors['items'] = [];
    const errors: Array<{ cfdiId: string; uuid: string; error: string }> = [];
    let updatedCount = 0;

    for (const batchRows of chunkArray(cfdiRows, 50)) {
      const itemsPayload = batchRows.map((r) => ({
        cfdiId: r.id,
        uuid: r.uuid,
        emisorRfc: r.emisor_rfc,
        receptorRfc: r.receptor_rfc,
        total: String(r.tipo_comprobante || '').toUpperCase() === 'P' ? 0 : Number(r.total || 0)
      }));

      const { data: edgeData, error: edgeError } =
        await supabase.functions.invoke<SatVerifyEdgeResponse>('sat-status-verify', {
          body: {
            action: 'VERIFY_BATCH',
            companyId,
            items: itemsPayload
          }
        });

      if (edgeError) throw new Error(await extractEdgeErrorMessage(edgeError));
      if (edgeData && !edgeData.ok) {
        throw new Error(edgeData.error || 'Error verificando CFDIs ante el SAT');
      }

      for (const res of edgeData?.results ?? []) {
        const hadPoliza = polizaById.get(res.cfdiId) ?? Boolean(res.polizaId);
        const rawStatus = String(res.statusSat || existingStatusById.get(res.cfdiId) || '').toUpperCase();
        if (!res.ok) {
          errors.push({
            cfdiId: res.cfdiId,
            uuid: res.uuid,
            error: res.error || 'Timeout o error consultando al SAT'
          });
          if (rawStatus === 'CANCELADO' || rawStatus === 'VIGENTE') {
            allItems.push({
              cfdiId: res.cfdiId,
              uuid: res.uuid,
              statusSat: rawStatus,
              hadPoliza,
              cancelledWithPoliza: rawStatus === 'CANCELADO' && hadPoliza,
              validacionEfos: res.validacionEfos || 'NO_VERIFICADO'
            });
          }
          continue;
        }
        const statusSat: 'VIGENTE' | 'CANCELADO' =
          rawStatus === 'CANCELADO' ? 'CANCELADO' : 'VIGENTE';
        const cancelledWithPoliza =
          Boolean(res.cancelledWithPoliza) || (statusSat === 'CANCELADO' && hadPoliza);
        if (res.updated) updatedCount += 1;
        allItems.push({
          cfdiId: res.cfdiId,
          uuid: res.uuid,
          statusSat,
          hadPoliza,
          cancelledWithPoliza,
          validacionEfos: res.validacionEfos || 'NO_VERIFICADO'
        });
      }
    }

    return {
      checkedCount: allItems.length,
      updatedCount,
      cancelledWithPolizaCount: allItems.filter((item) => item.cancelledWithPoliza).length,
      failedCount: errors.length,
      errors,
      items: allItems
    };
  }
};
