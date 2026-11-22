import type { PostgrestResponse } from '@supabase/supabase-js';
import { chunkArray } from '../../shared/array-utils';

export { chunkArray };

const DEFAULT_PAGE_SIZE = 1000;

/**
 * Paginador universal para PostgREST (Supabase).
 * Supera el límite por defecto de 1,000 filas de PostgREST ejecutando bloques
 * secuenciales .range(from, to) ordenados de forma determinista hasta vaciar la consulta.
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  fetchPage: (from: number, to: number) => PromiseLike<PostgrestResponse<T>>,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<T[]> {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);

    if (error) {
      throw new Error(`Error en consulta paginada PostgREST: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows.push(...data);

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRows;
}
