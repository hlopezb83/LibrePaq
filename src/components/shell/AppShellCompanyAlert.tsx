import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Company } from '../../shared/types';
import { getCompanyInitials } from '../company-switcher/companyThemes';

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
      className="dark-surface mb-3 px-3 py-2 rounded-xl bg-[#0A1120] border border-blue-500 text-white shadow-md flex items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top duration-300 no-print"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          aria-hidden="true"
          className={`w-7 h-7 rounded-lg ${currentTheme.bg} ${currentTheme.text} font-mono font-bold text-[10px] flex items-center justify-center shrink-0 border ${currentTheme.border}`}
        >
          {getCompanyInitials(company.name)}
        </div>
        <div className="text-xs flex items-center gap-2 min-w-0 flex-1">
          <span className="font-bold truncate">
            Empresa activa: {company.name}
          </span>
          <span className="font-mono bg-blue-950 px-1.5 py-0.5 rounded text-[11px] font-bold text-blue-200 border border-blue-500/50 shrink-0">
            {company.rfc}
          </span>
          <span className="hidden md:inline text-emerald-300 text-[11px] font-semibold shrink-0">
            Contexto verificado
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Descartar aviso de cambio de empresa"
        className="dark-focus-ring p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer shrink-0"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
