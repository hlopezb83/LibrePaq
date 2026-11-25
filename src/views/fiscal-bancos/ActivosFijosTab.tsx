import { useState } from 'react';
import { AlertCircle, BookOpen, Building, FileSpreadsheet, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { AlertBanner, Button, EmptyState, KpiCard } from '../../components/ui';
import { useCompany } from '../../context/CompanyContext';
import { formatCurrency, getDefaultDateForPeriod } from '../../lib/formatters';
import type { AccountWithBalance } from '../../shared/types';
import { ActivosFijosBajaModal } from './ActivosFijosBajaModal';
import { exportFixedAssetsXlsx } from './ActivosFijosExport';
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
  const { activeCompany, isReadOnlyClient, isReadOnlySupportMode } = useCompany();
  const isReadOnly = Boolean(isReadOnlyClientProp) || isReadOnlyClient || isReadOnlySupportMode;
  const isWriteLocked = isPeriodLocked || isReadOnly;
  const lockTitle = isReadOnly ? 'Modo solo lectura' : 'Periodo fiscal bloqueado ante el SAT';
  const [confirmDepPoliza, setConfirmDepPoliza] = useState(false);

  const fa = useActivosFijos({
    companyId,
    year,
    period,
    accounts,
    isPeriodLocked,
    isReadOnlyClient: isReadOnly,
    onFeedback
  });

  const depMensual = fa.fixedAssetsData?.totals.totalDepreciacionMensualContable ?? 0;
  const noDepAmount = depMensual <= 0;

  return (
    <div className="space-y-5">
      {fa.isErrorAssets ? (
        <div role="alert">
          <EmptyState
            variant="card"
            tone="red"
            icon={<AlertCircle className="w-6 h-6" aria-hidden="true" />}
            title="Error al cargar los activos fijos"
            description={
              fa.errorAssets instanceof Error
                ? fa.errorAssets.message
                : 'Error de conexión con el servidor contable.'
            }
            actions={
              <Button
                variant="primary"
                onClick={() => void fa.refetchAssets()}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
              >
                Reintentar
              </Button>
            }
          />
        </div>
      ) : fa.loadingAssets || !fa.fixedAssetsData ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-600"
        >
          Calculando depreciación mensual contable y actualización fiscal con INPC...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Monto Original de la Inversión (MOI Total)"
              value={formatCurrency(fa.fixedAssetsData.totals.totalMoi)}
              hint={`${fa.fixedAssetsData.assets.length} activos fijos (corte P${String(fa.activePeriod).padStart(2, '0')}/${year})`}
            />
            <KpiCard
              label="Depreciación Contable del Mes (NIF C-6)"
              value={formatCurrency(depMensual)}
              valueClassName="text-blue-800"
              hint="Cargo a 601-01-006 / Abono a 171-01-001"
            />
            <KpiCard
              label="Deducción de Inversión Actualizada (Art. 31 LISR INPC)"
              value={formatCurrency(fa.fixedAssetsData.totals.totalDepreciacionMensualFiscal)}
              valueClassName="text-emerald-800"
              hint="Con Factor de Actualización INPC a 4 decimales"
            />
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <Building className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900">
                    Cédula de Activos Fijos y Depreciación Mensual (Contable vs Fiscal INPC)
                  </h2>
                  <p className="text-xs text-slate-600">
                    Registra activos nuevos o migrados, edita meses depreciados, da de baja o genera la póliza mensual
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <Button
                  variant="export-outline"
                  disabled={fa.fixedAssetsData.assets.length === 0}
                  onClick={() => {
                    void exportFixedAssetsXlsx({
                      companyName: activeCompany?.name ?? 'Empresa',
                      companyRfc: activeCompany?.rfc ?? 'XAXX010101000',
                      year,
                      period: fa.activePeriod,
                      data: fa.fixedAssetsData!
                    }).then(() => onFeedback('Cédula de Activos Fijos exportada en Excel (.xlsx).'));
                  }}
                  leftIcon={<FileSpreadsheet className="w-4 h-4" aria-hidden="true" />}
                >
                  Excel (.XLSX)
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => fa.setIsInpcModalOpen(true)}
                  leftIcon={<BookOpen className="w-4 h-4 text-blue-700" aria-hidden="true" />}
                >
                  Catálogo INPC / DOF
                </Button>
                <Button
                  variant="primary"
                  loading={fa.genDepPolizaMutation.isPending}
                  disabled={isWriteLocked || fa.hasDepPolizaThisPeriod || noDepAmount}
                  title={
                    fa.hasDepPolizaThisPeriod
                      ? 'Ya existe una póliza de depreciación registrada para este periodo'
                      : isWriteLocked
                        ? lockTitle
                        : noDepAmount
                          ? 'No hay depreciación contable mensual mayor a $0.00 para contabilizar'
                          : 'Generar póliza mensual de depreciación contable'
                  }
                  onClick={() => setConfirmDepPoliza(true)}
                  leftIcon={
                    fa.genDepPolizaMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                    )
                  }
                >
                  {fa.genDepPolizaMutation.isPending
                    ? 'Generando Póliza...'
                    : fa.hasDepPolizaThisPeriod
                      ? 'Depreciación del Mes ya Generada'
                      : 'Generar Póliza de Depreciación del Mes'}
                </Button>
              </div>
            </div>

            {confirmDepPoliza && !fa.hasDepPolizaThisPeriod && !noDepAmount && (
              <div
                role="alertdialog"
                aria-label="Confirmación de póliza de depreciación"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setConfirmDepPoliza(false);
                  }
                }}
              >
                <AlertBanner
                  tone="warning"
                  title={`¿Confirmas registrar la póliza de Diario de Depreciación del periodo P${String(fa.activePeriod).padStart(2, '0')}/${year}?`}
                  action={
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" autoFocus onClick={() => setConfirmDepPoliza(false)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        loading={fa.genDepPolizaMutation.isPending}
                        disabled={isWriteLocked}
                        onClick={() => {
                          fa.genDepPolizaMutation.mutate(undefined, {
                            onSuccess: () => setConfirmDepPoliza(false)
                          });
                        }}
                        leftIcon={fa.genDepPolizaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : undefined}
                      >
                        {fa.genDepPolizaMutation.isPending ? 'Generando...' : 'Confirmar Póliza'}
                      </Button>
                    </div>
                  }
                >
                  <span className="font-mono text-[11px] block mt-0.5">
                    Debe: 601-01-006 Depreciación ({formatCurrency(depMensual)}) · Haber: 171-01-001 Dep. Acumulada ({formatCurrency(depMensual)})
                  </span>
                </AlertBanner>
              </div>
            )}

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
              vehicleCapType={fa.vehicleCapType}
              setVehicleCapType={fa.setVehicleCapType}
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
              isPeriodLocked={isPeriodLocked}
              isReadOnlyClient={isReadOnly}
              onEditAsset={fa.startEditAsset}
              onRetireAsset={(asset) => fa.setBajaModalAsset(asset)}
              onDeleteAsset={(id) => fa.deleteAssetMutation.mutate(id)}
              isDeleting={fa.deleteAssetMutation.isPending || fa.retireAssetMutation.isPending}
            />
          </div>

          <ActivosFijosBajaModal
            asset={fa.bajaModalAsset}
            defaultDate={getDefaultDateForPeriod(year, fa.activePeriod)}
            accounts={accounts}
            isSubmitting={fa.retireAssetMutation.isPending}
            onClose={() => fa.setBajaModalAsset(null)}
            onConfirm={(payload) => fa.retireAssetMutation.mutate(payload)}
          />

          <InpcCatalogModal
            isOpen={fa.isInpcModalOpen}
            onClose={() => fa.setIsInpcModalOpen(false)}
            activeYear={year}
            companyId={companyId}
            isReadOnly={isReadOnly}
          />
        </>
      )}
    </div>
  );
}
