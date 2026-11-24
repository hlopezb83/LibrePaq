import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Company } from '../../shared/types';
import { getCompanyInitials } from '../company-switcher/companyThemes';
import { StatusBadge } from '../ui';

interface AppShellCompanyAlertProps {
  company: Company;
  currentTheme: { bg: string; text: string; border: string };
  onDismiss: () => void;
}

export function AppShellCompanyAlert({
  company,
  currentTheme,
  onDismiss
}: AppShellCompanyAlertProps) {
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = window.setTimeout(onDismiss, 8000);
    return () => window.clearTimeout(timer);
  }, [company.id, isPaused, onDismiss]);

  return (
    <div
      role="status"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      className="mb-3 px-3.5 py-2.5 rounded-2xl bg-white border border-blue-300 text-slate-900 shadow-2xs flex items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top duration-300 no-print"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          aria-hidden="true"
          className={`w-7 h-7 rounded-lg ${currentTheme.bg} ${currentTheme.text} font-mono font-bold text-[10px] flex items-center justify-center shrink-0 border ${currentTheme.border}`}
        >
          {getCompanyInitials(company.name)}
        </div>
        <div className="text-xs flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <span className="font-bold text-slate-900 truncate">
            Empresa activa: {company.name}
          </span>
          <StatusBadge tone="blue" shape="tag">
            {company.rfc}
          </StatusBadge>
          <StatusBadge tone="emerald" dot className="hidden md:inline-flex">
            Contexto verificado
          </StatusBadge>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Descartar aviso de cambio de empresa"
        className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer shrink-0 transition-colors"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
