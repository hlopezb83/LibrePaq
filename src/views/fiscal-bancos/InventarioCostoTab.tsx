import { AlertCircle, Boxes, CheckCircle2, Loader2, RefreshCw, RotateCcw, Save, Sparkles } from 'lucide-react';
import { Button, EmptyState, FormField, Input, KpiCard, LABEL_CLASS, Select, StatusBadge } from '../../components/ui';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../lib/formatters';
import { toCents } from '../../shared/engine/invariants-and-math';
import type { AccountWithBalance } from '../../shared/types';
import type { InventoryMethod } from '../../shared/types/cost-of-sales.types';
import { InventarioCostoPolizaPreview } from './InventarioCostoPolizaPreview';
import { useInventarioCosto } from './useInventarioCosto';

export interface InventarioCostoTabProps {
  companyId?: string;
  year?: number;
  period?: number;
  accounts?: AccountWithBalance[];
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  onFeedback?: (msg: string, type?: 'success' | 'error') => void;
}

export function InventarioCostoTab({
  companyId,
  year,
  period,
  accounts: accountsProp,
  isPeriodLocked = false,
  isReadOnlyClient: isReadOnlyClientProp = false,
  onFeedback
}: InventarioCostoTabProps) {
  const { activeCompanyId, activeCompany, isReadOnlyClient, isReadOnlySupportMode } = useCompany();
  const isReadOnly = Boolean(isReadOnlyClientProp) || isReadOnlyClient || isReadOnlySupportMode;
  const isLocked = isPeriodLocked || isReadOnly;
  const lockReason = isPeriodLocked ? 'Periodo fiscal bloqueado ante el SAT' : isReadOnly ? 'Modo solo lectura' : null;
  const toast = useToast();

  const targetCompanyId = companyId ?? activeCompanyId;
  const targetYear = year ?? activeCompany?.currentYear ?? 2026;
  const targetPeriod = period ?? activeCompany?.currentPeriod ?? 10;
  const periodLabel = `P${String(targetPeriod).padStart(2, '0')}/${targetYear}`;

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (onFeedback) onFeedback(msg, type);
    else if (type === 'error') toast.error(msg);
    else toast.success(msg);
  };

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    method,
    handleMethodChange,
    initialInput,
    setInitialInput,
    purchasesInput,
    setPurchasesInput,
    finalInput,
    setFinalInput,
    isDirty,
    setIsDirty,
    confirmPoliza,
    setConfirmPoliza,
    purchasesFromBalance,
    hasOverride,
    liveCost,
    exceedsAvailable,
    hasAnalyticalAdjustment,
    polizaPlan,
    polizaError,
    saveMutation,
    createPolizaMutation
  } = useInventarioCosto({
    targetCompanyId,
    targetYear,
    targetPeriod,
    periodLabel,
    accountsProp,
    isLocked,
    notify
  });

  if (isError) {
    return (
      <div role="alert">
        <EmptyState
          variant="card"
          tone="red"
          icon={<AlertCircle className="w-6 h-6" aria-hidden="true" />}
          title="Error al cargar Inventarios y Costo de Ventas"
          description={error instanceof Error ? error.message : 'Error de conexión.'}
          actions={
            <Button variant="primary" onClick={() => void refetch()} leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}>
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-600">
        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-blue-600" aria-hidden="true" />
        Calculando inventarios y compras netas de la balanza {periodLabel}...
      </div>
    );
  }

  const saveTitle = lockReason ?? 'Guardar cálculo de inventario del periodo';
  const polizaTitle = lockReason
    ?? (!polizaPlan
      ? (toCents(liveCost.costOfSales) <= 0 && !hasAnalyticalAdjustment
        ? 'El costo de ventas debe ser mayor a $0.00 para generar póliza'
        : polizaError ?? 'No hay cuentas contables disponibles para generar póliza')
      : 'Registrar póliza de diario de costo de ventas');

  const handlePolizaClick = () => {
    if (!polizaPlan || isLocked) return;
    if (!confirmPoliza) {
      setConfirmPoliza(true);
      return;
    }
    createPolizaMutation.mutate();
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Inventario Inicial" value={formatCurrency(liveCost.initialInventory)} />
        <KpiCard
          label={`${method === 'PERPETUO' ? 'Entradas Almacén' : 'Compras Netas'} (${hasOverride ? 'Manual' : method === 'PERPETUO' ? 'Balanza 115' : 'Balanza 501'})`}
          value={formatCurrency(liveCost.purchasesPeriod)}
          valueClassName="text-blue-800"
        />
        <KpiCard label="Inventario Final" value={formatCurrency(liveCost.finalInventory)} />
        <KpiCard
          tone="emerald"
          label={`Costo de Ventas del Mes (${periodLabel})`}
          value={formatCurrency(liveCost.costOfSales)}
          valueClassName="text-emerald-900"
        />
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Boxes className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Control de Inventarios y Costo de lo Vendido (Art. 39 LISR)</h2>
                {isDirty && <StatusBadge tone="amber">Cambios sin guardar</StatusBadge>}
              </div>
              <p className="text-xs text-slate-600">
                Fórmula: Inv. Inicial + {method === 'PERPETUO' ? 'Entradas Almacén' : 'Compras Netas'} − Inv. Final = Costo de Ventas
              </p>
            </div>
          </div>
          {data.polizaId && (
            <StatusBadge tone="emerald" icon={<CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}>
              Póliza vinculada
            </StatusBadge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormField
            label="Método de Registro"
            htmlFor="inv-method"
            hint={
              method === 'PERPETUO'
                ? 'Las compras entran a Almacén (115); la póliza carga Costo de Ventas (501) con abono a 115.'
                : 'Traspasa Inv. Inicial y reconoce Inv. Final entre 115 y 501 sin duplicar compras.'
            }
          >
            <Select
              id="inv-method"
              value={method}
              disabled={isLocked}
              onChange={(e) => handleMethodChange(e.target.value as InventoryMethod)}
              className="font-semibold"
            >
              <option value="ANALITICO">Analítico / Pormenorizado</option>
              <option value="PERPETUO">Inventarios Perpetuos</option>
            </Select>
          </FormField>

          <FormField label="Inventario Inicial ($)" htmlFor="inv-initial">
            <Input
              id="inv-initial"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              disabled={isLocked}
              value={initialInput}
              onChange={(e) => { setInitialInput(e.target.value); setIsDirty(true); setConfirmPoliza(false); }}
              className="font-mono tabular-nums"
            />
          </FormField>

          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <label htmlFor="inv-purchases" className={LABEL_CLASS.replace(' mb-1', '')}>
                {method === 'PERPETUO' ? 'Entradas Almacén ($)' : 'Compras Netas ($)'}
              </label>
              {hasOverride && (
                <button
                  type="button"
                  disabled={isLocked}
                  title={lockReason ?? `Restaurar ${method === 'PERPETUO' ? 'entradas de almacén' : 'compras netas'} desde la balanza`}
                  onClick={() => { setPurchasesInput(''); setIsDirty(true); setConfirmPoliza(false); }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" /> Balanza ({formatCurrency(purchasesFromBalance)})
                </button>
              )}
            </div>
            <Input
              id="inv-purchases"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              disabled={isLocked}
              placeholder={`Balanza: ${formatCurrency(purchasesFromBalance)}`}
              value={purchasesInput}
              onChange={(e) => { setPurchasesInput(e.target.value); setIsDirty(true); setConfirmPoliza(false); }}
              className="font-mono tabular-nums"
            />
          </div>

          <FormField label="Inventario Final ($)" htmlFor="inv-final">
            <Input
              id="inv-final"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              disabled={isLocked}
              value={finalInput}
              onChange={(e) => { setFinalInput(e.target.value); setIsDirty(true); setConfirmPoliza(false); }}
              className="font-mono tabular-nums"
            />
          </FormField>
        </div>

        <InventarioCostoPolizaPreview
          liveCost={liveCost}
          exceedsAvailable={exceedsAvailable}
          polizaPlan={polizaPlan}
          hasExistingPoliza={Boolean(data.polizaId)}
          confirmPoliza={confirmPoliza}
          isLocked={isLocked}
          lockReason={lockReason}
          isSubmitting={createPolizaMutation.isPending}
          onCancelConfirm={() => setConfirmPoliza(false)}
          onConfirmPoliza={() => createPolizaMutation.mutate()}
        />

        {polizaError && <p role="alert" className="text-xs text-red-700 font-medium">{polizaError}</p>}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-1">
          <Button
            variant="secondary"
            loading={saveMutation.isPending}
            disabled={isLocked}
            title={saveTitle}
            onClick={() => saveMutation.mutate()}
            leftIcon={saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Save className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            {saveMutation.isPending ? 'Guardando...' : 'Guardar Inventario'}
          </Button>
          <Button
            variant="primary"
            loading={createPolizaMutation.isPending}
            disabled={isLocked || !polizaPlan}
            title={polizaTitle}
            onClick={handlePolizaClick}
            leftIcon={createPolizaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            {createPolizaMutation.isPending ? 'Registrando...' : 'Registrar Póliza de Costo de Ventas'}
          </Button>
        </div>
      </div>
    </div>
  );
}
