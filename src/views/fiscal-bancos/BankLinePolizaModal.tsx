import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { AlertBanner, Button, FormField, ModalShell, Select } from '../../components/ui';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { BankCounterLineInput } from '../../shared/engine/bank-and-closing.engine';
import { fromCents, toCents } from '../../shared/engine/invariants-and-math';
import type { AccountWithBalance, BankStatementLine } from '../../shared/types';
import { BankLinePolizaMultiLines, BankLineSinglePreviewTable, type MultiCounterRow } from './BankLinePolizaMultiLines';

interface BankLinePolizaModalProps {
  line: BankStatementLine | null;
  accounts: readonly AccountWithBalance[];
  currentBankAccountId: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (
    lineId: string,
    options: { counterAccountCode: string; desglosarIva: boolean; counterLines?: ReadonlyArray<BankCounterLineInput> }
  ) => void;
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
  const [multiMode, setMultiMode] = useState(false);
  const [multiRows, setMultiRows] = useState<MultiCounterRow[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const findByHints = (prefixes: string[], keywords: string[]): string => {
    const byKw = affectable.find((a) => prefixes.some((p) => a.code.startsWith(p)) && keywords.some((kw) => a.name.toLowerCase().includes(kw)));
    return byKw?.code ?? affectable.find((a) => prefixes.some((p) => a.code.startsWith(p)))?.code ?? affectable[0]?.code ?? '';
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
    const defaultCode = withdrawal ? findByHints(['601', '701'], ['comision', 'bancari', 'gasto']) : findByHints(['401', '702'], ['venta', 'ingreso', 'interes']);
    const lineAmt = withdrawal ? line.cargoBanco : line.abonoBanco;
    setCounterCode(defaultCode);
    setDesglosarIva(withdrawal);
    setMultiMode(false);
    setMultiRows([{ id: 'bcl_init', accountCode: defaultCode, side: withdrawal ? 'CARGO' : 'ABONO', amount: lineAmt, concepto: line.descripcion || '' }]);
    setIsDirty(false);
    setConfirmDiscard(false);
    if (dialog && !dialog.open) dialog.showModal();
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

  const amount = line ? (line.cargoBanco > 0 ? line.cargoBanco : line.abonoBanco) : 0;
  const totalCents = toCents(amount);
  const baseCents = desglosarIva ? Math.round(totalCents / 1.16) : totalCents;
  const ivaCents = desglosarIva ? totalCents - baseCents : 0;
  const baseAmt = fromCents(baseCents);
  const ivaAmt = fromCents(ivaCents);

  const isMultiBalanced = (() => {
    if (!multiMode) return true;
    let c = isWithdrawal ? 0 : totalCents;
    let a = isWithdrawal ? totalCents : 0;
    for (const r of multiRows) {
      const amtCents = toCents(r.amount);
      const side = r.side ?? (isWithdrawal ? 'CARGO' : 'ABONO');
      if (side === 'CARGO') c += amtCents;
      else a += amtCents;
    }
    return c === a && multiRows.some((r) => toCents(r.amount) > 0);
  })();

  const applyPreset = (preset: 'COMISION' | 'INTERES' | 'TRASPASO' | 'IMPUESTOS' | 'PPD_IVA') => {
    if (preset === 'COMISION') {
      setMultiMode(false);
      setCounterCode(findByHints(['601', '701'], ['comision', 'bancari']));
      setDesglosarIva(true);
    } else if (preset === 'INTERES') {
      setMultiMode(false);
      setCounterCode(findByHints(['702', '401'], ['interes', 'financiero', 'producto']));
      setDesglosarIva(false);
    } else if (preset === 'TRASPASO') {
      setMultiMode(false);
      setCounterCode(findByHints(['102'], ['banco']));
      setDesglosarIva(false);
    } else if (preset === 'IMPUESTOS') {
      const isrCode = findByHints(['213-01-002', '213'], ['isr', 'impuesto']);
      const ivaCode = findByHints(['213-01-001', '213'], ['iva', 'impuesto']);
      const half = fromCents(Math.floor(totalCents / 2));
      const rem = fromCents(totalCents - Math.floor(totalCents / 2));
      setMultiMode(true);
      setMultiRows([
        { id: 'dyp_isr', accountCode: isrCode, side: 'CARGO', amount: half, concepto: 'Pago ISR Provisional SAT DyP' },
        { id: 'dyp_iva', accountCode: ivaCode, side: 'CARGO', amount: rem, concepto: 'Pago IVA Definitivo SAT DyP' }
      ]);
    } else {
      const mainCode = isWithdrawal
        ? findByHints(['201-01-001', '201'], ['proveedor'])
        : findByHints(['105-01-001', '105'], ['cliente']);
      const ivaPayCode = isWithdrawal
        ? findByHints(['118-01-001', '118'], ['acreditable'])
        : findByHints(['209-01-001', '209'], ['pendiente']);
      const ivaPendCode = isWithdrawal
        ? findByHints(['119-01-001', '119'], ['pendiente'])
        : findByHints(['208-01-001', '208'], ['cobrado']);
      setMultiMode(true);
      setMultiRows([
        { id: 'ppd_main', accountCode: mainCode, side: isWithdrawal ? 'CARGO' : 'ABONO', amount, concepto: isWithdrawal ? 'Pago a proveedor PPD' : 'Cobro a cliente PPD' },
        { id: 'ppd_iva1', accountCode: ivaPayCode, side: 'CARGO', amount: fromCents(totalCents - Math.round(totalCents / 1.16)), concepto: 'Reclasificación IVA PPD' },
        { id: 'ppd_iva2', accountCode: ivaPendCode, side: 'ABONO', amount: fromCents(totalCents - Math.round(totalCents / 1.16)), concepto: 'Reclasificación IVA PPD' }
      ]);
    }
    setIsDirty(true);
    setConfirmDiscard(false);
  };

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={Boolean(line)}
      onClose={handleSafeClose}
      deferClose={true}
      busy={isSubmitting}
      title="Generar Póliza desde Movimiento Bancario"
      subtitle={
        line ? (
          <>
            {formatShortDate(line.fecha)} · {line.referencia} · {isWithdrawal ? 'Retiro' : 'Depósito'}{' '}
            <strong className="font-mono text-slate-900">{formatCurrency(amount)}</strong>
          </>
        ) : undefined
      }
      icon={<Sparkles className="w-4 h-4" aria-hidden="true" />}
      iconTone="blue"
      titleId="bank-line-poliza-title"
      maxWidth="lg"
      closeLabel="Cerrar diálogo"
      footer={
        line ? (
          <>
            <Button variant="secondary" onClick={handleSafeClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="bank-line-poliza-form"
              variant="primary"
              loading={isSubmitting}
              disabled={multiMode ? !isMultiBalanced : !counterCode}
              leftIcon={
                isSubmitting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  : <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              }
            >
              {isSubmitting ? 'Generando...' : 'Generar Póliza y Conciliar'}
            </Button>
          </>
        ) : undefined
      }
    >
      {line && (
        <form
          id="bank-line-poliza-form"
          onSubmit={(e) => {
            e.preventDefault();
            setConfirmDiscard(false);
            onSubmit(line.id, {
              counterAccountCode: counterCode,
              desglosarIva: multiMode ? false : desglosarIva,
              ...(multiMode
                ? {
                    counterLines: multiRows.map(({ accountCode, side, amount: rowAmt, concepto }) => ({
                      accountCode,
                      side,
                      amount: rowAmt,
                      concepto
                    }))
                  }
                : {})
            });
          }}
          className="space-y-4 text-xs"
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
                Pago Impuestos SAT (DyP)
              </button>
              <button type="button" onClick={() => applyPreset('PPD_IVA')} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100 cursor-pointer">
                PPD con IVA
              </button>
            </div>
          </div>

          <label htmlFor="bank-poliza-multi-toggle" className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="bank-poliza-multi-toggle"
              type="checkbox"
              checked={multiMode}
              onChange={(e) => {
                setMultiMode(e.target.checked);
                setIsDirty(true);
              }}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span className="font-semibold text-slate-800">Dividir en múltiples contracuentas</span>
          </label>

          {multiMode ? (
            <BankLinePolizaMultiLines
              rows={multiRows}
              affectable={affectable}
              bankAmount={amount}
              isWithdrawal={isWithdrawal}
              onChange={(next) => {
                setMultiRows(next);
                setIsDirty(true);
                setConfirmDiscard(false);
              }}
            />
          ) : (
            <>
              <FormField label="Contracuenta Contable" htmlFor="bank-poliza-counter-account">
                <Select
                  id="bank-poliza-counter-account"
                  value={counterCode}
                  onChange={(e) => {
                    setCounterCode(e.target.value);
                    setIsDirty(true);
                    setConfirmDiscard(false);
                  }}
                  className="font-mono"
                >
                  {affectable.map((a) => (
                    <option key={a.id} value={a.code}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </Select>
              </FormField>

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
            </>
          )}

          {!multiMode && (
            <BankLineSinglePreviewTable
              isWithdrawal={isWithdrawal}
              counterCode={counterCode}
              bankCode={bankAcc?.code ?? '102-01'}
              baseAmt={baseAmt}
              ivaAmt={ivaAmt}
              amount={amount}
              desglosarIva={desglosarIva}
            />
          )}

          {confirmDiscard && (
            <AlertBanner
              tone="warning"
              action={
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setConfirmDiscard(false)}>Seguir editando</Button>
                  <Button size="sm" variant="danger" onClick={() => { setConfirmDiscard(false); setIsDirty(false); dialogRef.current?.close(); onClose(); }}>
                    Descartar
                  </Button>
                </div>
              }
            >
              ¿Descartar cambios en la selección de contracuenta?
            </AlertBanner>
          )}
        </form>
      )}
    </ModalShell>
  );
}
