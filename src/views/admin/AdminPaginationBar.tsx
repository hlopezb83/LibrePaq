import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';

export interface AdminPaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (nextPage: number) => void;
  isFetching?: boolean;
}

const BTN_CLASS =
  'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 border border-slate-300 font-semibold transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

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
  const prevDisabled = safePage <= 1 || isFetching;
  const nextDisabled = safePage >= safeTotalPages || isFetching;
  const prevDisabledReason = isFetching ? 'Cargando página...' : 'Ya estás en la primera página';
  const nextDisabledReason = isFetching ? 'Cargando página...' : 'Ya estás en la última página';

  return (
    <nav
      aria-label={`Paginación de ${itemLabel}`}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-300/80 rounded-xl px-4 py-2.5 text-xs text-slate-700"
    >
      <p aria-live="polite" className="tabular-nums flex items-center gap-1.5">
        <span>
          Mostrando <span className="font-bold text-slate-900">{start.toLocaleString('es-MX')}</span>–
          <span className="font-bold text-slate-900">{end.toLocaleString('es-MX')}</span> de{' '}
          <span className="font-bold text-slate-900">{total.toLocaleString('es-MX')}</span> {itemLabel}
        </span>
        {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600 shrink-0" aria-hidden="true" />}
      </p>

      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {safeTotalPages > 2 && (
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={prevDisabled}
            title={prevDisabled ? prevDisabledReason : undefined}
            aria-label="Primera página"
            className={BTN_CLASS}
          >
            <ChevronsLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Primera
          </button>
        )}

        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={prevDisabled}
          title={prevDisabled ? prevDisabledReason : undefined}
          aria-label="Página anterior"
          className={BTN_CLASS}
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Anterior
        </button>

        <span className="px-2 font-semibold text-slate-800 tabular-nums">
          Página {safePage} de {safeTotalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={nextDisabled}
          title={nextDisabled ? nextDisabledReason : undefined}
          aria-label="Página siguiente"
          className={BTN_CLASS}
        >
          Siguiente
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        {safeTotalPages > 2 && (
          <button
            type="button"
            onClick={() => onPageChange(safeTotalPages)}
            disabled={nextDisabled}
            title={nextDisabled ? nextDisabledReason : undefined}
            aria-label="Última página"
            className={BTN_CLASS}
          >
            Última
            <ChevronsRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </nav>
  );
}
