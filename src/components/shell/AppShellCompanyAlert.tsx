import { X } from 'lucide-react';
import type { Company } from '../../shared/types';

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
  return (
    <div
      role="status"
      className="mb-4 p-3.5 rounded-2xl bg-[#0A1120] border-2 border-blue-500 text-white shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top duration-300 no-print"
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-xl ${currentTheme.bg} ${currentTheme.text} font-mono font-bold text-xs flex items-center justify-center shrink-0 border ${currentTheme.border} shadow-xs`}
        >
          {company.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="text-xs font-bold flex items-center gap-2 flex-wrap">
            <span>Espacio de Trabajo Activo: {company.name}</span>
            <span className="font-mono bg-blue-950 px-2 py-0.5 rounded text-[11px] font-bold text-blue-300 border border-blue-500/50">
              RFC: {company.rfc}
            </span>
            <span className="text-emerald-400 text-[11px] font-semibold">● Contexto Verificado</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-0.5">
            Has cambiado de entidad fiscal. Todos los comprobantes CFDI 4.0, pólizas y conciliaciones que proceses se imputarán a esta empresa.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Descartar aviso de cambio de empresa"
        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
