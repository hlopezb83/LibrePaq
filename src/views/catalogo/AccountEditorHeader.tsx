import { StatusBadge } from '../../components/ui';
import type { Company } from '../../shared/types';

export function AccountEditorSubtitle({
  activeCompany,
  currentYear
}: {
  activeCompany?: Company | null;
  currentYear?: number;
}) {
  return (
    <span className="inline-flex items-center gap-2 flex-wrap text-xs text-slate-600">
      <span className="font-bold text-slate-800">{activeCompany?.name}</span>
      {activeCompany?.rfc && (
        <StatusBadge tone="slate" shape="tag" className="text-[11px]">
          {activeCompany.rfc}
        </StatusBadge>
      )}
      <span className="text-slate-400" aria-hidden="true">•</span>
      <span className="font-mono tabular-nums text-[11px] text-blue-700 font-semibold">
        Ejercicio {currentYear}
      </span>
    </span>
  );
}
