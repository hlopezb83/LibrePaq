import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { FixedAssetWithCalculation } from '../../shared/types';

export interface ActivosFijosTableProps {
  assets: FixedAssetWithCalculation[];
  isPeriodLocked?: boolean;
  onDeleteAsset: (id: string) => void;
  isDeleting: boolean;
}

export function ActivosFijosTable({
  assets,
  isPeriodLocked = false,
  onDeleteAsset,
  isDeleting
}: ActivosFijosTableProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const totalMoi = assets.reduce((s, a) => s + a.montoOriginalInversion, 0);
  const totalDepContable = assets.reduce((s, a) => s + a.depreciacionMensualContable, 0);
  const totalDepFiscal = assets.reduce((s, a) => s + a.depreciacionMensualFiscalActualizada, 0);
  const totalValorLibros = assets.reduce((s, a) => s + a.valorNetoEnLibros, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <caption className="visually-hidden">
          Cédula de activos fijos y depreciación mensual contable y fiscal INPC
        </caption>
        <thead>
          <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <th scope="col" className="py-2.5 px-3">Código / Bien</th>
            <th scope="col" className="py-2.5 px-3">Adquisición</th>
            <th scope="col" className="py-2.5 px-3 text-right">MOI</th>
            <th scope="col" className="py-2.5 px-3 text-right">Tasa Anual</th>
            <th scope="col" className="py-2.5 px-3 text-right">Dep. Mensual Contable</th>
            <th scope="col" className="py-2.5 px-3 text-right">Factor INPC</th>
            <th scope="col" className="py-2.5 px-3 text-right">Dep. Fiscal Actualizada</th>
            <th scope="col" className="py-2.5 px-3 text-right">Valor Neto en Libros</th>
            <th scope="col" className="py-2.5 px-3 text-right">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs">
          {assets.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-8 text-center text-slate-500">
                No hay activos fijos registrados para esta empresa.
              </td>
            </tr>
          ) : (
            assets.map((asset) => (
            <tr key={asset.id} className="hover:bg-blue-50/30">
              <td className="py-2.5 px-3">
                <span className="font-mono font-bold text-blue-800 mr-1.5">
                  {asset.codigo}
                </span>
                <span className="font-medium text-slate-900">{asset.nombre}</span>
              </td>
              <td className="py-2.5 px-3 font-mono text-slate-600">
                {formatShortDate(asset.fechaAdquisicion)}
              </td>
              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                {formatCurrency(asset.montoOriginalInversion)}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                {asset.tasaAnualPct}%
              </td>
              <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-800">
                {formatCurrency(asset.depreciacionMensualContable)}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                {asset.factorActualizacionInpc.toFixed(4)}
              </td>
              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">
                {formatCurrency(asset.depreciacionMensualFiscalActualizada)}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                {formatCurrency(asset.valorNetoEnLibros)}
              </td>
              <td className="py-2.5 px-3 text-right">
                {confirmDeleteId === asset.id ? (
                  <div
                    role="alertdialog"
                    aria-label={`Confirmar baja de ${asset.codigo}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setConfirmDeleteId(null);
                      }
                    }}
                    className="flex items-center justify-end gap-1.5"
                  >
                    <button
                      type="button"
                      disabled={isDeleting || isPeriodLocked}
                      onClick={() => {
                        onDeleteAsset(asset.id);
                        setConfirmDeleteId(null);
                      }}
                      className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold hover:bg-red-700 cursor-pointer disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      autoFocus
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] hover:bg-slate-300 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isDeleting || isPeriodLocked}
                    onClick={() => setConfirmDeleteId(asset.id)}
                    title={isPeriodLocked ? 'Periodo fiscal bloqueado ante el SAT' : 'Eliminar activo fijo'}
                    aria-label={`Eliminar activo fijo ${asset.codigo} — ${asset.nombre}`}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </td>
            </tr>
            ))
          )}
        </tbody>
        {assets.length > 0 && (
          <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-mono text-xs font-bold text-slate-900">
            <tr>
              <td colSpan={2} className="py-2.5 px-3 font-sans text-right uppercase tracking-wider text-slate-700">
                Totales ({assets.length} activos):
              </td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums">
                {formatCurrency(totalMoi)}
              </td>
              <td />
              <td className="py-2.5 px-3 text-right text-blue-800 whitespace-nowrap tabular-nums">
                {formatCurrency(totalDepContable)}
              </td>
              <td />
              <td className="py-2.5 px-3 text-right text-emerald-800 whitespace-nowrap tabular-nums">
                {formatCurrency(totalDepFiscal)}
              </td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums">
                {formatCurrency(totalValorLibros)}
              </td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
