import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { PolizaEditorHeader } from './PolizaEditorHeader';
import { PolizaMovementsTable } from './PolizaMovementsTable';
import { PolizaEditorFooter } from './PolizaEditorFooter';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import type { DraftMovement, PolizaEditorModalProps } from './poliza-editor.types';
export type { DraftMovement, PolizaEditorModalProps };

export function PolizaEditorModal({
  dialogRef,
  editingPolizaId,
  activeCompany,
  currentYear,
  currentPeriod,
  isPeriodLocked,
  predictedNextFolio,
  tipo,
  setTipo,
  fecha,
  setFecha,
  concepto,
  setConcepto,
  cfdiUuid,
  pendingCfdis,
  handleSelectCfdiForForm,
  formError,
  setFormError,
  movements,
  setMovements,
  accounts,
  affectableAccounts,
  applyQuickTemplate,
  addIva16Line,
  autoBalanceDifference,
  applyBalanceToRow,
  totalCargos,
  totalAbonos,
  difference,
  isBalanced,
  isDateDifferentPeriod,
  isPendingSave,
  onSave
}: PolizaEditorModalProps) {
  const conceptoInputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const referenciaRefs = useRef<(HTMLInputElement | null)[]>([]);
  const conceptoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cargoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const abonoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const handleSafeClose = () => {
    const isDirty = (totalCargos > 0 || totalAbonos > 0 || concepto.trim().length > 0) && !editingPolizaId;
    if (isDirty) {
      const ok = window.confirm('¿Descartar el borrador de la póliza? Se perderán los renglones capturados.');
      if (!ok) return;
    }
    dialogRef.current?.close();
  };

  useDialogLightDismiss(dialogRef, handleSafeClose);

  return createPortal(
    <dialog
      ref={dialogRef}
      closedby="closerequest"
      aria-labelledby="modal-poliza-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-5xl overflow-hidden backdrop:bg-slate-900/60"
    >
      <div className="p-4 sm:p-5 max-h-[88dvh] scrollable-panel space-y-3.5">
        <PolizaEditorHeader
          editingPolizaId={editingPolizaId}
          activeCompany={activeCompany}
          currentYear={currentYear}
          currentPeriod={currentPeriod}
          isPeriodLocked={isPeriodLocked}
          predictedNextFolio={predictedNextFolio}
          tipo={tipo}
          setTipo={setTipo}
          fecha={fecha}
          setFecha={setFecha}
          concepto={concepto}
          setConcepto={setConcepto}
          conceptoInputRef={conceptoInputRef}
          onConceptoEnter={() => {
            referenciaRefs.current[0]?.focus();
            referenciaRefs.current[0]?.select();
          }}
          cfdiUuid={cfdiUuid}
          pendingCfdis={pendingCfdis}
          handleSelectCfdiForForm={handleSelectCfdiForForm}
          formError={formError}
          isDateDifferentPeriod={isDateDifferentPeriod}
          applyQuickTemplate={applyQuickTemplate}
          onClose={handleSafeClose}
        />

        <form
          id="poliza-form"
          method="post"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              if (isBalanced && !isPendingSave && !isPeriodLocked) {
                e.preventDefault();
                onSave();
              }
            } else if (e.altKey && !editingPolizaId) {
              if (e.key === '1') {
                e.preventDefault();
                applyQuickTemplate('GASTO_16');
              } else if (e.key === '2') {
                e.preventDefault();
                applyQuickTemplate('VENTA_PPD');
              } else if (e.key === '3') {
                e.preventDefault();
                applyQuickTemplate('PAGO_IMPUESTOS');
              }
            }
          }}
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            onSave();
          }}
          className="space-y-4"
        >
          <PolizaMovementsTable
            movements={movements}
            setMovements={setMovements}
            accounts={accounts}
            affectableAccounts={affectableAccounts}
            concepto={concepto}
            difference={difference}
            totalCargos={totalCargos}
            totalAbonos={totalAbonos}
            referenciaRefs={referenciaRefs}
            conceptoRefs={conceptoRefs}
            cargoRefs={cargoRefs}
            abonoRefs={abonoRefs}
            addIva16Line={addIva16Line}
            autoBalanceDifference={autoBalanceDifference}
            applyBalanceToRow={applyBalanceToRow}
            onLastRowSubmitFocus={() => submitButtonRef.current?.focus()}
          />

          <PolizaEditorFooter
            isBalanced={isBalanced}
            totalCargos={totalCargos}
            totalAbonos={totalAbonos}
            difference={difference}
            isPendingSave={isPendingSave}
            isPeriodLocked={isPeriodLocked}
            editingPolizaId={editingPolizaId}
            submitButtonRef={submitButtonRef}
            autoBalanceDifference={autoBalanceDifference}
            onCancel={() => dialogRef.current?.close()}
          />
        </form>
      </div>
    </dialog>,
    document.body
  );
}
