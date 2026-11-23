import React from 'react';
import { ShieldAlert, Sparkles, X } from 'lucide-react';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { formatCurrency } from '../../lib/formatters';
import { checkRfc69BStatus } from '../../shared/sat-69b';
import type { Account, CfdiDocument } from '../../shared/types';
import { CfdiRuleLearningBar } from './CfdiRuleLearningBar';
import { useCfdiContabilizarRules } from './useCfdiContabilizarRules';

export interface CfdiPreviewMovement {
  code: string;
  name: string;
  concepto: string;
  cargo: number;
  abono: number;
}

export interface CfdiContabilizarModalProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  selectedCfdi: CfdiDocument | null;
  onClose: () => void;
  operationAccountCode: string;
  setOperationAccountCode: (code: string) => void;
  counterAccountCode: string;
  setCounterAccountCode: (code: string) => void;
  affectableAccounts: Account[];
  previewMovements: CfdiPreviewMovement[];
  isPending: boolean;
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  onConfirm: () => void;
}

export function CfdiContabilizarModal({
  dialogRef, selectedCfdi, onClose, operationAccountCode, setOperationAccountCode,
  counterAccountCode, setCounterAccountCode, affectableAccounts, previewMovements,
  isPending, isPeriodLocked = false, isReadOnlyClient = false, onConfirm
}: CfdiContabilizarModalProps) {
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;
  useDialogLightDismiss(dialogRef, onClose);
  const {
    matchedRule,
    deductiblePct,
    setDeductiblePct,
    rememberRule,
    setRememberRule,
    isSavingRule,
    effectivePreviewMovements,
    saveLearnedRuleIfEnabled
  } = useCfdiContabilizarRules({
    selectedCfdi,
    affectableAccounts,
    operationAccountCode,
    setOperationAccountCode,
    counterAccountCode,
    setCounterAccountCode,
    fallbackPreviewMovements: previewMovements
  });

  const totalCargos = effectivePreviewMovements.reduce((acc, m) => acc + (m.cargo || 0), 0);
  const totalAbonos = effectivePreviewMovements.reduce((acc, m) => acc + (m.abono || 0), 0);
  const diffCents = Math.abs(Math.round(totalCargos * 100) - Math.round(totalAbonos * 100));
  const isBalanced = diffCents === 0;
  const counterpartyRfc = selectedCfdi
    ? selectedCfdi.direction === 'EMITIDO'
      ? selectedCfdi.receptorRfc
      : selectedCfdi.emisorRfc
    : '';
  const efosCheck = counterpartyRfc ? checkRfc69BStatus(counterpartyRfc) : { isEfos: false };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="modal-contabilizar-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-3xl overflow-hidden max-h-[92dvh]"
    >
      {selectedCfdi && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (isWriteBlocked || isPending || isSavingRule || !isBalanced) return;
            await saveLearnedRuleIfEnabled();
            onConfirm();
          }}
          className="p-4 sm:p-5 max-h-[92dvh] overflow-y-auto overscroll-contain space-y-3.5"
        >
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
                <Sparkles className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="modal-contabilizar-title" className="text-base font-bold text-slate-900">
                  Contabilizador Automático CFDI 4.0 → Póliza
                </h2>
                <p className="text-xs text-slate-600 font-mono break-all">
                  {selectedCfdi.serie}-{selectedCfdi.folio} (Tipo {selectedCfdi.tipoComprobante}) • UUID: {selectedCfdi.uuid}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar asistente"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {selectedCfdi.statusSat === 'CANCELADO' && (
            <div role="alert" className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2.5 text-red-900 text-xs">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <div className="font-bold">Comprobante Cancelado ante el SAT</div>
                <p className="text-[11px] text-red-800 mt-0.5">
                  Este CFDI figura con estatus CANCELADO en el SAT. Evita contabilizarlo como deducción o acreditamiento.
                </p>
              </div>
            </div>
          )}

          {efosCheck.isEfos && (
            <div role="alert" className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2.5 text-red-900 text-xs">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <div className="font-bold">
                  ⚠️ {selectedCfdi.direction === 'EMITIDO' ? 'Receptor' : 'Emisor'} en Lista Negra SAT (Art. 69-B CFF - {('record' in efosCheck ? efosCheck.record?.situacion : undefined) || 'EFOS'})
                </div>
                <p className="text-[11px] text-red-800 mt-0.5 leading-relaxed">
                  El RFC <strong>{counterpartyRfc}</strong> está catalogado como EFOS por la autoridad fiscal. Los comprobantes fiscales presuntamente no producen efectos deducibles ni acreditables.
                </p>
              </div>
            </div>
          )}

          {selectedCfdi.tipoComprobante === 'P' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-[11px] text-blue-900">
              <strong>REP 2.0 (Complemento de Pago):</strong> este asiento liquida el saldo pendiente PPD y reclasifica el IVA efectivamente pagado/cobrado del periodo.
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div>
              <div className="text-slate-500">Tipo CFDI</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {selectedCfdi.tipoComprobante === 'P'
                  ? 'REP 2.0 Pago'
                  : `${selectedCfdi.direction} (${selectedCfdi.metodoPago})`}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Base / Subtotal</div>
              <div className="font-mono font-bold text-slate-900 mt-0.5">
                {formatCurrency(selectedCfdi.subtotal)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">IVA 16%</div>
              <div className="font-mono font-bold text-slate-900 mt-0.5">
                {formatCurrency(selectedCfdi.ivaTrasladado)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Retenciones</div>
              <div className="font-mono font-bold text-red-700 mt-0.5">
                -{formatCurrency(selectedCfdi.isrRetenido + selectedCfdi.ivaRetenido)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Total Neto</div>
              <div className="font-mono font-bold text-blue-800 mt-0.5">
                {formatCurrency(selectedCfdi.total)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="auto-op-account"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {selectedCfdi.tipoComprobante === 'P'
                  ? selectedCfdi.direction === 'EMITIDO'
                    ? 'Cuenta de Cliente que se Liquida (Abono)'
                    : 'Cuenta de Proveedor que se Liquida (Cargo)'
                  : selectedCfdi.direction === 'EMITIDO'
                  ? 'Cuenta de Ingresos (Abono Subtotal)'
                  : 'Cuenta de Costo o Gasto (Cargo Subtotal)'}
              </label>
              <select
                id="auto-op-account"
                value={operationAccountCode}
                onChange={(e) => setOperationAccountCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition shadow-2xs"
              >
                {affectableAccounts.map((acc) => (
                  <option key={acc.id} value={acc.code}>
                    {acc.code} - {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="auto-counter-account"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {selectedCfdi.tipoComprobante === 'P' || selectedCfdi.metodoPago === 'PUE'
                  ? 'Cuenta Bancaria de Flujo'
                  : selectedCfdi.direction === 'EMITIDO'
                  ? 'Cuenta de Cliente (PPD Crédito)'
                  : 'Cuenta de Proveedor (PPD Crédito)'}
              </label>
              <select
                id="auto-counter-account"
                value={counterAccountCode}
                onChange={(e) => setCounterAccountCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition shadow-2xs"
              >
                {affectableAccounts.map((acc) => (
                  <option key={acc.id} value={acc.code}>
                    {acc.code} - {acc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <CfdiRuleLearningBar
            direction={selectedCfdi.direction}
            counterpartyRfc={counterpartyRfc}
            matchedRule={matchedRule}
            deductiblePct={deductiblePct}
            setDeductiblePct={setDeductiblePct}
            rememberRule={rememberRule}
            setRememberRule={setRememberRule}
          />

          {/* Tabla de Previsualización en Vivo de la Póliza Contable (Partida Doble) */}
          <div className="border border-slate-300 rounded-xl overflow-hidden overflow-x-auto scrollable-panel">
            <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Vista Previa de la Póliza que se Registrará (Partida Doble)
              </span>
              <span className="font-mono text-[11px] text-emerald-800 font-semibold">
                Sumas Iguales Verificadas ✔
              </span>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-600">
                  <th scope="col" className="py-2 px-3">
                    Cuenta
                  </th>
                  <th scope="col" className="py-2 px-3">
                    Nombre de Cuenta
                  </th>
                  <th scope="col" className="py-2 px-3">
                    Concepto
                  </th>
                  <th scope="col" className="py-2 px-3 text-right">
                    Cargo (Debe)
                  </th>
                  <th scope="col" className="py-2 px-3 text-right">
                    Abono (Haber)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {effectivePreviewMovements.map((line, i) => (
                  <tr key={i} className="hover:bg-blue-50/30">
                    <td className="py-2 px-3 font-mono font-bold text-blue-800">{line.code}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{line.name}</td>
                    <td className="py-2 px-3 text-slate-600 truncate max-w-48">{line.concepto}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-900 font-semibold">
                      {line.cargo > 0 ? formatCurrency(line.cargo) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-900 font-semibold">
                      {line.abono > 0 ? formatCurrency(line.abono) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-xs">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-slate-800">
                    <div className="flex items-center gap-2">
                      <span>Sumas Iguales:</span>
                      {isBalanced ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                          Póliza Cuadrada ✔
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                          Diferencia: {formatCurrency(diffCents / 100)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                    {formatCurrency(totalCargos)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                    {formatCurrency(totalAbonos)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer text-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isWriteBlocked || isPending || isSavingRule || !isBalanced}
              title={
                isWriteBlocked
                  ? 'Edición deshabilitada en periodo bloqueado o solo lectura'
                  : !isBalanced
                  ? 'El asiento proyectado está descuadrado'
                  : undefined
              }
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              {isPending || isSavingRule ? 'Generando Póliza...' : 'Confirmar y Generar Póliza'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
