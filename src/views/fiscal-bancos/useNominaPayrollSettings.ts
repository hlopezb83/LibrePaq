import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPayrollPeriodSettings,
  savePayrollPeriodSettings
} from '../../lib/supabase/supabase-payroll-settings';
import { MEXICO_ISN_RATES } from '../../shared/engine/payroll-summary.engine';

function parseNonNeg(val: string): number {
  const n = Number.parseFloat(val);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function useNominaPayrollSettings(params: {
  companyId: string;
  year: number;
  period: number;
  isLocked: boolean;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}) {
  const { companyId, year, period, isLocked, onNotify } = params;
  const queryClient = useQueryClient();

  const [stateCode, setStateCode] = useState<string>('CMX');
  const [isnRateInput, setIsnRateInput] = useState<string>('4');
  const [baseInput, setBaseInput] = useState<string | null>(null);
  const [imssInput, setImssInput] = useState<string>('0');
  const [rcvInput, setRcvInput] = useState<string>('0');
  const [infonavitInput, setInfonavitInput] = useState<string>('0');

  const { data: savedSettings } = useQuery({
    queryKey: ['payroll-settings', companyId, year, period],
    queryFn: () => getPayrollPeriodSettings(companyId, year, period),
    enabled: Boolean(companyId)
  });

  useEffect(() => {
    setBaseInput(null);
    if (savedSettings) {
      setStateCode(savedSettings.stateCode);
      setIsnRateInput(String(savedSettings.isnRate));
      setImssInput(String(savedSettings.imssPatronal));
      setRcvInput(String(savedSettings.rcv));
      setInfonavitInput(String(savedSettings.infonavit));
    } else {
      setStateCode('CMX');
      setIsnRateInput('4');
      setImssInput('0');
      setRcvInput('0');
      setInfonavitInput('0');
    }
  }, [companyId, year, period, savedSettings]);

  const handleStateChange = (nextCode: string) => {
    setStateCode(nextCode);
    const matched = MEXICO_ISN_RATES.find((s) => s.code === nextCode);
    if (matched) setIsnRateInput(String(matched.ratePct));
  };

  const saveSettingsMutation = useMutation({
    mutationFn: () => {
      if (isLocked) throw new Error('Periodo bloqueado o modo solo lectura.');
      return savePayrollPeriodSettings({
        companyId,
        ejercicio: year,
        periodo: period,
        stateCode,
        isnRate: parseNonNeg(isnRateInput),
        imssPatronal: parseNonNeg(imssInput),
        rcv: parseNonNeg(rcvInput),
        infonavit: parseNonNeg(infonavitInput)
      });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(['payroll-settings', companyId, year, period], saved);
      onNotify('Parámetros de ISN y cuotas SUA guardados para el periodo.');
    },
    onError: (err: Error) => onNotify(`Error al guardar parámetros de nómina: ${err.message}`, 'error')
  });

  return {
    stateCode,
    handleStateChange,
    isnRateInput,
    setIsnRateInput,
    baseInput,
    setBaseInput,
    imssInput,
    setImssInput,
    rcvInput,
    setRcvInput,
    infonavitInput,
    setInfonavitInput,
    saveSettingsMutation
  };
}
