import { getAuthHeaders, handleResponse } from '../api/api-helpers';
import { getRequiredSupabase, isSupabaseConfigured } from '../supabase';
import type { CustomInpcEntry } from '../../shared/types';

function shouldUseCloudInpc(): boolean {
  return (
    typeof window !== 'undefined' &&
    isSupabaseConfigured &&
    (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'))
  );
}

export async function listCustomInpcEntries(companyId: string): Promise<CustomInpcEntry[]> {
  if (!companyId) return [];
  if (shouldUseCloudInpc()) {
    const { data, error } = await getRequiredSupabase()
      .from('custom_inpc_entries')
      .select('*')
      .eq('company_id', companyId)
      .order('year', { ascending: false })
      .order('month', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Record<string, unknown>) => ({
      companyId: String(r.company_id),
      year: Number(r.year),
      month: Number(r.month),
      inpcValue: Number(r.inpc_value),
      source: r.source ? String(r.source) : 'MANUAL',
      updatedAt: r.updated_at ? String(r.updated_at) : undefined
    }));
  }
  const res = await fetch(`/api/custom-inpc?companyId=${encodeURIComponent(companyId)}`, {
    headers: getAuthHeaders()
  });
  return handleResponse<CustomInpcEntry[]>(res);
}

export async function upsertCustomInpcEntry(payload: {
  companyId: string;
  year: number;
  month: number;
  inpcValue: number;
  source?: string;
}): Promise<CustomInpcEntry> {
  if (shouldUseCloudInpc()) {
    const now = new Date().toISOString();
    const { data, error } = await getRequiredSupabase()
      .from('custom_inpc_entries')
      .upsert(
        {
          company_id: payload.companyId,
          year: payload.year,
          month: payload.month,
          inpc_value: payload.inpcValue,
          source: payload.source ?? 'MANUAL',
          updated_at: now
        },
        { onConflict: 'company_id,year,month' }
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return {
      companyId: String(data.company_id),
      year: Number(data.year),
      month: Number(data.month),
      inpcValue: Number(data.inpc_value),
      source: String(data.source ?? 'MANUAL'),
      updatedAt: String(data.updated_at ?? now)
    };
  }
  const res = await fetch('/api/custom-inpc', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payload)
  });
  return handleResponse<CustomInpcEntry>(res);
}

export async function deleteCustomInpcEntry(
  companyId: string,
  year: number,
  month: number
): Promise<void> {
  if (shouldUseCloudInpc()) {
    const { error } = await getRequiredSupabase()
      .from('custom_inpc_entries')
      .delete()
      .eq('company_id', companyId)
      .eq('year', year)
      .eq('month', month);
    if (error) throw new Error(error.message);
    return;
  }
  const res = await fetch(
    `/api/custom-inpc?companyId=${encodeURIComponent(companyId)}&year=${year}&month=${month}`,
    { method: 'DELETE', headers: getAuthHeaders() }
  );
  await handleResponse<{ deleted: boolean }>(res);
}
