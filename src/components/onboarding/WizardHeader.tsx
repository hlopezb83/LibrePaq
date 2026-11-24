interface WizardStepProgressProps {
  step: number;
  onGoToStep: (step: number) => void;
}

export const WIZARD_STEP_SUBTITLES: Record<number, string> = {
  1: 'Paso 1 de 5: Identidad SAT (Alta Rápida o con XML)',
  2: 'Paso 2 de 5: Catálogo Contable Anexo 24',
  3: 'Paso 3 de 5: Tesorería y Banco Opcional',
  4: 'Paso 4 de 5: Conexión Fiscal e.firma SAT',
  5: 'Paso 5 de 5: Confirmación y Apertura'
};

export function WizardHeader({ step, onGoToStep }: WizardStepProgressProps) {
  return (
    <nav
      aria-label="Pasos del asistente"
      className="flex items-center justify-between gap-1.5"
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
            aria-label={isCompleted ? `Volver al paso ${s}` : `Paso ${s} de 5`}
            title={
              isCompleted
                ? `Volver al paso ${s}`
                : isCurrent
                ? `Paso actual (${s} de 5)`
                : `Completa los pasos anteriores para avanzar al paso ${s}`
            }
            className={`flex-1 py-1 group ${isCompleted ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <span
              className={`block h-1.5 w-full rounded-full transition-all duration-300 ${
                isCompleted
                  ? 'bg-emerald-500 group-hover:bg-emerald-600'
                  : isCurrent
                  ? 'bg-blue-700 ring-2 ring-blue-600/20'
                  : 'bg-slate-200'
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
}
