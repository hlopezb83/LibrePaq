import { useEffect, useRef, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { ModalShell } from '../../components/ui';
import type { DraftMovement, PolizaEditorModalProps } from './poliza-editor.types';
import { createPolizaSnapshot, isPolizaSnapshotDirty } from './polizaDirtyCheck';
import { PolizaEditorFooter } from './PolizaEditorFooter';
import { PolizaEditorHeader } from './PolizaEditorHeader';
import {
  PolizaEditorSubtitle,
  PolizaEditorTitle,
  PolizaShortcutsPopover
} from './PolizaEditorTitleBar';
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
  businessSegments = [],
  polizaTemplates = [],
  applyQuickTemplate,
  applySavedTemplate,
  onSaveAsTemplate,
  isSavingTemplate = false,
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleKeyDown = (e: KeyboardEvent) => {
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
    };
    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [
    dialogRef,
    confirmDiscard,
    isBalanced,
    isPendingSave,
    isPeriodLocked,
    editingPolizaId,
    onSave,
    applyQuickTemplate
  ]);

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={Boolean(editorSessionId > 0 || editingPolizaId)}
      onClose={handleSafeClose}
      titleId="modal-poliza-title"
      title={
        <PolizaEditorTitle
          editingPolizaId={editingPolizaId}
          isPeriodLocked={isPeriodLocked}
          predictedNextFolio={predictedNextFolio}
          tipo={tipo}
        />
      }
      subtitle={
        <PolizaEditorSubtitle
          activeCompany={activeCompany}
          currentYear={currentYear}
          currentPeriod={currentPeriod}
        />
      }
      icon={<ReceiptText className="w-4 h-4" aria-hidden="true" />}
      iconTone="blue"
      maxWidth="5xl"
      busy={isPendingSave}
      deferClose={true}
      closeLabel="Cerrar captura de póliza"
      usePortal={true}
      headerExtra={<PolizaShortcutsPopover editingPolizaId={editingPolizaId} />}
      bodyClassName="p-3! sm:p-4! space-y-3 overflow-x-hidden scrollable-panel"
      footerJustify="between"
      footer={
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
          onSaveAsTemplate={onSaveAsTemplate}
          isSavingTemplate={isSavingTemplate}
          confirmDiscard={confirmDiscard}
          onCancelDiscard={() => setConfirmDiscard(false)}
          onConfirmDiscard={() => {
            setConfirmDiscard(false);
            dialogRef.current?.close();
          }}
          onCancel={handleSafeClose}
        />
      }
    >
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
        polizaTemplates={polizaTemplates}
        applySavedTemplate={applySavedTemplate}
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
          businessSegments={businessSegments}
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
    </ModalShell>
  );
}
