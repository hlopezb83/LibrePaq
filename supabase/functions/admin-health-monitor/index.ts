/**
 * Supabase Edge Function: admin-health-monitor (verify_jwt: false)
 * Ejecuta admin_run_health_scan() por cron (x-cron-secret) o disparo manual
 * con JWT administrativo (SUPERADMIN | SUPPORT_READONLY | BILLING_OPS)
 * y envía webhook best-effort cuando existen alertas críticas abiertas.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://librepaq.com',
  'https://www.librepaq.com',
  'https://librepaq-44516.web.app',
  'https://librepaq-44516.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5173'
]);

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://librepaq.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

type PlatformRole = 'SUPERADMIN' | 'SUPPORT_READONLY' | 'BILLING_OPS' | 'NONE';

function resolvePlatformRole(rawRole?: unknown, isSuperAdminFlag?: unknown, email?: string): PlatformRole {
  if ((email || '').trim().toLowerCase() === 'hlopezb@gmail.com') return 'SUPERADMIN';
  const upper = String(rawRole || '').trim().toUpperCase() as PlatformRole;
  if (upper === 'SUPERADMIN' || upper === 'SUPPORT_READONLY' || upper === 'BILLING_OPS') return upper;
  if (Boolean(isSuperAdminFlag)) return 'SUPERADMIN';
  return 'NONE';
}

interface HealthScanResult {
  scannedAtIso?: string;
  alertsCreated?: number;
  openAlertsCount?: number;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, headers);
  }

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

    if (!isValidCron) {
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        return jsonResponse({ ok: false, error: 'Autorización requerida (Bearer JWT o x-cron-secret)' }, 401, headers);
      }

      const { data: authData, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !authData?.user) {
        return jsonResponse({ ok: false, error: 'Token de sesión inválido o expirado' }, 401, headers);
      }

      const user = authData.user;
      const actorEmail = (user.email || '').toLowerCase();
      let role: PlatformRole = actorEmail === 'hlopezb@gmail.com' ? 'SUPERADMIN' : 'NONE';

      if (role !== 'SUPERADMIN') {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('platform_role, is_superadmin')
          .eq('id', user.id)
          .maybeSingle();
        role = resolvePlatformRole(profile?.platform_role, profile?.is_superadmin, actorEmail);
      }

      if (role === 'NONE') {
        return jsonResponse({ ok: false, error: 'Acceso denegado: requiere rol administrativo de plataforma' }, 403, headers);
      }
    }

    const { data: scanData, error: scanErr } = await supabase.rpc('admin_run_health_scan');
    if (scanErr) {
      return jsonResponse({ ok: false, error: scanErr.message }, 500, headers);
    }

    const result = (scanData ?? {}) as HealthScanResult;
    const scannedAtIso = String(result.scannedAtIso || new Date().toISOString());
    const alertsCreated = Number(result.alertsCreated ?? 0);
    const openAlertsCount = Number(result.openAlertsCount ?? 0);

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

    return jsonResponse(
      {
        ok: true,
        scannedAtIso,
        alertsCreated,
        openAlertsCount
      },
      200,
      headers
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno en admin-health-monitor';
    return jsonResponse({ ok: false, error: message }, 500, headers);
  }
});
