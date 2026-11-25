import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { getAuthHeaders, handleResponse } from '../../lib/api/api-helpers';
import { isSupabaseConfigured } from '../../lib/supabase';
import { listCustomInpcEntries } from '../../lib/supabase/supabase-custom-inpc';
import { supabaseFiscalAndAssets } from '../../lib/supabase/supabase-fiscal-assets';
import { hasExistingDepreciationPoliza } from '../../shared/engine/fixed-assets.engine';
import { getInpcForIsoDate } from '../../shared/sat-inpc-catalog';
import type {
  AccountWithBalance,
  FixedAssetCategory,
  FixedAssetRecord,
  FixedAssetWithCalculation,
  VehicleCapType
} from '../../shared/types';
import {
  adjustLocalAssetsForPostedPeriod,
  resolveAssetInpcMedioForForm,
  resolveFixedAssetDefaultAccounts
} from './activosFijosHelpers';

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
  const usingCloud =
    typeof window !== 'undefined' &&
    isSupabaseConfigured &&
    (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'));

  const fixedAssetsData =
    rawFixedAssetsData && hasDepPolizaThisPeriod && !usingCloud
      ? adjustLocalAssetsForPostedPeriod(rawFixedAssetsData, periodPolizas, year, activePeriod)
      : rawFixedAssetsData;

  const { data: customInpcEntries = [] } = useQuery({
    queryKey: ['custom-inpc', companyId],
    queryFn: () => listCustomInpcEntries(companyId),
    enabled: Boolean(companyId)
  });

  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [bajaModalAsset, setBajaModalAsset] = useState<FixedAssetWithCalculation | null>(null);
  const nextSuggestedCode = (() => {
    const list = rawFixedAssetsData?.assets ?? [];
    let maxNum = 0;
    for (const a of list) {
      const m = /^AF-(\d+)$/i.exec(a.codigo.trim());
      if (m?.[1]) maxNum = Math.max(maxNum, Number.parseInt(m[1], 10));
    }
    return `AF-${String(maxNum + 1).padStart(3, '0')}`;
  })();

  const [assetCode, setAssetCode] = useState('AF-001');
  const [assetName, setAssetName] = useState('');
  const [assetCat, setAssetCat] = useState<FixedAssetCategory>('COMPUTO_30');
  const [vehicleCapType, setVehicleCapType] = useState<VehicleCapType>('AUTO_COMBUSTION');
  const [assetDate, setAssetDate] = useState(`${year}-01-15`);
  const [assetMoi, setAssetMoi] = useState<string>('');
  const [assetRate, setAssetRate] = useState(30);
  const [mesesDepreciadosPrevios, setMesesDepreciadosPrevios] = useState(0);
  const [assetStatus, setAssetStatus] = useState<FixedAssetRecord['estatus']>('ACTIVO');
  const [assetInpcAdq, setAssetInpcAdq] = useState(() => getInpcForIsoDate(`${year}-01-15`, customInpcEntries));
  const [assetInpcUso, setAssetInpcUso] = useState(() =>
    resolveAssetInpcMedioForForm(`${year}-01-15`, year)
  );
  const [isInpcModalOpen, setIsInpcModalOpen] = useState(false);

  const resetForm = () => {
    const nextDate = `${year}-01-15`;
    setEditingAssetId(null);
    setAssetCode(nextSuggestedCode);
    setAssetName('');
    setAssetCat('COMPUTO_30');
    setVehicleCapType('AUTO_COMBUSTION');
    setAssetDate(nextDate);
    setAssetMoi('');
    setAssetRate(30);
    setMesesDepreciadosPrevios(0);
    setAssetStatus('ACTIVO');
    setAssetInpcAdq(getInpcForIsoDate(nextDate, customInpcEntries));
    setAssetInpcUso(resolveAssetInpcMedioForForm(nextDate, year));
  };

  useEffect(() => {
    if (!editingAssetId && !assetName) {
      setAssetCode(nextSuggestedCode);
    }
  }, [nextSuggestedCode, editingAssetId, assetName]);

  useEffect(() => {
    resetForm();
  }, [companyId, year]);

  const handleDateChange = (val: string) => {
    setAssetDate(val);
    setAssetInpcAdq(getInpcForIsoDate(val, customInpcEntries));
    setAssetInpcUso(resolveAssetInpcMedioForForm(val, year));
  };

  const startEditAsset = (asset: FixedAssetWithCalculation) => {
    setEditingAssetId(asset.id);
    setAssetCode(asset.codigo);
    setAssetName(asset.nombre);
    setAssetCat(asset.categoria);
    setVehicleCapType((asset.vehicleCapType as VehicleCapType) || 'AUTO_COMBUSTION');
    setAssetDate(asset.fechaAdquisicion);
    setAssetMoi(String(asset.montoOriginalInversion));
    setAssetRate(asset.tasaAnualPct);
    setMesesDepreciadosPrevios(asset.mesesDepreciadosPrevios);
    setAssetStatus(asset.estatus);
    setAssetInpcAdq(asset.inpcAdquisicion);
    setAssetInpcUso(asset.inpcMedioPeriodo);
    setTimeout(() => document.getElementById('asset-name')?.focus(), 0);
  };

  const invalidateAssetSideEffects = (scopes: ReadonlyArray<'fixed-assets' | 'annual-tax' | 'fiscal-workpaper'>) => {
    invalidateAccountingQueries(queryClient, scopes, companyId);
    void queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
  };

  const createAssetMutation = useMutation({
    mutationFn: () => {
      if (isWriteLocked) throw new Error(lockMsg);
      const cleanMoi = sanitizeFinitePositive(Number.parseFloat(assetMoi), 0);
      if (cleanMoi <= 0) throw new Error('El MOI debe ser un importe numérico mayor a cero.');

      const { cuentaActivoCode, cuentaDepAcumCode, cuentaGastoDepCode } =
        resolveFixedAssetDefaultAccounts(assetCat, affectableAccounts);

      return (apiClient.createFixedAsset as (p: Record<string, unknown>) => ReturnType<typeof apiClient.createFixedAsset>)({
        companyId,
        codigo: assetCode,
        nombre: assetName,
        categoria: assetCat,
        fechaAdquisicion: assetDate,
        montoOriginalInversion: cleanMoi,
        tasaAnualPct: sanitizeFinitePositive(assetRate, 0),
        mesesDepreciadosPrevios: Math.floor(sanitizeFinitePositive(mesesDepreciadosPrevios, 0)),
        inpcAdquisicion: sanitizeFinitePositive(assetInpcAdq, 0),
        inpcMedioPeriodo: sanitizeFinitePositive(assetInpcUso, 0),
        cuentaActivoCode,
        cuentaDepAcumCode,
        cuentaGastoDepCode,
        vehicleCapType: assetCat === 'TRANSPORTE_25' ? vehicleCapType : null
      });
    },
    onSuccess: () => {
      invalidateAssetSideEffects(['fixed-assets', 'annual-tax', 'fiscal-workpaper']);
      resetForm();
      onFeedback('Activo fijo registrado con INPC oficial y meses depreciados previos.');
    },
    onError: (err: Error) => onFeedback(`Error al registrar activo fijo: ${err.message}`, 'error')
  });

  const updateAssetMutation = useMutation({
    mutationFn: () => {
      if (isWriteLocked) throw new Error(lockMsg);
      if (!editingAssetId) throw new Error('No hay activo seleccionado para editar.');
      const cleanMoi = sanitizeFinitePositive(Number.parseFloat(assetMoi), 0);
      if (cleanMoi <= 0) throw new Error('El MOI debe ser un importe numérico mayor a cero.');
      return (apiClient.updateFixedAsset as (id: string, p: Record<string, unknown>, y?: number, m?: number) => ReturnType<typeof apiClient.updateFixedAsset>)(
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
          estatus: assetStatus,
          vehicleCapType: assetCat === 'TRANSPORTE_25' ? vehicleCapType : null
        },
        year,
        activePeriod
      );
    },
    onSuccess: () => {
      invalidateAssetSideEffects(['fixed-assets', 'annual-tax', 'fiscal-workpaper']);
      resetForm();
      onFeedback('Activo fijo actualizado correctamente.');
    },
    onError: (err: Error) => onFeedback(`Error al actualizar activo fijo: ${err.message}`, 'error')
  });

  const retireAssetMutation = useMutation({
    mutationFn: async (payload: { assetId: string; fechaBaja: string; precioVenta: number; generatePoliza: boolean; cuentaCobroCode: string }) => {
      if (isWriteLocked) throw new Error(lockMsg);
      if (usingCloud) {
        return supabaseFiscalAndAssets.retireFixedAsset(payload.assetId, payload);
      }
      const res = await fetch(`/api/fixed-assets/${encodeURIComponent(payload.assetId)}/baja`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload)
      });
      return handleResponse<{ assets: unknown; poliza: unknown }>(res);
    },
    onSuccess: () => {
      setBajaModalAsset(null);
      invalidateAccountingQueries(queryClient, ['fixed-assets', 'polizas', 'accounts', 'account-ledger', 'reports', 'dashboard', 'annual-tax', 'auxiliares-diario', 'fiscal-workpaper'], companyId);
      void queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
      onFeedback('Baja / enajenación de activo fijo registrada correctamente.');
    },
    onError: (err: Error) => onFeedback(`Error al dar de baja activo fijo: ${err.message}`, 'error')
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (id: string) => {
      if (isWriteLocked) throw new Error(lockMsg);
      return apiClient.deleteFixedAsset(id);
    },
    onSuccess: () => {
      invalidateAssetSideEffects(['fixed-assets', 'annual-tax', 'fiscal-workpaper']);
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
        [
          'fixed-assets',
          'polizas',
          'accounts',
          'account-ledger',
          'reports',
          'dashboard',
          'annual-tax',
          'auxiliares-diario',
          'fiscal-workpaper',
          'sat-xml'
        ],
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
    vehicleCapType,
    setVehicleCapType,
    customInpcEntries,
    bajaModalAsset,
    setBajaModalAsset,
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
