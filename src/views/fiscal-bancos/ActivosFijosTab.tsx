import { AlertCircle, BookOpen, Building, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { formatCurrency } from '../../lib/formatters';
import type { AccountWithBalance, FixedAssetCategory } from '../../shared/types';
import { ActivosFijosTable } from './ActivosFijosTable';
import { InpcCatalogModal } from './InpcCatalogModal';
import { useActivosFijos } from './useActivosFijos';

function sanitizeNumberInput(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export interface ActivosFijosTabProps {
  companyId: string;
  year: number;
  accounts: AccountWithBalance[];
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  onFeedback: (msg: string, type?: 'success' | 'error') => void;
}

export function ActivosFijosTab({
  companyId,
  year,
  accounts,
  isPeriodLocked = false,
  isReadOnlyClient: isReadOnlyClientProp = false,
  onFeedback
}: ActivosFijosTabProps) {
  const { isReadOnlyClient, isReadOnlySupportMode } = useCompany();
  const isReadOnly = Boolean(isReadOnlyClientProp) || isReadOnlyClient || isReadOnlySupportMode;
  const isWriteLocked = isPeriodLocked || isReadOnly;
  const lockTitle = isReadOnly ? 'Modo solo lectura' : 'Periodo fiscal bloqueado ante el SAT';
  const {
    fixedAssetsData,
    loadingAssets,
    isErrorAssets,
    errorAssets,
    refetchAssets,
    assetCode,
    setAssetCode,
    assetName,
    setAssetName,
    assetCat,
    setAssetCat,
    assetDate,
    handleDateChange,
    assetMoi,
    setAssetMoi,
    setAssetRate,
    assetInpcAdq,
    setAssetInpcAdq,
    assetInpcUso,
    setAssetInpcUso,
    isInpcModalOpen,
    setIsInpcModalOpen,
    createAssetMutation,
    deleteAssetMutation,
    genDepPolizaMutation
  } = useActivosFijos({
    companyId,
    year,
    accounts,
    isPeriodLocked,
    isReadOnlyClient: isReadOnly,
    onFeedback
  });

  return (
    <div className="space-y-5">
      {isErrorAssets ? (
        <div role="alert" className="p-8 bg-white rounded-2xl border border-red-200 text-center space-y-3 shadow-2xs">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-900">Error al cargar los activos fijos</p>
          <p className="text-xs text-slate-600">
            {errorAssets instanceof Error ? errorAssets.message : 'Error de conexión con el servidor contable.'}
          </p>
          <button
            type="button"
            onClick={() => void refetchAssets()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      ) : loadingAssets || !fixedAssetsData ? (
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
                {formatCurrency(fixedAssetsData.totals.totalMoi)}
              </div>
              <div className="text-[10px] text-slate-500">
                {fixedAssetsData.assets.length} activos fijos en control
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-300">
              <div className="text-[11px] font-bold uppercase text-slate-500">
                Depreciación Contable del Mes (NIF C-6)
              </div>
              <div className="mt-1 text-lg font-bold font-mono text-blue-800">
                {formatCurrency(fixedAssetsData.totals.totalDepreciacionMensualContable)}
              </div>
              <div className="text-[10px] text-slate-500">
                Cargo a 601-01-006 / Abono a 171-01-001
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-300">
              <div className="text-[11px] font-bold uppercase text-slate-500">
                Deducción de Inversión Actualizada (Art. 31 LISR INPC)
              </div>
              <div className="mt-1 text-lg font-bold font-mono text-emerald-800">
                {formatCurrency(fixedAssetsData.totals.totalDepreciacionMensualFiscal)}
              </div>
              <div className="text-[10px] text-slate-500">
                Con Factor de Actualización INPC a 4 decimales
              </div>
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
                    Genera la póliza mensual de depreciación en 1 clic o da de alta nuevas inversiones
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsInpcModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  Catálogo INPC / DOF
                </button>
                <button
                  type="button"
                  disabled={genDepPolizaMutation.isPending || isWriteLocked}
                  title={
                    isWriteLocked
                      ? lockTitle
                      : 'Generar póliza mensual de depreciación contable'
                  }
                  onClick={() => genDepPolizaMutation.mutate()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-2xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  {genDepPolizaMutation.isPending
                    ? 'Generando Póliza...'
                    : 'Generar Póliza de Depreciación del Mes'}
                </button>
              </div>
            </div>

            {/* Formulario de Alta Rápida de Activo Fijo */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!isWriteLocked) createAssetMutation.mutate();
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs"
            >
              <div>
                <label htmlFor="asset-code" className="block text-[10px] font-bold text-slate-700 mb-1">
                  Código *
                </label>
                <input
                  id="asset-code"
                  type="text"
                  required
                  disabled={isWriteLocked}
                  value={assetCode}
                  onChange={(e) => setAssetCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono bg-white disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="asset-name" className="block text-[10px] font-bold text-slate-700 mb-1">
                  Descripción del Bien *
                </label>
                <input
                  id="asset-name"
                  type="text"
                  required
                  disabled={isWriteLocked}
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="Ej. Laptop Dell Latitude / Utilitario"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="asset-date" className="block text-[10px] font-bold text-slate-700 mb-1">
                  Fecha Adquisición *
                </label>
                <input
                  id="asset-date"
                  type="date"
                  required
                  disabled={isWriteLocked}
                  value={assetDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-mono bg-white disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="asset-category" className="block text-[10px] font-bold text-slate-700 mb-1">
                  Categoría / Tasa LISR
                </label>
                <select
                  id="asset-category"
                  disabled={isWriteLocked}
                  value={assetCat}
                  onChange={(e) => {
                    const cat = e.target.value as FixedAssetCategory;
                    setAssetCat(cat);
                    if (cat === 'COMPUTO_30') setAssetRate(30);
                    else if (cat === 'TRANSPORTE_25') setAssetRate(25);
                    else if (cat === 'MOBILIARIO_10' || cat === 'MAQUINARIA_10') setAssetRate(10);
                    else setAssetRate(5);
                  }}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
                >
                  <option value="COMPUTO_30">Cómputo (30%)</option>
                  <option value="TRANSPORTE_25">Transporte (25%)</option>
                  <option value="MOBILIARIO_10">Mobiliario (10%)</option>
                  <option value="MAQUINARIA_10">Maquinaria (10%)</option>
                  <option value="EDIFICIOS_5">Construcciones (5%)</option>
                </select>
              </div>

              <div>
                <label htmlFor="asset-moi" className="block text-[10px] font-bold text-slate-700 mb-1">
                  MOI ($) *
                </label>
                <input
                  id="asset-moi"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                  disabled={isWriteLocked}
                  value={assetMoi}
                  onChange={(e) => setAssetMoi(sanitizeNumberInput(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono bg-white disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="asset-inpc-adq" className="block text-[10px] font-bold text-slate-700 mb-1">
                  INPC Adquisición (INEGI DOF)
                </label>
                <input
                  id="asset-inpc-adq"
                  type="number"
                  inputMode="decimal"
                  min="0.001"
                  step="0.001"
                  disabled={isWriteLocked}
                  value={assetInpcAdq}
                  onChange={(e) => setAssetInpcAdq(sanitizeNumberInput(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono bg-white disabled:bg-slate-100"
                />
              </div>

              <div>
                <label htmlFor="asset-inpc-mid" className="block text-[10px] font-bold text-slate-700 mb-1">
                  INPC Medio Periodo (INEGI DOF)
                </label>
                <input
                  id="asset-inpc-mid"
                  type="number"
                  inputMode="decimal"
                  min="0.001"
                  step="0.001"
                  disabled={isWriteLocked}
                  value={assetInpcUso}
                  onChange={(e) => setAssetInpcUso(sanitizeNumberInput(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono bg-white disabled:bg-slate-100"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={createAssetMutation.isPending || isWriteLocked}
                  title={isWriteLocked ? lockTitle : undefined}
                  className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A1120] hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Agregar Activo
                </button>
              </div>

              {assetCat === 'TRANSPORTE_25' && (
                <p role="note" className="sm:col-span-2 lg:col-span-4 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <strong>Art. 36 Fracc. II LISR:</strong> Automóviles utilitarios deducibles hasta un MOI de $175,000 MXN ($250,000 MXN en vehículos eléctricos o híbridos).
                </p>
              )}
            </form>

            <ActivosFijosTable
              assets={fixedAssetsData.assets}
              isPeriodLocked={isWriteLocked}
              onDeleteAsset={(id) => deleteAssetMutation.mutate(id)}
              isDeleting={deleteAssetMutation.isPending}
            />
          </div>

          <InpcCatalogModal
            isOpen={isInpcModalOpen}
            onClose={() => setIsInpcModalOpen(false)}
            activeYear={year}
          />
        </>
      )}
    </div>
  );
}
