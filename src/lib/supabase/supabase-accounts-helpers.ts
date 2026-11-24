import type { SupabaseClient } from '@supabase/supabase-js';
import { chunkArray, fetchAllRows } from './supabase-pagination';

/**
 * Resuelve el `organization_id` activo de despacho para una nueva empresa,
 * priorizando membresía activa (SOCIO/CONTADOR), perfil y workspace propio.
 */
export async function resolveActiveOrganizationId(
  client: SupabaseClient,
  userId: string | null,
  explicitOrgId?: string | null,
  metadataWorkspaceId?: unknown
): Promise<string | null> {
  if (explicitOrgId?.trim()) return explicitOrgId.trim();
  if (!userId) return null;

  const { data: memberRow } = await client
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('status', 'ACTIVO')
    .in('role', ['SOCIO', 'CONTADOR'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (memberRow?.workspace_id) {
    return String(memberRow.workspace_id);
  }

  const { data: profileRow } = await client
    .from('user_profiles')
    .select('workspace_id')
    .eq('id', userId)
    .maybeSingle();

  if (profileRow?.workspace_id) {
    return String(profileRow.workspace_id);
  }

  if (typeof metadataWorkspaceId === 'string' && metadataWorkspaceId.trim()) {
    return metadataWorkspaceId.trim();
  }

  return `ws_${userId.slice(0, 8)}`;
}

/**
 * Propaga el nuevo nombre de cuenta en `poliza_movements` únicamente para pólizas
 * pertenecientes a periodos abiertos, evitando disparar `PERIOD_LOCKED` en meses cerrados.
 */
export async function propagateOpenAccountNameToMovements(
  client: SupabaseClient,
  companyId: string,
  accountId: string,
  cleanName: string
): Promise<void> {
  const { data: lockedRows, error: lockErr } = await client
    .from('period_locks')
    .select('ejercicio, periodo')
    .eq('company_id', companyId)
    .eq('is_locked', true);

  if (lockErr) throw new Error(lockErr.message);

  const lockedKeys = new Set<string>(
    ((lockedRows || []) as Array<{ ejercicio: number; periodo: number }>).map(
      (r) => `${r.ejercicio}-${r.periodo}`
    )
  );

  if (lockedKeys.size === 0) {
    const { error: movErr } = await client
      .from('poliza_movements')
      .update({ account_name: cleanName })
      .eq('account_id', accountId);
    if (movErr) throw new Error(movErr.message);
    return;
  }

  const movRows = await fetchAllRows(async (from, to) =>
    client
      .from('poliza_movements')
      .select('poliza_id, polizas!inner(id, ejercicio, periodo)')
      .eq('account_id', accountId)
      .order('id', { ascending: true })
      .range(from, to)
  );

  const openPolizaIds = new Set<string>();
  for (const row of movRows as Array<{
    poliza_id?: string;
    polizas?: { ejercicio?: number; periodo?: number } | Array<{ ejercicio?: number; periodo?: number }>;
  }>) {
    const pol = Array.isArray(row.polizas) ? row.polizas[0] : row.polizas;
    if (!row.poliza_id || !pol) continue;
    const key = `${pol.ejercicio}-${pol.periodo}`;
    if (!lockedKeys.has(key)) {
      openPolizaIds.add(String(row.poliza_id));
    }
  }

  for (const chunk of chunkArray(Array.from(openPolizaIds), 100)) {
    const { error: updErr } = await client
      .from('poliza_movements')
      .update({ account_name: cleanName })
      .eq('account_id', accountId)
      .in('poliza_id', chunk);
    if (updErr) throw new Error(updErr.message);
  }
}

/** Fallback cliente secuencial para eliminar una empresa cuando la RPC en cascada no está disponible. */
export async function deleteCompanyFallbackInSupabase(
  client: SupabaseClient,
  companyId: string
): Promise<void> {
  const { data: pols } = await client.from('polizas').select('id').eq('company_id', companyId);
  const polIds = (pols || []).map((p: { id: string }) => p.id);
  for (const idChunk of chunkArray(polIds, 100)) {
    const { error: movErr } = await client.from('poliza_movements').delete().in('poliza_id', idChunk);
    if (movErr) throw new Error(movErr.message);
  }
  const childTables = [
    'bank_statement_matches',
    'bank_reconciliation_closures',
    'despacho_deliverable_branding',
    'inventory_periods',
    'accounting_rules',
    'annual_tax_snapshots',
    'company_audit_logs',
    'bank_statement_lines',
    'cfdi_documents',
    'polizas',
    'fixed_assets',
    'third_parties',
    'period_locks',
    'tax_parameters',
    'fiel_credentials',
    'sat_download_requests',
    'accounts'
  ];
  for (const table of childTables) {
    const { error: childErr } = await client.from(table).delete().eq('company_id', companyId);
    if (childErr) throw new Error(`[Delete ${table}] ${childErr.message}`);
  }
  const { error } = await client.from('companies').delete().eq('id', companyId);
  if (error) throw new Error(error.message);
}
