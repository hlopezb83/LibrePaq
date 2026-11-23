import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Boxes, Calculator, CheckCircle2, RefreshCw, RotateCcw, Save, Sparkles } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import { inventoryClient } from '../../lib/inventory-client';
import { buildCostOfSalesPolizaPlan, computeCostOfSales } from '../../shared/engine/cost-of-sales.engine';
import type { AccountWithBalance } from '../../shared/types';
import type { InventoryMethod } from '../../shared/types/cost-of-sales.types';

export interface InventarioCostoTabProps {
  companyId?: string;
  year?: number;
  period?: number;
  accounts?: AccountWithBalance[];
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  onFeedback?: (msg: string, type?: 'success' | 'error') => void;
}

function parseNonNeg(val: string): number {
  const n = Number.parseFloat(val);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function InventarioCostoTab({
  companyId, year, period, accounts: accountsProp, isPeriodLocked = false, isReadOnlyClient: isReadOnlyClientProp = false, onFeedback
}: InventarioCostoTabProps) {
  const { activeCompanyId, activeCompany, isReadOnlyClient, isReadOnlySupportMode } = useCompany();
  const isReadOnly = Boolean(isReadOnlyClientProp) || isReadOnlyClient || isReadOnlySupportMode;
  const isLocked = isPeriodLocked || isReadOnly;
  const lockReason = isPeriodLocked
    ? 'Periodo fiscal bloqueado ante el SAT'
    : isReadOnly
      ? 'Modo solo lectura'
      : null;

  const toast = useToast();
  const queryClient = useQueryClient();

  const targetCompanyId = companyId ?? activeCompanyId;
  const targetYear = year ?? activeCompany?.currentYear ?? 2026;
  const targetPeriod = period ?? activeCompany?.currentPeriod ?? 10;
  const periodLabel = `P${String(targetPeriod).padStart(2, '0')}/${targetYear}`;

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (onFeedback) onFeedback(msg, type);
    else if (type === 'error') toast.error(msg);
    else toast.success(msg);
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventory-cost', targetCompanyId, targetYear, targetPeriod],
    queryFn: () => inventoryClient.getInventoryPeriod(targetCompanyId, targetYear, targetPeriod),
    enabled: Boolean(targetCompanyId)
  });

  const { data: fetchedAccounts = [] } = useQuery({
    queryKey: ['accounts', targetCompanyId],
    queryFn: () => apiClient.getAccounts(targetCompanyId),
    enabled: Boolean(targetCompanyId) && !(accountsProp && accountsProp.length > 0)
  });

  const resolvedAccounts = accountsProp && accountsProp.length > 0 ? accountsProp : fetchedAccounts;
  const [method, setMethod] = useState<InventoryMethod>('ANALITICO');
  const [initialInput, setInitialInput] = useState<string>('0');
  const [purchasesInput, setPurchasesInput] = useState<string>('');
  const [finalInput, setFinalInput] = useState<string>('0');
  const [confirmPoliza, setConfirmPoliza] = useState<boolean>(false);

  useEffect(() => {
    if (!data) return;
    setMethod(data.method);
    setInitialInput(String(data.initialInventory));
    setPurchasesInput(data.purchasesOverride !== null ? String(data.purchasesOverride) : '');
    setFinalInput(String(data.finalInventory));
    setConfirmPoliza(false);
  }, [data]);

  const purchasesFromBalance = data?.purchasesFromBalance ?? 0;
  const hasOverride = purchasesInput.trim() !== '';
  const effectivePurchases = hasOverride ? parseNonNeg(purchasesInput) : purchasesFromBalance;

  const liveCost = useMemo(
    () => computeCostOfSales({
      initialInventory: parseNonNeg(initialInput),
      purchasesPeriod: effectivePurchases,
      finalInventory: parseNonNeg(finalInput)
    }),
    [initialInput, effectivePurchases, finalInput]
  );

  const exceedsAvailable = parseNonNeg(finalInput) > liveCost.availableMerchandise;

  const { polizaPlan, polizaError } = useMemo(() => {
    if (!targetCompanyId || liveCost.costOfSales <= 0 || resolvedAccounts.length === 0) {
      return { polizaPlan: null, polizaError: null };
    }
    try {
      const plan = buildCostOfSalesPolizaPlan({
        companyId: targetCompanyId, year: targetYear, period: targetPeriod,
        costOfSales: liveCost.costOfSales, accounts: resolvedAccounts
      });
      return { polizaPlan: plan, polizaError: null };
    } catch (err) {
      return { polizaPlan: null, polizaError: err instanceof Error ? err.message : 'Error al preparar póliza.' };
    }
  }, [targetCompanyId, targetYear, targetPeriod, liveCost.costOfSales, resolvedAccounts]);

  const buildSavePayload = (polizaId?: string | null) => ({
    ejercicio: targetYear,
    periodo: targetPeriod,
    initialInventory: parseNonNeg(initialInput),
    purchasesOverride: hasOverride ? parseNonNeg(purchasesInput) : null,
    finalInventory: parseNonNeg(finalInput),
    method,
    ...(polizaId !== undefined ? { polizaId } : {})
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (isLocked) {
        throw new Error('Periodo bloqueado o modo solo lectura: no es posible guardar inventarios.');
      }
      return inventoryClient.saveInventoryPeriod(targetCompanyId, buildSavePayload());
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['inventory-cost', targetCompanyId, targetYear, targetPeriod], updated);
      notify(`Inventario y Costo de Ventas ${periodLabel} guardado.`);
    },
    onError: (err: Error) => notify(`Error al guardar inventario: ${err.message}`, 'error')
  });

  const createPolizaMutation = useMutation({
    mutationFn: async () => {
      if (isLocked) {
        throw new Error('Periodo bloqueado o modo solo lectura: no es posible generar pólizas.');
      }
      if (!polizaPlan) throw new Error('No hay un borrador de póliza válido para registrar.');
      const poliza = await apiClient.createPoliza({
        companyId: polizaPlan.companyId, tipo: polizaPlan.tipo, fecha: polizaPlan.fecha,
        concepto: polizaPlan.concepto, origin: polizaPlan.origin,
        movements: polizaPlan.movements.map(({ accountId, referencia, concepto, cargo, abono }) => ({
          accountId, referencia, concepto, cargo, abono
        }))
      });
      await inventoryClient.saveInventoryPeriod(targetCompanyId, buildSavePayload(poliza.id));
      return { poliza, targetCompanyId, targetYear, targetPeriod };
    },
    onSuccess: ({ poliza, targetCompanyId: cid, targetYear: y, targetPeriod: p }) => {
      setConfirmPoliza(false);
      invalidateAccountingQueries(queryClient, ['polizas', 'accounts', 'account-ledger', 'reports', 'dashboard'], cid);
      void queryClient.invalidateQueries({ queryKey: ['inventory-cost', cid, y, p] });
      notify(`Póliza de Costo de Ventas (Diario #${poliza.folio}) registrada y cuadrada.`);
    },
    onError: (err: Error) => notify(`Error al registrar póliza de costo: ${err.message}`, 'error')
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
    { label: `Compras Netas (${hasOverride ? 'Manual' : 'Balanza 501'})`, value: liveCost.purchasesPeriod, box: 'bg-white border-slate-300', lbl: 'text-slate-600', val: 'text-blue-800' },
    { label: 'Inventario Final', value: liveCost.finalInventory, box: 'bg-white border-slate-300', lbl: 'text-slate-600', val: 'text-slate-900' },
    { label: `Costo de Ventas del Mes (${periodLabel})`, value: liveCost.costOfSales, box: 'bg-emerald-50/70 border-emerald-300', lbl: 'text-emerald-900', val: 'text-emerald-900' }
  ];

  const saveTitle = lockReason ?? 'Guardar cálculo de inventario del periodo';
  const polizaTitle = lockReason
    ?? (!polizaPlan
      ? (liveCost.costOfSales <= 0
        ? 'El costo de ventas debe ser mayor a $0.00 para generar póliza'
        : polizaError ?? 'No hay cuentas contables disponibles para generar póliza')
      : 'Registrar póliza de diario de costo de ventas');

  const handlePolizaClick = () => {
    if (!polizaPlan || isLocked) return;
    if (data.polizaId && !confirmPoliza) {
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
              <h2 className="text-sm font-bold text-slate-900">Control de Inventarios y Costo de lo Vendido (Art. 39 LISR)</h2>
              <p className="text-xs text-slate-600">Fórmula: Inv. Inicial + Compras Netas − Inv. Final = Costo de Ventas</p>
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
            <select id="inv-method" value={method} disabled={isLocked} onChange={(e) => setMethod(e.target.value as InventoryMethod)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white disabled:bg-slate-100">
              <option value="ANALITICO">Analítico / Pormenorizado</option>
              <option value="PERPETUO">Inventarios Perpetuos</option>
            </select>
            {method === 'PERPETUO' && (
              <p className="text-[11px] text-slate-600">
                En Inventarios Perpetuos el costo se registra en cada venta; esta cédula sirve como amarre de cierre.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor="inv-initial" className="block text-xs font-bold text-slate-700">Inventario Inicial ($)</label>
            <input id="inv-initial" type="number" inputMode="decimal" min="0" step="0.01" disabled={isLocked} value={initialInput} onChange={(e) => { setInitialInput(e.target.value); setConfirmPoliza(false); }} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono tabular-nums text-slate-900 disabled:bg-slate-100" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label htmlFor="inv-purchases" className="block text-xs font-bold text-slate-700">Compras Netas ($)</label>
              {hasOverride && (
                <button type="button" disabled={isLocked} title={lockReason ?? 'Restaurar compras netas desde la balanza (cuenta 501)'} onClick={() => { setPurchasesInput(''); setConfirmPoliza(false); }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                  <RotateCcw className="w-3 h-3" aria-hidden="true" /> Balanza ({formatCurrency(purchasesFromBalance)})
                </button>
              )}
            </div>
            <input id="inv-purchases" type="number" inputMode="decimal" min="0" step="0.01" disabled={isLocked} placeholder={`Balanza: ${formatCurrency(purchasesFromBalance)}`} value={purchasesInput} onChange={(e) => { setPurchasesInput(e.target.value); setConfirmPoliza(false); }} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono tabular-nums text-slate-900 disabled:bg-slate-100" />
          </div>
          <div className="space-y-1">
            <label htmlFor="inv-final" className="block text-xs font-bold text-slate-700">Inventario Final ($)</label>
            <input id="inv-final" type="number" inputMode="decimal" min="0" step="0.01" disabled={isLocked} value={finalInput} onChange={(e) => { setFinalInput(e.target.value); setConfirmPoliza(false); }} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono tabular-nums text-slate-900 disabled:bg-slate-100" />
          </div>
        </div>

        <div aria-live="polite" className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700 font-mono tabular-nums">
            <Calculator className="w-4 h-4 text-slate-600 shrink-0" aria-hidden="true" />
            <span>
              {formatCurrency(liveCost.initialInventory)} + {formatCurrency(liveCost.purchasesPeriod)} − {formatCurrency(liveCost.finalInventory)} ={' '}
              <strong className="text-emerald-800">{formatCurrency(liveCost.costOfSales)}</strong>
            </span>
          </div>
          {polizaPlan && (
            <div className="text-[11px] text-slate-600 font-mono">
              Diario ({formatShortDate(polizaPlan.fecha)}): Cargo {polizaPlan.movements[0]?.accountCode} {polizaPlan.movements[0]?.accountName} / Abono {polizaPlan.movements[1]?.accountCode} {polizaPlan.movements[1]?.accountName}
            </div>
          )}
        </div>

        {exceedsAvailable && (
          <div role="status" aria-live="polite" className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              El Inventario Final capturado supera la mercancía disponible ({formatCurrency(liveCost.availableMerchandise)}), por lo que el Costo de Ventas se ajustó a <strong className="font-mono">$0.00</strong>.
            </span>
          </div>
        )}

        {confirmPoliza && polizaPlan && (
          <div role="region" aria-label="Confirmación de póliza de costo de ventas" className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5 text-amber-950">
              <p className="font-semibold">
                Ya existe una póliza vinculada para este periodo. ¿Generar una nueva póliza de Costo de Ventas y actualizar el vínculo?
              </p>
              <p className="text-[11px] font-mono text-amber-900">
                Diario ({formatShortDate(polizaPlan.fecha)}): Cargo {polizaPlan.movements[0]?.accountCode} {polizaPlan.movements[0]?.accountName} / Abono {polizaPlan.movements[1]?.accountCode} {polizaPlan.movements[1]?.accountName} · {formatCurrency(liveCost.costOfSales)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" autoFocus onClick={() => setConfirmPoliza(false)} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold cursor-pointer">
                Cancelar
              </button>
              <button type="button" disabled={isLocked || createPolizaMutation.isPending} title={lockReason ?? 'Confirmar y registrar nueva póliza de costo de ventas'} onClick={() => createPolizaMutation.mutate()} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                {createPolizaMutation.isPending ? 'Registrando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        {polizaError && <p role="alert" className="text-xs text-red-700 font-medium">{polizaError}</p>}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-1">
          <button type="button" disabled={isLocked || saveMutation.isPending} title={saveTitle} onClick={() => saveMutation.mutate()} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition cursor-pointer">
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            {saveMutation.isPending ? 'Guardando...' : 'Guardar Inventario'}
          </button>
          <button type="button" disabled={isLocked || !polizaPlan || createPolizaMutation.isPending} title={polizaTitle} onClick={handlePolizaClick} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition cursor-pointer">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            {createPolizaMutation.isPending ? 'Registrando...' : 'Registrar Póliza de Costo de Ventas'}
          </button>
        </div>
      </div>
    </div>
  );
}
