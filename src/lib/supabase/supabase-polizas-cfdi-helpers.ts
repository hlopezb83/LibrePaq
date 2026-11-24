import type { PolizaType } from '../../shared/types';
import { getRequiredSupabase, supabase } from '../supabase';
import { chunkArray, fetchAllRows } from './supabase-pagination';

export function isDuplicateFolioError(
  err: { code?: string; message?: string } | null | undefined
): boolean {
  if (!err) return false;
  return (
    err.code === '23505' ||
    /duplicate key|unique constraint|polizas.*folio/i.test(err.message || '')
  );
}

export async function insertPolizaHeaderWithFolioRetry(params: {
  polizaId: string;
  companyId: string;
  tipo: PolizaType;
  initialFolio: number;
  fecha: string;
  year: number;
  period: number;
  concepto: string;
  primaryUuid: string | null;
  origin: string;
  createdAt: string;
  resolveNextFolio: () => Promise<number>;
}): Promise<number> {
  const client = getRequiredSupabase();
  let nextFolio = params.initialFolio;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error } = await client.from('polizas').insert({
      id: params.polizaId,
      company_id: params.companyId,
      tipo: params.tipo,
      folio: nextFolio,
      fecha: params.fecha,
      ejercicio: params.year,
      periodo: params.period,
      concepto: params.concepto,
      cfdi_uuid: params.primaryUuid,
      origin: params.origin,
      created_at: params.createdAt
    });
    if (!error) return nextFolio;
    if (attempt < 4 && isDuplicateFolioError(error)) {
      nextFolio = Math.max(nextFolio + 1, await params.resolveNextFolio());
      continue;
    }
    throw new Error(error.message);
  }
  return nextFolio;
}

export async function updatePolizaHeaderWithFolioRetry(params: {
  polizaId: string;
  tipo: PolizaType;
  initialFolio: number;
  concepto: string;
  fecha: string;
  year: number;
  period: number;
  primaryUuid: string | null;
  allowFolioRetry: boolean;
  resolveNextFolio: () => Promise<number>;
}): Promise<number> {
  const client = getRequiredSupabase();
  let nextFolio = params.initialFolio;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error } = await client
      .from('polizas')
      .update({
        tipo: params.tipo,
        folio: nextFolio,
        concepto: params.concepto,
        fecha: params.fecha,
        ejercicio: params.year,
        periodo: params.period,
        cfdi_uuid: params.primaryUuid
      })
      .eq('id', params.polizaId);
    if (!error) return nextFolio;
    if (params.allowFolioRetry && attempt < 4 && isDuplicateFolioError(error)) {
      nextFolio = Math.max(nextFolio + 1, await params.resolveNextFolio());
      continue;
    }
    throw new Error(error.message);
  }
  return nextFolio;
}

export async function restorePolizaHeaderRow(
  polizaId: string,
  existingPol: Record<string, unknown>
): Promise<void> {
  if (!supabase) return;
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
}

export async function cleanupDeletedPolizaLinks(
  compId: string,
  polizaId: string
): Promise<string[]> {
  const client = getRequiredSupabase();
  const linkedCfdis = (await fetchAllRows(async (from, to) =>
    client
      .from('cfdi_documents')
      .select('uuid')
      .eq('company_id', compId)
      .eq('poliza_id', polizaId)
      .order('id', { ascending: true })
      .range(from, to)
  )) as Array<{ uuid?: string | null }>;
  const linkedUuids = Array.from(
    new Set(linkedCfdis.map((c) => c.uuid?.trim().toUpperCase() || '').filter(Boolean))
  );

  const { error: unlinkLinksErr } = await client
    .from('poliza_cfdis')
    .delete()
    .eq('poliza_id', polizaId);
  if (unlinkLinksErr) throw new Error(unlinkLinksErr.message);

  await reconcileRemovedPolizaCfdiLinks(compId, polizaId, linkedUuids);

  const movs = (await fetchAllRows(async (from, to) =>
    client
      .from('poliza_movements')
      .select('id')
      .eq('poliza_id', polizaId)
      .order('id', { ascending: true })
      .range(from, to)
  )) as Array<{ id: string }>;
  return movs.map((m) => m.id);
}

/**
 * Reconcilia `cfdi_documents.poliza_id` cuando una póliza desvincula o elimina UUIDs:
 * si otra póliza en `poliza_cfdis` o `polizas` aún referencia el UUID, reasigna
 * `cfdi_documents.poliza_id` a esa póliza remanente en lugar de poner `NULL` a ciegas.
 */
export async function reconcileRemovedPolizaCfdiLinks(
  compId: string,
  polizaId: string,
  removedUuids: ReadonlyArray<string>
): Promise<void> {
  if (!supabase || removedUuids.length === 0) return;

  const remainingByUuid = new Map<string, string>();
  for (const uuidChunk of chunkArray(removedUuids, 100)) {
    const linkRows = (await fetchAllRows(async (from, to) =>
      getRequiredSupabase()
        .from('poliza_cfdis')
        .select('cfdi_uuid, poliza_id')
        .eq('company_id', compId)
        .neq('poliza_id', polizaId)
        .in('cfdi_uuid', uuidChunk)
        .order('id', { ascending: true })
        .range(from, to)
    )) as Array<{ cfdi_uuid?: string | null; poliza_id?: string | null }>;

    for (const row of linkRows) {
      const u = row.cfdi_uuid?.trim().toUpperCase();
      const pid = row.poliza_id?.trim();
      if (u && pid && !remainingByUuid.has(u)) {
        remainingByUuid.set(u, pid);
      }
    }

    const headerRows = (await fetchAllRows(async (from, to) =>
      getRequiredSupabase()
        .from('polizas')
        .select('id, cfdi_uuid')
        .eq('company_id', compId)
        .neq('id', polizaId)
        .in('cfdi_uuid', uuidChunk)
        .order('id', { ascending: true })
        .range(from, to)
    )) as Array<{ id?: string | null; cfdi_uuid?: string | null }>;

    for (const row of headerRows) {
      const u = row.cfdi_uuid?.trim().toUpperCase();
      const pid = row.id?.trim();
      if (u && pid && !remainingByUuid.has(u)) {
        remainingByUuid.set(u, pid);
      }
    }
  }

  const uuidsByTarget = new Map<string | null, string[]>();
  for (const raw of removedUuids) {
    const u = raw.trim().toUpperCase();
    if (!u) continue;
    const target = remainingByUuid.get(u) ?? null;
    const list = uuidsByTarget.get(target) ?? [];
    list.push(u);
    uuidsByTarget.set(target, list);
  }

  for (const [targetPolizaId, uuids] of uuidsByTarget.entries()) {
    for (const uuidChunk of chunkArray(uuids, 100)) {
      const { error } = await supabase
        .from('cfdi_documents')
        .update({ poliza_id: targetPolizaId })
        .eq('company_id', compId)
        .eq('poliza_id', polizaId)
        .in('uuid', uuidChunk);
      if (error) throw new Error(error.message);
    }
  }
}
