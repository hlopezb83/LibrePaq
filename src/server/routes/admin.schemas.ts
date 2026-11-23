import type { Context } from 'hono';
import { z } from 'zod';
import type { PlatformRole } from '../../shared/admin-types';

export type AdminEnv = { Variables: { callerRole: PlatformRole } };

const isoDateSchema = z.string().refine((val) => !Number.isNaN(Date.parse(val)), 'Fecha ISO inválida');

export const broadcastSchema = z.object({
  title: z.string().trim().min(1, 'Título requerido').max(200),
  message: z.string().trim().min(1, 'Mensaje requerido').max(1000),
  type: z.enum(['info', 'warning', 'success']).optional(),
  startsAt: isoDateSchema.nullable().optional(),
  expiresAt: isoDateSchema.nullable().optional()
});

export const userStatusSchema = z.object({
  status: z.enum(['ACTIVO', 'SUSPENDIDO']),
  reason: z.string().trim().max(300).optional()
});

export const auditLogSchema = z.object({
  action: z.string().trim().min(1).max(120),
  targetType: z.string().trim().min(1).max(80),
  targetId: z.string().trim().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const emptyToUndef = (v: unknown) => (v === '' || v === undefined ? undefined : v);
const optEnum = <T extends string>(vals: [T, ...T[]]) => z.preprocess(emptyToUndef, z.enum(vals).optional());
const optInt = (max: number) => z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(max).optional());
const optStr = (max = 120) => z.preprocess(emptyToUndef, z.string().trim().max(max).optional());

export const companiesPageQuerySchema = z.object({
  page: optInt(100000),
  pageSize: optInt(100),
  search: optStr(120),
  ownerType: optEnum(['ALL', 'user', 'superadmin', 'demo']),
  fielFilter: optEnum(['ALL', 'WITH_FIEL', 'WITHOUT_FIEL']),
  sortBy: optEnum(['createdAt', 'polizasCount', 'cfdisCount']),
  sortDir: optEnum(['asc', 'desc'])
});

export const usersPageQuerySchema = z.object({
  page: optInt(100000),
  pageSize: optInt(100),
  search: optStr(120),
  status: optEnum(['ALL', 'ACTIVO', 'SUSPENDIDO']),
  role: optEnum(['ALL', 'SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS', 'NONE'])
});

export const auditLogsPageQuerySchema = z.object({
  page: optInt(100000),
  pageSize: optInt(100),
  search: optStr(120),
  action: optStr(120),
  targetType: optStr(80)
});

export const userRoleSchema = z.object({
  platformRole: z.enum(['SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS', 'NONE'])
});

export const workspaceQuotaSchema = z.object({
  userId: z.string().trim().min(1).nullable().optional(),
  planTier: z.enum(['FREE', 'PRO', 'DESPACHO', 'ENTERPRISE']),
  maxCompanies: z.coerce.number().int().min(1).max(10000),
  maxCfdisPerMonth: z.coerce.number().int().min(1).max(10_000_000),
  maxStorageMb: z.coerce.number().int().min(10).max(10_000_000),
  notes: z.string().trim().max(500).nullable().optional()
});

export const alertQuerySchema = z.object({ status: optEnum(['ALL', 'open', 'acknowledged', 'resolved']) });
export const alertStatusSchema = z.object({ status: z.enum(['open', 'acknowledged', 'resolved']) });

/**
 * Valida los parámetros query de una petición Hono contra un esquema Zod.
 */
export function parseQuery<T>(c: Context, schema: z.ZodType<T>): { data: T } | { error: string } {
  const parsed = schema.safeParse(c.req.query());
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Parámetros de consulta inválidos.' };
  return { data: parsed.data };
}

/**
 * Extrae el correo y userId del operador desde los headers de la petición administrativa.
 */
export function getActorContext(c: Context<AdminEnv>): { actorEmail: string; actorUserId: string | null } {
  const email = (c.req.header('X-User-Email') || c.req.header('x-user-email') || '').trim().toLowerCase();
  const userId = (c.req.header('X-User-Id') || c.req.header('x-user-id') || '').trim();
  const fallbackActor = c.get('callerRole') === 'SUPERADMIN' ? 'hlopezb@gmail.com' : (userId || 'platform-operator');
  return { actorEmail: email || fallbackActor, actorUserId: userId || null };
}

/**
 * Parsea y valida el cuerpo JSON de una petición Hono contra un esquema Zod.
 */
export async function parseJsonBody<T>(c: Context, schema: z.ZodType<T>): Promise<{ data: T } | { error: string }> {
  try {
    const raw: unknown = await c.req.json();
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Payload inválido.' };
    return { data: parsed.data };
  } catch {
    return { error: 'JSON inválido en la solicitud.' };
  }
}
