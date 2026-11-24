import type React from 'react';

export type EmptyStateTone = 'slate' | 'blue' | 'emerald' | 'red';

const ICON_BOX_TONES: Record<EmptyStateTone, string> = {
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-red-50 text-red-700 border-red-200'
};

export interface EmptyStateProps {
  icon?: React.ReactNode;
  tone?: EmptyStateTone;
  variant?: 'plain' | 'card' | 'dashed';
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Estado vacío y de cero resultados unificado para tablas, módulos y paneles contables.
 */
export function EmptyState({
  icon,
  tone = 'blue',
  variant = 'plain',
  title,
  description,
  actions,
  className = ''
}: EmptyStateProps) {
  const containerVariant =
    variant === 'card'
      ? 'bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-8 sm:p-10'
      : variant === 'dashed'
        ? 'bg-slate-50/70 rounded-2xl border border-dashed border-slate-300 p-6 sm:p-8'
        : 'py-8 sm:py-10 px-4';

  return (
    <div className={`text-center ${containerVariant} ${className}`.trim()}>
      {icon && (
        <div
          className={`w-12 h-12 rounded-2xl border flex items-center justify-center mx-auto mb-3 ${ICON_BOX_TONES[tone]}`}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {description && (
        <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">{description}</p>
      )}
      {actions && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">{actions}</div>
      )}
    </div>
  );
}
