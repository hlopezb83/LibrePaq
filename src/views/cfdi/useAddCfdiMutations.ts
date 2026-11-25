import { type RefObject, useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries, type AccountingQueryScope } from '../../lib/api-client';
import { formatCurrency } from '../../lib/formatters';
import type { ForeignNoCfdiPayload } from '../../shared/cfdi-xml-foreign';
import type { BatchPolizaGroupingMode } from '../../shared/engine/auto-poliza-types';
import { deleteCfdisInBatches } from './cfdiXmlUploadHelpers';
import type { CfdiDocument, Poliza, SatBatchVerifyResult } from '../../shared/types';

const POLIZA_SCOPES: ReadonlyArray<AccountingQueryScope> = [
  'cfdis', 'polizas', 'accounts', 'account-ledger', 'reports',
  'dashboard', 'bank-reconciliation', 'fiscal-workpaper', 'diot', 'sat-xml'
];

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

type UploadCfdiPayload = { companyId: string; xmlRaw: string } | ForeignNoCfdiPayload;
type BatchAutoPolizaFn = (
  cfdiIds: string[],
  options?: { groupingMode?: BatchPolizaGroupingMode; allowEfos69B?: boolean },
  onProgress?: (current: number, total: number) => void
) => Promise<{
  createdPolizas: Poliza[];
  count: number;
  failedCount?: number;
  errors?: Array<{ cfdiId: string; uuid?: string; error: string }>;
}>;

  const uploadXmlMutation = useMutation({
    mutationFn: (params: UploadCfdiPayload) => {
      if (isReadOnlyClient) throw new Error('Acceso de solo lectura: no es posible importar comprobantes CFDI.');
      return (apiClient.uploadCfdi as (p: UploadCfdiPayload) => Promise<CfdiDocument>)(params);
    },
    onSuccess: (created) => {
      invalidateAccountingQueries(queryClient, ['cfdis', 'dashboard', 'fiscal-workpaper', 'diot', 'third-parties']);
      const tag = created.isForeignNoCfdi
        ? `Comprobante ${created.serie}-${created.folio} (${created.moneda} · Sin CFDI)`
        : `CFDI ${created.serie}-${created.folio} (${created.tipoComprobante} • ${created.uuid.slice(0, 8)}...)`;
      toast.success(`${tag} registrado en la Bóveda ADD.`);
      onUploadXmlSuccess?.();
      simModalRef?.current?.close();
    },
    onError: (err: Error) => toast.error(err.message)
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
      invalidateAccountingQueries(queryClient, POLIZA_SCOPES);
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
  const [batchPartialAlert, setBatchPartialAlert] = useState<{
    title: string;
    summary: string;
    items: Array<{ id: string; uuid?: string; error: string }>;
  } | null>(null);

  useEffect(() => {
    setBatchPartialAlert(null);
  }, [activeCompanyId]);

  const batchContabilizarMutation = useMutation({
    mutationFn: async (
      input:
        | string[]
        | { ids: string[]; groupingMode?: BatchPolizaGroupingMode; allowEfos69B?: boolean }
    ) => {
      if (isWriteBlocked) {
        throw new Error(
          isReadOnlyClient
            ? 'Acceso de solo lectura: no es posible contabilizar en lote.'
            : 'Periodo bloqueado ante el SAT. No es posible contabilizar en lote.'
        );
      }
      const ids = Array.isArray(input) ? input : input.ids;
      const groupingMode = Array.isArray(input) ? 'PER_CFDI' : (input.groupingMode ?? 'PER_CFDI');
      const allowEfos69B = Array.isArray(input) ? false : Boolean(input.allowEfos69B);
      setBatchProgress({ current: 0, total: ids.length });
      try {
        return await (apiClient.batchAutoPolizaFromCfdis as unknown as BatchAutoPolizaFn)(
          ids,
          { groupingMode, ...(allowEfos69B ? { allowEfos69B } : {}) },
          (current, total) => setBatchProgress({ current, total })
        );
      } finally {
        setBatchProgress(null);
      }
    },
    onSuccess: (res) => {
      invalidateAccountingQueries(queryClient, POLIZA_SCOPES);
      setSelectedCfdiIds(new Set());
      const failedCount = res.failedCount ?? 0;
      const errors = res.errors ?? [];
      const firstErr = errors[0]?.error || '';
      const efosCount = errors.filter((e) => e.error.includes('EFOS_69B_BLOCKED') || e.error.includes('69-B')).length;
      if (failedCount > 0) {
        setBatchPartialAlert({
          title:
            efosCount > 0
              ? `Alerta 69-B SAT: ${efosCount} comprobante(s) EFOS bloqueado(s) en lote (${res.count} pólizas creadas)`
              : res.count === 0
                ? `No se pudo contabilizar ninguno de los ${failedCount} comprobantes`
                : `Contabilización parcial: ${res.count} póliza(s) generada(s) y ${failedCount} con error`,
          summary: firstErr || 'Revisa el detalle de cada comprobante rechazado.',
          items: errors.map((e) => ({ id: e.cfdiId, uuid: e.uuid, error: e.error }))
        });
      } else {
        setBatchPartialAlert(null);
      }
      if (res.count === 0 && failedCount > 0) {
        toast.error(
          `Error en contabilización en lote: fallaron los ${failedCount} comprobantes.${firstErr ? ` ${firstErr}` : ''}`
        );
      } else if (failedCount > 0) {
        toast.warning(
          `Contabilización parcial: ${res.count} póliza(s) generada(s) y ${failedCount} bloqueado(s)/fallido(s).`
        );
      } else {
        toast.success(
          `¡Contabilización en lote exitosa! Se generaron ${res.count} pólizas cuadradas desde la Bóveda ADD.`
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
      const res = await deleteCfdisInBatches(ids);
      if (res.deletedCount === 0 && res.failures.length > 0) {
        throw new Error(res.failures[0]?.error || 'No se pudieron eliminar los comprobantes seleccionados.');
      }
      return res;
    },
    onSuccess: ({ deletedCount, failures }) => {
      invalidateAccountingQueries(queryClient, ['cfdis', 'dashboard', 'fiscal-workpaper', 'diot']);
      setSelectedCfdiIds(new Set());
      if (failures.length > 0) {
        setBatchPartialAlert({
          title: `Eliminación parcial: ${deletedCount} eliminado(s) y ${failures.length} con error`,
          summary: failures[0]?.error || 'Algunos comprobantes ya estaban contabilizados o protegidos.',
          items: failures.map((f) => ({ id: f.id, error: f.error }))
        });
        toast.warning(`${deletedCount} comprobantes eliminados; ${failures.length} no pudieron eliminarse.`);
      } else {
        setBatchPartialAlert(null);
        toast.success(`${deletedCount} comprobantes CFDI eliminados de la Bóveda ADD.`);
      }
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const verifySatMutation = useMutation({
    mutationFn: (cfdiId: string) => {
      if (isReadOnlyClient) throw new Error('Acceso de solo lectura: validación SAT deshabilitada.');
      return apiClient.verifyCfdiSatStatus(cfdiId);
    },
    onSuccess: (res) => {
      invalidateAccountingQueries(queryClient, ['cfdis']);
      toast.info(`Estatus SAT (${res.uuid.slice(0, 8)}...): ${res.estadoSat} • Lista 69-B: ${res.validacionEfos}`);
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const [satBatchAlert, setSatBatchAlert] = useState<{
    cancelledWithPolizaCount: number; checkedCount: number; alerts: Array<{ cfdiId: string; uuid: string }>;
  } | null>(null);

  useEffect(() => {
    setSatBatchAlert(null);
  }, [activeCompanyId]);

  const verifySatBatchMutation = useMutation({
    mutationFn: async (cfdiIds: string[]) => {
      if (isReadOnlyClient) throw new Error('Acceso de solo lectura: validación SAT en lote deshabilitada.');
      const targetCompanyId = activeCompanyId;
      const client = apiClient as SatBatchApiClient;
      if (typeof client.verifyCfdisSatBatch !== 'function') {
        throw new Error('El servicio de validación SAT en lote aún no está disponible.');
      }
      return { result: await client.verifyCfdisSatBatch(targetCompanyId, cfdiIds), targetCompanyId };
    },
    onSuccess: ({ result: res, targetCompanyId }) => {
      void queryClient.invalidateQueries({ queryKey: ['cfdis', targetCompanyId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', targetCompanyId] });
      if (latestCompanyIdRef.current !== targetCompanyId) return;
      const failedCount = (res as { failedCount?: number }).failedCount ?? 0;
      const errs = (res as { errors?: Array<{ error: string }> }).errors ?? [];
      if (res.cancelledWithPolizaCount > 0) {
        const alerts = res.items.filter((i) => i.cancelledWithPoliza).map((i) => ({ cfdiId: i.cfdiId, uuid: i.uuid }));
        setSatBatchAlert({ cancelledWithPolizaCount: res.cancelledWithPolizaCount, checkedCount: res.checkedCount, alerts });
        toast.error(`Alerta SAT: ${res.cancelledWithPolizaCount} de ${res.checkedCount} CFDI(s) cancelados aún tienen póliza.${failedCount > 0 ? ` (${failedCount} sin respuesta SAT)` : ''}`);
      } else if (failedCount > 0 && res.updatedCount === 0 && res.checkedCount === 0) {
        setSatBatchAlert(null);
        toast.error(`No se pudo verificar ningún CFDI ante el SAT (${failedCount} error(es)/timeout). ${errs[0]?.error || ''}`);
      } else if (failedCount > 0) {
        setSatBatchAlert(null);
        toast.warning(`Validación SAT parcial: ${res.checkedCount} verificados (${res.updatedCount} actualizados) y ${failedCount} con error/timeout del SAT.`);
      } else {
        setSatBatchAlert(null);
        toast.success(`Validación SAT en lote completada: ${res.checkedCount} comprobantes verificados (${res.updatedCount} actualizados).`);
      }
    },
    onError: (err: Error) => toast.error(err.message)
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
    batchPartialAlert,
    dismissBatchPartialAlert: () => setBatchPartialAlert(null),
    batchProgress
  };
}
