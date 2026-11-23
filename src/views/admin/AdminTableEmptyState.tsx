export interface AdminTableEmptyStateProps {
  colSpan: number;
  message: string;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
}

export function AdminTableEmptyState({
  colSpan,
  message,
  hasActiveFilters = false,
  onResetFilters
}: AdminTableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-slate-600">
        <div className="flex flex-col items-center gap-2">
          <span>{message}</span>
          {hasActiveFilters && onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Restablecer filtros
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
