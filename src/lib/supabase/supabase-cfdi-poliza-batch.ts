import type { Poliza } from '../../shared/types';
import { supabase } from '../supabase';
import { chunkArray } from './supabase-pagination';
import {
  preloadAutoPolizaBatchContext,
  runSupabaseAutoPolizaFromCfdi,
  type AutoPolizaBatchContext,
  type AutoPolizaClientOptions
} from './supabase-cfdi-poliza';

/**
 * Contabiliza un lote de CFDIs precargando catálogos (cuentas, reglas, terceros y candados)
 * una sola vez por empresa para evitar refetches N+1.
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
  const companyIdByCfdiId = new Map<string, string>();
  const contextByCompanyId = new Map<string, AutoPolizaBatchContext>();

  if (supabase && cfdiIds.length > 0) {
    for (const idChunk of chunkArray(cfdiIds, 100)) {
      const { data: metaRows } = await supabase
        .from('cfdi_documents')
        .select('id, uuid, company_id')
        .in('id', idChunk);
      for (const r of (metaRows || []) as Array<{ id: string; uuid?: string | null; company_id?: string | null }>) {
        if (r.uuid) uuidById.set(String(r.id), String(r.uuid));
        if (r.company_id) companyIdByCfdiId.set(String(r.id), String(r.company_id));
      }
    }

    const uniqueCompanyIds = Array.from(new Set(companyIdByCfdiId.values()));
    for (const cid of uniqueCompanyIds) {
      const ctx = await preloadAutoPolizaBatchContext(cid);
      contextByCompanyId.set(cid, ctx);
    }
  }

  for (let i = 0; i < cfdiIds.length; i++) {
    const id = cfdiIds[i]!;
    try {
      const cid = companyIdByCfdiId.get(id);
      const batchCtx = cid ? contextByCompanyId.get(cid) : undefined;
      const pol = await runSupabaseAutoPolizaFromCfdi(id, options, batchCtx);
      createdPolizas.push(pol);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ cfdiId: id, uuid: uuidById.get(id), error: msg });
      console.warn(`[Supabase AutoPoliza] Error al contabilizar CFDI ${id} (${uuidById.get(id) ?? 'sin UUID'}):`, msg);
    }
    onProgress?.(i + 1, cfdiIds.length);
  }

  return {
    createdPolizas,
    count: createdPolizas.length,
    failedCount: errors.length,
    errors
  };
}
