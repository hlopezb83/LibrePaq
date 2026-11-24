import { AlertCircle, BookOpen, Building, RefreshCw, Sparkles } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { formatCurrency } from '../../lib/formatters';
import type { AccountWithBalance } from '../../shared/types';
import { ActivosFijosForm } from './ActivosFijosForm';
import { ActivosFijosTable } from './ActivosFijosTable';
import { InpcCatalogModal } from './InpcCatalogModal';
import { useActivosFijos } from './useActivosFijos';

export interface ActivosFijosTabProps {
  companyId: string;
  year: number;
  period?: number;
  accounts: AccountWithBalance[];
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  onFeedback: (msg: string, type?: 'success' | 'error') => void;
}

export function ActivosFijosTab({
  companyId,
  year,
  period,
  accounts,
  isPeriodLocked = false,
  isReadOnlyClient: isReadOnlyClientProp = false,
  onFeedback
}: ActivosFijosTabProps) {
  const { isReadOnlyClient, isReadOnlySupportMode } = useCompany();
  const isReadOnly = Boolean(isReadOnlyClientProp) || isReadOnlyClient || isReadOnlySupportMode;
  const isWriteLocked = isPeriodLocked || isReadOnly;
  const lockTitle = isReadOnly ? 'Modo solo lectura' : 'Periodo fiscal bloqueado ante el SAT';
  const fa = useActivosFijos({
    companyId,
    year,
    period,
    accounts,
    isPeriodLocked,
    isReadOnlyClient: isReadOnly,
    onFeedback
  });

  return (
    <div className="space-y-5">
      {fa.isErrorAssets ? (
        <div role="alert" className="p-8 bg-white rounded-2xl border border-red-200 text-center space-y-3 shadow-2xs">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-900">Error al cargar los activos fijos</p>
          <p className="text-xs text-slate-600">
            {fa.errorAssets instanceof Error ? fa.errorAssets.message : 'Error de conexión con el servidor contable.'}
          </p>
          <button
            type="button"
            onClick={() => void fa.refetchAssets()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      ) : fa.loadingAssets || !fa.fixedAssetsData ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-500"
        >
          Calculando depreciación mensual contable y actualización fiscal con INPC...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-300">
              <div className="text-[11px] font-bold uppercase text-slate-500">
                Monto Original de la Inversión (MOI Total)
              </div>
              <div className="mt-1 text-lg font-bold font-mono text-slate-900">
                {formatCurrency(fa.fixedAssetsData.totals.totalMoi)}
              </div>
              <div className="text-[10px] text-slate-500">
                {fa.fixedAssetsData.assets.length} activos fijos (corte P{String(fa.activePeriod).padStart(2, '0')}/{year})
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-300">
              <div className="text-[11px] font-bold uppercase text-slate-500">
                Depreciación Contable del Mes (NIF C-6)
              </div>
              <div className="mt-1 text-lg font-bold font-mono text-blue-800">
                {formatCurrency(fa.fixedAssetsData.totals.totalDepreciacionMensualContable)}
              </div>
              <div className="text-[10px] text-slate-500">Cargo a 601-01-006 / Abono a 171-01-001</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-300">
              <div className="text-[11px] font-bold uppercase text-slate-500">
                Deducción de Inversión Actualizada (Art. 31 LISR INPC)
              </div>
              <div className="mt-1 text-lg font-bold font-mono text-emerald-800">
                {formatCurrency(fa.fixedAssetsData.totals.totalDepreciacionMensualFiscal)}
              </div>
              <div className="text-[10px] text-slate-500">Con Factor de Actualización INPC a 4 decimales</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <Building className="w-5 h-5 text-blue-700" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Cédula de Activos Fijos y Depreciación Mensual (Contable vs Fiscal INPC)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Registra activos nuevos o migrados, edita meses depreciados, da de baja o genera la póliza mensual
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fa.setIsInpcModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  Catálogo INPC / DOF
                </button>
                <button
                  type="button"
                  disabled={fa.genDepPolizaMutation.isPending || isWriteLocked || fa.hasDepPolizaThisPeriod}
                  title={
                    fa.hasDepPolizaThisPeriod
                      ? 'Ya existe una póliza de depreciación registrada para este periodo'
                      : isWriteLocked
                        ? lockTitle
                        : 'Generar póliza mensual de depreciación contable'
                  }
                  onClick={() => fa.genDepPolizaMutation.mutate()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-2xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  {fa.genDepPolizaMutation.isPending
                    ? 'Generando Póliza...'
                    : fa.hasDepPolizaThisPeriod
                      ? 'Depreciación del Mes ya Generada'
                      : 'Generar Póliza de Depreciación del Mes'}
                </button>
              </div>
            </div>

            <ActivosFijosForm
              isEditing={Boolean(fa.editingAssetId)}
              isWriteLocked={isWriteLocked}
              lockTitle={lockTitle}
              isPending={fa.createAssetMutation.isPending || fa.updateAssetMutation.isPending}
              assetCode={fa.assetCode}
              setAssetCode={fa.setAssetCode}
              assetName={fa.assetName}
              setAssetName={fa.setAssetName}
              assetDate={fa.assetDate}
              handleDateChange={fa.handleDateChange}
              assetCat={fa.assetCat}
              setAssetCat={fa.setAssetCat}
              setAssetRate={fa.setAssetRate}
              assetMoi={fa.assetMoi}
              setAssetMoi={fa.setAssetMoi}
              mesesDepreciadosPrevios={fa.mesesDepreciadosPrevios}
              setMesesDepreciadosPrevios={fa.setMesesDepreciadosPrevios}
              assetStatus={fa.assetStatus}
              setAssetStatus={fa.setAssetStatus}
              assetInpcAdq={fa.assetInpcAdq}
              setAssetInpcAdq={fa.setAssetInpcAdq}
              assetInpcUso={fa.assetInpcUso}
              setAssetInpcUso={fa.setAssetInpcUso}
              onSubmit={() => {
                if (fa.editingAssetId) fa.updateAssetMutation.mutate();
                else fa.createAssetMutation.mutate();
              }}
              onCancelEdit={fa.cancelEditAsset}
            />

            <ActivosFijosTable
              assets={fa.fixedAssetsData.assets}
              isPeriodLocked={isWriteLocked}
              onEditAsset={fa.startEditAsset}
              onRetireAsset={(id) => fa.retireAssetMutation.mutate(id)}
              onDeleteAsset={(id) => fa.deleteAssetMutation.mutate(id)}
              isDeleting={fa.deleteAssetMutation.isPending || fa.retireAssetMutation.isPending}
            />
          </div>

          <InpcCatalogModal
            isOpen={fa.isInpcModalOpen}
            onClose={() => fa.setIsInpcModalOpen(false)}
            activeYear={year}
          />
        </>
      )}
    </div>
  );
}
