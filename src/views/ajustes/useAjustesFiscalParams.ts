import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import type { ToastContextType } from '../../context/ToastContext';

export function useAjustesFiscalParams(
  activeCompanyId: string,
  currentYear: number,
  currentPeriod: number,
  canEditFiscalConfig: boolean,
  toast: ToastContextType
) {
  const { data: fiscalWp, refetch: refetchFiscalWp } = useQuery({
    queryKey: ['fiscal-workpaper', activeCompanyId, currentYear, currentPeriod],
    queryFn: () =>
      activeCompanyId
        ? apiClient.getFiscalWorkpaper(activeCompanyId, currentYear, currentPeriod)
        : null,
    enabled: Boolean(activeCompanyId)
  });

  const [coefUtilidad, setCoefUtilidad] = useState<number>(0.1845);
  const [tcDof, setTcDof] = useState<number>(0);
  const [perdidasAnt, setPerdidasAnt] = useState<number>(0);
  const [pagosAnt, setPagosAnt] = useState<number>(0);
  const [saldoIvaAnt, setSaldoIvaAnt] = useState<number>(0);

  React.useEffect(() => {
    setCoefUtilidad(0.1845);
    setTcDof(0);
    setPerdidasAnt(0);
    setPagosAnt(0);
    setSaldoIvaAnt(0);
  }, [activeCompanyId]);

  React.useEffect(() => {
    if (fiscalWp?.parameters) {
      setCoefUtilidad(fiscalWp.parameters.coeficienteUtilidad);
      setTcDof(fiscalWp.parameters.tipoCambioDofCierre);
      setPerdidasAnt(fiscalWp.parameters.perdidasFiscalesPendientes);
      setPagosAnt(fiscalWp.parameters.pagosProvisionalesAnteriores);
      setSaldoIvaAnt(fiscalWp.parameters.saldoFavorIvaAnterior);
    }
  }, [fiscalWp]);

  const saveFiscalParamsMutation = useMutation({
    mutationFn: () => {
      if (!canEditFiscalConfig) {
        throw new Error('Solo un Contador o Socio puede guardar los parámetros fiscales Día 17.');
      }
      return apiClient.saveTaxParameters({
        companyId: activeCompanyId,
        ejercicio: currentYear,
        periodo: currentPeriod,
        coeficienteUtilidad: Number(coefUtilidad),
        tipoCambioDofCierre: Number(tcDof),
        perdidasFiscalesPendientes: Number(perdidasAnt),
        pagosProvisionalesAnteriores: Number(pagosAnt),
        saldoFavorIvaAnterior: Number(saldoIvaAnt)
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

  const isFiscalDirty = Boolean(
    fiscalWp?.parameters &&
      (Number(coefUtilidad) !== fiscalWp.parameters.coeficienteUtilidad ||
        Number(tcDof) !== fiscalWp.parameters.tipoCambioDofCierre ||
        Number(perdidasAnt) !== fiscalWp.parameters.perdidasFiscalesPendientes ||
        Number(pagosAnt) !== fiscalWp.parameters.pagosProvisionalesAnteriores ||
        Number(saldoIvaAnt) !== fiscalWp.parameters.saldoFavorIvaAnterior)
  );

  const resetFiscalForm = () => {
    if (!fiscalWp?.parameters) return;
    setCoefUtilidad(fiscalWp.parameters.coeficienteUtilidad);
    setTcDof(fiscalWp.parameters.tipoCambioDofCierre);
    setPerdidasAnt(fiscalWp.parameters.perdidasFiscalesPendientes);
    setPagosAnt(fiscalWp.parameters.pagosProvisionalesAnteriores);
    setSaldoIvaAnt(fiscalWp.parameters.saldoFavorIvaAnterior);
  };

  return {
    fiscalWp,
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
    isFiscalDirty,
    resetFiscalForm,
    saveFiscalParamsMutation
  };
}
