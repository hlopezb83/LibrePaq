import { type RefObject, useState, useEffect } from 'react';
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

  const uploadXmlMutation = useMutation({
    mutationFn: apiClient.uploadCfdi,
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
    }) => {
      if (isPeriodLocked) {
        throw new Error(
          `El periodo P${String(currentPeriod).padStart(2, '0')}/${currentYear} está cerrado ante el SAT. No se pueden generar pólizas.`
        );
      }
      return apiClient.autoPolizaFromCfdi(params.cfdiId, {
        operationAccountCode: params.operationAccountCode,
        counterAccountCode: params.counterAccountCode
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
      if (isPeriodLocked) {
        throw new Error('No es posible eliminar comprobantes en un periodo contable bloqueado ante el SAT.');
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
      if (isPeriodLocked) {
        throw new Error('Periodo bloqueado ante el SAT. No es posible contabilizar en lote.');
      }
      setBatchProgress({ current: 0, total: ids.length });
      try {
        const res = await apiClient.batchAutoPolizaFromCfdis(
          ids,
          undefined,
          (current, total) => setBatchProgress({ current, total })
        );
        return res.count;
      } finally {
        setBatchProgress(null);
      }
    },
    onSuccess: (count) => {
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
      toast.success(
        `¡Contabilización en lote exitosa! Se generaron ${count} pólizas cuadradas desde la Bóveda ADD.`
      );
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
      if (isPeriodLocked) throw new Error('No es posible eliminar comprobantes en un periodo bloqueado.');
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
    mutationFn: (cfdiId: string) => apiClient.verifyCfdiSatStatus(cfdiId),
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
  } | null>(null);

  useEffect(() => {
    setSatBatchAlert(null);
  }, [activeCompanyId]);

  const verifySatBatchMutation = useMutation({
    mutationFn: (cfdiIds: string[]) => {
      const client = apiClient as SatBatchApiClient;
      if (typeof client.verifyCfdisSatBatch !== 'function') {
        throw new Error('El servicio de validación SAT en lote aún no está disponible.');
      }
      return client.verifyCfdisSatBatch(activeCompanyId, cfdiIds);
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['cfdis', activeCompanyId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', activeCompanyId] });
      if (res.cancelledWithPolizaCount > 0) {
        setSatBatchAlert({
          cancelledWithPolizaCount: res.cancelledWithPolizaCount,
          checkedCount: res.checkedCount
        });
        toast.error(
          `Alerta SAT: ${res.cancelledWithPolizaCount} de ${res.checkedCount} CFDI(s) cancelados ante el SAT aún tienen póliza contable.`
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
