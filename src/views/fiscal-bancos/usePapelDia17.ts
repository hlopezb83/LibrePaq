import { useCallback, useEffect, useState } from 'react';
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

export interface Dia17DraftParams {
  coefUtilidad: string;
  perdidasAmortizar: string;
  pagosPrevios: string;
  ivaSaldoFavor: string;
  tcCierreUsd: string;
  ptuPagadaEjercicio: string;
}

export function sanitizeDecimalInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const dotIdx = cleaned.indexOf('.');
  if (dotIdx === -1) return cleaned;
  return cleaned.slice(0, dotIdx + 1) + cleaned.slice(dotIdx + 1).replace(/\./g, '');
}

export function parseDraftNumber(raw: string, max?: number): number {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '.') return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return 0;
  return max !== undefined ? Math.min(n, max) : n;
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

  const [draftParams, setDraftParams] = useState<Dia17DraftParams>({
    coefUtilidad: '0',
    perdidasAmortizar: '0',
    pagosPrevios: '0',
    ivaSaldoFavor: '0',
    tcCierreUsd: '0',
    ptuPagadaEjercicio: '0'
  });

  const { copiedKey, copy: copySatDyp } = useCopyToClipboard<'sat-dyp'>(2500);
  const copiedSatDyp = copiedKey === 'sat-dyp';

  const syncFromWorkpaper = useCallback(() => {
    if (!workpaper?.parameters) return;
    const p = workpaper.parameters;
    setDraftParams({
      coefUtilidad: String(p.coeficienteUtilidad),
      perdidasAmortizar: String(p.perdidasFiscalesPendientes),
      pagosPrevios: String(p.pagosProvisionalesAnteriores ?? 0),
      ivaSaldoFavor: String(p.saldoFavorIvaAnterior),
      tcCierreUsd: String(p.tipoCambioDofCierre),
      ptuPagadaEjercicio: String(p.ptuPagadaEjercicio ?? 0)
    });
  }, [workpaper?.parameters]);

  useEffect(() => {
    syncFromWorkpaper();
  }, [syncFromWorkpaper]);

  const updateDraftField = (field: keyof Dia17DraftParams, raw: string) => {
    setDraftParams((prev) => ({ ...prev, [field]: sanitizeDecimalInput(raw) }));
  };

  const normalizeDraftField = (field: keyof Dia17DraftParams, max?: number) => {
    setDraftParams((prev) => ({
      ...prev,
      [field]: String(parseDraftNumber(prev[field], max))
    }));
  };

  const parsedCoef = parseDraftNumber(draftParams.coefUtilidad, 1);
  const parsedPerdidas = parseDraftNumber(draftParams.perdidasAmortizar);
  const parsedPagosPrevios = parseDraftNumber(draftParams.pagosPrevios);
  const parsedIvaFavor = parseDraftNumber(draftParams.ivaSaldoFavor);
  const parsedTcUsd = parseDraftNumber(draftParams.tcCierreUsd);
  const parsedPtuPagada = parseDraftNumber(draftParams.ptuPagadaEjercicio);

  const hasUnsavedParams = Boolean(
    workpaper?.parameters &&
      (parsedCoef !== workpaper.parameters.coeficienteUtilidad ||
        parsedPerdidas !== workpaper.parameters.perdidasFiscalesPendientes ||
        parsedPagosPrevios !== (workpaper.parameters.pagosProvisionalesAnteriores ?? 0) ||
        parsedIvaFavor !== workpaper.parameters.saldoFavorIvaAnterior ||
        parsedTcUsd !== workpaper.parameters.tipoCambioDofCierre ||
        parsedPtuPagada !== (workpaper.parameters.ptuPagadaEjercicio ?? 0))
  );

  const handleCopySatDyp = () => {
    if (!workpaper || hasUnsavedParams) return;
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
      const normalized = {
        coefUtilidad: String(parsedCoef),
        perdidasAmortizar: String(parsedPerdidas),
        pagosPrevios: String(parsedPagosPrevios),
        ivaSaldoFavor: String(parsedIvaFavor),
        tcCierreUsd: String(parsedTcUsd),
        ptuPagadaEjercicio: String(parsedPtuPagada)
      };
      setDraftParams(normalized);
      return apiClient.saveTaxParameters({
        companyId,
        ejercicio: year,
        periodo: period,
        coeficienteUtilidad: parsedCoef,
        perdidasFiscalesPendientes: parsedPerdidas,
        pagosProvisionalesAnteriores: parsedPagosPrevios,
        saldoFavorIvaAnterior: parsedIvaFavor,
        tipoCambioDofCierre: parsedTcUsd,
        ptuPagadaEjercicio: parsedPtuPagada
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
    draftParams,
    updateDraftField,
    normalizeDraftField,
    hasUnsavedParams,
    resetTaxParams: syncFromWorkpaper,
    copiedSatDyp,
    handleCopySatDyp,
    saveTaxParamsMutation,
    genTaxProvisionMutation,
    genExchangePolizaMutation
  };
}
