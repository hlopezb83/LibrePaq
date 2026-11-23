/**
 * Supabase Edge Function: extract-bank-statement
 * Recibe un estado de cuenta bancario (PDF en Base64) de un usuario autenticado
 * y devuelve los movimientos normalizados extraídos con Gemini 2.5 Flash.
 *
 * Deploy: bunx supabase functions deploy extract-bank-statement --no-verify-jwt
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  extractBankStatementMovements,
  validateBankPdfRequest,
  type BankPdfFailureCode
} from './handler.ts';

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
    'Access-Control-Allow-Origin':
      origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://librepaq.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}

const STATUS_BY_CODE: Record<BankPdfFailureCode | 'UNAUTHORIZED' | 'FORBIDDEN', number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  FILE_TOO_LARGE: 413,
  INVALID_DOCUMENT: 422,
  AI_UNAVAILABLE: 503,
  AI_NOT_CONFIGURED: 500
};

Deno.serve(async (req: Request) => {
  const headers = {
    ...corsHeaders(req.headers.get('Origin')),
    'Content-Type': 'application/json'
  };
  const fail = (code: BankPdfFailureCode | 'UNAUTHORIZED' | 'FORBIDDEN', error?: string) =>
    new Response(JSON.stringify({ ok: false, code, ...(error ? { error } : {}) }), {
      status: STATUS_BY_CODE[code],
      headers
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return fail('INVALID_INPUT');

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return fail('UNAUTHORIZED');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) return fail('UNAUTHORIZED');

  const supabase = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return fail('UNAUTHORIZED');

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const profileClient = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      });
  const { data: profile } = await profileClient
    .from('user_profiles')
    .select('status')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (String(profile?.status || '').trim().toUpperCase() === 'SUSPENDIDO') {
    return fail('FORBIDDEN', 'Acceso denegado: cuenta suspendida');
  }

  let body: { data?: unknown; mimeType?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail('INVALID_INPUT');
  }

  const invalid = validateBankPdfRequest(body.data, body.mimeType);
  if (invalid) return fail(invalid);

  const result = await extractBankStatementMovements(
    body.data as string,
    body.mimeType as string,
    Deno.env.get('GEMINI_API_KEY')
  );
  if (!result.ok) return fail(result.code);

  return new Response(JSON.stringify(result), { status: 200, headers });
});
