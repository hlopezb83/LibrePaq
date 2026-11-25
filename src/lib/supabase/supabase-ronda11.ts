import { isSupabaseConfigured, supabase } from '../supabase';
import { fetchWithTimeout, handleResponse } from '../api/api-helpers';
import { computeFinancialStatementsData, type JoinedPolizaMovementInput } from '../../shared/engine/financial-reports.engine';
import type {
  BusinessSegment,
  FinancialStatementsResponse,
  PolizaTemplate,
  PolizaTemplateMovement,
  PolizaType
} from '../../shared/types';
import { fetchAllRows } from './supabase-pagination';
import { mapSupabaseAccount, mapSupabaseCompany } from './supabase-mappers';

const DEFAULT_FIRM_NAME = 'Despacho Contable y Fiscal Integral S.C.';

function useCloudRonda11(): boolean {
  return (
    typeof window !== 'undefined' &&
    isSupabaseConfigured &&
    (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'))
  );
}

function mapSupabaseTemplate(row: Record<string, unknown>): PolizaTemplate {
  let movs: PolizaTemplateMovement[] = [];
  if (Array.isArray(row.movements_json)) {
    movs = row.movements_json as PolizaTemplateMovement[];
  } else if (typeof row.movements_json === 'string') {
    try {
      movs = JSON.parse(row.movements_json) as PolizaTemplateMovement[];
    } catch {
      movs = [];
    }
  }
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    name: String(row.name || ''),
    tipo: (String(row.tipo || 'DIARIO') as PolizaType),
    conceptoDefault: String(row.concepto_default || ''),
    movementsJson: movs,
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapSupabaseSegment(row: Record<string, unknown>): BusinessSegment {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    code: String(row.code || ''),
    name: String(row.name || ''),
    parentId: row.parent_id ? String(row.parent_id) : null,
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

export async function resolveClientDespachoName(company: {
  id: string;
  organizationId?: string | null;
}): Promise<string | null> {
  if (!supabase || !company.id) return null;
  try {
    const { data: brand } = await supabase
      .from('despacho_deliverable_branding')
      .select('firm_name')
      .eq('scope_key', `comp_${company.id}`)
      .maybeSingle();
    const firmName = typeof brand?.firm_name === 'string' ? brand.firm_name.trim() : '';
    if (firmName && firmName !== DEFAULT_FIRM_NAME) return firmName;

    if (company.organizationId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', company.organizationId)
        .maybeSingle();
      const orgName = typeof org?.name === 'string' ? org.name.trim() : '';
      if (orgName) return orgName;
    }
    return firmName || null;
  } catch {
    return null;
  }
}

export const ronda11Client = {
  async listPolizaTemplates(companyId: string): Promise<PolizaTemplate[]> {
    if (!companyId) return [];
    if (useCloudRonda11() && supabase) {
      const { data, error } = await supabase
        .from('poliza_templates')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []).map((r) => mapSupabaseTemplate(r as Record<string, unknown>));
    }
    const res = await fetchWithTimeout(`/api/poliza-templates?companyId=${encodeURIComponent(companyId)}`);
    return handleResponse<PolizaTemplate[]>(res);
  },

  async createPolizaTemplate(payload: {
    companyId: string;
    name: string;
    tipo: PolizaType;
    conceptoDefault: string;
    movementsJson: PolizaTemplateMovement[];
  }): Promise<PolizaTemplate> {
    if (useCloudRonda11() && supabase) {
      const id = `ptpl_${crypto.randomUUID().slice(0, 10)}`;
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('poliza_templates')
        .insert({
          id,
          company_id: payload.companyId,
          name: payload.name.trim(),
          tipo: payload.tipo,
          concepto_default: payload.conceptoDefault.trim(),
          movements_json: payload.movementsJson,
          is_active: true,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapSupabaseTemplate(data as Record<string, unknown>);
    }
    const res = await fetchWithTimeout('/api/poliza-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse<PolizaTemplate>(res);
  },

  async updatePolizaTemplate(
    id: string,
    payload: {
      companyId: string;
      name: string;
      tipo: PolizaType;
      conceptoDefault: string;
      movementsJson: PolizaTemplateMovement[];
    }
  ): Promise<PolizaTemplate> {
    if (useCloudRonda11() && supabase) {
      const { data, error } = await supabase
        .from('poliza_templates')
        .update({
          name: payload.name.trim(),
          tipo: payload.tipo,
          concepto_default: payload.conceptoDefault.trim(),
          movements_json: payload.movementsJson,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('company_id', payload.companyId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapSupabaseTemplate(data as Record<string, unknown>);
    }
    const res = await fetchWithTimeout(`/api/poliza-templates/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse<PolizaTemplate>(res);
  },

  async deletePolizaTemplate(id: string, companyId: string): Promise<{ deleted: boolean }> {
    if (useCloudRonda11() && supabase) {
      const { error } = await supabase
        .from('poliza_templates')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);
      if (error) throw new Error(error.message);
      return { deleted: true };
    }
    const res = await fetchWithTimeout(
      `/api/poliza-templates/${encodeURIComponent(id)}?companyId=${encodeURIComponent(companyId)}`,
      { method: 'DELETE' }
    );
    return handleResponse<{ deleted: boolean }>(res);
  },

  async listBusinessSegments(companyId: string): Promise<BusinessSegment[]> {
    if (!companyId) return [];
    if (useCloudRonda11() && supabase) {
      const { data, error } = await supabase
        .from('business_segments')
        .select('*')
        .eq('company_id', companyId)
        .order('code', { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []).map((r) => mapSupabaseSegment(r as Record<string, unknown>));
    }
    const res = await fetchWithTimeout(`/api/business-segments?companyId=${encodeURIComponent(companyId)}`);
    return handleResponse<BusinessSegment[]>(res);
  },

  async createBusinessSegment(payload: {
    companyId: string;
    code: string;
    name: string;
    parentId?: string | null;
    isActive?: boolean;
  }): Promise<BusinessSegment> {
    if (useCloudRonda11() && supabase) {
      const id = `seg_${crypto.randomUUID().slice(0, 10)}`;
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('business_segments')
        .insert({
          id,
          company_id: payload.companyId,
          code: payload.code.trim().toUpperCase(),
          name: payload.name.trim(),
          parent_id: payload.parentId || null,
          is_active: payload.isActive ?? true,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapSupabaseSegment(data as Record<string, unknown>);
    }
    const res = await fetchWithTimeout('/api/business-segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse<BusinessSegment>(res);
  },

  async updateBusinessSegment(
    id: string,
    payload: {
      companyId: string;
      code: string;
      name: string;
      parentId?: string | null;
      isActive?: boolean;
    }
  ): Promise<BusinessSegment> {
    if (useCloudRonda11() && supabase) {
      const { data, error } = await supabase
        .from('business_segments')
        .update({
          code: payload.code.trim().toUpperCase(),
          name: payload.name.trim(),
          parent_id: payload.parentId || null,
          is_active: payload.isActive ?? true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('company_id', payload.companyId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapSupabaseSegment(data as Record<string, unknown>);
    }
    const res = await fetchWithTimeout(`/api/business-segments/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse<BusinessSegment>(res);
  },

  async deleteBusinessSegment(id: string, companyId: string): Promise<{ deleted: boolean }> {
    if (useCloudRonda11() && supabase) {
      const { error } = await supabase
        .from('business_segments')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);
      if (error) throw new Error(error.message);
      return { deleted: true };
    }
    const res = await fetchWithTimeout(
      `/api/business-segments/${encodeURIComponent(id)}?companyId=${encodeURIComponent(companyId)}`,
      { method: 'DELETE' }
    );
    return handleResponse<{ deleted: boolean }>(res);
  },

  async getSegmentFinancialStatements(
    companyId: string,
    year: number,
    period: number,
    segmentId: string
  ): Promise<FinancialStatementsResponse> {
    if (useCloudRonda11() && supabase) {
      const { data: cRow } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle();
      const company = cRow ? mapSupabaseCompany(cRow) : null;
      if (!company) throw new Error(`Empresa no encontrada: ${companyId}`);
      const [rawAccounts, movs] = await Promise.all([
        fetchAllRows(async (from, to) =>
          supabase!
            .from('accounts')
            .select('*')
            .eq('company_id', companyId)
            .order('code', { ascending: true })
            .range(from, to)
        ),
        fetchAllRows(async (from, to) =>
          supabase!
            .from('poliza_movements')
            .select('account_id, cargo, abono, business_segment_id, polizas!inner(company_id, ejercicio, periodo, origin)')
            .eq('polizas.company_id', companyId)
            .eq('business_segment_id', segmentId)
            .lte('polizas.ejercicio', year)
            .order('id', { ascending: true })
            .range(from, to)
        )
      ]);
      return computeFinancialStatementsData(
        company,
        rawAccounts.map(mapSupabaseAccount),
        movs as unknown as JoinedPolizaMovementInput[],
        year,
        period,
        { businessSegmentId: segmentId }
      );
    }
    const res = await fetchWithTimeout(
      `/api/reports/by-segment?companyId=${encodeURIComponent(companyId)}&year=${year}&period=${period}&segmentId=${encodeURIComponent(segmentId)}`
    );
    return handleResponse<FinancialStatementsResponse>(res);
  }
};
