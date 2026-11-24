import { ChevronLeft, ChevronRight, Loader2, Sparkles, Zap } from 'lucide-react';

interface WizardFooterNavProps {
  step: number;
  canProceedStep1: boolean;
  isPending: boolean;
  onPrevStep: () => void;
  onNextStep: () => void;
  onQuickCreate: () => void;
  onSubmitWizard: () => void;
}

export function WizardFooterNav({
  step,
  canProceedStep1,
  isPending,
  onPrevStep,
  onNextStep,
  onQuickCreate,
  onSubmitWizard
}: WizardFooterNavProps) {
  return (
    <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
      <div>
        {step > 1 ? (
          <button
            type="button"
            disabled={isPending}
            title={isPending ? 'Creando empresa, espera un momento...' : undefined}
            onClick={onPrevStep}
            className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            Anterior
          </button>
        ) : (
          <span className="text-[11px] text-slate-600 hidden md:inline">
            Catálogo SAT Anexo 24 incluido automáticamente
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
        {step === 1 && (
          <button
            type="button"
            onClick={onNextStep}
            disabled={!canProceedStep1 || isPending}
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
            disabled={!canProceedStep1 || isPending}
            aria-busy={isPending}
            title={
              !canProceedStep1
                ? 'Completa Razón Social, RFC válido y Código Postal de 5 dígitos'
                : undefined
            }
            onClick={onQuickCreate}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm cursor-pointer"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
            ) : (
              <Zap className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
            )}
            <span>{isPending ? 'Creando...' : 'Crear Empresa Rápido'}</span>
          </button>
        ) : step < 5 ? (
          <button
            type="button"
            disabled={isPending}
            onClick={onNextStep}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
          >
            Siguiente
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            disabled={isPending}
            aria-busy={isPending}
            onClick={onSubmitWizard}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-md cursor-pointer"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{isPending ? 'Creando Empresa...' : '¡Crear Empresa y Comenzar!'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
