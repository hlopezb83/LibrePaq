import React, { useEffect, useRef, useState } from 'react';
import type { Company } from '../../shared/types';
import { WizardHeader } from './WizardHeader';
import { WizardFooterNav } from './WizardFooterNav';
import { WizardStep1Identity } from './WizardStep1Identity';
import { WizardStep2Catalog } from './WizardStep2Catalog';
import { WizardStep3Banking } from './WizardStep3Banking';
import { WizardStep4Fiel } from './WizardStep4Fiel';
import { WizardStep5Review } from './WizardStep5Review';
import { useCompanyOnboardingWizard } from './useCompanyOnboardingWizard';

interface CompanyOnboardingWizardModalProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  onClose?: () => void;
  onCompanyCreated: (companyId: string, company?: Company) => void;
}

export function CompanyOnboardingWizardModal({
  dialogRef,
  onClose,
  onCompanyCreated
}: CompanyOnboardingWizardModalProps) {
  const {
    step,
    personType,
    setPersonType,
    name,
    setName,
    rfc,
    setRfc,
    codigoPostal,
    setCodigoPostal,
    regimenFiscal,
    setRegimenFiscal,
    currentYear,
    setCurrentYear,
    currentPeriod,
    setCurrentPeriod,
    catalogPreset,
    setCatalogPreset,
    initialBankName,
    setInitialBankName,
    initialBankAccount,
    setInitialBankAccount,
    initialBankBalanceDraft,
    setInitialBankBalanceDraft,
    initialBankBalance,
    createOpeningEntry,
    setCreateOpeningEntry,
    skipFiel,
    setSkipFiel,
    fielCerName,
    fielKeyName,
    fielPassword,
    setFielPassword,
    xmlCandidates,
    activeXmlRole,
    handleXmlAutofill,
    handleFileAutofill,
    applyXmlCandidate,
    errorMessage,
    setErrorMessage,
    showModulo11Breakdown,
    setShowModulo11Breakdown,
    setBypassRfcCheckDigit,
    isRfcValid,
    isDirty,
    rfcModulo11,
    canProceedStep1,
    handleCerFileChange,
    handleKeyFileChange,
    handleFielDrop,
    createCompanyMutation,
    quickCreateCompany,
    nextStep,
    prevStep,
    goToStep
  } = useCompanyOnboardingWizard({
    dialogRef,
    onCompanyCreated
  });

  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const errorAlertRef = useRef<HTMLDivElement>(null);
  const confirmDiscardRef = useRef<HTMLDivElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [step]);

  useEffect(() => {
    if (!errorMessage) return;
    bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    requestAnimationFrame(() => errorAlertRef.current?.focus());
  }, [errorMessage]);

  useEffect(() => {
    if (!confirmDiscard) return;
    bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    requestAnimationFrame(() => confirmDiscardRef.current?.focus());
  }, [confirmDiscard]);

  const handleRequestClose = () => {
    if (isDirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="closerequest"
      onClose={() => {
        setConfirmDiscard(false);
        onClose?.();
      }}
      aria-labelledby="onboarding-wizard-title"
      onCancel={(e) => {
        if (step > 1) {
          e.preventDefault();
          prevStep();
          return;
        }
        if (isDirty && !confirmDiscard) {
          e.preventDefault();
          setConfirmDiscard(true);
        }
      }}
      className="no-print rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-300 bg-white w-full max-w-2xl overflow-hidden max-h-[92dvh] p-0"
    >
      <div className="flex flex-col max-h-[92dvh]">
        <WizardHeader
          step={step}
          onRequestClose={handleRequestClose}
          onGoToStep={goToStep}
        />

        {/* Cuerpo del Asistente con scroll interno */}
        <div
          ref={bodyScrollRef}
          className="p-4 sm:p-6 pb-6 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-3.5 sm:space-y-4"
        >
          {confirmDiscard && (
            <div
              ref={confirmDiscardRef}
              tabIndex={-1}
              role="alert"
              className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2 focus:outline-2 focus:outline-amber-700"
            >
              <span className="font-semibold">
                Tienes datos capturados sin guardar. ¿Deseas descartarlos y cerrar?
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 font-semibold text-slate-700 cursor-pointer"
                >
                  Seguir editando
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDiscard(false);
                    dialogRef.current?.close();
                  }}
                  className="px-3 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold cursor-pointer"
                >
                  Descartar y cerrar
                </button>
              </div>
            </div>
          )}

          {errorMessage && (
            <div
              ref={errorAlertRef}
              tabIndex={-1}
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 animate-in fade-in focus:outline-2 focus:outline-red-700"
            >
              {errorMessage}
            </div>
          )}

          {step === 1 && (
            <WizardStep1Identity
              personType={personType}
              setPersonType={setPersonType}
              name={name}
              setName={setName}
              rfc={rfc}
              setRfc={setRfc}
              codigoPostal={codigoPostal}
              setCodigoPostal={setCodigoPostal}
              regimenFiscal={regimenFiscal}
              setRegimenFiscal={setRegimenFiscal}
              currentYear={currentYear}
              setCurrentYear={setCurrentYear}
              currentPeriod={currentPeriod}
              setCurrentPeriod={setCurrentPeriod}
              isRfcValid={isRfcValid}
              rfcModulo11={rfcModulo11}
              showModulo11Breakdown={showModulo11Breakdown}
              setShowModulo11Breakdown={setShowModulo11Breakdown}
              setBypassRfcCheckDigit={setBypassRfcCheckDigit}
              onClearModulo11Error={() => {
                if (errorMessage?.includes('Módulo 11') || errorMessage?.includes('verificador')) {
                  setErrorMessage(null);
                }
              }}
              xmlCandidates={xmlCandidates}
              activeXmlRole={activeXmlRole}
              onXmlLoaded={handleXmlAutofill}
              onFileLoaded={handleFileAutofill}
              onSelectXmlCandidate={applyXmlCandidate}
            />
          )}

          {step === 2 && (
            <WizardStep2Catalog
              catalogPreset={catalogPreset}
              setCatalogPreset={setCatalogPreset}
            />
          )}

          {step === 3 && (
            <WizardStep3Banking
              initialBankName={initialBankName}
              setInitialBankName={setInitialBankName}
              initialBankAccount={initialBankAccount}
              setInitialBankAccount={setInitialBankAccount}
              initialBankBalanceDraft={initialBankBalanceDraft}
              setInitialBankBalanceDraft={setInitialBankBalanceDraft}
              initialBankBalance={initialBankBalance}
              createOpeningEntry={createOpeningEntry}
              setCreateOpeningEntry={setCreateOpeningEntry}
            />
          )}

          {step === 4 && (
            <WizardStep4Fiel
              skipFiel={skipFiel}
              setSkipFiel={setSkipFiel}
              fielCerName={fielCerName}
              fielKeyName={fielKeyName}
              fielPassword={fielPassword}
              setFielPassword={setFielPassword}
              onCerFileChange={handleCerFileChange}
              onKeyFileChange={handleKeyFileChange}
              onFielDrop={handleFielDrop}
            />
          )}

          {step === 5 && (
            <WizardStep5Review
              name={name}
              rfc={rfc}
              regimenFiscal={regimenFiscal}
              codigoPostal={codigoPostal}
              currentYear={currentYear}
              currentPeriod={currentPeriod}
              catalogPreset={catalogPreset}
              initialBankName={initialBankName}
              initialBankBalance={initialBankBalance}
              createOpeningEntry={createOpeningEntry}
              skipFiel={skipFiel}
              fielCerName={fielCerName}
              fielKeyName={fielKeyName}
            />
          )}
        </div>

        <WizardFooterNav
          step={step}
          canProceedStep1={canProceedStep1}
          isPending={createCompanyMutation.isPending}
          onPrevStep={prevStep}
          onNextStep={nextStep}
          onQuickCreate={quickCreateCompany}
          onSubmitWizard={() => createCompanyMutation.mutate('wizard')}
        />
      </div>
    </dialog>
  );
}
