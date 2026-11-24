import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { Company } from '../../shared/types';

export interface ConfirmDeleteCompanyModalProps {
  targetCompany: Company | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirmDelete: (companyId: string) => void;
}

export function ConfirmDeleteCompanyModal({
  targetCompany,
  isDeleting,
  onClose,
  onConfirmDelete
}: ConfirmDeleteCompanyModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rfcInput, setRfcInput] = useState('');

  useEffect(() => {
    setRfcInput('');
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (targetCompany && !dlg.open) {
      dlg.showModal();
    } else if (!targetCompany && dlg.open) {
      dlg.close();
    }
  }, [targetCompany]);

  const expectedRfc = targetCompany?.rfc.trim().toUpperCase() ?? '';
  const isRfcMatch = Boolean(expectedRfc && rfcInput.trim().toUpperCase() === expectedRfc);

  return (
    <dialog
      ref={dialogRef}
      closedby={isDeleting ? 'none' : 'any'}
      aria-labelledby="confirm-delete-company-title"
      onCancel={(e) => {
        if (isDeleting) {
          e.preventDefault();
          return;
        }
        onClose();
      }}
      className="m-auto w-full max-w-md rounded-2xl border border-red-300 bg-white p-0 shadow-2xl backdrop:bg-slate-900/55"
    >
      {targetCompany && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isRfcMatch && !isDeleting) {
              onConfirmDelete(targetCompany.id);
            }
          }}
          className="p-5 sm:p-6 space-y-4 text-xs"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <h3 id="confirm-delete-company-title" className="text-sm font-bold text-red-950">
                  Confirmar baja definitiva de empresa
                </h3>
                <p className="text-slate-600">
                  <strong className="text-slate-900">{targetCompany.name}</strong> ·{' '}
                  <span className="font-mono font-bold text-slate-800">{expectedRfc}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              aria-label="Cerrar confirmación de baja"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <p className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 leading-relaxed">
            Esta acción eliminará de forma irreversible todas las pólizas, catálogos, CFDIs y conciliaciones vinculados a esta empresa.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="confirm-delete-rfc-input" className="block font-bold text-slate-800">
              Para confirmar, escribe el RFC exacto:{' '}
              <span className="font-mono text-red-700">{expectedRfc}</span>
            </label>
            <input
              id="confirm-delete-rfc-input"
              type="text"
              autoFocus
              disabled={isDeleting}
              value={rfcInput}
              onChange={(e) => setRfcInput(e.target.value.toUpperCase())}
              placeholder={expectedRfc}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 uppercase focus:outline-red-600 disabled:bg-slate-100"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isRfcMatch || isDeleting}
              aria-busy={isDeleting}
              title={!isRfcMatch ? `Escribe ${expectedRfc} para habilitar la baja definitiva` : undefined}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold bg-red-700 hover:bg-red-800 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              <span>{isDeleting ? 'Eliminando...' : 'Sí, eliminar permanentemente'}</span>
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
