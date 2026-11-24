import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Company } from '../../shared/types';
import { AlertBanner, Button, ModalShell } from '../ui';
import { WIZARD_STEP_SUBTITLES, WizardHeader } from './WizardHeader';
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
    step, personType, setPersonType, name, setName, rfc, setRfc,
    codigoPostal, setCodigoPostal, regimenFiscal, setRegimenFiscal,
    currentYear, setCurrentYear, currentPeriod, setCurrentPeriod,
    catalogPreset, setCatalogPreset, initialBankName, setInitialBankName,
    initialBankAccount, setInitialBankAccount, initialBankBalanceDraft, setInitialBankBalanceDraft,
    initialBankBalance, createOpeningEntry, setCreateOpeningEntry,
    skipFiel, setSkipFiel, fielCerName, fielKeyName, fielPassword, setFielPassword,
    xmlCandidates, activeXmlRole, handleXmlAutofill, handleFileAutofill, applyXmlCandidate,
    errorMessage, setErrorMessage, showModulo11Breakdown, setShowModulo11Breakdown,
    setBypassRfcCheckDigit, isRfcValid, isDirty, rfcModulo11, canProceedStep1,
    handleCerFileChange, handleKeyFileChange, handleFielDrop,
    createCompanyMutation, quickCreateCompany, nextStep, prevStep, goToStep
  } = useCompanyOnboardingWizard({ dialogRef, onCompanyCreated });

  const errorAlertRef = useRef<HTMLDivElement>(null);
  const confirmDiscardRef = useRef<HTMLDivElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const scrollBodyTop = () => {
    dialogRef.current?.querySelector('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'auto' });
  };

  useEffect(() => {
    scrollBodyTop();
  }, [step]);

  useEffect(() => {
    if (!errorMessage) return;
    scrollBodyTop();
    requestAnimationFrame(() => errorAlertRef.current?.focus());
  }, [errorMessage]);

  useEffect(() => {
    if (!confirmDiscard) return;
    scrollBodyTop();
    requestAnimationFrame(() => confirmDiscardRef.current?.focus());
  }, [confirmDiscard]);

  const forceClose = () => {
    setConfirmDiscard(false);
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose?.();
  };

  const handleRequestClose = () => {
    if (createCompanyMutation.isPending) return;
    if (isDirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    forceClose();
  };

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={true}
      onClose={handleRequestClose}
      deferClose={Boolean(isDirty && !confirmDiscard)}
      busy={createCompanyMutation.isPending}
      noPrint
      maxWidth="2xl"
      titleId="onboarding-wizard-title"
      closeLabel="Cerrar asistente"
      icon={<Sparkles className="w-4 h-4" aria-hidden="true" />}
      iconTone="blue"
      title="Alta de Nueva Empresa Fiscal"
      subtitle={WIZARD_STEP_SUBTITLES[step] ?? 'Asistente de configuración'}
      headerTabs={<WizardHeader step={step} onGoToStep={goToStep} />}
      bodyClassName="sm:p-6 space-y-3.5 sm:space-y-4"
      footer={
        <WizardFooterNav
          step={step}
          canProceedStep1={canProceedStep1}
          isPending={createCompanyMutation.isPending}
          onPrevStep={prevStep}
          onNextStep={nextStep}
          onQuickCreate={quickCreateCompany}
          onSubmitWizard={() => createCompanyMutation.mutate('wizard')}
        />
      }
    >
      {confirmDiscard && (
        <div ref={confirmDiscardRef} tabIndex={-1} className="focus:outline-none">
          <AlertBanner
            tone="warning"
            action={
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirmDiscard(false)}>
                  Seguir editando
                </Button>
                <Button variant="danger" size="sm" onClick={forceClose}>
                  Descartar y cerrar
                </Button>
              </div>
            }
          >
            <span className="font-semibold">
              Tienes datos capturados sin guardar. ¿Deseas descartarlos y cerrar?
            </span>
          </AlertBanner>
        </div>
      )}

      {errorMessage && (
        <div ref={errorAlertRef} tabIndex={-1} className="focus:outline-none">
          <AlertBanner tone="danger">
            <span className="font-semibold">{errorMessage}</span>
          </AlertBanner>
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
    </ModalShell>
  );
}
