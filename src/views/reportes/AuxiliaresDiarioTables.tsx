import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { Poliza } from '../../shared/types';
import type { AuxiliarAccountBlock } from './auxiliaresDiarioExport';

export function DiarioGeneralTable({
  polizas,
  diarioTotals,
  onSelectAccount
}: {
  polizas: Poliza[];
  diarioTotals: { cargos: number; abonos: number };
  onSelectAccount: (accountId: string) => void;
}) {
  return (
    <div tabIndex={0} role="region" aria-label="Tabla de Diario General" className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-x-auto focus:outline-none focus:ring-2 focus:ring-blue-600">
      <table className="w-full text-left border-collapse text-xs">
        <caption className="visually-hidden">Diario General de pólizas contables</caption>
        <thead>
          <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase text-slate-600">
            <th scope="col" className="py-2.5 px-3">Fecha</th>
            <th scope="col" className="py-2.5 px-3">Póliza</th>
            <th scope="col" className="py-2.5 px-3">Cuenta</th>
            <th scope="col" className="py-2.5 px-3">Nombre</th>
            <th scope="col" className="py-2.5 px-3">Concepto</th>
            <th scope="col" className="py-2.5 px-3 text-right">Cargo</th>
            <th scope="col" className="py-2.5 px-3 text-right">Abono</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {polizas.length === 0 ? (
            <tr><td colSpan={7} className="py-8 text-center text-slate-600">Sin pólizas registradas en el rango de periodos.</td></tr>
          ) : (
            polizas.flatMap((p) =>
              p.movements.map((m) => (
                <tr key={m.id} className="hover:bg-blue-50/30">
                  <td className="py-2 px-3 font-mono whitespace-nowrap">{formatShortDate(p.fecha)}</td>
                  <td className="py-2 px-3 font-mono font-bold text-blue-900 whitespace-nowrap">{p.tipo} #{p.folio}</td>
                  <td className="py-2 px-3 font-mono whitespace-nowrap">
                    <button type="button" onClick={() => onSelectAccount(m.accountId)} className="text-blue-800 hover:underline font-bold cursor-pointer">
                      {m.accountCode}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-slate-800">{m.accountName}</td>
                  <td className="py-2 px-3 text-slate-600">{m.concepto || p.concepto}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">{m.cargo > 0 ? formatCurrency(m.cargo) : '—'}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">{m.abono > 0 ? formatCurrency(m.abono) : '—'}</td>
                </tr>
              ))
            )
          )}
        </tbody>
        <tfoot className="bg-[#0A1120] text-white font-mono font-bold tabular-nums">
          <tr>
            <td colSpan={5} className="py-2.5 px-3 text-right uppercase">Sumas Iguales ({polizas.length} pólizas):</td>
            <td className="py-2.5 px-3 text-right text-cyan-300 whitespace-nowrap">{formatCurrency(diarioTotals.cargos)}</td>
            <td className="py-2.5 px-3 text-right text-cyan-300 whitespace-nowrap">{formatCurrency(diarioTotals.abonos)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function AuxiliaresAccountBlocks({
  auxiliarBlocks,
  onSelectAccount
}: {
  auxiliarBlocks: AuxiliarAccountBlock[];
  onSelectAccount: (accountId: string) => void;
}) {
  return (
    <div className="space-y-4">
      {auxiliarBlocks.length === 0 ? (
        <div className="p-8 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-600">
          No se encontraron cuentas con saldo o movimiento en el rango seleccionado.
        </div>
      ) : (
        auxiliarBlocks.map((b) => (
          <div key={b.account.id} tabIndex={0} role="region" aria-label={`Auxiliar de cuenta ${b.account.code} ${b.account.name}`} className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-x-auto focus:outline-none focus:ring-2 focus:ring-blue-600">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <button type="button" onClick={() => onSelectAccount(b.account.id)} className="font-bold text-blue-900 hover:underline cursor-pointer">
                <span className="font-mono mr-1.5">{b.account.code}</span>{b.account.name}
              </button>
              <div className="font-mono tabular-nums flex flex-wrap gap-3 text-[11px]">
                <span>Inicial: <strong>{formatCurrency(b.initialBalance)}</strong></span>
                <span>Cargos: <strong>{formatCurrency(b.totalCharges)}</strong></span>
                <span>Abonos: <strong>{formatCurrency(b.totalCredits)}</strong></span>
                <span className="text-blue-900">Final: <strong>{formatCurrency(b.finalBalance)}</strong></span>
              </div>
            </div>
            {b.entries.length > 0 && (
              <table className="w-full text-left border-collapse text-xs">
                <caption className="visually-hidden">Movimientos auxiliares de {b.account.code} {b.account.name}</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                    <th scope="col" className="py-1.5 px-3">Fecha</th>
                    <th scope="col" className="py-1.5 px-3">Póliza</th>
                    <th scope="col" className="py-1.5 px-3">Referencia</th>
                    <th scope="col" className="py-1.5 px-3">Concepto</th>
                    <th scope="col" className="py-1.5 px-3 text-right">Cargo</th>
                    <th scope="col" className="py-1.5 px-3 text-right">Abono</th>
                    <th scope="col" className="py-1.5 px-3 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {b.entries.map((e) => (
                    <tr key={e.movementId} className="hover:bg-blue-50/30">
                      <td className="py-1.5 px-3 font-mono whitespace-nowrap">{formatShortDate(e.fecha)}</td>
                      <td className="py-1.5 px-3 font-mono font-semibold text-blue-900 whitespace-nowrap">{e.tipoPoliza} #{e.folioPoliza}</td>
                      <td className="py-1.5 px-3 font-mono text-slate-600 whitespace-nowrap">{e.referencia}</td>
                      <td className="py-1.5 px-3 text-slate-700">{e.concepto}</td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">{e.cargo > 0 ? formatCurrency(e.cargo) : '—'}</td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">{e.abono > 0 ? formatCurrency(e.abono) : '—'}</td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap">{formatCurrency(e.runningBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))
      )}
    </div>
  );
}
