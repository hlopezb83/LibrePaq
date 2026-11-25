import { useState } from 'react';
import { getDefaultDateForPeriod } from '../../lib/formatters';
import type { ForeignNoCfdiMode, ForeignNoCfdiPayload } from '../../shared/cfdi-xml-foreign';

export type ForeignReceiptPreset = 'FOREIGN_USD' | 'FOREIGN_EUR' | 'NO_CFDI';

export interface UseCfdiSimulatorFormProps {
  activeCompanyId: string;
  currentYear: number;
  currentPeriod: number;
  onSubmit: (payload: ForeignNoCfdiPayload) => void;
}

export function useCfdiSimulatorForm({
  activeCompanyId,
  currentYear,
  currentPeriod,
  onSubmit
}: UseCfdiSimulatorFormProps) {
  const [mode, setMode] = useState<ForeignNoCfdiMode>('EXTRANJERO');
  const [numFactExt, setNumFactExt] = useState('INV-2026-1042');
  const [taxId, setTaxId] = useState('US-91-2345678');
  const [country, setCountry] = useState('USA');
  const [counterpartyName, setCounterpartyName] = useState('Amazon Web Services, Inc.');
  const [concepto, setConcepto] = useState('Servicios de Infraestructura Cloud (Regla 2.7.1.14 RMF)');
  const [moneda, setMoneda] = useState('USD');
  const [tipoCambio, setTipoCambio] = useState(20.0);
  const [subtotal, setSubtotal] = useState(250);
  const [ivaTrasladado, setIvaTrasladado] = useState(0);
  const [deductiblePct, setDeductiblePct] = useState(100);
  const [metodoPago, setMetodoPago] = useState<'PUE' | 'PPD'>('PUE');
  const [fecha, setFecha] = useState(() => getDefaultDateForPeriod(currentYear, currentPeriod));

  const applyPreset = (preset: ForeignReceiptPreset) => {
    setFecha(getDefaultDateForPeriod(currentYear, currentPeriod));
    if (preset === 'FOREIGN_USD') {
      setMode('EXTRANJERO');
      setNumFactExt('INV-2026-1042');
      setTaxId('US-91-2345678');
      setCountry('USA');
      setCounterpartyName('Amazon Web Services, Inc.');
      setConcepto('Servicios de Infraestructura Cloud (Regla 2.7.1.14 RMF)');
      setMoneda('USD');
      setTipoCambio(20.0);
      setSubtotal(250);
      setIvaTrasladado(0);
      setDeductiblePct(100);
      setMetodoPago('PUE');
    } else if (preset === 'FOREIGN_EUR') {
      setMode('EXTRANJERO');
      setNumFactExt('EU-2026-8831');
      setTaxId('ESB12345678');
      setCountry('ESP');
      setCounterpartyName('Consultoría Tecnológica Europa S.L.');
      setConcepto('Licenciamiento SaaS Internacional');
      setMoneda('EUR');
      setTipoCambio(21.5);
      setSubtotal(500);
      setIvaTrasladado(0);
      setDeductiblePct(100);
      setMetodoPago('PUE');
    } else {
      setMode('GASTO_SIN_CFDI');
      setNumFactExt('VALE-001');
      setTaxId('');
      setCountry('MEX');
      setCounterpartyName('Gastos Menores / Caja Chica Sin CFDI');
      setConcepto('Gasto operativo sin comprobante fiscal (Art. 28 LISR)');
      setMoneda('MXN');
      setTipoCambio(1);
      setSubtotal(500);
      setIvaTrasladado(0);
      setDeductiblePct(0);
      setMetodoPago('PUE');
    }
  };

  const handleModeChange = (nextMode: ForeignNoCfdiMode) => {
    setMode(nextMode);
    if (nextMode === 'GASTO_SIN_CFDI') {
      setMoneda('MXN');
      setTipoCambio(1);
      setCountry('MEX');
      setDeductiblePct(0);
    } else {
      if (moneda === 'MXN') {
        setMoneda('USD');
        setTipoCambio(20.0);
      }
      if (country === 'MEX') setCountry('USA');
      setDeductiblePct(100);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveCur = moneda.trim().toUpperCase() || 'MXN';
    const effectiveTc = effectiveCur === 'MXN' ? 1 : Math.max(0.0001, Number(tipoCambio || 1));
    onSubmit({
      companyId: activeCompanyId,
      isForeignNoCfdi: true,
      mode,
      direction: 'RECIBIDO',
      numFactExt: numFactExt.trim(),
      taxId: mode === 'EXTRANJERO' ? taxId.trim() : undefined,
      country: country.trim().toUpperCase(),
      counterpartyRfc: mode === 'EXTRANJERO' ? 'XEXX010101000' : 'XAXX010101000',
      counterpartyName: counterpartyName.trim(),
      conceptoPrincipal: concepto.trim(),
      moneda: effectiveCur,
      tipoCambio: effectiveTc,
      subtotal: Number(subtotal || 0),
      ivaTrasladado: Number(ivaTrasladado || 0),
      isrRetenido: 0,
      ivaRetenido: 0,
      metodoPago,
      formaPago: '03',
      fecha: fecha || getDefaultDateForPeriod(currentYear, currentPeriod),
      deductiblePct,
      tipoOperacionDiot: '85'
    });
  };

  return {
    mode,
    handleModeChange,
    numFactExt,
    setNumFactExt,
    taxId,
    setTaxId,
    country,
    setCountry,
    counterpartyName,
    setCounterpartyName,
    concepto,
    setConcepto,
    moneda,
    setMoneda,
    tipoCambio,
    setTipoCambio,
    subtotal,
    setSubtotal,
    ivaTrasladado,
    setIvaTrasladado,
    deductiblePct,
    setDeductiblePct,
    metodoPago,
    setMetodoPago,
    fecha,
    setFecha,
    applyPreset,
    handleSubmit
  };
}
