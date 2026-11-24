import { AlertCircle, Boxes, CheckCircle2, Loader2, RefreshCw, RotateCcw, Save, Sparkles } from 'lucide-react';
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
      <div role="alert" className="p-8 bg-white rounded-2xl border border-red-200 text-center space-y-3 shadow-2xs">
        <AlertCircle className="w-8 h-8 text-red-600 mx-auto" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-900">Error al cargar Inventarios y Costo de Ventas</p>
        <p className="text-xs text-slate-600">{error instanceof Error ? error.message : 'Error de conexión.'}</p>
        <button type="button" onClick={() => void refetch()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Reintentar
        </button>
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

  const kpis = [
    { label: 'Inventario Inicial', value: liveCost.initialInventory, box: 'bg-white border-slate-300', lbl: 'text-slate-600', val: 'text-slate-900' },
    { label: `${method === 'PERPETUO' ? 'Entradas Almacén' : 'Compras Netas'} (${hasOverride ? 'Manual' : method === 'PERPETUO' ? 'Balanza 115' : 'Balanza 501'})`, value: liveCost.purchasesPeriod, box: 'bg-white border-slate-300', lbl: 'text-slate-600', val: 'text-blue-800' },
    { label: 'Inventario Final', value: liveCost.finalInventory, box: 'bg-white border-slate-300', lbl: 'text-slate-600', val: 'text-slate-900' },
    { label: `Costo de Ventas del Mes (${periodLabel})`, value: liveCost.costOfSales, box: 'bg-emerald-50/70 border-emerald-300', lbl: 'text-emerald-900', val: 'text-emerald-900' }
  ];

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
        {kpis.map((k) => (
          <div key={k.label} className={`p-4 rounded-2xl border min-w-0 ${k.box}`}>
            <div className={`text-[11px] font-bold uppercase ${k.lbl}`}>{k.label}</div>
            <div className={`mt-1 text-lg font-extrabold font-mono tabular-nums ${k.val}`}>{formatCurrency(k.value)}</div>
          </div>
        ))}
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Boxes className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Control de Inventarios y Costo de lo Vendido (Art. 39 LISR)</h2>
                {isDirty && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-300">
                    Cambios sin guardar
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                Fórmula: Inv. Inicial + {method === 'PERPETUO' ? 'Entradas Almacén' : 'Compras Netas'} − Inv. Final = Costo de Ventas
              </p>
            </div>
          </div>
          {data.polizaId && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Póliza vinculada
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label htmlFor="inv-method" className="block text-xs font-bold text-slate-700">Método de Registro</label>
            <select id="inv-method" value={method} disabled={isLocked} onChange={(e) => handleMethodChange(e.target.value as InventoryMethod)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white disabled:bg-slate-100">
              <option value="ANALITICO">Analítico / Pormenorizado</option>
              <option value="PERPETUO">Inventarios Perpetuos</option>
            </select>
            <p className="text-[11px] text-slate-600">
              {method === 'PERPETUO'
                ? 'Las compras entran a Almacén (115); la póliza carga Costo de Ventas (501) con abono a 115.'
                : 'Traspasa Inv. Inicial y reconoce Inv. Final entre 115 y 501 sin duplicar compras.'}
            </p>
          </div>
          <div className="space-y-1">
            <label htmlFor="inv-initial" className="block text-xs font-bold text-slate-700">Inventario Inicial ($)</label>
            <input id="inv-initial" type="number" inputMode="decimal" min="0" step="0.01" disabled={isLocked} value={initialInput} onChange={(e) => { setInitialInput(e.target.value); setIsDirty(true); setConfirmPoliza(false); }} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono tabular-nums text-slate-900 disabled:bg-slate-100" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label htmlFor="inv-purchases" className="block text-xs font-bold text-slate-700">
                {method === 'PERPETUO' ? 'Entradas Almacén ($)' : 'Compras Netas ($)'}
              </label>
              {hasOverride && (
                <button type="button" disabled={isLocked} title={lockReason ?? `Restaurar ${method === 'PERPETUO' ? 'entradas de almacén' : 'compras netas'} desde la balanza`} onClick={() => { setPurchasesInput(''); setIsDirty(true); setConfirmPoliza(false); }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                  <RotateCcw className="w-3 h-3" aria-hidden="true" /> Balanza ({formatCurrency(purchasesFromBalance)})
                </button>
              )}
            </div>
            <input id="inv-purchases" type="number" inputMode="decimal" min="0" step="0.01" disabled={isLocked} placeholder={`Balanza: ${formatCurrency(purchasesFromBalance)}`} value={purchasesInput} onChange={(e) => { setPurchasesInput(e.target.value); setIsDirty(true); setConfirmPoliza(false); }} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono tabular-nums text-slate-900 disabled:bg-slate-100" />
          </div>
          <div className="space-y-1">
            <label htmlFor="inv-final" className="block text-xs font-bold text-slate-700">Inventario Final ($)</label>
            <input id="inv-final" type="number" inputMode="decimal" min="0" step="0.01" disabled={isLocked} value={finalInput} onChange={(e) => { setFinalInput(e.target.value); setIsDirty(true); setConfirmPoliza(false); }} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono tabular-nums text-slate-900 disabled:bg-slate-100" />
          </div>
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
          <button type="button" disabled={isLocked || saveMutation.isPending} title={saveTitle} onClick={() => saveMutation.mutate()} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition cursor-pointer">
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Save className="w-3.5 h-3.5" aria-hidden="true" />}
            {saveMutation.isPending ? 'Guardando...' : 'Guardar Inventario'}
          </button>
          <button type="button" disabled={isLocked || !polizaPlan || createPolizaMutation.isPending} title={polizaTitle} onClick={handlePolizaClick} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition cursor-pointer">
            {createPolizaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />}
            {createPolizaMutation.isPending ? 'Registrando...' : 'Registrar Póliza de Costo de Ventas'}
          </button>
        </div>
      </div>
    </div>
  );
}
