import { supabase } from '../supabase';

export interface CompanyAuditEventInput {
  companyId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Registra en `company_audit_logs` de manera asíncrona sin bloquear ni fallar
 * el flujo contable principal si el usuario opera en modo local/demo o sin red.
 */
export function logCompanyAuditEvent(input: CompanyAuditEventInput): void {
  if (!supabase || !input.companyId) return;
  const client = supabase;

  void client.auth
    .getUser()
    .then(async ({ data }) => {
      const user = data?.user;
      if (!user || !user.email) return;
      await client.from('company_audit_logs').insert({
        id: `log_${crypto.randomUUID().slice(0, 12)}`,
        company_id: input.companyId,
        actor_user_id: user.id,
        actor_email: user.email,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        metadata: input.metadata ?? {}
      });
    })
    .catch(() => {
      // Bitácora best-effort para no interrumpir captura contable
    });
}
