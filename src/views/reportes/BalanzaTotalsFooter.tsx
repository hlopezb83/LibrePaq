import { formatCurrency } from '../../lib/formatters';

interface BalanzaTotalsFooterProps {
  balanzaSearch: string;
  onlyAffectable: boolean;
  hideZeroBalances: boolean;
  affectableFilteredCount: number;
  filteredBalanzaTotals: {
    initialDeudor: number;
    initialAcreedor: number;
    cargos: number;
    abonos: number;
    finalDeudor: number;
    finalAcreedor: number;
  };
}

export function BalanzaTotalsFooter({
  balanzaSearch,
  onlyAffectable,
  hideZeroBalances,
  affectableFilteredCount,
  filteredBalanzaTotals
}: BalanzaTotalsFooterProps) {
  const isCargosAbonosBalanced =
    Math.abs(filteredBalanzaTotals.cargos - filteredBalanzaTotals.abonos) < 0.01;
  const isFiltered = Boolean(balanzaSearch.trim() || onlyAffectable || hideZeroBalances);

  return (
    <tfoot className="sticky bottom-0 z-10 shadow-2xl">
      <tr className="bg-[#0A1120] text-white font-mono text-xs font-bold border-t-2 border-blue-500">
        <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider">
          <div className="flex items-center justify-end gap-2">
            {isCargosAbonosBalanced ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                Sumas Iguales ✔
              </span>
            ) : !isFiltered ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 border border-red-500/40">
                Diferencia: {formatCurrency(Math.abs(filteredBalanzaTotals.cargos - filteredBalanzaTotals.abonos))}
              </span>
            ) : null}
            <span>
              {isFiltered
                ? `Totales Filtrados (${affectableFilteredCount} afectables):`
                : 'Sumas Totales Cuentas Afectables:'}
            </span>
          </div>
        </td>
        <td className="py-3 px-4 text-right">
          <div className="text-emerald-300">D: {formatCurrency(filteredBalanzaTotals.initialDeudor)}</div>
          <div className="text-slate-400 text-[11px]">
            A: {formatCurrency(filteredBalanzaTotals.initialAcreedor)}
          </div>
        </td>
        <td className="py-3 px-4 text-right text-cyan-300 text-[13px]">
          {formatCurrency(filteredBalanzaTotals.cargos)}
        </td>
        <td className="py-3 px-4 text-right text-cyan-300 text-[13px]">
          {formatCurrency(filteredBalanzaTotals.abonos)}
        </td>
        <td className="py-3 px-4 text-right">
          <div className="text-emerald-300">D: {formatCurrency(filteredBalanzaTotals.finalDeudor)}</div>
          <div className="text-slate-400 text-[11px]">
            A: {formatCurrency(filteredBalanzaTotals.finalAcreedor)}
          </div>
        </td>
        <td className="no-print py-3 px-4" />
      </tr>
    </tfoot>
  );
}
