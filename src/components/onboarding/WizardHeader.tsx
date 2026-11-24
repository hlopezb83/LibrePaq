import { Sparkles, X } from 'lucide-react';

interface WizardHeaderProps {
  step: number;
  onRequestClose: () => void;
  onGoToStep: (step: number) => void;
}

export function WizardHeader({ step, onRequestClose, onGoToStep }: WizardHeaderProps) {
  return (
    <div className="dark-surface bg-[#0A1120] text-white px-4 sm:px-6 py-3 sm:py-3.5 shrink-0 border-b border-slate-800">
      <div className="flex items-center justify-between gap-2 pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="onboarding-wizard-title" className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
              Alta de Nueva Empresa Fiscal
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-300 truncate">
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
          onClick={onRequestClose}
          aria-label="Cerrar asistente"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
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
        className="flex items-center justify-between gap-1.5 pt-0.5"
      >
        {[1, 2, 3, 4, 5].map((s) => {
          const isCompleted = s < step;
          const isCurrent = s === step;
          return (
            <button
              key={s}
              type="button"
              disabled={!isCompleted}
              onClick={() => onGoToStep(s)}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={isCompleted ? `Volver al paso ${s}` : `Paso ${s}`}
              title={isCompleted ? `Volver al paso ${s}` : undefined}
              className={`flex-1 py-1 group ${isCompleted ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span
                className={`block h-1.5 w-full rounded-full transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-400 group-hover:bg-emerald-300'
                    : isCurrent
                    ? 'bg-blue-500 ring-2 ring-blue-400/30'
                    : 'bg-slate-700'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
