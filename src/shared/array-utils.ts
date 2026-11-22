/**
 * Divide un arreglo en lotes (chunks) de tamaño máximo especificado.
 * Previene la saturación del event-loop y desbordes en HTTP/DB queries.
 */
export function chunkArray<T>(items: readonly T[], chunkSize = 150): T[][] {
  if (items.length === 0) return [];
  const safeChunkSize = Math.max(1, chunkSize);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += safeChunkSize) {
    chunks.push(items.slice(i, i + safeChunkSize));
  }
  return chunks;
}
