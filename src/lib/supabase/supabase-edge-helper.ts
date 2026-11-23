import { supabase } from '../supabase';
import type { AdminPaginatedResponse } from '../../shared/admin-types';

/** Indica si un mensaje de error corresponde a una denegación de permisos o sesión. */
export function isForbiddenMsg(msg?: string): boolean {
  const upper = String(msg || '').toUpperCase();
  return upper.includes('FORBIDDEN') || upper.includes('UNAUTHORIZED');
}

/** Invoca una Edge Function administrativa y distingue indisponibilidad de errores de negocio. */
export async function invokeAdminEdge<T>(
  fnName: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; unavailable: boolean }> {
  if (!supabase) throw new Error('Supabase no disponible');
  const { data, error } = await supabase.functions.invoke<T & { ok?: boolean; error?: string }>(fnName, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const status = ctx?.status;
    if (!status || status === 404 || status === 502 || status === 503) return { data: null, unavailable: true };
    let msg = error.message || `Error en Edge Function ${fnName}`;
    try {
      const json = (await ctx?.json()) as { error?: string } | undefined;
      if (json?.error) msg = json.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data && typeof data === 'object' && 'error' in data && data.error && !data.ok) {
    throw new Error(String(data.error));
  }
  return { data: (data as T) ?? null, unavailable: false };
}

/** Ejecuta un RPC paginado propagando errores de autorización y devolviendo null en fallback. */
export async function callPaginatedRpc<T>(
  fnName: string,
  params: Record<string, unknown>
): Promise<AdminPaginatedResponse<T> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(fnName, params);
  if (!error && data && typeof data === 'object') return data as AdminPaginatedResponse<T>;
  if (error && isForbiddenMsg(error.message)) throw new Error(error.message);
  return null;
}

/** Pagina en memoria una colección como respaldo cuando el RPC no está disponible. */
export function paginateSlice<T>(items: T[], page: number, pageSize: number): AdminPaginatedResponse<T> {
  const safeSize = Math.min(100, Math.max(1, pageSize));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safeSize;
  return { items: items.slice(start, start + safeSize), total, page: safePage, pageSize: safeSize, totalPages };
}
