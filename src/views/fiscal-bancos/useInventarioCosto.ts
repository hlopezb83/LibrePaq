import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { inventoryClient } from '../../lib/inventory-client';
import {
  buildCostOfSalesPolizaPlan,
  computeCostOfSales,
  computeInventoryInputsFromMovements,
  computePurchasesFromMovements,
  type CostPolizaMovementInput
} from '../../shared/engine/cost-of-sales.engine';
import { toCents } from '../../shared/engine/invariants-and-math';
import type { AccountWithBalance } from '../../shared/types';
import type { InventoryMethod } from '../../shared/types/cost-of-sales.types';

export function parseNonNeg(val: string): number {
  const n = Number.parseFloat(val);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function useInventarioCosto(params: {
  targetCompanyId: string;
  targetYear: number;
  targetPeriod: number;
  periodLabel: string;
  accountsProp?: AccountWithBalance[];
  isLocked: boolean;
  notify: (msg: string, type?: 'success' | 'error') => void;
}) {
  const { targetCompanyId, targetYear, targetPeriod, periodLabel, accountsProp, isLocked, notify } = params;
  const queryClient = useQueryClient();

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

  const { data: periodPolizas = [], refetch: refetchPolizas } = useQuery({
    queryKey: ['polizas', targetCompanyId, targetYear, targetPeriod],
    queryFn: () => apiClient.getPolizas(targetCompanyId, targetYear, targetPeriod),
    enabled: Boolean(targetCompanyId)
  });

  const resolvedAccounts = accountsProp && accountsProp.length > 0 ? accountsProp : fetchedAccounts;
  const [method, setMethod] = useState<InventoryMethod>('ANALITICO');
  const [initialInput, setInitialInput] = useState<string>('0');
  const [purchasesInput, setPurchasesInput] = useState<string>('');
  const [finalInput, setFinalInput] = useState<string>('0');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [confirmPoliza, setConfirmPoliza] = useState<boolean>(false);

  const contextKey = `${targetCompanyId}::${targetYear}::${targetPeriod}`;
  const hydratedKeyRef = useRef<string>('');
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    setIsDirty(false);
    setConfirmPoliza(false);
  }, [contextKey]);

  useEffect(() => {
    if (!data) return;
    const keyChanged = hydratedKeyRef.current !== contextKey;
    if (!keyChanged && isDirtyRef.current) return;
    hydratedKeyRef.current = contextKey;
    setMethod(data.method);
    setInitialInput(String(data.initialInventory));
    setPurchasesInput(data.purchasesOverride !== null ? String(data.purchasesOverride) : '');
    setFinalInput(String(data.finalInventory));
    setIsDirty(false);
    setConfirmPoliza(false);
  }, [contextKey, data]);

  const flatPeriodMovs = useMemo<CostPolizaMovementInput[]>(
    () =>
      periodPolizas.flatMap((p) =>
        p.movements.map((m) => ({
          poliza_id: p.id,
          account_id: m.accountId,
          cargo: m.cargo,
          abono: m.abono,
          polizas: null
        }))
      ),
    [periodPolizas]
  );

  const purchasesFromBalance = useMemo(() => {
    if (data && method === data.method) return data.purchasesFromBalance;
    if (resolvedAccounts.length > 0) {
      return method === 'PERPETUO'
        ? computeInventoryInputsFromMovements(resolvedAccounts, flatPeriodMovs, data?.polizaId)
        : computePurchasesFromMovements(resolvedAccounts, flatPeriodMovs, data?.polizaId);
    }
    return data?.purchasesFromBalance ?? 0;
  }, [data, method, resolvedAccounts, flatPeriodMovs]);

  const hasOverride = purchasesInput.trim() !== '';
  const effectivePurchases = hasOverride ? parseNonNeg(purchasesInput) : purchasesFromBalance;

  const liveCost = useMemo(
    () =>
      computeCostOfSales({
        initialInventory: parseNonNeg(initialInput),
        purchasesPeriod: effectivePurchases,
        finalInventory: parseNonNeg(finalInput)
      }),
    [initialInput, effectivePurchases, finalInput]
  );

  const exceedsAvailable = parseNonNeg(finalInput) > liveCost.availableMerchandise;
  const hasAnalyticalAdjustment =
    method === 'ANALITICO' &&
    (toCents(liveCost.initialInventory) > 0 || toCents(liveCost.finalInventory) > 0);

  const { polizaPlan, polizaError } = useMemo(() => {
    if (
      !targetCompanyId ||
      resolvedAccounts.length === 0 ||
      (toCents(liveCost.costOfSales) <= 0 && !hasAnalyticalAdjustment)
    ) {
      return { polizaPlan: null, polizaError: null };
    }
    try {
      const plan = buildCostOfSalesPolizaPlan({
        companyId: targetCompanyId,
        year: targetYear,
        period: targetPeriod,
        costOfSales: liveCost.costOfSales,
        accounts: resolvedAccounts,
        method,
        initialInventory: liveCost.initialInventory,
        purchasesPeriod: liveCost.purchasesPeriod,
        finalInventory: liveCost.finalInventory
      });
      return { polizaPlan: plan, polizaError: null };
    } catch (err) {
      return {
        polizaPlan: null,
        polizaError: err instanceof Error ? err.message : 'Error al preparar póliza.'
      };
    }
  }, [
    targetCompanyId,
    targetYear,
    targetPeriod,
    liveCost.costOfSales,
    liveCost.initialInventory,
    liveCost.purchasesPeriod,
    liveCost.finalInventory,
    method,
    resolvedAccounts,
    hasAnalyticalAdjustment
  ]);

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
      if (isLocked) throw new Error('Periodo bloqueado o modo solo lectura: no es posible guardar inventarios.');
      return inventoryClient.saveInventoryPeriod(targetCompanyId, buildSavePayload());
    },
    onSuccess: (updated) => {
      setIsDirty(false);
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
      const previousPolizaId = data?.polizaId ?? null;

      // Crear la nueva póliza primero; solo borrar la anterior tras persistir exitosamente
      const poliza = await apiClient.createPoliza({
        companyId: polizaPlan.companyId,
        tipo: polizaPlan.tipo,
        fecha: polizaPlan.fecha,
        concepto: polizaPlan.concepto,
        origin: polizaPlan.origin,
        ejercicio: targetYear,
        periodo: targetPeriod,
        movements: polizaPlan.movements.map(({ accountId, referencia, concepto, cargo, abono }) => ({
          accountId,
          referencia,
          concepto,
          cargo,
          abono
        }))
      });

      try {
        await inventoryClient.saveInventoryPeriod(targetCompanyId, buildSavePayload(poliza.id));
      } catch (saveErr) {
        await apiClient.deletePoliza(poliza.id).catch(() => {});
        throw saveErr;
      }

      if (previousPolizaId && previousPolizaId !== poliza.id) {
        try {
          await apiClient.deletePoliza(previousPolizaId);
        } catch (delErr) {
          const msg = delErr instanceof Error ? delErr.message.toLowerCase() : '';
          if (!msg.includes('no encontrad') && !msg.includes('not found')) {
            throw delErr;
          }
        }
      }
      return { poliza, targetCompanyId, targetYear, targetPeriod };
    },
    onSuccess: ({ poliza, targetCompanyId: cid, targetYear: y, targetPeriod: p }) => {
      setIsDirty(false);
      setConfirmPoliza(false);
      invalidateAccountingQueries(queryClient, ['polizas', 'accounts', 'account-ledger', 'reports', 'dashboard'], cid);
      void queryClient.invalidateQueries({ queryKey: ['inventory-cost', cid, y, p] });
      notify(`Póliza de Costo de Ventas (Diario #${poliza.folio}) registrada y cuadrada.`);
    },
    onError: (err: Error) => notify(`Error al registrar póliza de costo: ${err.message}`, 'error')
  });

  const handleMethodChange = (nextMethod: InventoryMethod) => {
    setMethod(nextMethod);
    setIsDirty(true);
    setConfirmPoliza(false);
    void refetch();
    void refetchPolizas();
  };

  return {
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
  };
}
