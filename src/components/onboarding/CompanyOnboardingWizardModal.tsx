import React from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  X,
  Zap
} from 'lucide-react';
import type { Company } from '../../shared/types';
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
    initialBankBalance,
    setInitialBankBalance,
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
    rfcModulo11,
    canProceedStep1,
    handleCerFileChange,
    handleKeyFileChange,
    createCompanyMutation,
    quickCreateCompany,
    nextStep,
    prevStep
  } = useCompanyOnboardingWizard({
    dialogRef,
    onCompanyCreated
  });

  return (
    <dialog
      ref={dialogRef}
      closedby="closerequest"
      onClose={onClose}
      aria-labelledby="onboarding-wizard-title"
      onCancel={(e) => {
        if (step > 1) {
          e.preventDefault();
          prevStep();
        }
      }}
      className="rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-300 bg-white w-full max-w-2xl overflow-hidden max-h-[90dvh] p-0"
    >
      <div className="flex flex-col max-h-[90dvh]">
        {/* Cabecera con Stepper de Progreso */}
        <div className="bg-[#0A1120] text-white px-4 sm:px-6 py-3 sm:py-3.5 shrink-0 border-b border-slate-800">
          <div className="flex items-center justify-between gap-2 pb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 id="onboarding-wizard-title" className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                  Alta de Nueva Empresa Fiscal
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                  Paso {step} de 5: {step === 1 && 'Identidad SAT (Alta Rápida o con XML)'}
                  {step === 2 && 'Catálogo Contable Anexo 24'}
                  {step === 3 && 'Tesorería y Banco Opcional'}
                  {step === 4 && 'Conexión Fiscal e.firma SAT'}
                  {step === 5 && 'Confirmación y Apertura'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Cerrar asistente"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={5}
            aria-label={`Progreso de alta de empresa: paso ${step} de 5`}
            className="flex items-center justify-between gap-1 pt-0.5"
          >
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} aria-hidden="true" className="flex-1 flex items-center gap-1.5">
                <div
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    s < step
                      ? 'bg-emerald-400'
                      : s === step
                      ? 'bg-blue-500 ring-2 ring-blue-400/30'
                      : 'bg-slate-700'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Cuerpo del Asistente con scroll interno */}
        <div className="p-4 sm:p-6 pb-6 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-3.5 sm:space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 animate-in fade-in"
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
                if (errorMessage?.includes('Módulo 11')) setErrorMessage(null);
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
              initialBankBalance={initialBankBalance}
              setInitialBankBalance={setInitialBankBalance}
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
            />
          )}
        </div>

        {/* Barra de Navegación Inferior con Alta Rápida en Paso 1 */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                Anterior
              </button>
            ) : (
              <span className="text-[11px] text-slate-500 hidden md:inline">
                Catálogo SAT Anexo 24 incluido automáticamente
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
            {step === 1 && (
              <button
                type="button"
                onClick={nextStep}
                disabled={!canProceedStep1 || createCompanyMutation.isPending}
                title={
                  !canProceedStep1
                    ? 'Completa Razón Social, RFC válido y Código Postal de 5 dígitos'
                    : undefined
                }
                className="inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <span className="hidden sm:inline">Configuración Avanzada</span>
                <span className="sm:hidden">Avanzado</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}

            {step === 1 ? (
              <button
                type="button"
                disabled={!canProceedStep1 || createCompanyMutation.isPending}
                aria-busy={createCompanyMutation.isPending}
                title={
                  !canProceedStep1
                    ? 'Completa Razón Social, RFC válido y Código Postal de 5 dígitos'
                    : undefined
                }
                onClick={quickCreateCompany}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                <span>
                  {createCompanyMutation.isPending ? 'Creando...' : 'Crear Empresa Rápido'}
                </span>
              </button>
            ) : step < 5 ? (
              <button
                type="button"
                onClick={nextStep}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 transition shadow-2xs cursor-pointer"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                disabled={createCompanyMutation.isPending}
                aria-busy={createCompanyMutation.isPending}
                onClick={() => createCompanyMutation.mutate('wizard')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-md cursor-pointer"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                {createCompanyMutation.isPending ? 'Creando Empresa...' : '¡Crear Empresa y Comenzar!'}
              </button>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
