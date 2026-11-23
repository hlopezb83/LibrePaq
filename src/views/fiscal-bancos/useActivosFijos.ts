import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { getInpcForIsoDate, getInpcMedioPeriodo } from '../../shared/sat-inpc-catalog';
import { FISCAL_ACCOUNT_ROLES } from '../../shared/sat-constants';
import type { AccountWithBalance, FixedAssetCategory } from '../../shared/types';

interface UseActivosFijosParams {
  companyId: string;
  year: number;
  accounts: AccountWithBalance[];
  onFeedback: (msg: string, type?: 'success' | 'error') => void;
}

export function useActivosFijos({
  companyId,
  year,
  accounts,
  onFeedback
}: UseActivosFijosParams) {
  const queryClient = useQueryClient();
  const affectableAccounts = accounts.filter((a) => a.isAffectable);

  const {
    data: fixedAssetsData,
    isLoading: loadingAssets,
    isError: isErrorAssets,
    error: errorAssets,
    refetch: refetchAssets
  } = useQuery({
    queryKey: ['fixed-assets', companyId],
    queryFn: () => apiClient.getFixedAssets(companyId),
    enabled: Boolean(companyId)
  });

  const [assetCode, setAssetCode] = useState('AF-003');
  const [assetName, setAssetName] = useState('');
  const [assetCat, setAssetCat] = useState<FixedAssetCategory>('COMPUTO_30');
  const [assetDate, setAssetDate] = useState(`${year}-01-15`);
  const [assetMoi, setAssetMoi] = useState(45000);
  const [assetRate, setAssetRate] = useState(30);
  const [assetInpcAdq, setAssetInpcAdq] = useState(() => getInpcForIsoDate(`${year}-01-15`));
  const [assetInpcUso, setAssetInpcUso] = useState(() => getInpcMedioPeriodo(year));
  const [isInpcModalOpen, setIsInpcModalOpen] = useState(false);

  useEffect(() => {
    const nextDate = `${year}-01-15`;
    setAssetDate(nextDate);
    setAssetInpcAdq(getInpcForIsoDate(nextDate));
    setAssetInpcUso(getInpcMedioPeriodo(year));
  }, [companyId, year]);

  const handleDateChange = (val: string) => {
    setAssetDate(val);
    setAssetInpcAdq(getInpcForIsoDate(val));
    setAssetInpcUso(getInpcMedioPeriodo(year));
  };

  const createAssetMutation = useMutation({
    mutationFn: () => {
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
        montoOriginalInversion: assetMoi,
        tasaAnualPct: assetRate,
        inpcAdquisicion: assetInpcAdq,
        inpcMedioPeriodo: assetInpcUso,
        cuentaActivoCode: assetAcc,
        cuentaDepAcumCode: depAcumCode,
        cuentaGastoDepCode: gastoDepCode
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
      setAssetName('');
      onFeedback('Activo fijo registrado con INPC oficial y factor Art. 31 LISR.');
    },
    onError: (err: Error) => {
      onFeedback(`Error al registrar activo fijo: ${err.message}`, 'error');
    }
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteFixedAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
      onFeedback('Activo fijo eliminado del catálogo.');
    },
    onError: (err: Error) => {
      onFeedback(`Error al eliminar activo fijo: ${err.message}`, 'error');
    }
  });

  const genDepPolizaMutation = useMutation({
    mutationFn: () => apiClient.generateDepreciationPoliza(companyId),
    onSuccess: () => {
      invalidateAccountingQueries(queryClient, ['fixed-assets', 'polizas', 'accounts', 'account-ledger', 'reports', 'dashboard']);
      queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
      onFeedback(
        '¡Póliza mensual de Depreciación Contable generada y aplicada en libros (Cargo 601-01-006 / Abono 171-01-001)!'
      );
    },
    onError: (err: Error) => {
      onFeedback(`Error al generar depreciación: ${err.message}`, 'error');
    }
  });

  return {
    fixedAssetsData,
    loadingAssets,
    isErrorAssets,
    errorAssets,
    refetchAssets,
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
    assetInpcAdq,
    setAssetInpcAdq,
    assetInpcUso,
    setAssetInpcUso,
    isInpcModalOpen,
    setIsInpcModalOpen,
    createAssetMutation,
    deleteAssetMutation,
    genDepPolizaMutation
  };
}
