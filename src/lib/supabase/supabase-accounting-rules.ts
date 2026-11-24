import { supabase } from '../supabase';
import { logCompanyAuditEvent } from './audit-logger';
import type {
  AccountingRuleDirection,
  AccountingRuleRecord,
  UpsertAccountingRulePayload
} from '../../shared/types/accounting-rules.types';

function mapSupabaseAccountingRule(row: Record<string, unknown>): AccountingRuleRecord {
  const dir: AccountingRuleDirection =
    row.direction === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO';
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    name: String(row.name ?? ''),
    matchRfc: row.match_rfc ? String(row.match_rfc) : null,
    matchClaveProdServ: row.match_clave_prod_serv ? String(row.match_clave_prod_serv) : null,
    matchUsoCfdi: row.match_uso_cfdi ? String(row.match_uso_cfdi) : null,
    direction: dir,
    operationAccountCode: String(row.operation_account_code ?? ''),
    counterAccountCode: row.counter_account_code ? String(row.counter_account_code) : null,
    deductiblePct: Number(row.deductible_pct ?? 100),
    priority: Number(row.priority ?? 10),
    autoLearned: Boolean(row.auto_learned),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString())
  };
}

function normalizeUpperOrNull(val?: string | null): string | null {
  const clean = val?.trim().toUpperCase() || '';
  return clean.length > 0 ? clean : null;
}

export const supabaseAccountingRules = {
  async listAccountingRules(companyId: string): Promise<AccountingRuleRecord[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('accounting_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('priority', { ascending: true })
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map((row) => mapSupabaseAccountingRule(row as Record<string, unknown>));
  },

  async upsertAccountingRule(
    payload: UpsertAccountingRulePayload
  ): Promise<AccountingRuleRecord> {
    if (!supabase) throw new Error('Supabase no disponible');

    const matchRfc = normalizeUpperOrNull(payload.matchRfc);
    const matchClave = normalizeUpperOrNull(payload.matchClaveProdServ);
    const matchUso = normalizeUpperOrNull(payload.matchUsoCfdi);
    if (!matchRfc && !matchClave && !matchUso) {
      throw new Error('Debes especificar al menos RFC, ClaveProdServ o Uso CFDI.');
    }

    const direction: AccountingRuleDirection =
      payload.direction === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO';
    const deductiblePct = Math.max(0, Math.min(100, Number(payload.deductiblePct ?? 100)));
    const priority =
      payload.priority !== undefined && Number.isFinite(Number(payload.priority))
        ? Math.round(Number(payload.priority))
        : 10;
    const now = new Date().toISOString();
    let id = payload.id?.trim() || '';
    if (!id) {
      let existingQuery = supabase
        .from('accounting_rules')
        .select('id')
        .eq('company_id', payload.companyId)
        .eq('direction', direction);
      existingQuery = matchRfc
        ? existingQuery.eq('match_rfc', matchRfc)
        : existingQuery.is('match_rfc', null);
      existingQuery = matchClave
        ? existingQuery.eq('match_clave_prod_serv', matchClave)
        : existingQuery.is('match_clave_prod_serv', null);
      existingQuery = matchUso
        ? existingQuery.eq('match_uso_cfdi', matchUso)
        : existingQuery.is('match_uso_cfdi', null);

      const { data: existingRule, error: findErr } = await existingQuery.limit(1).maybeSingle();
      if (findErr) throw new Error(findErr.message);
      id = existingRule?.id ? String(existingRule.id) : `rule_${crypto.randomUUID().slice(0, 12)}`;
    }
    const name =
      payload.name?.trim() ||
      [matchRfc, matchClave, matchUso].filter(Boolean).join(' · ') ||
      `Regla ${payload.operationAccountCode}`;

    const { data, error } = await supabase
      .from('accounting_rules')
      .upsert(
        {
          id,
          company_id: payload.companyId,
          name,
          match_rfc: matchRfc,
          match_clave_prod_serv: matchClave,
          match_uso_cfdi: matchUso,
          direction,
          operation_account_code: payload.operationAccountCode.trim(),
          counter_account_code: payload.counterAccountCode?.trim() || null,
          deductible_pct: deductiblePct,
          priority,
          auto_learned: Boolean(payload.autoLearned),
          updated_at: now
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) throw new Error(error.message);
    const mapped = mapSupabaseAccountingRule(data as Record<string, unknown>);
    logCompanyAuditEvent({
      companyId: payload.companyId,
      action: 'RULE_UPSERT',
      entityType: 'accounting_rule',
      entityId: mapped.id,
      metadata: { name: mapped.name, operationAccountCode: mapped.operationAccountCode }
    });
    return mapped;
  },

  async deleteAccountingRule(
    companyId: string,
    ruleId: string
  ): Promise<{ deleted: boolean }> {
    if (!supabase) return { deleted: false };
    const { error } = await supabase
      .from('accounting_rules')
      .delete()
      .eq('id', ruleId)
      .eq('company_id', companyId);

    if (error) throw new Error(error.message);
    logCompanyAuditEvent({ companyId, action: 'RULE_DELETE', entityType: 'accounting_rule', entityId: ruleId });
    return { deleted: true };
  }
};
