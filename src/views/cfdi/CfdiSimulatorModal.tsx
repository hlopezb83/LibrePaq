import React from 'react';
import { AlertTriangle, CheckCircle2, FilePlus2 } from 'lucide-react';
import { Button, FormField, Input, ModalShell, Select, StatusBadge } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
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
  } = useCfdiSimulatorForm({
    activeCompanyId,
    currentYear,
    currentPeriod,
    onSubmit
  });

  const appliesIva = simTipoComprobante === 'I';
  const simIva = appliesIva ? simSubtotal * 0.16 : 0;
  const simTotal = simSubtotal + simIva - simIsrRetenido - simIvaRetenido;
  const handleClose = () => {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    } else {
      onClose();
    }
  };

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={true}
      onClose={handleClose}
      maxWidth="xl"
      titleId="modal-sim-cfdi-title"
      icon={<FilePlus2 className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      title="Registro de Comprobante CFDI 4.0 / Retenciones / REP 2.0"
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
            form="cfdi-simulator-form"
            variant="primary"
            size="md"
            loading={isPending}
            leftIcon={<FilePlus2 className="w-4 h-4" aria-hidden="true" />}
          >
            {isPending ? 'Timbrando XML...' : 'Generar XML en Bóveda ADD'}
          </Button>
        </>
      }
    >
      <CfdiSimulatorHeader onApplyPreset={applyPreset} />

      <form
        id="cfdi-simulator-form"
        method="post"
        onSubmit={handleSubmit}
        className="space-y-3.5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Tipo de Comprobante SAT" htmlFor="sim-tipo-comp">
            <Select
              id="sim-tipo-comp"
              value={simTipoComprobante}
              onChange={(e) => setSimTipoComprobante(e.target.value as 'I' | 'P' | 'N')}
              className="font-semibold"
            >
              <option value="I">I - Factura de Ingreso / Gasto</option>
              <option value="P">P - Complemento de Recepción de Pagos 2.0</option>
              <option value="N">N - Recibo Electrónico de Nómina 1.2</option>
            </Select>
          </FormField>

          <FormField label="Dirección" htmlFor="sim-direction">
            <Select
              id="sim-direction"
              value={simDirection}
              onChange={(e) => setSimDirection(e.target.value as 'EMITIDO' | 'RECIBIDO')}
              className="font-semibold"
            >
              <option value="RECIBIDO">RECIBIDO (De Proveedor / Asesor)</option>
              <option value="EMITIDO">EMITIDO (A Cliente)</option>
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="sim-rfc" className="block text-xs font-semibold text-slate-700">
                RFC Contraparte <span className="text-red-700">*</span>
              </label>
              {simRfcModulo11 && simRfcModulo11.isValidFormat && (
                <div className="flex items-center gap-1">
                  {simRfcModulo11.isValidCheckDigit ? (
                    <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" /> RFC
                      válido
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" aria-hidden="true" /> SAT:{' '}
                      {simRfcModulo11.expectedCheckDigit}
                      {simRfcModulo11.expectedRfc && (
                        <button
                          type="button"
                          onClick={() => setSimCounterpartyRfc(simRfcModulo11.expectedRfc!)}
                          className="underline text-blue-700 hover:text-blue-900 cursor-pointer"
                        >
                          Corregir
                        </button>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
            <Input
              id="sim-rfc"
              type="text"
              required
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={13}
              value={simCounterpartyRfc}
              onChange={(e) =>
                setSimCounterpartyRfc(e.target.value.toUpperCase().replace(/[^A-Z0-9&Ñ]/g, ''))
              }
              className="font-mono uppercase"
            />
          </div>

          <FormField label="Método de Pago SAT" htmlFor="sim-metodo">
            <Select
              id="sim-metodo"
              value={simMetodoPago}
              onChange={(e) => setSimMetodoPago(e.target.value as 'PUE' | 'PPD')}
            >
              <option value="PUE">PUE - Una sola exhibición (Contado)</option>
              <option value="PPD">PPD - Parcialidades o diferido (Crédito)</option>
            </Select>
          </FormField>
        </div>

        <FormField label="Razón Social Contraparte" htmlFor="sim-nombre" required>
          <Input
            id="sim-nombre"
            type="text"
            required
            value={simCounterpartyName}
            onChange={(e) => setSimCounterpartyName(e.target.value)}
          />
        </FormField>

        <FormField label="Concepto del CFDI 4.0" htmlFor="sim-concepto" required>
          <Input
            id="sim-concepto"
            type="text"
            required
            value={simConcepto}
            onChange={(e) => setSimConcepto(e.target.value)}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField
            label={
              appliesIva
                ? 'Subtotal / Base 16%'
                : simTipoComprobante === 'N'
                ? 'Percepciones / Subtotal'
                : 'Monto del Pago (REP)'
            }
            htmlFor="sim-subtotal"
          >
            <Input
              id="sim-subtotal"
              type="number"
              min="1"
              step="0.01"
              required
              value={simSubtotal}
              onChange={(e) => setSimSubtotal(Number(e.target.value || 0))}
              className="font-mono tabular-nums"
            />
          </FormField>

          <FormField label="ISR Retenido (001)" htmlFor="sim-isr-ret">
            <Input
              id="sim-isr-ret"
              type="number"
              min="0"
              step="0.01"
              value={simIsrRetenido}
              onChange={(e) => setSimIsrRetenido(Number(e.target.value || 0))}
              className="font-mono tabular-nums"
            />
          </FormField>

          <FormField label="IVA Retenido (002)" htmlFor="sim-iva-ret">
            <Input
              id="sim-iva-ret"
              type="number"
              min="0"
              step="0.01"
              value={simIvaRetenido}
              onChange={(e) => setSimIvaRetenido(Number(e.target.value || 0))}
              className="font-mono tabular-nums"
            />
          </FormField>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700 flex flex-wrap items-center justify-between gap-2">
          <span className="tabular-nums">
            {appliesIva
              ? `IVA 16%: ${formatCurrency(simIva)}`
              : 'IVA: $0.00 (Sin IVA automático)'}
          </span>
          <span className="tabular-nums">
            Retenciones: -{formatCurrency(simIsrRetenido + simIvaRetenido)}
          </span>
          <strong className="text-blue-800 tabular-nums">
            Total Neto: {formatCurrency(simTotal)}
          </strong>
        </div>
      </form>
    </ModalShell>
  );
}
