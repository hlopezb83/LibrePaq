import { useEffect, useMemo, useRef, useState } from 'react';
import { getDefaultDateForPeriod } from '../../lib/formatters';
import { getOfficialDofExchangeRate } from '../../shared/sat-inpc-catalog';
import type { Account } from '../../shared/types';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { isPolizaDateInDifferentPeriod } from './filterPolizas';

export function parseNonNegNumber(raw: string): number {
  const val = Number.parseFloat(raw);
  return Number.isFinite(val) && val >= 0 ? val : 0;
}

export function sanitizeDecimalInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join('')}`;
}

export interface UsePedimentoFormParams {
  isOpen: boolean;
  onClose: () => void;
  currentYear: number;
  currentPeriod: number;
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  isSaving?: boolean;
  accounts: Account[];
  onSavePoliza: (poliza: {
    tipo: 'EGRESO' | 'DIARIO';
    fecha: string;
    concepto: string;
    movements: Array<{ accountCode: string; concepto: string; cargo: number; abono: number }>;
  }) => void;
}

export function usePedimentoForm({
  isOpen,
  onClose,
  currentYear,
  currentPeriod,
  isPeriodLocked = false,
  isReadOnlyClient = false,
  isSaving = false,
  accounts,
  onSavePoliza
}: UsePedimentoFormParams) {
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;
  const defaultIvaAcc = useMemo(
    () => accounts.find((a) => a.code === '118-01-001' || a.code.startsWith('118')) ?? accounts[0],
    [accounts]
  );
  const defaultGastoAcc = useMemo(
    () => accounts.find((a) => a.code === '601-01-005' || a.code.startsWith('601')) ?? accounts[0],
    [accounts]
  );
  const defaultBancoAcc = useMemo(
    () => accounts.find((a) => a.code === '102-01-001' || a.code.startsWith('102')) ?? accounts[0],
    [accounts]
  );

  const [aduana, setAduana] = useState('');
  const [patente, setPatente] = useState('');
  const [ano, setAno] = useState(() => String(currentYear).slice(-2));
  const [consecutivo, setConsecutivo] = useState('');
  const [clave, setClave] = useState<'A1' | 'IN' | 'AF'>('A1');
  const [fecha, setFecha] = useState(() => getDefaultDateForPeriod(currentYear, currentPeriod));
  const [valorAduanaRaw, setValorAduanaRaw] = useState('');
  const [dtaRaw, setDtaRaw] = useState('');
  const [prvRaw, setPrvRaw] = useState('');
  const [ivaPagadoRaw, setIvaPagadoRaw] = useState('');
  const [cuentaBancoId, setCuentaBancoId] = useState(defaultBancoAcc?.id || '');
  const [cuentaIvaId, setCuentaIvaId] = useState(defaultIvaAcc?.id || '');
  const [cuentaGastoId, setCuentaGastoId] = useState(defaultGastoAcc?.id || '');

  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogLightDismiss(dialogRef, isSaving ? undefined : onClose, { isOpen });

  useEffect(() => {
    if (!isOpen) return;
    setAduana('');
    setPatente('');
    setConsecutivo('');
    setAno(String(currentYear).slice(-2));
    setFecha(getDefaultDateForPeriod(currentYear, currentPeriod));
    setValorAduanaRaw('');
    setDtaRaw('');
    setPrvRaw('');
    setIvaPagadoRaw('');
    setCuentaIvaId(defaultIvaAcc?.id || '');
    setCuentaGastoId(defaultGastoAcc?.id || '');
    setCuentaBancoId(defaultBancoAcc?.id || '');
  }, [isOpen, currentYear, currentPeriod, defaultIvaAcc?.id, defaultGastoAcc?.id, defaultBancoAcc?.id]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const valorAduana = parseNonNegNumber(valorAduanaRaw);
  const dta = parseNonNegNumber(dtaRaw);
  const prv = parseNonNegNumber(prvRaw);
  const ivaPagado = parseNonNegNumber(ivaPagadoRaw);

  const tcSugerido = useMemo(
    () => getOfficialDofExchangeRate(currentYear, currentPeriod),
    [currentYear, currentPeriod]
  );

  const handleAutoCalcIva = () => {
    const computed = Math.round((valorAduana + dta + prv) * 0.16 * 100) / 100;
    setIvaPagadoRaw(computed > 0 ? computed.toFixed(2) : '');
  };

  const cuentaIvaCode = accounts.find((a) => a.id === cuentaIvaId)?.code || defaultIvaAcc?.code || '118-01-001';
  const cuentaGastoCode = accounts.find((a) => a.id === cuentaGastoId)?.code || defaultGastoAcc?.code || '601-01-005';
  const cuentaBancoCode = accounts.find((a) => a.id === cuentaBancoId)?.code || defaultBancoAcc?.code || '102-01-001';

  const totalDesembolso = Math.round((ivaPagado + dta + prv) * 100) / 100;
  const isPedimentoIdComplete =
    /^\d{2}$/.test(ano) &&
    /^\d{2}$/.test(aduana) &&
    /^\d{4}$/.test(patente) &&
    /^\d{7}$/.test(consecutivo);
  const isDateDifferentPeriod = isPolizaDateInDifferentPeriod(fecha, currentYear, currentPeriod);
  const pedimentoCompleto = `${ano}  ${aduana}  ${patente}  ${consecutivo}`;
  const conceptoPoliza = `Pago Pedimento Aduanal ${clave} ${pedimentoCompleto} - Aduana ${aduana}`;

  const handleConfirm = () => {
    if (isWriteBlocked || !isPedimentoIdComplete || !Number.isFinite(totalDesembolso) || totalDesembolso <= 0) {
      return;
    }
    onSavePoliza({
      tipo: 'EGRESO',
      fecha,
      concepto: conceptoPoliza,
      movements: [
        {
          accountCode: cuentaIvaCode,
          concepto: `IVA Acreditable Aduana Pedimento ${pedimentoCompleto}`,
          cargo: ivaPagado,
          abono: 0
        },
        {
          accountCode: cuentaGastoCode,
          concepto: `DTA y Prevalidación Aduanal Pedimento ${pedimentoCompleto}`,
          cargo: Math.round((dta + prv) * 100) / 100,
          abono: 0
        },
        {
          accountCode: cuentaBancoCode,
          concepto: `Liquidación Contribuciones al Comercio Exterior Ped. ${pedimentoCompleto}`,
          cargo: 0,
          abono: totalDesembolso
        }
      ]
    });
  };

  return {
    dialogRef,
    aduana,
    setAduana,
    patente,
    setPatente,
    ano,
    setAno,
    consecutivo,
    setConsecutivo,
    clave,
    setClave,
    fecha,
    setFecha,
    valorAduanaRaw,
    setValorAduanaRaw,
    dtaRaw,
    setDtaRaw,
    prvRaw,
    setPrvRaw,
    ivaPagadoRaw,
    setIvaPagadoRaw,
    dta,
    prv,
    ivaPagado,
    cuentaBancoId,
    setCuentaBancoId,
    cuentaIvaId,
    setCuentaIvaId,
    cuentaGastoId,
    setCuentaGastoId,
    cuentaBancoCode,
    cuentaIvaCode,
    cuentaGastoCode,
    tcSugerido,
    totalDesembolso,
    isPedimentoIdComplete,
    isDateDifferentPeriod,
    handleAutoCalcIva,
    handleConfirm
  };
}
