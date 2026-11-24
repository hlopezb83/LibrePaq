import { type RefObject, useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { formatCurrency } from '../../lib/formatters';
import { chunkArray } from '../../shared/array-utils';
import type { SatBatchVerifyResult } from '../../shared/types';

type SatBatchApiClient = typeof apiClient & {
  verifyCfdisSatBatch?: (companyId: string, cfdiIds: string[]) => Promise<SatBatchVerifyResult>;
};

export interface UseAddCfdiMutationsParams {
  activeCompanyId: string;
  isPeriodLocked: boolean;
  isReadOnlyClient?: boolean;
  currentYear: number;
  currentPeriod: number;
  simModalRef?: RefObject<HTMLDialogElement | null>;
  contabilizarModalRef?: RefObject<HTMLDialogElement | null>;
  onUploadXmlSuccess?: () => void;
  onAutoPolizaSuccess?: () => void;
  setConfirmDeleteCfdiId: (id: string | null) => void;
  setSelectedCfdiIds: (ids: Set<string>) => void;
}

export function useAddCfdiMutations({
  activeCompanyId,
  isPeriodLocked,
  isReadOnlyClient = false,
  currentYear,
  currentPeriod,
  simModalRef,
  contabilizarModalRef,
  onUploadXmlSuccess,
  onAutoPolizaSuccess,
  setConfirmDeleteCfdiId,
  setSelectedCfdiIds
}: UseAddCfdiMutationsParams) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const latestCompanyIdRef = useRef(activeCompanyId);
  latestCompanyIdRef.current = activeCompanyId;
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;

  const uploadXmlMutation = useMutation({
    mutationFn: (params: { companyId: string; xmlRaw: string }) => {
      if (isReadOnlyClient) {
        throw new Error('Acceso de solo lectura: no es posible importar comprobantes CFDI.');
      }
      return apiClient.uploadCfdi(params);
    },
    onSuccess: (created) => {
      invalidateAccountingQueries(queryClient, ['cfdis', 'dashboard', 'fiscal-workpaper', 'diot']);
      toast.success(
        `CFDI ${created.serie}-${created.folio} (${created.tipoComprobante} • ${created.uuid.slice(0, 8)}...) importado al ADD.`
      );
      onUploadXmlSuccess?.();
      simModalRef?.current?.close();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const autoPolizaMutation = useMutation({
    mutationFn: (params: {
      cfdiId: string;
      operationAccountCode?: string;
      counterAccountCode?: string;
      deductiblePct?: number;
    }) => {
      if (isWriteBlocked) {
        throw new Error(
          isReadOnlyClient
            ? 'Acceso de solo lectura: no se pueden generar pólizas.'
            : `El periodo P${String(currentPeriod).padStart(2, '0')}/${currentYear} está cerrado ante el SAT. No se pueden generar pólizas.`
        );
      }
      return apiClient.autoPolizaFromCfdi(params.cfdiId, {
        operationAccountCode: params.operationAccountCode,
        counterAccountCode: params.counterAccountCode,
        deductiblePct: params.deductiblePct
      });
    },
    onSuccess: (poliza) => {
      invalidateAccountingQueries(queryClient, [
        'cfdis',
        'polizas',
        'accounts',
        'account-ledger',
        'reports',
        'dashboard',
        'bank-reconciliation',
        'fiscal-workpaper',
        'diot',
        'sat-xml'
      ]);
      onAutoPolizaSuccess?.();
      contabilizarModalRef?.current?.close();
      toast.success(
        `¡Póliza ${poliza.tipo} #${poliza.folio} generada por ${formatCurrency(poliza.totalCargos)}!`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const deleteCfdiMutation = useMutation({
    mutationFn: (cfdiId: string) => {
      if (isWriteBlocked) {
        throw new Error(
          isReadOnlyClient
            ? 'Acceso de solo lectura: no es posible eliminar comprobantes.'
            : 'No es posible eliminar comprobantes en un periodo contable bloqueado ante el SAT.'
        );
      }
      return apiClient.deleteCfdi(cfdiId);
    },
    onSuccess: () => {
      invalidateAccountingQueries(queryClient, ['cfdis', 'dashboard', 'fiscal-workpaper', 'diot']);
      setConfirmDeleteCfdiId(null);
      toast.success('Comprobante CFDI eliminado de la Bóveda ADD correctamente.');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const batchContabilizarMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (isWriteBlocked) {
        throw new Error(
          isReadOnlyClient
            ? 'Acceso de solo lectura: no es posible contabilizar en lote.'
            : 'Periodo bloqueado ante el SAT. No es posible contabilizar en lote.'
        );
      }
      setBatchProgress({ current: 0, total: ids.length });
      try {
        const res = await apiClient.batchAutoPolizaFromCfdis(
          ids,
          undefined,
          (current, total) => setBatchProgress({ current, total })
        );
        return res;
      } finally {
        setBatchProgress(null);
      }
    },
    onSuccess: (res) => {
      invalidateAccountingQueries(queryClient, [
        'cfdis',
        'polizas',
        'accounts',
        'account-ledger',
        'reports',
        'dashboard',
        'bank-reconciliation',
        'fiscal-workpaper',
        'diot',
        'sat-xml'
      ]);
      setSelectedCfdiIds(new Set());
      const typedRes = res as typeof res & {
        failedCount?: number;
        errors?: Array<{ cfdiId: string; uuid?: string; error: string }>;
      };
      const failedCount = typedRes.failedCount ?? 0;
      const firstErr = typedRes.errors?.[0]?.error || '';
      if (typedRes.count === 0 && failedCount > 0) {
        toast.error(
          `Error en contabilización en lote: fallaron los ${failedCount} comprobantes.${firstErr ? ` ${firstErr}` : ''}`
        );
      } else if (failedCount > 0) {
        toast.warning(
          `Contabilización parcial: ${typedRes.count} póliza(s) generada(s) y ${failedCount} fallido(s).${firstErr ? ` (${firstErr})` : ''}`
        );
      } else {
        toast.success(
          `¡Contabilización en lote exitosa! Se generaron ${typedRes.count} pólizas cuadradas desde la Bóveda ADD.`
        );
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  useEffect(() => {
    if (!batchContabilizarMutation.isPending) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [batchContabilizarMutation.isPending]);

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (isWriteBlocked) {
        throw new Error(
          isReadOnlyClient
            ? 'Acceso de solo lectura: no es posible eliminar comprobantes.'
            : 'No es posible eliminar comprobantes en un periodo bloqueado.'
        );
      }
      const batches = chunkArray(ids, 10);
      for (const batch of batches) {
        await Promise.all(batch.map((id) => apiClient.deleteCfdi(id)));
      }
      return ids.length;
    },
    onSuccess: (count) => {
      invalidateAccountingQueries(queryClient, ['cfdis', 'dashboard', 'fiscal-workpaper', 'diot']);
      setSelectedCfdiIds(new Set());
      toast.success(`${count} comprobantes CFDI eliminados de la Bóveda ADD.`);
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const verifySatMutation = useMutation({
    mutationFn: (cfdiId: string) => {
      if (isReadOnlyClient) {
        throw new Error('Acceso de solo lectura: validación SAT deshabilitada.');
      }
      return apiClient.verifyCfdiSatStatus(cfdiId);
    },
    onSuccess: (res) => {
      invalidateAccountingQueries(queryClient, ['cfdis']);
      toast.info(
        `Estatus SAT (${res.uuid.slice(0, 8)}...): ${res.estadoSat} • Lista 69-B: ${res.validacionEfos}`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const [satBatchAlert, setSatBatchAlert] = useState<{
    cancelledWithPolizaCount: number;
    checkedCount: number;
    alerts: Array<{ cfdiId: string; uuid: string }>;
  } | null>(null);

  useEffect(() => {
    setSatBatchAlert(null);
  }, [activeCompanyId]);

  const verifySatBatchMutation = useMutation({
    mutationFn: async (cfdiIds: string[]) => {
      if (isReadOnlyClient) {
        throw new Error('Acceso de solo lectura: validación SAT en lote deshabilitada.');
      }
      const targetCompanyId = activeCompanyId;
      const client = apiClient as SatBatchApiClient;
      if (typeof client.verifyCfdisSatBatch !== 'function') {
        throw new Error('El servicio de validación SAT en lote aún no está disponible.');
      }
      const result = await client.verifyCfdisSatBatch(targetCompanyId, cfdiIds);
      return { result, targetCompanyId };
    },
    onSuccess: ({ result: res, targetCompanyId }) => {
      void queryClient.invalidateQueries({ queryKey: ['cfdis', targetCompanyId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', targetCompanyId] });
      if (latestCompanyIdRef.current !== targetCompanyId) return;
      const failedCount = (res as { failedCount?: number }).failedCount ?? 0;
      const errors = (res as { errors?: Array<{ error: string }> }).errors ?? [];
      if (res.cancelledWithPolizaCount > 0) {
        const alerts = res.items
          .filter((item) => item.cancelledWithPoliza)
          .map((item) => ({ cfdiId: item.cfdiId, uuid: item.uuid }));
        setSatBatchAlert({
          cancelledWithPolizaCount: res.cancelledWithPolizaCount,
          checkedCount: res.checkedCount,
          alerts
        });
        toast.error(
          `Alerta SAT: ${res.cancelledWithPolizaCount} de ${res.checkedCount} CFDI(s) cancelados ante el SAT aún tienen póliza contable.${failedCount > 0 ? ` (${failedCount} sin respuesta SAT)` : ''}`
        );
      } else if (failedCount > 0 && res.updatedCount === 0 && res.checkedCount === 0) {
        setSatBatchAlert(null);
        toast.error(
          `No se pudo verificar ningún CFDI ante el SAT (${failedCount} error(es)/timeout). ${errors[0]?.error || ''}`
        );
      } else if (failedCount > 0) {
        setSatBatchAlert(null);
        toast.warning(
          `Validación SAT parcial: ${res.checkedCount} verificados (${res.updatedCount} actualizados) y ${failedCount} con error/timeout del SAT.`
        );
      } else {
        setSatBatchAlert(null);
        toast.success(
          `Validación SAT en lote completada: ${res.checkedCount} comprobantes verificados (${res.updatedCount} actualizados).`
        );
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  return {
    uploadXmlMutation,
    autoPolizaMutation,
    deleteCfdiMutation,
    batchContabilizarMutation,
    batchDeleteMutation,
    verifySatMutation,
    verifySatBatchMutation,
    satBatchAlert,
    dismissSatBatchAlert: () => setSatBatchAlert(null),
    batchProgress
  };
}
