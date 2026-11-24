import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { formatSatDypWorkpaperText } from '../../shared/engine/sat-dyp-formatter';

interface UsePapelDia17Params {
  companyId: string;
  year: number;
  period: number;
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  onFeedback: (msg: string, type?: 'success' | 'error') => void;
}

function sanitizeFiniteNonNeg(val: number): number {
  return Number.isFinite(val) && val >= 0 ? val : 0;
}

export function usePapelDia17({
  companyId,
  year,
  period,
  isPeriodLocked = false,
  isReadOnlyClient = false,
  onFeedback
}: UsePapelDia17Params) {
  const isWriteLocked = isPeriodLocked || isReadOnlyClient;
  const lockMsg = isReadOnlyClient
    ? 'Modo solo lectura: no es posible modificar parámetros fiscales ni generar pólizas.'
    : 'Periodo fiscal bloqueado ante el SAT.';
  const queryClient = useQueryClient();

  const {
    data: workpaper,
    isLoading: loadingWp,
    isError: isErrorWp,
    error: errorWp,
    refetch: refetchWp
  } = useQuery({
    queryKey: ['fiscal-workpaper', companyId, year, period],
    queryFn: () => apiClient.getFiscalWorkpaper(companyId, year, period),
    enabled: Boolean(companyId)
  });

  const [coefUtilidad, setCoefUtilidad] = useState(0);
  const [perdidasAmortizar, setPerdidasAmortizar] = useState(0);
  const [pagosPreviosInput, setPagosPreviosInput] = useState(0);
  const [ivaSaldoFavor, setIvaSaldoFavor] = useState(0);
  const [tcCierreUsd, setTcCierreUsd] = useState(0);
  const { copiedKey, copy: copySatDyp } = useCopyToClipboard<'sat-dyp'>(2500);
  const copiedSatDyp = copiedKey === 'sat-dyp';

  useEffect(() => {
    if (workpaper?.parameters) {
      setCoefUtilidad(workpaper.parameters.coeficienteUtilidad);
      setPerdidasAmortizar(workpaper.parameters.perdidasFiscalesPendientes);
      setPagosPreviosInput(workpaper.parameters.pagosProvisionalesAnteriores ?? 0);
      setIvaSaldoFavor(workpaper.parameters.saldoFavorIvaAnterior);
      setTcCierreUsd(workpaper.parameters.tipoCambioDofCierre);
    }
  }, [workpaper?.parameters]);

  const resetTaxParams = () => {
    if (!workpaper?.parameters) return;
    setCoefUtilidad(workpaper.parameters.coeficienteUtilidad);
    setPerdidasAmortizar(workpaper.parameters.perdidasFiscalesPendientes);
    setPagosPreviosInput(workpaper.parameters.pagosProvisionalesAnteriores ?? 0);
    setIvaSaldoFavor(workpaper.parameters.saldoFavorIvaAnterior);
    setTcCierreUsd(workpaper.parameters.tipoCambioDofCierre);
  };

  const hasUnsavedParams = Boolean(
    workpaper?.parameters &&
      (coefUtilidad !== workpaper.parameters.coeficienteUtilidad ||
        perdidasAmortizar !== workpaper.parameters.perdidasFiscalesPendientes ||
        pagosPreviosInput !== (workpaper.parameters.pagosProvisionalesAnteriores ?? 0) ||
        ivaSaldoFavor !== workpaper.parameters.saldoFavorIvaAnterior ||
        tcCierreUsd !== workpaper.parameters.tipoCambioDofCierre)
  );

  const handleCopySatDyp = () => {
    if (!workpaper) return;
    void copySatDyp(formatSatDypWorkpaperText(workpaper, year, period), 'sat-dyp').then((ok) => {
      if (ok) {
        onFeedback(
          '¡Cédula fiscal copiada al portapapeles en formato ordenado para el portal SAT DyP!'
        );
      }
    });
  };

  const saveTaxParamsMutation = useMutation({
    mutationFn: () => {
      if (isWriteLocked) throw new Error(lockMsg);
      return apiClient.saveTaxParameters({
        companyId,
        ejercicio: year,
        periodo: period,
        coeficienteUtilidad: Math.min(1, sanitizeFiniteNonNeg(coefUtilidad)),
        perdidasFiscalesPendientes: sanitizeFiniteNonNeg(perdidasAmortizar),
        pagosProvisionalesAnteriores: sanitizeFiniteNonNeg(pagosPreviosInput),
        saldoFavorIvaAnterior: sanitizeFiniteNonNeg(ivaSaldoFavor),
        tipoCambioDofCierre: sanitizeFiniteNonNeg(tcCierreUsd)
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fiscal-workpaper', companyId, year, period] });
      onFeedback('Parámetros fiscales del mes actualizados y cédula Día 17 recalculada.');
    },
    onError: (err: Error) => {
      onFeedback(`Error al guardar parámetros fiscales: ${err.message}`, 'error');
    }
  });

  const genTaxProvisionMutation = useMutation({
    mutationFn: () => {
      if (isWriteLocked) throw new Error(lockMsg);
      return apiClient.generateTaxProvisionPoliza(companyId, year, period);
    },
    onSuccess: () => {
      invalidateAccountingQueries(
        queryClient,
        ['fiscal-workpaper', 'polizas', 'accounts', 'account-ledger', 'reports', 'dashboard'],
        companyId
      );
      void queryClient.invalidateQueries({ queryKey: ['fiscal-workpaper', companyId, year, period] });
      onFeedback('¡Póliza de Provisión Mensual de ISR e IVA generada y aplicada en el Libro Diario!');
    },
    onError: (err: Error) => {
      onFeedback(`Error al generar provisión de impuestos: ${err.message}`, 'error');
    }
  });

  const genExchangePolizaMutation = useMutation({
    mutationFn: () => {
      if (isWriteLocked) throw new Error(lockMsg);
      return apiClient.generateExchangePoliza(companyId, year, period);
    },
    onSuccess: () => {
      invalidateAccountingQueries(
        queryClient,
        ['fiscal-workpaper', 'polizas', 'accounts', 'account-ledger', 'reports', 'dashboard'],
        companyId
      );
      void queryClient.invalidateQueries({ queryKey: ['fiscal-workpaper', companyId, year, period] });
      onFeedback('¡Póliza de Fluctuación Cambiaria USD (Art. 8 CFF / NIF B-15) generada y aplicada en libros!');
    },
    onError: (err: Error) => {
      onFeedback(`Error al generar fluctuación cambiaria: ${err.message}`, 'error');
    }
  });

  return {
    workpaper,
    loadingWp,
    isErrorWp,
    errorWp,
    refetchWp,
    coefUtilidad,
    setCoefUtilidad,
    perdidasAmortizar,
    setPerdidasAmortizar,
    pagosPreviosInput,
    setPagosPreviosInput,
    ivaSaldoFavor,
    setIvaSaldoFavor,
    tcCierreUsd,
    setTcCierreUsd,
    hasUnsavedParams,
    resetTaxParams,
    copiedSatDyp,
    handleCopySatDyp,
    saveTaxParamsMutation,
    genTaxProvisionMutation,
    genExchangePolizaMutation
  };
}
