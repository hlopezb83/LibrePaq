import { useMemo, useState } from 'react';
import { getDefaultDateForPeriod } from '../../lib/formatters';
import { validateRfcModulo11 } from '../../shared/accounting-engine';

export type CfdiSimulatorPreset = 'NORMAL' | 'HONORARIOS_RET' | 'REP_PAGO';

export interface UseCfdiSimulatorFormProps {
  activeCompanyId: string;
  currentYear: number;
  currentPeriod: number;
  onSubmit: (payload: {
    companyId: string;
    tipoComprobante: 'I' | 'P' | 'N';
    direction: 'EMITIDO' | 'RECIBIDO';
    counterpartyRfc: string;
    counterpartyName: string;
    conceptoPrincipal: string;
    subtotal: number;
    isrRetenido: number;
    ivaRetenido: number;
    metodoPago: 'PUE' | 'PPD';
    fecha: string;
  }) => void;
}

export function useCfdiSimulatorForm({
  activeCompanyId,
  currentYear,
  currentPeriod,
  onSubmit
}: UseCfdiSimulatorFormProps) {
  const [simDirection, setSimDirection] = useState<'EMITIDO' | 'RECIBIDO'>('RECIBIDO');
  const [simTipoComprobante, setSimTipoComprobante] = useState<'I' | 'P' | 'N'>('I');
  const [simCounterpartyRfc, setSimCounterpartyRfc] = useState('LEN200512A19');
  const [simCounterpartyName, setSimCounterpartyName] = useState(
    'Lenovo Tecnología de México S.A. de C.V.'
  );
  const [simConcepto, setSimConcepto] = useState(
    'Licenciamiento Anual y Soporte Técnico Empresarial'
  );
  const [simSubtotal, setSimSubtotal] = useState(35000);
  const [simIsrRetenido, setSimIsrRetenido] = useState(0);
  const [simIvaRetenido, setSimIvaRetenido] = useState(0);
  const [simMetodoPago, setSimMetodoPago] = useState<'PUE' | 'PPD'>('PUE');

  const simRfcModulo11 = useMemo(() => {
    if (!simCounterpartyRfc) return null;
    return validateRfcModulo11(simCounterpartyRfc);
  }, [simCounterpartyRfc]);

  const applyPreset = (preset: 'NORMAL' | 'HONORARIOS_RET' | 'REP_PAGO') => {
    if (preset === 'NORMAL') {
      setSimTipoComprobante('I');
      setSimDirection('RECIBIDO');
      setSimMetodoPago('PUE');
      setSimCounterpartyRfc('LEN200512A19');
      setSimCounterpartyName('Lenovo Tecnología de México S.A. de C.V.');
      setSimConcepto('Licenciamiento Anual y Soporte Técnico Empresarial');
      setSimSubtotal(35000);
      setSimIsrRetenido(0);
      setSimIvaRetenido(0);
    } else if (preset === 'HONORARIOS_RET') {
      setSimTipoComprobante('I');
      setSimDirection('RECIBIDO');
      setSimMetodoPago('PUE');
      setSimCounterpartyRfc('GARM850612H92');
      setSimCounterpartyName('Mtro. Roberto Garza Martínez (Persona Física Honorarios)');
      setSimConcepto('Servicios Profesionales con Retención ISR 10% e IVA 10.6667%');
      setSimSubtotal(30000);
      setSimIsrRetenido(3000);
      setSimIvaRetenido(3200);
    } else if (preset === 'REP_PAGO') {
      setSimTipoComprobante('P');
      setSimDirection('EMITIDO');
      setSimMetodoPago('PUE');
      setSimCounterpartyRfc('GLP1703198H4');
      setSimCounterpartyName('Grupo Logístico Pacífico S.A. de C.V.');
      setSimConcepto('Complemento de Pago REP 2.0 Liquida Factura PPD y Reclasifica IVA');
      setSimSubtotal(185000);
      setSimIsrRetenido(0);
      setSimIvaRetenido(0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      companyId: activeCompanyId,
      tipoComprobante: simTipoComprobante,
      direction: simDirection,
      counterpartyRfc: simCounterpartyRfc.toUpperCase(),
      counterpartyName: simCounterpartyName,
      conceptoPrincipal: simConcepto,
      subtotal: simSubtotal,
      isrRetenido: simIsrRetenido,
      ivaRetenido: simIvaRetenido,
      metodoPago: simMetodoPago,
      fecha: getDefaultDateForPeriod(currentYear, currentPeriod)
    });
  };

  return {
    simDirection,
    setSimDirection,
    simTipoComprobante,
    setSimTipoComprobante,
    simCounterpartyRfc,
    setSimCounterpartyRfc,
    simCounterpartyName,
    setSimCounterpartyName,
    simConcepto,
    setSimConcepto,
    simSubtotal,
    setSimSubtotal,
    simIsrRetenido,
    setSimIsrRetenido,
    simIvaRetenido,
    setSimIvaRetenido,
    simMetodoPago,
    setSimMetodoPago,
    simRfcModulo11,
    applyPreset,
    handleSubmit
  };
}
