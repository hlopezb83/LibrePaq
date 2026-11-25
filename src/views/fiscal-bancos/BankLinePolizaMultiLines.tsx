import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Select } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
import { fromCents, toCents } from '../../shared/engine/invariants-and-math';
import type { BankCounterLineInput } from '../../shared/engine/bank-and-closing.engine';
import type { AccountWithBalance } from '../../shared/types';

export interface MultiCounterRow extends BankCounterLineInput {
  id: string;
}

interface BankLinePolizaMultiLinesProps {
  rows: MultiCounterRow[];
  affectable: AccountWithBalance[];
  bankAmount: number;
  isWithdrawal: boolean;
  onChange: (rows: MultiCounterRow[]) => void;
}

export function BankLinePolizaMultiLines({
  rows,
  affectable,
  bankAmount,
  isWithdrawal,
  onChange
}: BankLinePolizaMultiLinesProps) {
  const bankCents = toCents(bankAmount);
  let totalCargosCents = isWithdrawal ? 0 : bankCents;
  let totalAbonosCents = isWithdrawal ? bankCents : 0;

  for (const r of rows) {
    const c = toCents(r.amount);
    const side = r.side ?? (isWithdrawal ? 'CARGO' : 'ABONO');
    if (side === 'CARGO') totalCargosCents += c;
    else totalAbonosCents += c;
  }
  const diffCents = totalCargosCents - totalAbonosCents;

  const updateRow = (id: string, patch: Partial<MultiCounterRow>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    const remaining = Math.max(0, fromCents(Math.abs(diffCents)));
    onChange([
      ...rows,
      {
        id: `bcl_${crypto.randomUUID().slice(0, 6)}`,
        accountCode: affectable[0]?.code ?? '',
        side: isWithdrawal ? 'CARGO' : 'ABONO',
        amount: remaining,
        concepto: ''
      }
    ]);
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-slate-800 text-[11px] uppercase">
          Múltiples Contracuentas (SAT DyP / PPD con IVA)
        </span>
        <Button type="button" size="sm" variant="secondary" onClick={addRow} leftIcon={<Plus className="w-3 h-3" aria-hidden="true" />}>
          Agregar partida
        </Button>
      </div>

      <div className="space-y-2 max-h-52 overflow-y-auto">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
            <div className="sm:col-span-5">
              <Select
                size="sm"
                aria-label="Cuenta contable de contrapartida"
                value={r.accountCode}
                onChange={(e) => updateRow(r.id, { accountCode: e.target.value })}
                className="font-mono text-[11px]"
              >
                {affectable.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Select
                size="sm"
                aria-label="Naturaleza Cargo o Abono"
                value={r.side ?? (isWithdrawal ? 'CARGO' : 'ABONO')}
                onChange={(e) => updateRow(r.id, { side: e.target.value as 'CARGO' | 'ABONO' })}
                className="text-[11px]"
              >
                <option value="CARGO">Cargo</option>
                <option value="ABONO">Abono</option>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Input
                size="sm"
                type="number"
                step="0.01"
                min="0"
                aria-label="Importe"
                value={r.amount}
                onChange={(e) => updateRow(r.id, { amount: Math.max(0, Number(e.target.value) || 0) })}
                className="font-mono text-right text-[11px]"
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                size="sm"
                type="text"
                aria-label="Concepto partida"
                placeholder="Concepto..."
                value={r.concepto ?? ''}
                onChange={(e) => updateRow(r.id, { concepto: e.target.value })}
                className="text-[11px]"
              />
            </div>
            <div className="sm:col-span-1 flex justify-end">
              <button
                type="button"
                disabled={rows.length <= 1}
                aria-label="Eliminar contracuenta"
                onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
                className="p-1.5 rounded text-slate-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono px-2 py-1 rounded ${diffCents === 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>
        <span>Cargos: {formatCurrency(fromCents(totalCargosCents))} · Abonos: {formatCurrency(fromCents(totalAbonosCents))}</span>
        <strong>{diffCents === 0 ? 'Partida doble cuadrada' : `Descuadre: ${formatCurrency(fromCents(diffCents))}`}</strong>
      </div>
    </div>
  );
}

export function BankLineSinglePreviewTable(props: {
  isWithdrawal: boolean;
  counterCode: string;
  bankCode: string;
  baseAmt: number;
  ivaAmt: number;
  amount: number;
  desglosarIva: boolean;
}) {
  const { isWithdrawal, counterCode, bankCode, baseAmt, ivaAmt, amount, desglosarIva } = props;
  const rows: Array<{ label: string; debe: number; haber: number }> = isWithdrawal
    ? [
        { label: counterCode || 'Contracuenta', debe: baseAmt, haber: 0 },
        ...(desglosarIva && ivaAmt > 0 ? [{ label: '118-01 IVA Acreditable Pagado (16%)', debe: ivaAmt, haber: 0 }] : []),
        { label: `${bankCode} Bancos`, debe: 0, haber: amount }
      ]
    : [
        { label: `${bankCode} Bancos`, debe: amount, haber: 0 },
        { label: counterCode || 'Contracuenta', debe: 0, haber: baseAmt },
        ...(desglosarIva && ivaAmt > 0 ? [{ label: '208-01 IVA Trasladado Cobrado (16%)', debe: 0, haber: ivaAmt }] : [])
      ];

  return (
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
          {rows.map((r, i) => (
            <tr key={`${r.label}-${i}`}>
              <td className="py-1.5 px-3 text-slate-800">{r.label}</td>
              <td className="py-1.5 px-3 text-right text-slate-900">{r.debe > 0 ? formatCurrency(r.debe) : '—'}</td>
              <td className="py-1.5 px-3 text-right text-slate-900">{r.haber > 0 ? formatCurrency(r.haber) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
