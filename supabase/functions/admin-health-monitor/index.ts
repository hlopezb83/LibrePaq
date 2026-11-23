/**
 * Supabase Edge Function: admin-health-monitor (verify_jwt: false)
 * Ejecuta admin_run_health_scan() por cron (x-cron-secret) o disparo manual
 * con JWT administrativo (SUPERADMIN | SUPPORT_READONLY | BILLING_OPS)
 * y envía webhook best-effort cuando existen alertas críticas abiertas.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  type PlatformRole,
  authenticateAdminRequest,
  corsHeaders,
  jsonResponse
} from '../_shared/admin-edge-auth.ts';

interface HealthScanResult {
  scannedAtIso?: string;
  alertsCreated?: number;
  openAlertsCount?: number;
}

Deno.serve(async (req: Request) => {
  const headers = {
    ...corsHeaders(req.headers.get('Origin'), 'x-cron-secret'),
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, headers);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Configuración de servidor incompleta en Edge Function' }, 500, headers);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const cronSecretEnv = (Deno.env.get('CRON_SECRET') || '').trim();
    const cronHeader = (req.headers.get('x-cron-secret') || '').trim();
    const isValidCron = Boolean(cronSecretEnv && cronHeader && cronHeader === cronSecretEnv);
    let actorUser: { id: string; email: string; role: PlatformRole } | null = null;

    if (!isValidCron) {
      const auth = await authenticateAdminRequest(req, supabase, 'Autorización requerida (Bearer JWT o x-cron-secret)');
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, headers);
      actorUser = { id: auth.user.id, email: auth.user.email, role: auth.role };
    }

    const { data: scanData, error: scanErr } = await supabase.rpc('admin_run_health_scan');
    if (scanErr) return jsonResponse({ ok: false, error: scanErr.message }, 500, headers);

    const result = (scanData ?? {}) as HealthScanResult;
    const scannedAtIso = String(result.scannedAtIso || new Date().toISOString());
    const alertsCreated = Number(result.alertsCreated ?? 0);
    const openAlertsCount = Number(result.openAlertsCount ?? 0);

    if (actorUser) {
      try {
        await supabase.from('admin_audit_logs').insert({
          id: `audit_${crypto.randomUUID().slice(0, 12)}`,
          actor_user_id: actorUser.id,
          actor_email: actorUser.email,
          action: 'RUN_HEALTH_SCAN',
          target_type: 'platform',
          target_id: null,
          metadata: { actorRole: actorUser.role, scannedAtIso, alertsCreated, openAlertsCount },
          created_at: new Date().toISOString()
        });
      } catch {
        // Auditoría best-effort: no bloquea la respuesta del monitor
      }
    }

    const webhookUrl = (Deno.env.get('ADMIN_ALERT_WEBHOOK_URL') || '').trim();
    if (webhookUrl && openAlertsCount > 0) {
      const { data: criticalAlerts } = await supabase
        .from('platform_alerts')
        .select('id, code, severity, category, title, message, target_type, target_id, detected_at')
        .eq('status', 'open')
        .eq('severity', 'critical')
        .order('detected_at', { ascending: false })
        .limit(20);

      if (criticalAlerts && criticalAlerts.length > 0) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'librepaq.platform_alerts.critical',
              scannedAtIso,
              alertsCreated,
              openAlertsCount,
              criticalCount: criticalAlerts.length,
              alerts: criticalAlerts
            }),
            signal: controller.signal
          });
        } catch {
          // Webhook best-effort: no bloquea la respuesta del monitor
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }

    return jsonResponse({ ok: true, scannedAtIso, alertsCreated, openAlertsCount }, 200, headers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno en admin-health-monitor';
    return jsonResponse({ ok: false, error: message }, 500, headers);
  }
});
