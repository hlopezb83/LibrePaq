import { ChevronLeft, ChevronRight, Sparkles, Zap } from 'lucide-react';
import { Button } from '../ui';

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
    <div className="w-full flex flex-wrap items-center justify-between gap-2">
      <div>
        {step > 1 ? (
          <Button
            variant="secondary"
            disabled={isPending}
            title={isPending ? 'Creando empresa, espera un momento...' : undefined}
            leftIcon={<ChevronLeft className="w-4 h-4" aria-hidden="true" />}
            onClick={onPrevStep}
          >
            Anterior
          </Button>
        ) : (
          <span className="text-[11px] text-slate-600 hidden md:inline">
            Catálogo SAT Anexo 24 incluido automáticamente
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {step === 1 && (
          <Button
            variant="secondary"
            onClick={onNextStep}
            disabled={!canProceedStep1 || isPending}
            title={
              !canProceedStep1
                ? 'Completa Razón Social, RFC válido y Código Postal de 5 dígitos'
                : undefined
            }
            rightIcon={<ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            <span className="hidden sm:inline">Configuración Avanzada</span>
            <span className="sm:hidden">Avanzado</span>
          </Button>
        )}

        {step === 1 ? (
          <Button
            variant="primary"
            loading={isPending}
            disabled={!canProceedStep1}
            title={
              !canProceedStep1
                ? 'Completa Razón Social, RFC válido y Código Postal de 5 dígitos'
                : undefined
            }
            leftIcon={!isPending ? <Zap className="w-3.5 h-3.5 fill-current" aria-hidden="true" /> : undefined}
            onClick={onQuickCreate}
          >
            {isPending ? 'Creando...' : 'Crear Empresa Rápido'}
          </Button>
        ) : step < 5 ? (
          <Button
            variant="primary"
            disabled={isPending}
            rightIcon={<ChevronRight className="w-4 h-4" aria-hidden="true" />}
            onClick={onNextStep}
          >
            Siguiente
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            loading={isPending}
            leftIcon={!isPending ? <Sparkles className="w-4 h-4" aria-hidden="true" /> : undefined}
            onClick={onSubmitWizard}
          >
            {isPending ? 'Creando Empresa...' : '¡Crear Empresa y Comenzar!'}
          </Button>
        )}
      </div>
    </div>
  );
}
