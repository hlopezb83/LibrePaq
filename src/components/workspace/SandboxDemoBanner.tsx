import { useEffect, useRef, useState } from 'react';
import { FlaskConical, Loader2, Plus, Trash2 } from 'lucide-react';
import type { Company } from '../../shared/types';
import { useSandboxDemoActions } from './useWorkspaceActions';

interface SandboxDemoBannerProps {
  company: Company;
  onOpenNewCompanyWizard: () => void;
  onDemoDeleted: () => void;
}

export function SandboxDemoBanner({
  company,
  onOpenNewCompanyWizard,
  onDemoDeleted
}: SandboxDemoBannerProps) {
  const { isDeleting, handleDeleteDemo } = useSandboxDemoActions(company.id, onDemoDeleted);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingRef = useRef(false);

  useEffect(() => {
    if (confirmDelete) {
      wasConfirmingRef.current = true;
      requestAnimationFrame(() => cancelBtnRef.current?.focus());
    } else if (wasConfirmingRef.current) {
      wasConfirmingRef.current = false;
      requestAnimationFrame(() => deleteBtnRef.current?.focus());
    }
  }, [confirmDelete]);

  return (
    <aside
      aria-label="Aviso de Empresa Ejemplo"
      className="mb-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50/70 to-amber-50 border border-amber-300/90 px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-2xs no-print"
    >
      <div className="flex items-start lg:items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-800 flex items-center justify-center shrink-0">
          <FlaskConical className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="text-xs text-amber-950 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-mono font-extrabold text-[10px] uppercase tracking-wider">
              Empresa Ejemplo (Demo)
            </span>
            <span className="font-bold">
              Estás explorando una Empresa Ejemplo con pólizas y CFDIs de prueba.
            </span>
          </div>
          <p className="text-[11px] text-amber-800 mt-0.5">
            Inspecciona Pólizas, Balanza Anexo 24, Bóveda CFDI y Cédula Día 17 sin afectar tu contabilidad real.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <button
          type="button"
          onClick={onOpenNewCompanyWizard}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Crear Mi Empresa Real</span>
        </button>

        {confirmDelete ? (
          <div
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !isDeleting) {
                e.preventDefault();
                setConfirmDelete(false);
              }
            }}
            className="inline-flex flex-wrap items-center gap-1.5 bg-red-50 border border-red-300 rounded-xl px-2 py-1"
          >
            <span className="text-[11px] font-bold text-red-900">¿Eliminar demo?</span>
            <button
              type="button"
              disabled={isDeleting}
              aria-busy={isDeleting}
              onClick={() => void handleDeleteDemo()}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
            >
              {isDeleting && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
              <span>{isDeleting ? 'Eliminando...' : 'Sí, eliminar'}</span>
            </button>
            <button
              ref={cancelBtnRef}
              type="button"
              disabled={isDeleting}
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            ref={deleteBtnRef}
            type="button"
            disabled={isDeleting}
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-amber-300 hover:border-red-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Borrar Demo</span>
          </button>
        )}
      </div>
    </aside>
  );
}
