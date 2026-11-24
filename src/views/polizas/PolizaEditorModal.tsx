import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import type { DraftMovement, PolizaEditorModalProps } from './poliza-editor.types';
import { createPolizaSnapshot, isPolizaSnapshotDirty } from './polizaDirtyCheck';
import { PolizaEditorFooter } from './PolizaEditorFooter';
import { PolizaEditorHeader } from './PolizaEditorHeader';
import { PolizaEditorTitleBar } from './PolizaEditorTitleBar';
import { PolizaMovementsTable } from './PolizaMovementsTable';
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
  cfdiUuids,
  pendingCfdis,
  allCfdis,
  handleSelectCfdiForForm,
  handleAddCfdiUuid,
  handleRemoveCfdiUuid,
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
  onUseActivePeriodDate,
  editorSessionId = 0,
  initialSnapshot = null,
  isPendingSave,
  onSave
}: PolizaEditorModalProps) {
  const conceptoInputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const accountRefs = useRef<(HTMLInputElement | null)[]>([]);
  const referenciaRefs = useRef<(HTMLInputElement | null)[]>([]);
  const conceptoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cargoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const abonoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    setConfirmDiscard(false);
  }, [editorSessionId, editingPolizaId]);

  const computeIsDirty = () => {
    const currentSnap = createPolizaSnapshot({
      tipo,
      fecha,
      concepto,
      cfdiUuids: cfdiUuids.length > 0 ? cfdiUuids : cfdiUuid ? [cfdiUuid] : [],
      movements
    });
    return isPolizaSnapshotDirty(initialSnapshot, currentSnap);
  };

  const handleSafeClose = () => {
    if (confirmDiscard) {
      setConfirmDiscard(false);
      return;
    }
    if (computeIsDirty()) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    dialogRef.current?.close();
  };

  useDialogLightDismiss(dialogRef, handleSafeClose, { deferClose: true });

  return createPortal(
    <dialog
      ref={dialogRef}
      closedby="closerequest"
      onCancel={(e) => {
        e.preventDefault();
        if (confirmDiscard) {
          setConfirmDiscard(false);
          return;
        }
        handleSafeClose();
      }}
      aria-labelledby="modal-poliza-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-[calc(100vw-1rem)] sm:w-full max-w-5xl min-w-0 max-h-[92dvh] open:flex open:flex-col overflow-hidden backdrop:bg-slate-900/60 p-0 m-auto"
    >
      <div
        onKeyDown={(e) => {
          if (e.key === 'Escape' && confirmDiscard) {
            e.preventDefault();
            e.stopPropagation();
            setConfirmDiscard(false);
            return;
          }
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (isBalanced && !isPendingSave && !isPeriodLocked) {
              e.preventDefault();
              setConfirmDiscard(false);
              onSave();
            }
          } else if (e.altKey && !editingPolizaId) {
            if (e.key === '1') {
              e.preventDefault();
              e.stopPropagation();
              applyQuickTemplate('GASTO_16');
            } else if (e.key === '2') {
              e.preventDefault();
              e.stopPropagation();
              applyQuickTemplate('VENTA_PPD');
            } else if (e.key === '3') {
              e.preventDefault();
              e.stopPropagation();
              applyQuickTemplate('PAGO_IMPUESTOS');
            }
          }
        }}
        className="w-full min-w-0 max-w-full max-h-[92dvh] min-h-0 grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden overflow-x-hidden"
      >
        <PolizaEditorTitleBar
          editingPolizaId={editingPolizaId}
          activeCompany={activeCompany}
          currentYear={currentYear}
          currentPeriod={currentPeriod}
          isPeriodLocked={isPeriodLocked}
          predictedNextFolio={predictedNextFolio}
          tipo={tipo}
          onClose={handleSafeClose}
        />

        <div className="p-3 sm:p-4 overflow-y-auto overflow-x-hidden overscroll-contain flex-1 min-h-0 min-w-0 w-full max-w-full scrollable-panel space-y-3">
          <PolizaEditorHeader
            editingPolizaId={editingPolizaId}
            currentYear={currentYear}
            currentPeriod={currentPeriod}
            isPeriodLocked={isPeriodLocked}
            tipo={tipo}
            setTipo={setTipo}
            fecha={fecha}
            setFecha={setFecha}
            concepto={concepto}
            setConcepto={setConcepto}
            conceptoInputRef={conceptoInputRef}
            onConceptoEnter={() => {
              accountRefs.current[0]?.focus();
              accountRefs.current[0]?.select();
            }}
            cfdiUuids={cfdiUuids}
            pendingCfdis={pendingCfdis}
            allCfdis={allCfdis}
            handleSelectCfdiForForm={handleSelectCfdiForForm}
            handleAddCfdiUuid={handleAddCfdiUuid}
            handleRemoveCfdiUuid={handleRemoveCfdiUuid}
            formError={formError}
            isDateDifferentPeriod={isDateDifferentPeriod}
            onUseActivePeriodDate={onUseActivePeriodDate}
            applyQuickTemplate={applyQuickTemplate}
          />

          <form
            id="poliza-form"
            method="post"
            className="w-full min-w-0 max-w-full"
            onSubmit={(e) => {
              e.preventDefault();
              setConfirmDiscard(false);
              setFormError(null);
              onSave();
            }}
          >
            <PolizaMovementsTable
              movements={movements}
              setMovements={setMovements}
              accounts={accounts}
              affectableAccounts={affectableAccounts}
              cfdiUuids={cfdiUuids}
              allCfdis={allCfdis}
              concepto={concepto}
              difference={difference}
              totalCargos={totalCargos}
              totalAbonos={totalAbonos}
              accountRefs={accountRefs}
              referenciaRefs={referenciaRefs}
              conceptoRefs={conceptoRefs}
              cargoRefs={cargoRefs}
              abonoRefs={abonoRefs}
              addIva16Line={addIva16Line}
              autoBalanceDifference={autoBalanceDifference}
              applyBalanceToRow={applyBalanceToRow}
              onLastRowSubmitFocus={() => submitButtonRef.current?.focus()}
            />
          </form>
        </div>

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
          confirmDiscard={confirmDiscard}
          onCancelDiscard={() => setConfirmDiscard(false)}
          onConfirmDiscard={() => {
            setConfirmDiscard(false);
            dialogRef.current?.close();
          }}
          onCancel={handleSafeClose}
        />
      </div>
    </dialog>,
    document.body
  );
}
