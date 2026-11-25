import { useState } from 'react';
import { ArchiveX, Building, Pencil, Trash2 } from 'lucide-react';
import { EmptyState, InlineConfirm, StatusBadge, type BadgeTone } from '../../components/ui';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { FixedAssetWithCalculation } from '../../shared/types';

export interface ActivosFijosTableProps {
  assets: FixedAssetWithCalculation[];
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  onEditAsset?: (asset: FixedAssetWithCalculation) => void;
  onRetireAsset?: (asset: FixedAssetWithCalculation) => void;
  onDeleteAsset: (id: string) => void;
  isDeleting: boolean;
}

const STATUS_BADGES: Record<FixedAssetWithCalculation['estatus'], { label: string; tone: BadgeTone }> = {
  ACTIVO: { label: 'Activo', tone: 'emerald' },
  BAJA: { label: 'Baja', tone: 'red' },
  TOTALMENTE_DEPRECIADO: { label: '100% Dep.', tone: 'slate' }
};

export function ActivosFijosTable({
  assets,
  isPeriodLocked = false,
  isReadOnlyClient = false,
  onEditAsset,
  onRetireAsset,
  onDeleteAsset,
  isDeleting
}: ActivosFijosTableProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const isWriteLocked = isPeriodLocked || isReadOnlyClient;
  const lockReason = isPeriodLocked
    ? 'Periodo fiscal bloqueado ante el SAT'
    : isReadOnlyClient
      ? 'Modo solo lectura'
      : undefined;

  const totalMoi = assets.reduce((s, a) => s + a.montoOriginalInversion, 0);
  const totalDepContable = assets.reduce((s, a) => s + a.depreciacionMensualContable, 0);
  const totalDepFiscal = assets.reduce((s, a) => s + a.depreciacionMensualFiscalActualizada, 0);
  const totalValorLibros = assets.reduce((s, a) => s + a.valorNetoEnLibros, 0);

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Tabla de activos fijos y depreciación mensual"
      className="overflow-x-auto focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-xl"
    >
      <table className="w-full text-left border-collapse">
        <caption className="visually-hidden">
          Cédula de activos fijos y depreciación mensual contable y fiscal INPC
        </caption>
        <thead>
          <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <th scope="col" className="py-2 px-2.5">Código / Bien</th>
            <th scope="col" className="py-2 px-2.5 whitespace-nowrap">Adquisición</th>
            <th scope="col" className="py-2 px-2.5 text-right whitespace-nowrap">MOI</th>
            <th scope="col" className="py-2 px-2.5 text-right whitespace-nowrap">Tasa / Meses</th>
            <th scope="col" className="py-2 px-2.5 text-right whitespace-nowrap">Dep. Contable</th>
            <th scope="col" className="py-2 px-2.5 text-right whitespace-nowrap">INPC</th>
            <th scope="col" className="py-2 px-2.5 text-right whitespace-nowrap">Dep. Fiscal Act.</th>
            <th scope="col" className="py-2 px-2.5 text-right whitespace-nowrap">Valor Libros</th>
            <th scope="col" className="py-2 px-2.5 text-center whitespace-nowrap">Estatus</th>
            <th scope="col" className="py-2 px-2.5 text-right whitespace-nowrap">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs">
          {assets.length === 0 ? (
            <tr>
              <td colSpan={10}>
                <EmptyState
                  icon={<Building className="w-6 h-6" aria-hidden="true" />}
                  tone="blue"
                  title="No hay activos fijos registrados para esta empresa"
                  description="Captura un activo fijo en el formulario superior para calcular su depreciación contable y deducción fiscal actualizada."
                />
              </td>
            </tr>
          ) : (
            assets.map((asset) => {
              const badge = STATUS_BADGES[asset.estatus] ?? STATUS_BADGES.ACTIVO;
              return (
                <tr key={asset.id} className="hover:bg-blue-50/30">
                  <td className="py-2 px-2.5">
                    <span className="font-mono font-bold text-blue-800 mr-1.5 whitespace-nowrap">{asset.codigo}</span>
                    <span className="font-medium text-slate-900">{asset.nombre}</span>
                  </td>
                  <td className="py-2 px-2.5 font-mono text-slate-600 whitespace-nowrap tabular-nums">
                    {formatShortDate(asset.fechaAdquisicion)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                    {formatCurrency(asset.montoOriginalInversion)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-slate-600 whitespace-nowrap tabular-nums">
                    {asset.tasaAnualPct}% · {asset.mesesDepreciadosPrevios}m
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono font-bold text-blue-800 whitespace-nowrap tabular-nums">
                    {formatCurrency(asset.depreciacionMensualContable)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-slate-700 whitespace-nowrap tabular-nums">
                    {asset.factorActualizacionInpc.toFixed(4)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-800 whitespace-nowrap tabular-nums">
                    {formatCurrency(asset.depreciacionMensualFiscalActualizada)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-slate-900 whitespace-nowrap tabular-nums">
                    {formatCurrency(asset.valorNetoEnLibros)}
                  </td>
                  <td className="py-2 px-2.5 text-center whitespace-nowrap">
                    <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                    {asset.estatus === 'BAJA' && asset.fechaBaja && (
                      <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                        {formatShortDate(asset.fechaBaja)}
                        {asset.precioVenta != null ? ` · ${formatCurrency(asset.precioVenta)}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-2.5 text-right whitespace-nowrap">
                    {confirmDeleteId === asset.id ? (
                      <InlineConfirm
                        ariaLabel={`Confirmar eliminación de ${asset.codigo}`}
                        tone="danger"
                        busy={isDeleting || isWriteLocked}
                        confirmLabel="Confirmar"
                        cancelLabel="Cancelar"
                        onCancel={() => setConfirmDeleteId(null)}
                        onConfirm={() => {
                          onDeleteAsset(asset.id);
                          setConfirmDeleteId(null);
                        }}
                      />
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        {onEditAsset && (
                          <button
                            type="button"
                            disabled={isDeleting || isWriteLocked}
                            onClick={() => onEditAsset(asset)}
                            title={lockReason ?? 'Editar activo fijo'}
                            aria-label={`Editar activo fijo ${asset.codigo}`}
                            className="min-h-[28px] min-w-[28px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                        {onRetireAsset && asset.estatus === 'ACTIVO' && (
                          <button
                            type="button"
                            disabled={isDeleting || isWriteLocked}
                            onClick={() => {
                              setConfirmDeleteId(null);
                              onRetireAsset(asset);
                            }}
                            title={lockReason ?? 'Dar de baja / enajenar activo (Art. 31 LISR)'}
                            aria-label={`Dar de baja activo fijo ${asset.codigo}`}
                            className="min-h-[28px] min-w-[28px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:text-amber-700 hover:bg-amber-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ArchiveX className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isDeleting || isWriteLocked}
                          onClick={() => setConfirmDeleteId(asset.id)}
                          title={lockReason ?? 'Eliminar activo fijo'}
                          aria-label={`Eliminar activo fijo ${asset.codigo} — ${asset.nombre}`}
                          className="min-h-[28px] min-w-[28px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {assets.length > 0 && (
          <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-mono text-xs font-bold text-slate-900">
            <tr>
              <td colSpan={2} className="py-2.5 px-2.5 font-sans text-right uppercase tracking-wider text-slate-700">
                Totales ({assets.length} activos):
              </td>
              <td className="py-2.5 px-2.5 text-right whitespace-nowrap tabular-nums">{formatCurrency(totalMoi)}</td>
              <td />
              <td className="py-2.5 px-2.5 text-right text-blue-800 whitespace-nowrap tabular-nums">
                {formatCurrency(totalDepContable)}
              </td>
              <td />
              <td className="py-2.5 px-2.5 text-right text-emerald-800 whitespace-nowrap tabular-nums">
                {formatCurrency(totalDepFiscal)}
              </td>
              <td className="py-2.5 px-2.5 text-right whitespace-nowrap tabular-nums">
                {formatCurrency(totalValorLibros)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
