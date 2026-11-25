import React, { useMemo } from 'react';
import { Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { AccountPickerCombobox } from '../../components/account-picker/AccountPickerCombobox';
import { AlertBanner, Button, FormField, ModalShell, StatusBadge } from '../../components/ui';
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
  dialogRef,
  selectedCfdi,
  onClose,
  operationAccountCode,
  setOperationAccountCode,
  counterAccountCode,
  setCounterAccountCode,
  affectableAccounts,
  previewMovements,
  isPending,
  isPeriodLocked = false,
  isReadOnlyClient = false,
  onConfirm
}: CfdiContabilizarModalProps) {
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;
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

  const selectedOpAccountId = useMemo(
    () => affectableAccounts.find((a) => a.code === operationAccountCode)?.id ?? '',
    [affectableAccounts, operationAccountCode]
  );

  const selectedCounterAccountId = useMemo(
    () => affectableAccounts.find((a) => a.code === counterAccountCode)?.id ?? '',
    [affectableAccounts, counterAccountCode]
  );

  const totalCargos = effectivePreviewMovements.reduce((acc, m) => acc + (m.cargo || 0), 0);
  const totalAbonos = effectivePreviewMovements.reduce((acc, m) => acc + (m.abono || 0), 0);
  const diffCents = Math.abs(Math.round(totalCargos * 100) - Math.round(totalAbonos * 100));
  const isBalanced = effectivePreviewMovements.length > 0 && diffCents === 0;
  const isCancelled = selectedCfdi?.statusSat === 'CANCELADO';
  const counterpartyRfc = selectedCfdi
    ? selectedCfdi.direction === 'EMITIDO'
      ? selectedCfdi.receptorRfc
      : selectedCfdi.emisorRfc
    : '';
  const efosCheck = counterpartyRfc ? checkRfc69BStatus(counterpartyRfc) : { isEfos: false };
  const folioDisplay = selectedCfdi
    ? [selectedCfdi.serie, selectedCfdi.folio].filter(Boolean).join('-') || 'S/F'
    : 'S/F';

  const handleClose = () => {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    } else {
      onClose();
    }
  };

  const opLabel = !selectedCfdi
    ? 'Cuenta de Operación'
    : selectedCfdi.tipoComprobante === 'P'
    ? selectedCfdi.direction === 'EMITIDO'
      ? 'Cuenta de Cliente que se Liquida (Abono)'
      : 'Cuenta de Proveedor que se Liquida (Cargo)'
    : selectedCfdi.direction === 'EMITIDO'
    ? 'Cuenta de Ingresos (Abono Subtotal)'
    : 'Cuenta de Costo o Gasto (Cargo Subtotal)';

  const counterLabel = !selectedCfdi
    ? 'Contracuenta'
    : selectedCfdi.tipoComprobante === 'P' || selectedCfdi.metodoPago === 'PUE'
    ? 'Cuenta Bancaria de Flujo'
    : selectedCfdi.direction === 'EMITIDO'
    ? 'Cuenta de Cliente (PPD Crédito)'
    : 'Cuenta de Proveedor (PPD Crédito)';

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={Boolean(selectedCfdi)}
      onClose={handleClose}
      maxWidth="3xl"
      titleId="modal-contabilizar-title"
      icon={<Sparkles className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      title="Contabilizador Automático CFDI 4.0 → Póliza"
      subtitle={
        selectedCfdi ? (
          <span className="font-mono break-all">
            {folioDisplay} (Tipo {selectedCfdi.tipoComprobante}) • UUID: {selectedCfdi.uuid}
          </span>
        ) : undefined
      }
      busy={isPending || isSavingRule}
      closeLabel="Cerrar asistente"
      bodyClassName="space-y-3.5 scrollable-panel"
      footer={
        selectedCfdi ? (
          <>
            <Button variant="secondary" size="md" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="cfdi-contabilizar-form"
              variant="primary"
              size="md"
              loading={isPending || isSavingRule}
              disabled={
                isWriteBlocked || isCancelled || isPending || isSavingRule || !isBalanced
              }
              title={
                isWriteBlocked
                  ? 'Edición deshabilitada en periodo bloqueado o solo lectura'
                  : isCancelled
                  ? 'Este CFDI está CANCELADO ante el SAT y no debe contabilizarse.'
                  : !isBalanced
                  ? 'El asiento proyectado no tiene movimientos válidos o está descuadrado'
                  : undefined
              }
              leftIcon={
                isPending || isSavingRule ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                )
              }
            >
              {isPending || isSavingRule ? 'Generando Póliza...' : 'Confirmar y Generar Póliza'}
            </Button>
          </>
        ) : undefined
      }
    >
      {selectedCfdi && (
        <form
          id="cfdi-contabilizar-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (isWriteBlocked || isCancelled || isPending || isSavingRule || !isBalanced) return;
            await saveLearnedRuleIfEnabled();
            onConfirm({ deductiblePct });
          }}
          className="space-y-3.5"
        >
          {isCancelled && (
            <AlertBanner
              tone="danger"
              icon={<ShieldAlert className="w-4 h-4" aria-hidden="true" />}
              title="Comprobante Cancelado ante el SAT"
            >
              Este CFDI está CANCELADO ante el SAT y no debe contabilizarse.
            </AlertBanner>
          )}

          {efosCheck.isEfos && (
            <AlertBanner
              tone="danger"
              icon={<ShieldAlert className="w-4 h-4" aria-hidden="true" />}
              title={`${selectedCfdi.direction === 'EMITIDO' ? 'Receptor' : 'Emisor'} en Lista Negra SAT (Art. 69-B CFF - ${
                ('record' in efosCheck ? efosCheck.record?.situacion : undefined) || 'EFOS'
              })`}
            >
              El RFC <strong>{counterpartyRfc}</strong> está catalogado como EFOS por la autoridad
              fiscal. Los comprobantes fiscales presuntamente no producen efectos deducibles ni
              acreditables.
            </AlertBanner>
          )}

          {selectedCfdi.tipoComprobante === 'P' && (
            <AlertBanner tone="blue" title="REP 2.0 (Complemento de Pago):">
              este asiento liquida el saldo pendiente PPD y reclasifica el IVA efectivamente
              pagado/cobrado del periodo.
            </AlertBanner>
          )}

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div>
              <div className="text-slate-500">Tipo CFDI</div>
              <div className="font-bold text-slate-900 mt-0.5 flex flex-wrap items-center gap-1">
                <span>
                  {selectedCfdi.tipoComprobante === 'P'
                    ? 'REP 2.0 Pago'
                    : `${selectedCfdi.direction} (${selectedCfdi.metodoPago})`}
                </span>
                {selectedCfdi.moneda && selectedCfdi.moneda.toUpperCase() !== 'MXN' && (
                  <StatusBadge tone="blue" shape="tag" className="font-mono">
                    {selectedCfdi.moneda.toUpperCase()} · TC {(selectedCfdi.tipoCambio || 1).toFixed(4)}
                  </StatusBadge>
                )}
                {selectedCfdi.isForeignNoCfdi && (
                  <StatusBadge tone="purple" shape="tag">
                    Sin CFDI
                  </StatusBadge>
                )}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Base / Subtotal</div>
              <div className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
                {formatCurrency(selectedCfdi.subtotal)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">IVA Trasladado</div>
              <div className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
                {formatCurrency(selectedCfdi.ivaTrasladado)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Retenciones</div>
              <div className="font-mono font-bold text-red-700 mt-0.5 tabular-nums">
                -{formatCurrency(selectedCfdi.isrRetenido + selectedCfdi.ivaRetenido)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Total Neto</div>
              <div className="font-mono font-bold text-blue-800 mt-0.5 tabular-nums">
                {formatCurrency(selectedCfdi.total)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={opLabel} htmlFor="auto-op-account">
              <div className={isWriteBlocked ? 'pointer-events-none opacity-60' : ''}>
                <AccountPickerCombobox
                  accounts={affectableAccounts}
                  value={selectedOpAccountId}
                  ariaLabel={opLabel}
                  onChange={(accountId) => {
                    if (isWriteBlocked) return;
                    const found = affectableAccounts.find((a) => a.id === accountId);
                    if (found) setOperationAccountCode(found.code);
                  }}
                />
              </div>
            </FormField>

            <FormField label={counterLabel} htmlFor="auto-counter-account">
              <div className={isWriteBlocked ? 'pointer-events-none opacity-60' : ''}>
                <AccountPickerCombobox
                  accounts={affectableAccounts}
                  value={selectedCounterAccountId}
                  ariaLabel={counterLabel}
                  onChange={(accountId) => {
                    if (isWriteBlocked) return;
                    const found = affectableAccounts.find((a) => a.id === accountId);
                    if (found) setCounterAccountCode(found.code);
                  }}
                />
              </div>
            </FormField>
          </div>

          {selectedCfdi.tipoComprobante !== 'P' && (
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
          )}

          <CfdiPolizaPreviewTable
            effectivePreviewMovements={effectivePreviewMovements}
            totalCargos={totalCargos}
            totalAbonos={totalAbonos}
            diffCents={diffCents}
            isBalanced={isBalanced}
          />
        </form>
      )}
    </ModalShell>
  );
}
