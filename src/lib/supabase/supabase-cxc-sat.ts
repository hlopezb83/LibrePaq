import { supabase } from '../supabase';
import { chunkArray } from '../../shared/array-utils';
import { computeCxcCxpAging } from '../../shared/accounting-engine';
import type { CxcCxpAgingResponse, SatBatchVerifyResult } from '../../shared/types';
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
}

interface SatVerifyEdgeResponse {
  ok: boolean;
  error?: string;
  results?: SatVerifyEdgeItemResult[];
}

export const supabaseCxcSat = {
  async getCxcCxpAging(companyId: string): Promise<CxcCxpAgingResponse> {
    const cfdis = await supabaseCfdi.getCfdis(companyId, { includeXml: false });
    return computeCxcCxpAging({ companyId, cfdis });
  },

  async verifyCfdisSatBatch(
    companyId: string,
    cfdiIds: string[]
  ): Promise<SatBatchVerifyResult> {
    if (!supabase) throw new Error('Supabase no disponible');

    const uniqueIds = Array.from(
      new Set(cfdiIds.map((id) => String(id || '').trim()).filter(Boolean))
    );
    if (uniqueIds.length === 0) {
      return { checkedCount: 0, updatedCount: 0, cancelledWithPolizaCount: 0, items: [] };
    }

    const cfdiRows: Array<{
      id: string;
      uuid: string;
      emisor_rfc: string;
      receptor_rfc: string;
      total: number;
      poliza_id: string | null;
    }> = [];

    for (const idChunk of chunkArray(uniqueIds, 100)) {
      const { data, error } = await supabase
        .from('cfdi_documents')
        .select('id, uuid, emisor_rfc, receptor_rfc, total, poliza_id')
        .eq('company_id', companyId)
        .in('id', idChunk);
      if (error) throw new Error(error.message);
      if (data) cfdiRows.push(...(data as typeof cfdiRows));
    }

    if (cfdiRows.length === 0) {
      return { checkedCount: 0, updatedCount: 0, cancelledWithPolizaCount: 0, items: [] };
    }

    const polizaById = new Map(cfdiRows.map((r) => [r.id, Boolean(r.poliza_id)]));
    const allItems: SatBatchVerifyResult['items'] = [];
    let updatedCount = 0;

    for (const batchRows of chunkArray(cfdiRows, 50)) {
      const itemsPayload = batchRows.map((r) => ({
        cfdiId: r.id,
        uuid: r.uuid,
        emisorRfc: r.emisor_rfc,
        receptorRfc: r.receptor_rfc,
        total: Number(r.total || 0)
      }));

      const { data: edgeData, error: edgeError } =
        await supabase.functions.invoke<SatVerifyEdgeResponse>('sat-status-verify', {
          body: {
            action: 'VERIFY_BATCH',
            companyId,
            items: itemsPayload
          }
        });

      if (edgeError) {
        let errorMsg = edgeError.message;
        try {
          const ctxJson = await (edgeError as { context?: Response }).context?.json();
          if (ctxJson?.error) errorMsg = String(ctxJson.error);
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }

      if (edgeData && !edgeData.ok) {
        throw new Error(edgeData.error || 'Error verificando CFDIs ante el SAT');
      }

      for (const res of edgeData?.results ?? []) {
        const statusSat: 'VIGENTE' | 'CANCELADO' =
          String(res.statusSat || '').toUpperCase() === 'CANCELADO' ? 'CANCELADO' : 'VIGENTE';
        const hadPoliza = polizaById.get(res.cfdiId) ?? Boolean(res.polizaId);
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
      items: allItems
    };
  }
};
