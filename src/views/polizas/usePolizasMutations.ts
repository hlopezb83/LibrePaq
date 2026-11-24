import { type RefObject } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries, type AccountingQueryScope } from '../../lib/api-client';
import { formatCurrency, getDefaultDateForPeriod } from '../../lib/formatters';
import { parseCalendarDate } from '../../shared/date-utils';
import { buildInversePolizaDraft } from '../../shared/engine/poliza-productivity';
import type { AccountWithBalance, Poliza, PolizaType } from '../../shared/types';
import type { DraftMovement } from './PolizaEditorModal';

const POLIZA_INVALIDATION_SCOPES: ReadonlyArray<AccountingQueryScope> = [
  'polizas',
  'accounts',
  'account-ledger',
  'reports',
  'dashboard',
  'cfdis',
  'bank-reconciliation',
  'fiscal-workpaper',
  'diot',
  'sat-xml',
  'auxiliares-diario',
  'annual-tax',
  'cxc-cxp',
  'fixed-assets'
];

export interface UsePolizasMutationsParams {
  activeCompanyId: string;
  currentYear?: number;
  currentPeriod?: number;
  isPeriodLocked: boolean;
  isPeriod13Locked?: boolean;
  isReadOnlyClient?: boolean;
  editingPolizaId: string | null;
  editingPolizaPeriodo?: number | null;
  tipo: PolizaType;
  fecha: string;
  concepto: string;
  cfdiUuid: string;
  cfdiUuids?: string[];
  movements: DraftMovement[];
  accounts: AccountWithBalance[];
  dialogRef?: RefObject<HTMLDialogElement | null>;
  onSaveSuccess?: () => void;
  onPedimentoSuccess?: () => void;
  setFormError: (err: string | null) => void;
  setConfirmDeleteId: (id: string | null) => void;
  setConfirmReverseId?: (id: string | null) => void;
}

