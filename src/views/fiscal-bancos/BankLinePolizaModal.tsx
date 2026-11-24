import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import { fromCents, toCents } from '../../shared/engine/invariants-and-math';
import type { AccountWithBalance, BankStatementLine } from '../../shared/types';

interface BankLinePolizaModalProps {
  line: BankStatementLine | null;
  accounts: readonly AccountWithBalance[];
  currentBankAccountId: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (lineId: string, options: { counterAccountCode: string; desglosarIva: boolean }) => void;
}

export function BankLinePolizaModal({
  line,
  accounts,
  currentBankAccountId,
  isSubmitting,
  onClose,
  onSubmit
}: BankLinePolizaModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const affectable = accounts.filter((a) => a.isAffectable && a.id !== currentBankAccountId);
  const bankAcc = accounts.find((a) => a.id === currentBankAccountId);
  const isWithdrawal = Boolean(line && line.cargoBanco > 0);
  const [counterCode, setCounterCode] = useState('');
  const [desglosarIva, setDesglosarIva] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const findByHints = (prefixes: string[], keywords: string[]): string => {
    const byKw = affectable.find(
      (a) =>
        prefixes.some((p) => a.code.startsWith(p)) &&
        keywords.some((kw) => a.name.toLowerCase().includes(kw))
    );
    if (byKw) return byKw.code;
    return affectable.find((a) => prefixes.some((p) => a.code.startsWith(p)))?.code ?? affectable[0]?.code ?? '';
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!line) {
      if (dialog?.open) dialog.close();
      setIsDirty(false);
      setConfirmDiscard(false);
      return;
    }
    const withdrawal = line.cargoBanco > 0;
    const defaultCode = withdrawal
      ? findByHints(['601', '701'], ['comision', 'bancari', 'gasto'])
      : findByHints(['401', '702'], ['venta', 'ingreso', 'interes']);
    setCounterCode(defaultCode);
    setDesglosarIva(withdrawal);
    setIsDirty(false);
    setConfirmDiscard(false);
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, [line?.id]);

  const handleSafeClose = useCallback(() => {
    if (isSubmitting) return;
    if (isDirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    setIsDirty(false);
    dialogRef.current?.close();
    onClose();
  }, [isSubmitting, isDirty, confirmDiscard, onClose]);

  useDialogLightDismiss(dialogRef, handleSafeClose, { isOpen: Boolean(line), deferClose: true });

  const amount = line ? (line.cargoBanco > 0 ? line.cargoBanco : line.abonoBanco) : 0;
  const totalCents = toCents(amount);
  const baseCents = desglosarIva ? Math.round(totalCents / 1.16) : totalCents;
  const ivaCents = desglosarIva ? totalCents - baseCents : 0;
  const baseAmt = fromCents(baseCents);
  const ivaAmt = fromCents(ivaCents);

  const applyPreset = (preset: 'COMISION' | 'INTERES' | 'TRASPASO' | 'IMPUESTOS') => {
    if (preset === 'COMISION') {
      setCounterCode(findByHints(['601', '701'], ['comision', 'bancari']));
      setDesglosarIva(true);
    } else if (preset === 'INTERES') {
      setCounterCode(findByHints(['702', '401'], ['interes', 'financiero', 'producto']));
      setDesglosarIva(false);
    } else if (preset === 'TRASPASO') {
      setCounterCode(findByHints(['102'], ['banco']));
      setDesglosarIva(false);
    } else {
      setCounterCode(findByHints(['213', '216', '208'], ['impuesto', 'isr', 'iva', 'retencion']));
      setDesglosarIva(false);
    }
    setIsDirty(true);
    setConfirmDiscard(false);
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="closerequest"
      onCancel={(e) => {
        e.preventDefault();
        handleSafeClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          handleSafeClose();
        }
      }}
      aria-labelledby="bank-line-poliza-title"
      className="rounded-2xl border border-slate-300 bg-white shadow-2xl w-full max-w-lg max-h-[92dvh] open:flex open:flex-col overflow-hidden backdrop:bg-slate-900/60 p-0 m-auto"
    >
      {line && (
        <>
          <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-5 py-4 shrink-0 bg-white">
            <div>
              <h2 id="bank-line-poliza-title" className="text-sm font-bold text-slate-900">
                Generar Póliza desde Movimiento Bancario
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {formatShortDate(line.fecha)} · {line.referencia} · {isWithdrawal ? 'Retiro' : 'Depósito'}{' '}
                <strong className="font-mono text-slate-900">{formatCurrency(amount)}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={handleSafeClose}
              disabled={isSubmitting}
              aria-label="Cerrar diálogo"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setConfirmDiscard(false);
              onSubmit(line.id, { counterAccountCode: counterCode, desglosarIva });
            }}
            className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain text-xs"
          >
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700">
              <span className="font-semibold text-slate-900">Concepto bancario:</span> {line.descripcion}
            </div>

            <div className="space-y-1.5">
              <span className="block text-[11px] font-bold uppercase text-slate-600">Atajos Rápidos</span>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => applyPreset('COMISION')} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 cursor-pointer">
                  Comisiones c/IVA
                </button>
                <button type="button" onClick={() => applyPreset('INTERES')} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 cursor-pointer">
                  Intereses s/IVA
                </button>
                <button type="button" onClick={() => applyPreset('TRASPASO')} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200 cursor-pointer">
                  Traspaso entre Cuentas
                </button>
                <button type="button" onClick={() => applyPreset('IMPUESTOS')} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 cursor-pointer">
                  Pago Impuestos SAT
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="bank-poliza-counter-account" className="block font-bold text-slate-700 mb-1">
                Contracuenta Contable
              </label>
              <select
                id="bank-poliza-counter-account"
                value={counterCode}
                onChange={(e) => {
                  setCounterCode(e.target.value);
                  setIsDirty(true);
                  setConfirmDiscard(false);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-900"
              >
                {affectable.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>

            <label htmlFor="bank-poliza-iva-toggle" className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="bank-poliza-iva-toggle"
                type="checkbox"
                checked={desglosarIva}
                onChange={(e) => {
                  setDesglosarIva(e.target.checked);
                  setIsDirty(true);
                  setConfirmDiscard(false);
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span className="font-semibold text-slate-800">Desglosar IVA 16% automáticamente</span>
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
              <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                Previsualización de Póliza (Partida Doble)
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th scope="col" className="py-1.5 px-3 text-left">Cuenta</th>
                    <th scope="col" className="py-1.5 px-3 text-right">Debe</th>
                    <th scope="col" className="py-1.5 px-3 text-right">Haber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                  {isWithdrawal ? (
                    <>
                      <tr>
                        <td className="py-1.5 px-3 text-slate-800">{counterCode || 'Contracuenta'}</td>
                        <td className="py-1.5 px-3 text-right text-slate-900">{formatCurrency(baseAmt)}</td>
                        <td className="py-1.5 px-3 text-right text-slate-400">—</td>
                      </tr>
                      {desglosarIva && ivaAmt > 0 && (
                        <tr>
                          <td className="py-1.5 px-3 text-slate-800">118-01 IVA Acreditable Pagado (16%)</td>
                          <td className="py-1.5 px-3 text-right text-slate-900">{formatCurrency(ivaAmt)}</td>
                          <td className="py-1.5 px-3 text-right text-slate-400">—</td>
                        </tr>
                      )}
                      <tr>
                        <td className="py-1.5 px-3 text-slate-800">{bankAcc?.code ?? '102-01'} Bancos</td>
                        <td className="py-1.5 px-3 text-right text-slate-400">—</td>
                        <td className="py-1.5 px-3 text-right text-slate-900">{formatCurrency(amount)}</td>
                      </tr>
                    </>
                  ) : (
                    <>
                      <tr>
                        <td className="py-1.5 px-3 text-slate-800">{bankAcc?.code ?? '102-01'} Bancos</td>
                        <td className="py-1.5 px-3 text-right text-slate-900">{formatCurrency(amount)}</td>
                        <td className="py-1.5 px-3 text-right text-slate-400">—</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 text-slate-800">{counterCode || 'Contracuenta'}</td>
                        <td className="py-1.5 px-3 text-right text-slate-400">—</td>
                        <td className="py-1.5 px-3 text-right text-slate-900">{formatCurrency(baseAmt)}</td>
                      </tr>
                      {desglosarIva && ivaAmt > 0 && (
                        <tr>
                          <td className="py-1.5 px-3 text-slate-800">208-01 IVA Trasladado Cobrado (16%)</td>
                          <td className="py-1.5 px-3 text-right text-slate-400">—</td>
                          <td className="py-1.5 px-3 text-right text-slate-900">{formatCurrency(ivaAmt)}</td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {confirmDiscard && (
              <div role="alert" className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-2 text-amber-950">
                <span>¿Descartar cambios en la selección de contracuenta?</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmDiscard(false)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 font-semibold cursor-pointer"
                  >
                    Seguir editando
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDiscard(false);
                      setIsDirty(false);
                      dialogRef.current?.close();
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-700 text-white font-semibold cursor-pointer"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onClick={handleSafeClose} disabled={isSubmitting} className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold disabled:opacity-50 cursor-pointer">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !counterCode}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />}
                {isSubmitting ? 'Generando...' : 'Generar Póliza y Conciliar'}
              </button>
            </div>
          </form>
        </>
      )}
    </dialog>
  );
}
