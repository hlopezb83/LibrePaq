import React from 'react';
import { Loader2, ShieldAlert, Sparkles, X } from 'lucide-react';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { formatCurrency } from '../../lib/formatters';
import { checkRfc69BStatus } from '../../shared/sat-69b';
import type { Account, CfdiDocument } from '../../shared/types';
import { CfdiPolizaPreviewTable } from './CfdiPolizaPreviewTable';
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
  onConfirm: (opts?: { deductiblePct: number }) => void;
}

export function CfdiContabilizarModal({
  dialogRef, selectedCfdi, onClose, operationAccountCode, setOperationAccountCode,
  counterAccountCode, setCounterAccountCode, affectableAccounts, previewMovements,
  isPending, isPeriodLocked = false, isReadOnlyClient = false, onConfirm
}: CfdiContabilizarModalProps) {
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;
  useDialogLightDismiss(dialogRef, onClose);
  const {
    matchedRule, deductiblePct, setDeductiblePct, rememberRule, setRememberRule,
    isSavingRule, effectivePreviewMovements, saveLearnedRuleIfEnabled
  } = useCfdiContabilizarRules({
    selectedCfdi, affectableAccounts, operationAccountCode, setOperationAccountCode,
    counterAccountCode, setCounterAccountCode, fallbackPreviewMovements: previewMovements
  });

  const totalCargos = effectivePreviewMovements.reduce((acc, m) => acc + (m.cargo || 0), 0);
  const totalAbonos = effectivePreviewMovements.reduce((acc, m) => acc + (m.abono || 0), 0);
  const diffCents = Math.abs(Math.round(totalCargos * 100) - Math.round(totalAbonos * 100));
  const isBalanced = effectivePreviewMovements.length > 0 && diffCents === 0;
  const isCancelled = selectedCfdi?.statusSat === 'CANCELADO';
  const counterpartyRfc = selectedCfdi
    ? selectedCfdi.direction === 'EMITIDO' ? selectedCfdi.receptorRfc : selectedCfdi.emisorRfc
    : '';
  const efosCheck = counterpartyRfc ? checkRfc69BStatus(counterpartyRfc) : { isEfos: false };
  const folioDisplay = selectedCfdi
    ? [selectedCfdi.serie, selectedCfdi.folio].filter(Boolean).join('-') || 'S/F'
    : 'S/F';

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="modal-contabilizar-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-3xl open:flex open:flex-col max-h-[92dvh] overflow-hidden p-0 m-auto backdrop:bg-slate-900/60"
    >
      {selectedCfdi && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (isWriteBlocked || isCancelled || isPending || isSavingRule || !isBalanced) return;
            await saveLearnedRuleIfEnabled();
            onConfirm({ deductiblePct });
          }}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 bg-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 id="modal-contabilizar-title" className="text-base font-bold text-slate-900">
                  Contabilizador Automático CFDI 4.0 → Póliza
                </h1>
                <p className="text-xs text-slate-600 font-mono break-all">
                  {folioDisplay} (Tipo {selectedCfdi.tipoComprobante}) • UUID: {selectedCfdi.uuid}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar asistente"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3.5 scrollable-panel">
            {isCancelled && (
              <div role="alert" className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2.5 text-red-900 text-xs">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <div className="font-bold">Comprobante Cancelado ante el SAT</div>
                  <p className="text-[11px] text-red-800 mt-0.5">
                    Este CFDI está CANCELADO ante el SAT y no debe contabilizarse.
                  </p>
                </div>
              </div>
            )}

            {efosCheck.isEfos && (
              <div role="alert" className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2.5 text-red-900 text-xs">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <div className="font-bold">
                    {selectedCfdi.direction === 'EMITIDO' ? 'Receptor' : 'Emisor'} en Lista Negra SAT (Art. 69-B CFF - {('record' in efosCheck ? efosCheck.record?.situacion : undefined) || 'EFOS'})
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
                  {selectedCfdi.tipoComprobante === 'P' ? 'REP 2.0 Pago' : `${selectedCfdi.direction} (${selectedCfdi.metodoPago})`}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Base / Subtotal</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums">{formatCurrency(selectedCfdi.subtotal)}</div>
              </div>
              <div>
                <div className="text-slate-500">IVA 16%</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums">{formatCurrency(selectedCfdi.ivaTrasladado)}</div>
              </div>
              <div>
                <div className="text-slate-500">Retenciones</div>
                <div className="font-mono font-bold text-red-700 mt-0.5 tabular-nums">
                  -{formatCurrency(selectedCfdi.isrRetenido + selectedCfdi.ivaRetenido)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Total Neto</div>
                <div className="font-mono font-bold text-blue-800 mt-0.5 tabular-nums">{formatCurrency(selectedCfdi.total)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="auto-op-account" className="block text-xs font-semibold text-slate-700 mb-1">
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
                  disabled={isWriteBlocked}
                  onChange={(e) => setOperationAccountCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {affectableAccounts.map((acc) => (
                    <option key={acc.id} value={acc.code}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="auto-counter-account" className="block text-xs font-semibold text-slate-700 mb-1">
                  {selectedCfdi.tipoComprobante === 'P' || selectedCfdi.metodoPago === 'PUE'
                    ? 'Cuenta Bancaria de Flujo'
                    : selectedCfdi.direction === 'EMITIDO'
                    ? 'Cuenta de Cliente (PPD Crédito)'
                    : 'Cuenta de Proveedor (PPD Crédito)'}
                </label>
                <select
                  id="auto-counter-account"
                  value={counterAccountCode}
                  disabled={isWriteBlocked}
                  onChange={(e) => setCounterAccountCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {affectableAccounts.map((acc) => (
                    <option key={acc.id} value={acc.code}>{acc.code} - {acc.name}</option>
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
              disabled={isWriteBlocked}
            />

            <CfdiPolizaPreviewTable
              effectivePreviewMovements={effectivePreviewMovements}
              totalCargos={totalCargos}
              totalAbonos={totalAbonos}
              diffCents={diffCents}
              isBalanced={isBalanced}
            />
          </div>

          <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-end gap-2.5 shrink-0 bg-slate-50/70">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer text-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isWriteBlocked || isCancelled || isPending || isSavingRule || !isBalanced}
              title={
                isWriteBlocked
                  ? 'Edición deshabilitada en periodo bloqueado o solo lectura'
                  : isCancelled
                  ? 'Este CFDI está CANCELADO ante el SAT y no debe contabilizarse.'
                  : !isBalanced
                  ? 'El asiento proyectado no tiene movimientos válidos o está descuadrado'
                  : undefined
              }
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
            >
              {isPending || isSavingRule ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="w-4 h-4" aria-hidden="true" />
              )}
              {isPending || isSavingRule ? 'Generando Póliza...' : 'Confirmar y Generar Póliza'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
