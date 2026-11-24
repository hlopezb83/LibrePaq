import { useMemo } from 'react';
import { BookOpen, Keyboard, ShieldCheck } from 'lucide-react';
import { sumCents } from '../../shared/accounting-engine';
import type { AccountWithBalance, Company } from '../../shared/types';

interface AppShellFooterProps {
  activeCompany: Company;
  currentTheme: { bg: string };
  onOpenShortcuts: () => void;
  accounts: AccountWithBalance[];
}

export function AppShellFooter({
  activeCompany,
  currentTheme,
  onOpenShortcuts,
  accounts
}: AppShellFooterProps) {
  const isTrialBalanced = useMemo(() => {
    const affectable = accounts.filter((a) => a.isAffectable);
    return sumCents(affectable.map((a) => a.periodCharges)) === sumCents(affectable.map((a) => a.periodCredits));
  }, [accounts]);

  return (
    <footer className="lg:sticky lg:bottom-0 z-20 bg-[#0A1120] text-slate-400 border-t border-[#1E293B] pl-3 pr-14 sm:pl-4 sm:pr-16 py-1.5 lg:py-1 text-[11px] no-print">
      <div className="max-w-[1800px] mx-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {/* Indicadores de Entorno Fiscal y Régimen SAT */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 font-mono text-slate-300 font-medium truncate">
            <span className={`w-2 h-2 rounded-full shrink-0 ${currentTheme.bg}`} />
            <span className="font-mono text-slate-300 text-[10.5px] truncate max-w-md">
              Régimen {activeCompany.regimenFiscal}
            </span>
          </span>
        </div>

        {/* Indicadores de Sistema y Auditoría */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <a
            href="/Manual_Usuario_LibrePaq_Pro.pdf"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir Manual de Usuario en PDF"
            title="Abrir o descargar el Manual de Usuario de LibrePaq Pro (PDF)"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#111C35] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-mono text-[10px] transition cursor-pointer"
          >
            <BookOpen className="w-3 h-3 text-emerald-400" aria-hidden="true" />
            <span className="hidden sm:inline">Manual PDF</span>
            <span className="sm:hidden">Manual</span>
          </a>
          <button
            type="button"
            onClick={onOpenShortcuts}
            aria-label="Abrir guía de atajos de teclado (F1)"
            title="Abrir Centro Unificado de Atajos de Teclado (F1 o ?)"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#111C35] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-mono text-[10px] transition cursor-pointer"
          >
            <Keyboard className="w-3 h-3 text-blue-400" aria-hidden="true" />
            <span className="hidden sm:inline">Atajos [F1]</span>
            <span className="sm:hidden">F1</span>
          </button>
          <span className="text-slate-600">|</span>
          <span
            className={`inline-flex items-center gap-1 font-semibold ${
              isTrialBalanced ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{isTrialBalanced ? 'Balanza Cuadrada ✔' : 'Balanza Descuadrada ⚠'}</span>
          </span>
          <span className="text-slate-600 hidden md:inline">|</span>
          <span className="hidden md:inline font-mono text-slate-400 text-[10px]">
            v1.2.0 Cloud
          </span>
        </div>
      </div>
    </footer>
  );
}
