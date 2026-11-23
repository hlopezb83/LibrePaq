import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface AdminPaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (nextPage: number) => void;
  isFetching?: boolean;
}

export function AdminPaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  itemLabel,
  onPageChange,
  isFetching = false
}: AdminPaginationBarProps) {
  if (total === 0) return null;

  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <nav
      aria-label={`Paginación de ${itemLabel}`}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-300/80 rounded-xl px-4 py-2.5 text-xs text-slate-700"
    >
      <p className="tabular-nums">
        Mostrando <span className="font-bold text-slate-900">{start.toLocaleString('es-MX')}</span>–
        <span className="font-bold text-slate-900">{end.toLocaleString('es-MX')}</span> de{' '}
        <span className="font-bold text-slate-900">{total.toLocaleString('es-MX')}</span> {itemLabel}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1 || isFetching}
          aria-label="Página anterior"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 border border-slate-300 font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Anterior
        </button>

        <span className="px-2 font-semibold text-slate-800 tabular-nums" aria-live="polite">
          Página {safePage} de {safeTotalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= safeTotalPages || isFetching}
          aria-label="Página siguiente"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 border border-slate-300 font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          Siguiente
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
