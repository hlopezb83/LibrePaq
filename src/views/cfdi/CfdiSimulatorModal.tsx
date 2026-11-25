import React from 'react';
import { Globe2 } from 'lucide-react';
import { AlertBanner, Button, FormField, Input, ModalShell, Select, StatusBadge } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
import type { ForeignNoCfdiMode, ForeignNoCfdiPayload } from '../../shared/cfdi-xml-foreign';
import type { Company } from '../../shared/types';
import { CfdiSimulatorHeader } from './CfdiSimulatorHeader';
import { useCfdiSimulatorForm } from './useCfdiSimulatorForm';

export interface CfdiSimulatorModalProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  activeCompany?: Company | null;
  activeCompanyId: string;
  currentYear: number;
  currentPeriod: number;
  onClose: () => void;
  onSubmit: (payload: ForeignNoCfdiPayload) => void;
  isPending: boolean;
}

export function CfdiSimulatorModal({
  dialogRef,
  activeCompany,
  activeCompanyId,
  currentYear,
  currentPeriod,
  onClose,
  onSubmit,
  isPending
}: CfdiSimulatorModalProps) {
  const {
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
  } = useCfdiSimulatorForm({
    activeCompanyId,
    currentYear,
    currentPeriod,
    onSubmit
  });

  const isForeign = mode === 'EXTRANJERO';
  const effectiveTc = moneda === 'MXN' ? 1 : Math.max(0.0001, tipoCambio || 1);
  const totalOrig = subtotal + ivaTrasladado;
  const totalMxn = totalOrig * effectiveTc;
  const handleClose = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    else onClose();
  };

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={true}
      onClose={handleClose}
      maxWidth="xl"
      titleId="modal-sim-cfdi-title"
      icon={<Globe2 className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      title="Registro de Comprobante Extranjero / Gastos Sin CFDI"
      subtitle={
        <span className="inline-flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-800">{activeCompany?.name}</span>
          {activeCompany?.rfc && (
            <StatusBadge tone="slate" shape="tag">
              {activeCompany.rfc}
            </StatusBadge>
          )}
          <StatusBadge tone="blue" shape="tag">
            Periodo P{String(currentPeriod).padStart(2, '0')}/{currentYear}
          </StatusBadge>
        </span>
      }
      busy={isPending}
      bodyClassName="space-y-3.5 scrollable-panel"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="cfdi-foreign-form"
            variant="primary"
            size="md"
            loading={isPending}
            leftIcon={<Globe2 className="w-4 h-4" aria-hidden="true" />}
          >
            {isPending ? 'Registrando...' : 'Registrar en Bóveda'}
          </Button>
        </>
      }
    >
      <AlertBanner tone="info" title="Sin UUID SAT apócrifo (CompExt / DIOT 05):">
        Este registro no genera timbres XML falsos ni contamina <code>CompNal</code> en Anexo 24.
        Se enlaza como <code>CompExt</code>, DIOT Tipo <code>05</code> y flujo RESICO/612.
      </AlertBanner>

      <CfdiSimulatorHeader onApplyPreset={applyPreset} />

      <form id="cfdi-foreign-form" method="post" onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Tipo de Registro" htmlFor="foreign-mode">
            <Select
              id="foreign-mode"
              value={mode}
              onChange={(e) => handleModeChange(e.target.value as ForeignNoCfdiMode)}
              className="font-semibold"
            >
              <option value="EXTRANJERO">Comprobante Extranjero (Invoice)</option>
              <option value="GASTO_SIN_CFDI">Gasto Sin CFDI (Nacional)</option>
            </Select>
          </FormField>

          <FormField label="Folio / NumFactExt" htmlFor="foreign-folio" required>
            <Input
              id="foreign-folio"
              type="text"
              required
              value={numFactExt}
              onChange={(e) => setNumFactExt(e.target.value)}
              placeholder="Ej. INV-2026-1042"
              className="font-mono"
            />
          </FormField>

          <FormField label="Fecha" htmlFor="foreign-fecha" required>
            <Input
              id="foreign-fecha"
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="font-mono"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label={isForeign ? 'Tax ID / ID Fiscal' : 'Referencia / RFC'} htmlFor="foreign-taxid" required={isForeign}>
            <Input
              id="foreign-taxid"
              type="text"
              required={isForeign}
              value={taxId}
              onChange={(e) => setTaxId(e.target.value.toUpperCase())}
              placeholder={isForeign ? 'Ej. US-91-2345678' : 'Opcional'}
              className="font-mono uppercase"
            />
          </FormField>

          <FormField label="País (ISO-3)" htmlFor="foreign-country" required={isForeign}>
            <Select id="foreign-country" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="USA">USA - Estados Unidos</option>
              <option value="CAN">CAN - Canadá</option>
              <option value="ESP">ESP - España</option>
              <option value="GBR">GBR - Reino Unido</option>
              <option value="DEU">DEU - Alemania</option>
              <option value="COL">COL - Colombia</option>
              <option value="CHN">CHN - China</option>
              <option value="MEX">MEX - México (Sin CFDI)</option>
            </Select>
          </FormField>

          <FormField label="Método de Pago" htmlFor="foreign-metodo">
            <Select
              id="foreign-metodo"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value as 'PUE' | 'PPD')}
            >
              <option value="PUE">PUE - Pagado de Contado</option>
              <option value="PPD">PPD - Crédito / Por Pagar</option>
            </Select>
          </FormField>
        </div>

        <FormField label="Proveedor / Emisor Extranjero" htmlFor="foreign-nombre" required>
          <Input
            id="foreign-nombre"
            type="text"
            required
            value={counterpartyName}
            onChange={(e) => setCounterpartyName(e.target.value)}
          />
        </FormField>

        <FormField label="Concepto de Operación" htmlFor="foreign-concepto" required>
          <Input
            id="foreign-concepto"
            type="text"
            required
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
          />
        </FormField>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <FormField label="Moneda" htmlFor="foreign-moneda">
            <Select
              id="foreign-moneda"
              value={moneda}
              onChange={(e) => {
                const cur = e.target.value;
                setMoneda(cur);
                if (cur === 'MXN') setTipoCambio(1);
                else if (tipoCambio <= 1) setTipoCambio(20.0);
              }}
              className="font-mono"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="CAD">CAD</option>
              <option value="GBP">GBP</option>
              <option value="MXN">MXN</option>
            </Select>
          </FormField>

          <FormField label="Tipo Cambio" htmlFor="foreign-tc">
            <Input
              id="foreign-tc"
              type="number"
              min="0.0001"
              step="0.0001"
              disabled={moneda === 'MXN'}
              value={moneda === 'MXN' ? 1 : tipoCambio}
              onChange={(e) => setTipoCambio(Number(e.target.value || 1))}
              className="font-mono tabular-nums"
            />
          </FormField>

          <FormField label={`Subtotal (${moneda})`} htmlFor="foreign-subtotal" required>
            <Input
              id="foreign-subtotal"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={subtotal}
              onChange={(e) => setSubtotal(Number(e.target.value || 0))}
              className="font-mono tabular-nums"
            />
          </FormField>

          <FormField label="IVA Aduana/Otro" htmlFor="foreign-iva">
            <Input
              id="foreign-iva"
              type="number"
              min="0"
              step="0.01"
              value={ivaTrasladado}
              onChange={(e) => setIvaTrasladado(Number(e.target.value || 0))}
              className="font-mono tabular-nums"
            />
          </FormField>

          <FormField label="% Deducible" htmlFor="foreign-deductible">
            <Select
              id="foreign-deductible"
              value={deductiblePct}
              onChange={(e) => setDeductiblePct(Number(e.target.value))}
              className="font-mono"
            >
              <option value={100}>100%</option>
              <option value={50}>50%</option>
              <option value={0}>0% (No Ded.)</option>
            </Select>
          </FormField>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700 flex flex-wrap items-center justify-between gap-2">
          <span className="tabular-nums">
            Total {moneda}: {totalOrig.toFixed(2)} {moneda !== 'MXN' ? `(TC ${effectiveTc.toFixed(4)})` : ''}
          </span>
          <strong className="text-blue-800 tabular-nums">
            Equivalente MXN: {formatCurrency(totalMxn)}
          </strong>
        </div>
      </form>
    </ModalShell>
  );
}
