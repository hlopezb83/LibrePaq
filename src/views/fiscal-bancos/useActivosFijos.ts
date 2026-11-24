import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { isSupabaseConfigured } from '../../lib/supabase';
import { supabaseFiscalAndAssets } from '../../lib/supabase/supabase-fiscal-assets';
import {
  computeFixedAssetWithDepreciation,
  hasExistingDepreciationPoliza
} from '../../shared/engine/fixed-assets.engine';
import { fromCents, sumCents } from '../../shared/engine/invariants-and-math';
import { getInpcForIsoDate, getInpcMedioPeriodo } from '../../shared/sat-inpc-catalog';
import { FISCAL_ACCOUNT_ROLES } from '../../shared/sat-constants';
import type {
  AccountWithBalance,
  FixedAssetCategory,
  FixedAssetRecord,
  FixedAssetWithCalculation
} from '../../shared/types';

interface UseActivosFijosParams {
  companyId: string;
  year: number;
  period?: number;
  accounts: AccountWithBalance[];
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  onFeedback: (msg: string, type?: 'success' | 'error') => void;
}

function sanitizeFinitePositive(val: number, fallback = 0): number {
  return Number.isFinite(val) && val >= 0 ? val : fallback;
}

export function useActivosFijos({
  companyId,
  year,
  period,
  accounts,
  isPeriodLocked = false,
  isReadOnlyClient = false,
  onFeedback
}: UseActivosFijosParams) {
  const { activeCompany } = useCompany();
  const activePeriod = period ?? activeCompany?.currentPeriod ?? 10;
  const isWriteLocked = isPeriodLocked || isReadOnlyClient;
  const lockMsg = isReadOnlyClient
    ? 'Modo solo lectura: no es posible modificar activos fijos.'
    : 'Periodo bloqueado ante el SAT. No es posible modificar activos fijos.';
  const queryClient = useQueryClient();
  const affectableAccounts = accounts.filter((a) => a.isAffectable);

  const {
    data: rawFixedAssetsData,
    isLoading: loadingAssets,
    isError: isErrorAssets,
    error: errorAssets,
    refetch: refetchAssets
  } = useQuery({
    queryKey: ['fixed-assets', companyId, year, activePeriod],
    queryFn: () => apiClient.getFixedAssets(companyId, year, activePeriod),
    enabled: Boolean(companyId)
  });

  const { data: periodPolizas = [] } = useQuery({
    queryKey: ['polizas', companyId, year, activePeriod],
    queryFn: () => apiClient.getPolizas(companyId, year, activePeriod),
    enabled: Boolean(companyId)
  });

  const hasDepPolizaThisPeriod = hasExistingDepreciationPoliza(periodPolizas);

  const fixedAssetsData =
    rawFixedAssetsData && hasDepPolizaThisPeriod && !isSupabaseConfigured
      ? (() => {
          const adjusted = rawFixedAssetsData.assets.map((a) =>
            computeFixedAssetWithDepreciation(a, {
              ejercicio: year,
              periodo: activePeriod,
              alreadyDepreciatedThisPeriod: true
            })
          );
          return {
            assets: adjusted,
            totals: {
              totalMoi: fromCents(sumCents(adjusted.map((a) => a.montoOriginalInversion))),
              totalDepreciacionMensualContable: fromCents(
                sumCents(adjusted.map((a) => a.depreciacionMensualContable))
              ),
              totalDepreciacionMensualFiscal: fromCents(
                sumCents(adjusted.map((a) => a.depreciacionMensualFiscalActualizada))
              ),
              totalDepreciacionAcumulada: fromCents(
                sumCents(adjusted.map((a) => a.depreciacionAcumuladaTotal))
              ),
              totalValorNetoEnLibros: fromCents(sumCents(adjusted.map((a) => a.valorNetoEnLibros)))
            }
          };
        })()
      : rawFixedAssetsData;

  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [assetCode, setAssetCode] = useState('AF-003');
  const [assetName, setAssetName] = useState('');
  const [assetCat, setAssetCat] = useState<FixedAssetCategory>('COMPUTO_30');
  const [assetDate, setAssetDate] = useState(`${year}-01-15`);
  const [assetMoi, setAssetMoi] = useState(45000);
  const [assetRate, setAssetRate] = useState(30);
  const [mesesDepreciadosPrevios, setMesesDepreciadosPrevios] = useState(0);
  const [assetStatus, setAssetStatus] = useState<FixedAssetRecord['estatus']>('ACTIVO');
  const [assetInpcAdq, setAssetInpcAdq] = useState(() => getInpcForIsoDate(`${year}-01-15`));
  const [assetInpcUso, setAssetInpcUso] = useState(() => getInpcMedioPeriodo(year));
  const [isInpcModalOpen, setIsInpcModalOpen] = useState(false);

  const resetForm = () => {
    const nextDate = `${year}-01-15`;
    setEditingAssetId(null);
    setAssetCode('AF-003');
    setAssetName('');
    setAssetCat('COMPUTO_30');
    setAssetDate(nextDate);
    setAssetMoi(45000);
    setAssetRate(30);
    setMesesDepreciadosPrevios(0);
    setAssetStatus('ACTIVO');
    setAssetInpcAdq(getInpcForIsoDate(nextDate));
    setAssetInpcUso(getInpcMedioPeriodo(year));
  };

  useEffect(() => {
    resetForm();
  }, [companyId, year]);

  const handleDateChange = (val: string) => {
    setAssetDate(val);
    setAssetInpcAdq(getInpcForIsoDate(val));
    setAssetInpcUso(getInpcMedioPeriodo(year));
  };

  const startEditAsset = (asset: FixedAssetWithCalculation) => {
    setEditingAssetId(asset.id);
    setAssetCode(asset.codigo);
    setAssetName(asset.nombre);
    setAssetCat(asset.categoria);
    setAssetDate(asset.fechaAdquisicion);
    setAssetMoi(asset.montoOriginalInversion);
    setAssetRate(asset.tasaAnualPct);
    setMesesDepreciadosPrevios(asset.mesesDepreciadosPrevios);
    setAssetStatus(asset.estatus);
    setAssetInpcAdq(asset.inpcAdquisicion);
    setAssetInpcUso(asset.inpcMedioPeriodo);
  };

  const createAssetMutation = useMutation({
    mutationFn: () => {
      if (isWriteLocked) throw new Error(lockMsg);
      const cleanMoi = sanitizeFinitePositive(assetMoi, 0);
      const cleanRate = sanitizeFinitePositive(assetRate, 0);
      const cleanMonths = Math.floor(sanitizeFinitePositive(mesesDepreciadosPrevios, 0));
      const cleanInpcAdq = sanitizeFinitePositive(assetInpcAdq, 0);
      const cleanInpcUso = sanitizeFinitePositive(assetInpcUso, 0);
      if (cleanMoi <= 0) throw new Error('El MOI debe ser un importe numérico mayor a cero.');

      const assetAcc =
        affectableAccounts.find((a) => a.code === '154-01-001')?.code ??
        affectableAccounts[0]?.code ??
        '154-01-001';
      const depAcumCode =
        affectableAccounts.find(
          (a) =>
            a.code === FISCAL_ACCOUNT_ROLES.DEPRECIACION_ACUMULADA.code ||
            a.satGroupCode?.startsWith('171')
        )?.code ?? FISCAL_ACCOUNT_ROLES.DEPRECIACION_ACUMULADA.code;
      const gastoDepCode =
        affectableAccounts.find(
          (a) =>
            a.code === FISCAL_ACCOUNT_ROLES.GASTO_DEPRECIACION.code ||
            a.satGroupCode?.startsWith('601.84')
        )?.code ?? FISCAL_ACCOUNT_ROLES.GASTO_DEPRECIACION.code;

      return apiClient.createFixedAsset({
        companyId,
        codigo: assetCode,
        nombre: assetName,
        categoria: assetCat,
        fechaAdquisicion: assetDate,
        montoOriginalInversion: cleanMoi,
        tasaAnualPct: cleanRate,
        mesesDepreciadosPrevios: cleanMonths,
        inpcAdquisicion: cleanInpcAdq,
        inpcMedioPeriodo: cleanInpcUso,
        cuentaActivoCode: assetAcc,
        cuentaDepAcumCode: depAcumCode,
        cuentaGastoDepCode: gastoDepCode
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
      resetForm();
      onFeedback('Activo fijo registrado con INPC oficial y meses depreciados previos.');
    },
    onError: (err: Error) => onFeedback(`Error al registrar activo fijo: ${err.message}`, 'error')
  });

  const updateAssetMutation = useMutation({
    mutationFn: () => {
      if (isWriteLocked) throw new Error(lockMsg);
      if (!editingAssetId) throw new Error('No hay activo seleccionado para editar.');
      if (!isSupabaseConfigured) {
        throw new Error('La edición de activos fijos requiere conexión Supabase Cloud.');
      }
      const cleanMoi = sanitizeFinitePositive(assetMoi, 0);
      if (cleanMoi <= 0) throw new Error('El MOI debe ser un importe numérico mayor a cero.');
      return supabaseFiscalAndAssets.updateFixedAsset(
        editingAssetId,
        {
          codigo: assetCode,
          nombre: assetName,
          categoria: assetCat,
          fechaAdquisicion: assetDate,
          montoOriginalInversion: cleanMoi,
          tasaAnualPct: sanitizeFinitePositive(assetRate, 0),
          mesesDepreciadosPrevios: Math.floor(sanitizeFinitePositive(mesesDepreciadosPrevios, 0)),
          inpcAdquisicion: sanitizeFinitePositive(assetInpcAdq, 0),
          inpcMedioPeriodo: sanitizeFinitePositive(assetInpcUso, 0),
          estatus: assetStatus
        },
        year,
        activePeriod
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
      resetForm();
      onFeedback('Activo fijo actualizado correctamente.');
    },
    onError: (err: Error) => onFeedback(`Error al actualizar activo fijo: ${err.message}`, 'error')
  });

  const retireAssetMutation = useMutation({
    mutationFn: (assetId: string) => {
      if (isWriteLocked) throw new Error(lockMsg);
      if (!isSupabaseConfigured) {
        throw new Error('La baja de activos fijos requiere conexión Supabase Cloud.');
      }
      return supabaseFiscalAndAssets.updateFixedAsset(assetId, { estatus: 'BAJA' }, year, activePeriod);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
      onFeedback('Activo fijo dado de baja (BAJA). Dejará de depreciarse en periodos posteriores.');
    },
    onError: (err: Error) => onFeedback(`Error al dar de baja activo fijo: ${err.message}`, 'error')
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (id: string) => {
      if (isWriteLocked) throw new Error(lockMsg);
      return apiClient.deleteFixedAsset(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
      onFeedback('Activo fijo eliminado del catálogo.');
    },
    onError: (err: Error) => onFeedback(`Error al eliminar activo fijo: ${err.message}`, 'error')
  });

  const genDepPolizaMutation = useMutation({
    mutationFn: () => {
      if (isWriteLocked) throw new Error(lockMsg);
      return apiClient.generateDepreciationPoliza(companyId, year, activePeriod);
    },
    onSuccess: () => {
      invalidateAccountingQueries(
        queryClient,
        ['fixed-assets', 'polizas', 'accounts', 'account-ledger', 'reports', 'dashboard'],
        companyId
      );
      void queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
      onFeedback(
        '¡Póliza mensual de Depreciación Contable generada y meses depreciados actualizados (+1)!'
      );
    },
    onError: (err: Error) => onFeedback(`Error al generar depreciación: ${err.message}`, 'error')
  });

  return {
    activePeriod,
    hasDepPolizaThisPeriod,
    fixedAssetsData,
    loadingAssets,
    isErrorAssets,
    errorAssets,
    refetchAssets,
    editingAssetId,
    startEditAsset,
    cancelEditAsset: resetForm,
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
    assetRate,
    setAssetRate,
    mesesDepreciadosPrevios,
    setMesesDepreciadosPrevios,
    assetStatus,
    setAssetStatus,
    assetInpcAdq,
    setAssetInpcAdq,
    assetInpcUso,
    setAssetInpcUso,
    isInpcModalOpen,
    setIsInpcModalOpen,
    createAssetMutation,
    updateAssetMutation,
    retireAssetMutation,
    deleteAssetMutation,
    genDepPolizaMutation
  };
}
