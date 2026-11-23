export interface ParsedNavTarget {
  to: string;
  search?: Record<string, string>;
}

/**
 * Separa rutas con querystring (ej. '/admin?tab=users') en { to, search }
 * para navegación tipada y reactiva con TanStack Router.
 */
export function parseNavTarget(target: string): ParsedNavTarget {
  const qIndex = target.indexOf('?');
  if (qIndex === -1) return { to: target };
  const to = target.slice(0, qIndex) || '/';
  const rawQuery = target.slice(qIndex + 1);
  if (!rawQuery) return { to };
  const params = new URLSearchParams(rawQuery);
  const search: Record<string, string> = {};
  params.forEach((value, key) => {
    search[key] = value;
  });
  return Object.keys(search).length > 0 ? { to, search } : { to };
}
