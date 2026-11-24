import { Layers, X } from 'lucide-react';
import type { Company } from '../../shared/types';

interface AccountEditorHeaderProps {
  editingAccountId: string | null;
  activeCompany?: Company | null;
  currentYear?: number;
  onClose: () => void;
}

export function AccountEditorHeader({
  editingAccountId,
  activeCompany,
  currentYear,
  onClose
}: AccountEditorHeaderProps) {
  return (
    <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-200 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
          <Layers className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 id="modal-account-title" className="text-base font-bold text-slate-900">
            {editingAccountId ? 'Editar Cuenta Contable' : 'Nueva Cuenta Contable'}
          </h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-slate-600">
            <span className="font-bold text-slate-800">{activeCompany?.name}</span>
            <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 text-[11px] font-bold">
              {activeCompany?.rfc}
            </span>
            <span className="text-slate-400" aria-hidden="true">•</span>
            <span className="font-mono text-[11px] text-blue-700 font-semibold">
              Ejercicio {currentYear}
            </span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar ventana"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer shrink-0"
      >
        <X className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
}
