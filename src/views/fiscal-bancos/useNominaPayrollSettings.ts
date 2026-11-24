import { useEffect, useRef, useState } from 'react';
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
  const [isnRateInput, setIsnRateInputState] = useState<string>('4');
  const [baseInput, setBaseInputState] = useState<string | null>(null);
  const [imssInput, setImssInputState] = useState<string>('0');
  const [rcvInput, setRcvInputState] = useState<string>('0');
  const [infonavitInput, setInfonavitInputState] = useState<string>('0');
  const [isDirty, setIsDirty] = useState(false);

  const contextKey = `${companyId}::${year}::${period}`;
  const hydratedKeyRef = useRef<string>('');
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const { data: savedSettings } = useQuery({
    queryKey: ['payroll-settings', companyId, year, period],
    queryFn: () => getPayrollPeriodSettings(companyId, year, period),
    enabled: Boolean(companyId)
  });

  useEffect(() => {
    setBaseInputState(null);
    setIsDirty(false);
  }, [contextKey]);

  useEffect(() => {
    const keyChanged = hydratedKeyRef.current !== contextKey;
    if (!keyChanged && isDirtyRef.current) return;
    hydratedKeyRef.current = contextKey;
    if (savedSettings) {
      setStateCode(savedSettings.stateCode);
      setIsnRateInputState(String(savedSettings.isnRate));
      setImssInputState(String(savedSettings.imssPatronal));
      setRcvInputState(String(savedSettings.rcv));
      setInfonavitInputState(String(savedSettings.infonavit));
    } else if (keyChanged) {
      setStateCode('CMX');
      setIsnRateInputState('4');
      setImssInputState('0');
      setRcvInputState('0');
      setInfonavitInputState('0');
    }
    setIsDirty(false);
  }, [contextKey, savedSettings]);

  const handleStateChange = (nextCode: string) => {
    setStateCode(nextCode);
    const matched = MEXICO_ISN_RATES.find((s) => s.code === nextCode);
    if (matched) setIsnRateInputState(String(matched.ratePct));
    setIsDirty(true);
  };

  const setIsnRateInput = (v: string) => { setIsnRateInputState(v); setIsDirty(true); };
  const setBaseInput = (v: string | null) => { setBaseInputState(v); };
  const setImssInput = (v: string) => { setImssInputState(v); setIsDirty(true); };
  const setRcvInput = (v: string) => { setRcvInputState(v); setIsDirty(true); };
  const setInfonavitInput = (v: string) => { setInfonavitInputState(v); setIsDirty(true); };

  const buildPayload = () => ({
    companyId,
    ejercicio: year,
    periodo: period,
    stateCode,
    isnRate: parseNonNeg(isnRateInput),
    imssPatronal: parseNonNeg(imssInput),
    rcv: parseNonNeg(rcvInput),
    infonavit: parseNonNeg(infonavitInput)
  });

  const saveSettingsSilently = async () => {
    if (isLocked) throw new Error('Periodo bloqueado o modo solo lectura.');
    const saved = await savePayrollPeriodSettings(buildPayload());
    queryClient.setQueryData(['payroll-settings', companyId, year, period], saved);
    setIsDirty(false);
    return saved;
  };

  const saveSettingsMutation = useMutation({
    mutationFn: saveSettingsSilently,
    onSuccess: () => {
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
    isDirty,
    saveSettingsSilently,
    saveSettingsMutation
  };
}
