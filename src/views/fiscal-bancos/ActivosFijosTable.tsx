import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { FixedAssetWithCalculation } from '../../shared/types';

export interface ActivosFijosTableProps {
  assets: FixedAssetWithCalculation[];
  onDeleteAsset: (id: string) => void;
  isDeleting: boolean;
}

export function ActivosFijosTable({
  assets,
  onDeleteAsset,
  isDeleting
}: ActivosFijosTableProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <th className="py-2.5 px-3">Código / Bien</th>
            <th className="py-2.5 px-3">Adquisición</th>
            <th className="py-2.5 px-3 text-right">MOI</th>
            <th className="py-2.5 px-3 text-right">Tasa Anual</th>
            <th className="py-2.5 px-3 text-right">Dep. Mensual Contable</th>
            <th className="py-2.5 px-3 text-right">Factor INPC</th>
            <th className="py-2.5 px-3 text-right">Dep. Fiscal Actualizada</th>
            <th className="py-2.5 px-3 text-right">Valor Neto en Libros</th>
            <th className="py-2.5 px-3 text-right">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs">
          {assets.map((asset) => (
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
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      disabled={isDeleting}
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
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] hover:bg-slate-300 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setConfirmDeleteId(asset.id)}
                    title="Eliminar activo fijo"
                    className="p-1 text-slate-400 hover:text-red-700 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
