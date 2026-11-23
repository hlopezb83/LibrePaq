import React from 'react';
import { Landmark, X } from 'lucide-react';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';

interface AddBankStatementLineModalProps {
  addBankModalRef: React.RefObject<HTMLDialogElement | null>;
  bFecha: string;
  setBFecha: (d: string) => void;
  bRef: string;
  setBRef: (r: string) => void;
  bDesc: string;
  setBDesc: (d: string) => void;
  bTipo: 'CARGO' | 'ABONO';
  setBTipo: (t: 'CARGO' | 'ABONO') => void;
  bMonto: number;
  setBMonto: (m: number) => void;
  onAddBankLineSubmit: (e: React.FormEvent) => void;
  isAddBankLinePending: boolean;
}

export function AddBankStatementLineModal({
  addBankModalRef,
  bFecha,
  setBFecha,
  bRef,
  setBRef,
  bDesc,
  setBDesc,
  bTipo,
  setBTipo,
  bMonto,
  setBMonto,
  onAddBankLineSubmit,
  isAddBankLinePending
}: AddBankStatementLineModalProps) {
  useDialogLightDismiss(addBankModalRef, () => addBankModalRef.current?.close());

  return (
    <dialog
      ref={addBankModalRef}
      closedby="any"
      aria-labelledby="modal-add-bank-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden backdrop:bg-slate-900/60 p-0 m-auto"
    >
      <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-3.5">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
              <Landmark className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="modal-add-bank-title" className="text-base font-bold text-slate-900">
                Registrar Movimiento en Estado de Cuenta
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Captura manual para conciliar partidas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => addBankModalRef.current?.close()}
            aria-label="Cerrar modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={onAddBankLineSubmit} className="space-y-3.5">
          <div>
            <label
              htmlFor="bank-line-date"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Fecha del Movimiento Bancario *
            </label>
            <input
              id="bank-line-date"
              type="date"
              required
              value={bFecha}
              onChange={(e) => setBFecha(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="bank-line-type"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Tipo de Operación *
              </label>
              <select
                id="bank-line-type"
                value={bTipo}
                onChange={(e) => setBTipo(e.target.value as 'CARGO' | 'ABONO')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="CARGO">Cargo (Retiro / Salida)</option>
                <option value="ABONO">Abono (Depósito / Entrada)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="bank-line-amount"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Importe $ *
              </label>
              <input
                id="bank-line-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                value={bMonto}
                onChange={(e) => setBMonto(Number(e.target.value || 0))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="bank-line-ref"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Referencia o Folio Bancario *
            </label>
            <input
              id="bank-line-ref"
              type="text"
              required
              value={bRef}
              onChange={(e) => setBRef(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono uppercase"
            />
          </div>

          <div>
            <label
              htmlFor="bank-line-desc"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Descripción en Estado de Cuenta *
            </label>
            <input
              id="bank-line-desc"
              type="text"
              required
              value={bDesc}
              onChange={(e) => setBDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => addBankModalRef.current?.close()}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isAddBankLinePending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 cursor-pointer"
            >
              {isAddBankLinePending ? 'Registrando...' : 'Guardar Partida'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
