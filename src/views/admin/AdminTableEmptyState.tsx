import { Search } from 'lucide-react';
import { ClearFiltersButton, EmptyState } from '../../components/ui';

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
      <td colSpan={colSpan} className="border-b border-slate-200">
        <EmptyState
          tone={hasActiveFilters ? 'slate' : 'blue'}
          icon={<Search className="w-5 h-5" aria-hidden="true" />}
          title={message}
          actions={
            hasActiveFilters && onResetFilters ? (
              <ClearFiltersButton label="Restablecer filtros" onClick={onResetFilters} />
            ) : undefined
          }
        />
      </td>
    </tr>
  );
}
