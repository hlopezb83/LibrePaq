import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { formatSatDypWorkpaperText } from '../../shared/engine/sat-dyp-formatter';

interface UsePapelDia17Params {
  companyId: string;
  year: number;
  period: number;
  onFeedback: (msg: string, type?: 'success' | 'error') => void;
}

export function usePapelDia17({ companyId, year, period, onFeedback }: UsePapelDia17Params) {
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
  const [ivaSaldoFavor, setIvaSaldoFavor] = useState(0);
  const [tcCierreUsd, setTcCierreUsd] = useState(0);
  const { copiedKey, copy: copySatDyp } = useCopyToClipboard<'sat-dyp'>(2500);
  const copiedSatDyp = copiedKey === 'sat-dyp';

  useEffect(() => {
    if (workpaper?.parameters) {
      setCoefUtilidad(workpaper.parameters.coeficienteUtilidad);
      setPerdidasAmortizar(workpaper.parameters.perdidasFiscalesPendientes);
      setIvaSaldoFavor(workpaper.parameters.saldoFavorIvaAnterior);
      setTcCierreUsd(workpaper.parameters.tipoCambioDofCierre);
    }
  }, [workpaper?.parameters]);

  const hasUnsavedParams = Boolean(
    workpaper?.parameters &&
      (coefUtilidad !== workpaper.parameters.coeficienteUtilidad ||
        perdidasAmortizar !== workpaper.parameters.perdidasFiscalesPendientes ||
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
    mutationFn: () =>
      apiClient.saveTaxParameters({
        companyId,
        ejercicio: year,
        coeficienteUtilidad: coefUtilidad,
        perdidasFiscalesPendientes: perdidasAmortizar,
        saldoFavorIvaAnterior: ivaSaldoFavor,
        tipoCambioDofCierre: tcCierreUsd
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-workpaper', companyId, year, period] });
      onFeedback('Parámetros fiscales del mes actualizados y cédula Día 17 recalculada.');
    },
    onError: (err: Error) => {
      onFeedback(`Error al guardar parámetros fiscales: ${err.message}`, 'error');
    }
  });

  const genTaxProvisionMutation = useMutation({
    mutationFn: () => apiClient.generateTaxProvisionPoliza(companyId),
    onSuccess: () => {
      invalidateAccountingQueries(queryClient, ['fiscal-workpaper', 'polizas', 'accounts', 'account-ledger', 'reports', 'dashboard']);
      queryClient.invalidateQueries({ queryKey: ['fiscal-workpaper', companyId, year, period] });
      onFeedback('¡Póliza de Provisión Mensual de ISR e IVA generada y aplicada en el Libro Diario!');
    },
    onError: (err: Error) => {
      onFeedback(`Error al generar provisión de impuestos: ${err.message}`, 'error');
    }
  });

  const genExchangePolizaMutation = useMutation({
    mutationFn: () => apiClient.generateExchangePoliza(companyId),
    onSuccess: () => {
      invalidateAccountingQueries(queryClient, ['fiscal-workpaper', 'polizas', 'accounts', 'account-ledger', 'reports', 'dashboard']);
      queryClient.invalidateQueries({ queryKey: ['fiscal-workpaper', companyId, year, period] });
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
    ivaSaldoFavor,
    setIvaSaldoFavor,
    tcCierreUsd,
    setTcCierreUsd,
    hasUnsavedParams,
    copiedSatDyp,
    handleCopySatDyp,
    saveTaxParamsMutation,
    genTaxProvisionMutation,
    genExchangePolizaMutation
  };
}
