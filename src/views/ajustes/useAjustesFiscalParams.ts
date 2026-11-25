import React, { useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import type { ToastContextType } from '../../context/ToastContext';

export interface FiscalParamsDraft {
  coefUtilidad: string;
  tcDof: string;
  perdidasAnt: string;
  pagosAnt: string;
  saldoIvaAnt: string;
  ptuPagada?: string;
}

export interface FiscalSavedParams {
  coeficienteUtilidad: number;
  tipoCambioDofCierre: number;
  perdidasFiscalesPendientes: number;
  pagosProvisionalesAnteriores: number;
  saldoFavorIvaAnterior: number;
  ptuPagadaEjercicio?: number;
}

const ptuDraftStore = new Map<string, string>();
const ptuSetterStore = new Map<string, (v: string) => void>();
const ptuListeners = new Set<() => void>();

function notifyPtuListeners() {
  for (const l of ptuListeners) l();
}

export function useSharedPtuDraft(year: number, period: number, fallback = 0): [string, (v: string) => void] {
  const key = `${year}-${period}`;
  const value = useSyncExternalStore(
    (cb) => {
      ptuListeners.add(cb);
      return () => ptuListeners.delete(cb);
    },
    () => ptuDraftStore.get(key) ?? String(fallback),
    () => String(fallback)
  );
  const setValue = (v: string) => {
    const setter = ptuSetterStore.get(key);
    if (setter) setter(v);
    ptuDraftStore.set(key, v);
    notifyPtuListeners();
  };
  return [value, setValue];
}

function parseNonNegative(raw: string): number {
  const cleaned = raw.replaceAll(',', '.').trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function sanitizeFiscalDecimalInput(raw: string): string {
  const normalized = raw.replaceAll(',', '.').replace(/[^0-9.]/g, '');
  const dotIdx = normalized.indexOf('.');
  if (dotIdx === -1) return normalized;
  return `${normalized.slice(0, dotIdx + 1)}${normalized.slice(dotIdx + 1).replaceAll('.', '')}`;
}

/**
 * Determina si los parámetros capturados difieren de los guardados.
 * Si no existen parámetros previos guardados (`!savedParams`), devuelve `true`
 * para permitir guardar la configuración inicial de la empresa/periodo.
 */
export function isFiscalParamsDirty(
  draft: FiscalParamsDraft,
  savedParams: FiscalSavedParams | null | undefined
): boolean {
  if (!savedParams) return true;
  return (
    parseNonNegative(draft.coefUtilidad) !== savedParams.coeficienteUtilidad ||
    parseNonNegative(draft.tcDof) !== savedParams.tipoCambioDofCierre ||
    parseNonNegative(draft.perdidasAnt) !== savedParams.perdidasFiscalesPendientes ||
    parseNonNegative(draft.pagosAnt) !== savedParams.pagosProvisionalesAnteriores ||
    parseNonNegative(draft.saldoIvaAnt) !== savedParams.saldoFavorIvaAnterior ||
    (draft.ptuPagada !== undefined &&
      parseNonNegative(draft.ptuPagada) !== (savedParams.ptuPagadaEjercicio ?? 0))
  );
}

export function useAjustesFiscalParams(
  activeCompanyId: string,
  currentYear: number,
  currentPeriod: number,
  canEditFiscalConfig: boolean,
  toast: ToastContextType
) {
  const { data: fiscalWp, isLoading: isLoadingFiscalWp, refetch: refetchFiscalWp } = useQuery({
    queryKey: ['fiscal-workpaper', activeCompanyId, currentYear, currentPeriod],
    queryFn: () =>
      activeCompanyId
        ? apiClient.getFiscalWorkpaper(activeCompanyId, currentYear, currentPeriod)
        : null,
    enabled: Boolean(activeCompanyId)
  });

  const [coefUtilidad, setCoefUtilidad] = useState<string>('0.1845');
  const [tcDof, setTcDof] = useState<string>('0');
  const [perdidasAnt, setPerdidasAnt] = useState<string>('0');
  const [pagosAnt, setPagosAnt] = useState<string>('0');
  const [saldoIvaAnt, setSaldoIvaAnt] = useState<string>('0');
  const [ptuPagada, setPtuPagada] = useState<string>('0');

  const periodKey = `${currentYear}-${currentPeriod}`;
  const syncSharedPtu = (val: string) => {
    ptuDraftStore.set(periodKey, val);
    notifyPtuListeners();
  };

  React.useEffect(() => {
    ptuSetterStore.set(periodKey, setPtuPagada);
    return () => {
      ptuSetterStore.delete(periodKey);
    };
  }, [periodKey]);

  React.useEffect(() => {
    setCoefUtilidad('0.1845');
    setTcDof('0');
    setPerdidasAnt('0');
    setPagosAnt('0');
    setSaldoIvaAnt('0');
    setPtuPagada('0');
    syncSharedPtu('0');
  }, [activeCompanyId]);

  React.useEffect(() => {
    if (fiscalWp?.parameters) {
      setCoefUtilidad(String(fiscalWp.parameters.coeficienteUtilidad));
      setTcDof(String(fiscalWp.parameters.tipoCambioDofCierre));
      setPerdidasAnt(String(fiscalWp.parameters.perdidasFiscalesPendientes));
      setPagosAnt(String(fiscalWp.parameters.pagosProvisionalesAnteriores));
      setSaldoIvaAnt(String(fiscalWp.parameters.saldoFavorIvaAnterior));
      const ptuStr = String(fiscalWp.parameters.ptuPagadaEjercicio ?? 0);
      setPtuPagada(ptuStr);
      syncSharedPtu(ptuStr);
    }
  }, [fiscalWp]);

  const saveFiscalParamsMutation = useMutation({
    mutationFn: () => {
      if (!canEditFiscalConfig) {
        throw new Error('Solo un Contador o Socio puede guardar los parámetros fiscales Día 17.');
      }
      const cuNum = Math.min(1, parseNonNegative(coefUtilidad));
      const tcNum = parseNonNegative(tcDof);
      const perdidasNum = parseNonNegative(perdidasAnt);
      const pagosNum = parseNonNegative(pagosAnt);
      const ivaNum = parseNonNegative(saldoIvaAnt);
      const ptuNum = parseNonNegative(ptuPagada);

      setCoefUtilidad(String(cuNum));
      setTcDof(String(tcNum));
      setPerdidasAnt(String(perdidasNum));
      setPagosAnt(String(pagosNum));
      setSaldoIvaAnt(String(ivaNum));
      setPtuPagada(String(ptuNum));
      syncSharedPtu(String(ptuNum));

      return apiClient.saveTaxParameters({
        companyId: activeCompanyId,
        ejercicio: currentYear,
        periodo: currentPeriod,
        coeficienteUtilidad: cuNum,
        tipoCambioDofCierre: tcNum,
        perdidasFiscalesPendientes: perdidasNum,
        pagosProvisionalesAnteriores: pagosNum,
        saldoFavorIvaAnterior: ivaNum,
        ptuPagadaEjercicio: ptuNum
      });
    },
    onSuccess: () => {
      toast.success('Parámetros fiscales Día 17 actualizados');
      refetchFiscalWp();
    },
    onError: (err: Error) => {
      toast.error(`Error al guardar parámetros fiscales: ${err.message}`);
    }
  });

  const isFiscalDirty = isFiscalParamsDirty(
    { coefUtilidad, tcDof, perdidasAnt, pagosAnt, saldoIvaAnt, ptuPagada },
    fiscalWp?.parameters
  );

  const resetFiscalForm = () => {
    if (!fiscalWp?.parameters) {
      setCoefUtilidad('0.1845');
      setTcDof('0');
      setPerdidasAnt('0');
      setPagosAnt('0');
      setSaldoIvaAnt('0');
      setPtuPagada('0');
      syncSharedPtu('0');
      return;
    }
    setCoefUtilidad(String(fiscalWp.parameters.coeficienteUtilidad));
    setTcDof(String(fiscalWp.parameters.tipoCambioDofCierre));
    setPerdidasAnt(String(fiscalWp.parameters.perdidasFiscalesPendientes));
    setPagosAnt(String(fiscalWp.parameters.pagosProvisionalesAnteriores));
    setSaldoIvaAnt(String(fiscalWp.parameters.saldoFavorIvaAnterior));
    const ptuStr = String(fiscalWp.parameters.ptuPagadaEjercicio ?? 0);
    setPtuPagada(ptuStr);
    syncSharedPtu(ptuStr);
  };

  return {
    fiscalWp,
    isLoadingFiscalWp,
    coefUtilidad,
    setCoefUtilidad,
    tcDof,
    setTcDof,
    perdidasAnt,
    setPerdidasAnt,
    pagosAnt,
    setPagosAnt,
    saldoIvaAnt,
    setSaldoIvaAnt,
    ptuPagada,
    setPtuPagada: (v: string) => {
      setPtuPagada(v);
      syncSharedPtu(v);
    },
    isFiscalDirty,
    resetFiscalForm,
    saveFiscalParamsMutation
  };
}