export function usePolizasMutations({
  activeCompanyId,
  currentYear,
  currentPeriod,
  isPeriodLocked,
  isPeriod13Locked = false,
  isReadOnlyClient = false,
  editingPolizaId,
  editingPolizaPeriodo = null,
  tipo,
  fecha,
  concepto,
  cfdiUuid,
  cfdiUuids = [],
  movements,
  accounts,
  dialogRef,
  onSaveSuccess,
  onPedimentoSuccess,
  setFormError,
  setConfirmDeleteId,
  setConfirmReverseId
}: UsePolizasMutationsParams) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;

  const savePolizaMutation = useMutation({
    mutationFn: async () => {
      if (isWriteBlocked) {
        throw new Error(
          isReadOnlyClient
            ? 'Acceso de solo lectura: no se pueden registrar o modificar pólizas.'
            : `El periodo P${String(currentPeriod).padStart(2, '0')}/${currentYear} se encuentra bloqueado ante el SAT. No se pueden registrar o modificar pólizas.`
        );
      }
      const normalizedUuids = Array.from(
        new Set(
          [
            ...cfdiUuids,
            cfdiUuid,
            ...movements.map((m) => m.cfdiUuid || '')
          ]
            .map((u) => u.trim().toUpperCase())
            .filter(Boolean)
        )
      );
      const primaryUuid = normalizedUuids[0] || null;
      if (editingPolizaId) {
        return apiClient.updatePoliza(editingPolizaId, {
          tipo,
          fecha,
          periodo: editingPolizaPeriodo === 13 ? 13 : undefined,
          concepto,
          cfdiUuid: primaryUuid,
          cfdiUuids: normalizedUuids,
          movements
        });
      }
      const parsedFecha = parseCalendarDate(
        fecha,
        currentYear,
        currentPeriod === 13 ? 12 : currentPeriod
      );
      const createPeriodo = currentPeriod === 13 && parsedFecha.month === 12 ? 13 : undefined;
      return apiClient.createPoliza({
        companyId: activeCompanyId,
        tipo,
        fecha,
        periodo: createPeriodo,
        concepto,
        cfdiUuid: primaryUuid,
        cfdiUuids: normalizedUuids,
        origin: primaryUuid ? 'ADD_AUTO' : 'MANUAL',
        movements
      });
    },
    onSuccess: (saved) => {
      setConfirmReverseId?.(null);
      invalidateAccountingQueries(queryClient, POLIZA_INVALIDATION_SCOPES);
      onSaveSuccess?.();
      dialogRef?.current?.close();
      if ('tipo' in saved) {
        toast.success(
          `Póliza ${saved.tipo} #${saved.folio} Registrada`,
          `Sumas iguales cuadradas por ${formatCurrency(saved.totalCargos)}.`
        );
      } else {
        toast.success(
          'Póliza Actualizada',
          'Los cambios en el asiento contable se guardaron correctamente.'
        );
      }
    },
    onError: (err: Error) => {
      setFormError(err.message);
      toast.error('Error al guardar póliza', err.message);
    }
  });

  const deletePolizaMutation = useMutation({
    mutationFn: (id: string) => {
      if (isWriteBlocked) {
        throw new Error(
          isReadOnlyClient
            ? 'Acceso de solo lectura: no se pueden eliminar pólizas.'
            : 'El periodo contable está bloqueado ante el SAT.'
        );
      }
      return apiClient.deletePoliza(id);
    },
    onSuccess: () => {
      invalidateAccountingQueries(queryClient, POLIZA_INVALIDATION_SCOPES);
      setConfirmDeleteId(null);
      toast.success('Póliza Eliminada', 'El asiento y sus movimientos fueron revertidos.');
    },
    onError: (err: Error) => {
      toast.error('Error al eliminar póliza', err.message);
    }
  });

  const closeYearMutation = useMutation({
    mutationFn: async () => {
      if (isReadOnlyClient || isPeriod13Locked) {
        throw new Error(
          isReadOnlyClient
            ? 'Acceso de solo lectura: no es posible ejecutar el cierre anual.'
            : 'El Periodo 13 (Cierre Anual) está bloqueado ante el SAT.'
        );
      }
      if (!currentYear) throw new Error('Año no definido');
      return apiClient.closeYearPoliza(activeCompanyId);
    },
    onSuccess: (res) => {
      invalidateAccountingQueries(queryClient, ['companies', ...POLIZA_INVALIDATION_SCOPES]);
      toast.success(
        `Cierre Anual ${currentYear} Registrado`,
        `Se generó la póliza de cierre en Periodo 13 con utilidad/pérdida de ${formatCurrency(res.utilidadTraspasada)}.`
      );
    },
    onError: (err: Error) => {
      toast.error('Error en Cierre Anual', err.message);
    }
  });

  const createPedimentoMutation = useMutation({
    mutationFn: (pedimentoData: {
      tipo: 'EGRESO' | 'DIARIO';
      fecha: string;
      concepto: string;
      movements: Array<{
        accountCode: string;
        concepto: string;
        cargo: number;
        abono: number;
      }>;
    }) => {
      if (isWriteBlocked) {
        throw new Error(
          isReadOnlyClient
            ? 'Acceso de solo lectura: no se pueden registrar pedimentos.'
            : `El periodo P${String(currentPeriod).padStart(2, '0')}/${currentYear} está bloqueado ante el SAT.`
        );
      }
      const mappedMovements = pedimentoData.movements.map((mov) => {
        const found = accounts.find((a) => a.code === mov.accountCode);
        return {
          accountId: found?.id ?? `acc_${mov.accountCode.replace(/-/g, '_')}`,
          concepto: mov.concepto,
          cargo: mov.cargo,
          abono: mov.abono
        };
      });

      return apiClient.createPoliza({
        companyId: activeCompanyId,
        tipo: pedimentoData.tipo,
        fecha: pedimentoData.fecha,
        periodo:
          currentPeriod === 13 &&
          parseCalendarDate(pedimentoData.fecha, currentYear, 12).month === 12
            ? 13
            : undefined,
        concepto: pedimentoData.concepto,
        movements: mappedMovements
      });
    },
    onSuccess: () => {
      invalidateAccountingQueries(queryClient, POLIZA_INVALIDATION_SCOPES);
      onPedimentoSuccess?.();
      toast.success(
        'Pedimento Registrado',
        'La póliza de importación aduanal se generó y cuadró con éxito.'
      );
    },
    onError: (err: Error) => {
      toast.error('Error al registrar pedimento', err.message);
    }
  });

  const reversePolizaMutation = useMutation({
    mutationFn: (poliza: Poliza) => {
      if (isWriteBlocked) {
        throw new Error(
          isReadOnlyClient
            ? 'Acceso de solo lectura: no se pueden generar pólizas inversas.'
            : `El periodo P${String(currentPeriod).padStart(2, '0')}/${currentYear} está bloqueado ante el SAT.`
        );
      }
      const targetFecha = getDefaultDateForPeriod(currentYear, currentPeriod);
      const draft = buildInversePolizaDraft(poliza, {
        fecha: targetFecha,
        periodo: currentPeriod ?? poliza.periodo
      });
      return apiClient.createPoliza(draft);
    },
    onSuccess: (saved) => {
      setConfirmReverseId?.(null);
      invalidateAccountingQueries(queryClient, POLIZA_INVALIDATION_SCOPES);
      toast.success(
        `Póliza Inversa ${saved.tipo} #${saved.folio} Generada`,
        `Reversión balanceada por ${formatCurrency(saved.totalCargos)}.`
      );
    },
    onError: (err: Error) => {
      toast.error('Error al generar póliza inversa', err.message);
    }
  });

  return {
    savePolizaMutation,
    deletePolizaMutation,
    closeYearMutation,
    createPedimentoMutation,
    reversePolizaMutation
  };
}
