import crypto from 'node:crypto';
import type { Context } from 'hono';

export interface ResolvedActor {
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  verifiedByJwt: boolean;
  authError: string | null;
}

const verifiedActorCache = new WeakMap<Request, ResolvedActor>();

function decodeBase64UrlJson(segment: string): Record<string, unknown> | null {
  try {
    const json = Buffer.from(segment, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function verifySupabaseHs256Jwt(
  token: string,
  secret: string
): { userId: string; userEmail: string | null; userName: string | null } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  const header = decodeBase64UrlJson(headerB64);
  if (!header || header.alg !== 'HS256') return null;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();

  let actualSig: Buffer;
  try {
    actualSig = Buffer.from(sigB64, 'base64url');
  } catch {
    return null;
  }
  if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(actualSig, expectedSig)) {
    return null;
  }

  const payload = decodeBase64UrlJson(payloadB64);
  if (!payload) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp !== undefined) {
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || nowSec >= payload.exp) {
      return null;
    }
  }
  if (payload.nbf !== undefined) {
    if (typeof payload.nbf !== 'number' || !Number.isFinite(payload.nbf) || nowSec < payload.nbf) {
      return null;
    }
  }

  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!sub) return null;

  const email =
    typeof payload.email === 'string' && payload.email.trim()
      ? payload.email.trim().toLowerCase()
      : null;
  const meta =
    payload.user_metadata && typeof payload.user_metadata === 'object'
      ? (payload.user_metadata as Record<string, unknown>)
      : null;
  const userName =
    meta && typeof meta.full_name === 'string' && meta.full_name.trim()
      ? meta.full_name.trim()
      : null;

  return { userId: sub, userEmail: email, userName };
}

function readBearerToken(c: Context): string {
  const authHeader = c.req.header('Authorization') || c.req.header('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

export function resolveRequestActor(c: Context): ResolvedActor {
  const rawReq = c.req?.raw;
  if (rawReq) {
    const cached = verifiedActorCache.get(rawReq);
    if (cached) return cached;
  }

  const bearerToken = readBearerToken(c);
  const jwtSecret = (process.env.SUPABASE_JWT_SECRET || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  const rawUserId = (c.req.header('X-User-Id') || c.req.header('x-user-id') || '').trim() || null;
  const rawUserEmail =
    (c.req.header('X-User-Email') || c.req.header('x-user-email') || '').trim().toLowerCase() ||
    null;
  const rawUserName =
    (c.req.header('X-User-Name') || c.req.header('x-user-name') || '').trim() || null;

  if (bearerToken && jwtSecret) {
    const verified = verifySupabaseHs256Jwt(bearerToken, jwtSecret);
    if (!verified) {
      return {
        userId: null,
        userEmail: null,
        userName: null,
        verifiedByJwt: false,
        authError: 'Token JWT inválido o expirado.'
      };
    }
    return {
      userId: verified.userId,
      userEmail: verified.userEmail,
      userName: verified.userName ?? rawUserName,
      verifiedByJwt: true,
      authError: null
    };
  }

  if (isProd) {
    return {
      userId: null,
      userEmail: null,
      userName: null,
      verifiedByJwt: false,
      authError: bearerToken
        ? 'No se pudo verificar el token JWT en producción.'
        : 'Autenticación Bearer JWT requerida en producción.'
    };
  }

  return {
    userId: rawUserId,
    userEmail: rawUserEmail,
    userName: rawUserName,
    verifiedByJwt: false,
    authError: null
  };
}

export async function resolveRequestActorAsync(c: Context): Promise<ResolvedActor> {
  const syncActor = resolveRequestActor(c);
  if (!syncActor.authError || syncActor.verifiedByJwt) {
    return syncActor;
  }

  if (process.env.NODE_ENV === 'production') {
    const bearerToken = readBearerToken(c);
    const jwtSecret = (process.env.SUPABASE_JWT_SECRET || '').trim();
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const supabaseKey = (
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      ''
    ).trim();

    if (bearerToken && !jwtSecret && supabaseUrl && supabaseKey) {
      try {
        const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            apikey: supabaseKey
          }
        });
        if (res.ok) {
          const data = (await res.json()) as {
            id?: unknown;
            email?: unknown;
            user_metadata?: { full_name?: unknown };
          };
          if (typeof data.id === 'string' && data.id.trim()) {
            const verified: ResolvedActor = {
              userId: data.id.trim(),
              userEmail:
                typeof data.email === 'string' && data.email.trim()
                  ? data.email.trim().toLowerCase()
                  : null,
              userName:
                typeof data.user_metadata?.full_name === 'string' &&
                data.user_metadata.full_name.trim()
                  ? data.user_metadata.full_name.trim()
                  : null,
              verifiedByJwt: true,
              authError: null
            };
            if (c.req?.raw) {
              verifiedActorCache.set(c.req.raw, verified);
            }
            return verified;
          }
        }
      } catch {
        // Fall through to authError
      }
    }
  }

  return syncActor;
}
