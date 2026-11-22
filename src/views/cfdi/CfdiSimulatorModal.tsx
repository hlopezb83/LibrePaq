import React from 'react';
import { AlertTriangle, CheckCircle2, FilePlus2, X } from 'lucide-react';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { formatCurrency } from '../../lib/formatters';
import type { Company } from '../../shared/types';
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
    simDirection, setSimDirection,
    simTipoComprobante, setSimTipoComprobante,
    simCounterpartyRfc, setSimCounterpartyRfc,
    simCounterpartyName, setSimCounterpartyName,
    simConcepto, setSimConcepto,
    simSubtotal, setSimSubtotal,
    simIsrRetenido, setSimIsrRetenido,
    simIvaRetenido, setSimIvaRetenido,
    simMetodoPago, setSimMetodoPago,
    simRfcModulo11,
    applyPreset,
    handleSubmit
  } = useCfdiSimulatorForm({
    activeCompanyId,
    currentYear,
    currentPeriod,
    onSubmit
  });

  useDialogLightDismiss(dialogRef, onClose);

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="modal-sim-cfdi-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-xl overflow-hidden"
    >
      <div className="p-4 sm:p-5 max-h-[86dvh] overflow-y-auto overscroll-contain space-y-3.5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h2 id="modal-sim-cfdi-title" className="text-base font-bold text-slate-900">
              Registro de Comprobante CFDI 4.0 / Retenciones / REP 2.0
            </h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-slate-600">
              <span className="font-bold text-slate-800">{activeCompany?.name}</span>
              <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 text-[11px] font-bold">
                {activeCompany?.rfc}
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-mono text-[11px] text-blue-700 font-semibold">
                Periodo P{String(currentPeriod).padStart(2, '0')}/{currentYear}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Plantillas rápidas de prueba */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset('NORMAL')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 cursor-pointer"
          >
            1. Factura Gasto Normal (16% IVA)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('HONORARIOS_RET')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 cursor-pointer"
          >
            2. Honorarios con Retención ISR e IVA
          </button>
          <button
            type="button"
            onClick={() => applyPreset('REP_PAGO')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 cursor-pointer"
          >
            3. Complemento de Pago REP 2.0 (Tipo P)
          </button>
        </div>

        <form method="post" onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="sim-tipo-comp"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Tipo de Comprobante SAT
              </label>
              <select
                id="sim-tipo-comp"
                value={simTipoComprobante}
                onChange={(e) => setSimTipoComprobante(e.target.value as 'I' | 'P' | 'N')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
              >
                <option value="I">I - Factura de Ingreso / Gasto</option>
                <option value="P">P - Complemento de Recepción de Pagos 2.0</option>
                <option value="N">N - Recibo Electrónico de Nómina 1.2</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="sim-direction"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Dirección
              </label>
              <select
                id="sim-direction"
                value={simDirection}
                onChange={(e) => setSimDirection(e.target.value as 'EMITIDO' | 'RECIBIDO')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
              >
                <option value="RECIBIDO">RECIBIDO (De Proveedor / Asesor)</option>
                <option value="EMITIDO">EMITIDO (A Cliente)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="sim-rfc" className="block text-xs font-semibold text-slate-700">
                  RFC Contraparte *
                </label>
                {simRfcModulo11 && simRfcModulo11.isValidFormat && (
                  <div className="flex items-center gap-1">
                    {simRfcModulo11.isValidCheckDigit ? (
                      <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> M11 OK
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" /> SAT:{' '}
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
              <input
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
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono uppercase"
              />
            </div>
            <div>
              <label htmlFor="sim-metodo" className="block text-xs font-semibold text-slate-700 mb-1">
                Método de Pago SAT
              </label>
              <select
                id="sim-metodo"
                value={simMetodoPago}
                onChange={(e) => setSimMetodoPago(e.target.value as 'PUE' | 'PPD')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="PUE">PUE - Una sola exhibición (Contado)</option>
                <option value="PPD">PPD - Parcialidades o diferido (Crédito)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="sim-nombre" className="block text-xs font-semibold text-slate-700 mb-1">
              Razón Social Contraparte *
            </label>
            <input
              id="sim-nombre"
              type="text"
              required
              value={simCounterpartyName}
              onChange={(e) => setSimCounterpartyName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div>
            <label
              htmlFor="sim-concepto"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Concepto del CFDI 4.0 *
            </label>
            <input
              id="sim-concepto"
              type="text"
              required
              value={simConcepto}
              onChange={(e) => setSimConcepto(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="sim-subtotal"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Subtotal / Base 16%
              </label>
              <input
                id="sim-subtotal"
                type="number"
                min="1"
                step="0.01"
                required
                value={simSubtotal}
                onChange={(e) => setSimSubtotal(Number(e.target.value || 0))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>

            <div>
              <label
                htmlFor="sim-isr-ret"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                ISR Retenido (001)
              </label>
              <input
                id="sim-isr-ret"
                type="number"
                min="0"
                step="0.01"
                value={simIsrRetenido}
                onChange={(e) => setSimIsrRetenido(Number(e.target.value || 0))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>

            <div>
              <label
                htmlFor="sim-iva-ret"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                IVA Retenido (002)
              </label>
              <input
                id="sim-iva-ret"
                type="number"
                min="0"
                step="0.01"
                value={simIvaRetenido}
                onChange={(e) => setSimIvaRetenido(Number(e.target.value || 0))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700 flex justify-between">
            <span>IVA 16%: {formatCurrency(simSubtotal * 0.16)}</span>
            <span>Retenciones: -{formatCurrency(simIsrRetenido + simIvaRetenido)}</span>
            <strong className="text-blue-800">
              Total Neto: {formatCurrency(simSubtotal * 1.16 - simIsrRetenido - simIvaRetenido)}
            </strong>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" aria-hidden="true" />
              {isPending ? 'Timbrando XML...' : 'Generar XML en Bóveda ADD'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
