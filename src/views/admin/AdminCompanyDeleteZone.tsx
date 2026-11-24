import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

interface AdminCompanyDeleteZoneProps {
  companyId: string;
  companyName?: string;
  companyRfc: string;
  isDeleting: boolean;
  onDeleteCompany: (companyId: string) => Promise<void> | void;
  onDeleted: () => void;
}

export function AdminCompanyDeleteZone({
  companyId,
  companyName,
  companyRfc,
  isDeleting,
  onDeleteCompany,
  onDeleted
}: AdminCompanyDeleteZoneProps) {
  const [confirmRfc, setConfirmRfc] = useState('');
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setConfirmRfc('');
    setShowDeleteZone(false);
  }, [companyId]);

  const closeDeleteZone = () => {
    if (isDeleting) return;
    setShowDeleteZone(false);
    setConfirmRfc('');
    requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  };

  const isRfcMatch = confirmRfc.trim().toUpperCase() === companyRfc.toUpperCase();

  const handleDelete = async () => {
    if (!isRfcMatch || isDeleting) return;
    try {
      await onDeleteCompany(companyId);
      onDeleted();
    } catch {
      /* toast handled in mutation onError */
    }
  };

  return (
    <section aria-labelledby="danger-zone-title" className="p-4 rounded-xl border border-red-200 bg-red-50/60 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div>
          <h3 id="danger-zone-title" className="font-bold text-red-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-700" aria-hidden="true" />
            Zona Peligrosa — Baja Definitiva de Empresa
          </h3>
          <p className="text-red-800 mt-0.5">
            Elimina permanentemente la empresa, pólizas, cuentas, CFDIs y conciliaciones.
          </p>
        </div>
        {!showDeleteZone && (
          <button
            ref={deleteTriggerRef}
            type="button"
            onClick={() => setShowDeleteZone(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-red-300 text-red-800 hover:bg-red-100 text-xs font-bold transition cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Depurar / Eliminar Empresa
          </button>
        )}
      </div>
      {showDeleteZone && (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby="danger-zone-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !isDeleting) {
              e.stopPropagation();
              closeDeleteZone();
            }
          }}
          className="p-3 rounded-lg bg-white border border-red-200 space-y-2.5 text-xs"
        >
          <label htmlFor="confirm-delete-rfc" className="block font-semibold text-slate-800">
            Escribe el RFC exacto <span className="font-mono font-bold text-red-700">{companyRfc}</span>{' '}
            {companyName ? (
              <>
                para eliminar definitivamente <span className="font-bold text-slate-900">{companyName}</span>:
              </>
            ) : (
              'para confirmar:'
            )}
          </label>
          <input
            id="confirm-delete-rfc"
            type="text"
            disabled={isDeleting}
            value={confirmRfc}
            onChange={(e) => setConfirmRfc(e.target.value)}
            placeholder={companyRfc}
            autoComplete="off"
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              autoFocus
              disabled={isDeleting}
              onClick={closeDeleteZone}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!isRfcMatch || isDeleting}
              aria-busy={isDeleting}
              title={
                isDeleting
                  ? 'Eliminando empresa y registros...'
                  : !isRfcMatch
                    ? 'Escribe el RFC exacto para habilitar la baja'
                    : undefined
              }
              onClick={() => void handleDelete()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold cursor-pointer"
            >
              {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              <span>{isDeleting ? 'Eliminando...' : 'Confirmar Eliminación'}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
