import { useEffect, useMemo, useRef, useState } from 'react';
import { getOfficialDofExchangeRate } from '../../shared/sat-inpc-catalog';
import type { Account } from '../../shared/types';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';

interface UsePedimentoFormParams {
  isOpen: boolean;
  onClose: () => void;
  currentYear: number;
  currentPeriod: number;
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
  accounts,
  onSavePoliza
}: UsePedimentoFormParams) {
  const defaultIva = useMemo(
    () => accounts.find((a) => a.code === '118-01-001' || a.code.startsWith('118'))?.code || '118-01-001',
    [accounts]
  );
  const defaultGasto = useMemo(
    () => accounts.find((a) => a.code === '601-01-005' || a.code.startsWith('601'))?.code || '601-01-005',
    [accounts]
  );
  const defaultBanco = useMemo(
    () => accounts.find((a) => a.code === '102-01-001' || a.code.startsWith('102'))?.code || '102-01-001',
    [accounts]
  );

  const [aduana, setAduana] = useState('240');
  const [patente, setPatente] = useState('3820');
  const [ano, setAno] = useState('24');
  const [consecutivo, setConsecutivo] = useState('4001234');
  const [clave, setClave] = useState<'A1' | 'IN' | 'AF'>('A1');
  const clampPeriod = Math.max(1, Math.min(12, currentPeriod));
  const [fecha, setFecha] = useState(`${currentYear}-${String(clampPeriod).padStart(2, '0')}-15`);
  const [valorAduana, setValorAduana] = useState(250000);
  const [dta, setDta] = useState(2000);
  const [prv, setPrv] = useState(310);
  const [ivaPagado, setIvaPagado] = useState(40370);
  const [cuentaBanco, setCuentaBanco] = useState(defaultBanco);
  const [cuentaIva, setCuentaIva] = useState(defaultIva);
  const [cuentaGasto, setCuentaGasto] = useState(defaultGasto);

  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogLightDismiss(dialogRef, onClose, { isOpen });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
      if (!accounts.some((a) => a.code === cuentaIva)) setCuentaIva(defaultIva);
      if (!accounts.some((a) => a.code === cuentaGasto)) setCuentaGasto(defaultGasto);
      if (!accounts.some((a) => a.code === cuentaBanco)) setCuentaBanco(defaultBanco);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, accounts, defaultIva, defaultGasto, defaultBanco, cuentaIva, cuentaGasto, cuentaBanco]);

  const tcSugerido = useMemo(
    () => getOfficialDofExchangeRate(currentYear, currentPeriod),
    [currentYear, currentPeriod]
  );

  const handleAutoCalcIva = () =>
    setIvaPagado(Math.round((valorAduana + dta + prv) * 0.16 * 100) / 100);

  const totalDesembolso = ivaPagado + dta + prv;
  const pedimentoCompleto = `${ano}  ${aduana}  ${patente}  ${consecutivo}`;
  const conceptoPoliza = `Pago Pedimento Aduanal ${clave} ${pedimentoCompleto} - Aduana ${aduana}`;

  const handleConfirm = () => {
    onSavePoliza({
      tipo: 'EGRESO',
      fecha,
      concepto: conceptoPoliza,
      movements: [
        {
          accountCode: cuentaIva,
          concepto: `IVA Acreditable Aduana Pedimento ${pedimentoCompleto}`,
          cargo: ivaPagado,
          abono: 0
        },
        {
          accountCode: cuentaGasto,
          concepto: `DTA y Prevalidación Aduanal Pedimento ${pedimentoCompleto}`,
          cargo: dta + prv,
          abono: 0
        },
        {
          accountCode: cuentaBanco,
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
    valorAduana,
    setValorAduana,
    dta,
    setDta,
    prv,
    setPrv,
    ivaPagado,
    setIvaPagado,
    cuentaBanco,
    setCuentaBanco,
    cuentaIva,
    setCuentaIva,
    cuentaGasto,
    setCuentaGasto,
    tcSugerido,
    totalDesembolso,
    handleAutoCalcIva,
    handleConfirm
  };
}
