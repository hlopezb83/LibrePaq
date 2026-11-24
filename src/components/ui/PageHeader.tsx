import type React from 'react';

export type PageHeaderIconTone = 'blue' | 'amber' | 'emerald' | 'slate';

const ICON_TONE_CLASSES: Record<PageHeaderIconTone, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200'
};

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconTone?: PageHeaderIconTone;
  eyebrow?: React.ReactNode;
  titleBadge?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  className?: string;
}

/**
 * Cabecera canónica blanca para todas las pantallas del ERP.
 * Unifica padding, caja de ícono de 40px, jerarquía H1/subtítulo y franja inferior integrada para pestañas.
 */
export function PageHeader({
  title,
  subtitle,
  icon,
  iconTone = 'blue',
  eyebrow,
  titleBadge,
  actions,
  tabs,
  className = ''
}: PageHeaderProps) {
  return (
    <header
      className={`bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5 ${className}`.trim()}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          {icon && (
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${ICON_TONE_CLASSES[iconTone]}`}
              aria-hidden="true"
            >
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && <div className="flex flex-wrap items-center gap-1.5 mb-1">{eyebrow}</div>}
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                {title}
              </h1>
              {titleBadge}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>

      {tabs && (
        <div className="border-t border-slate-100 pt-3 mt-3.5 min-w-0">{tabs}</div>
      )}
    </header>
  );
}
