import type React from 'react';

export type KpiTone = 'default' | 'blue' | 'emerald' | 'amber' | 'red';

const SURFACE_TONES: Record<KpiTone, string> = {
  default: 'bg-white border-slate-300/90',
  blue: 'bg-blue-50/70 border-blue-200',
  emerald: 'bg-emerald-50/70 border-emerald-200',
  amber: 'bg-amber-50/70 border-amber-300',
  red: 'bg-red-50/70 border-red-200'
};

const ICON_TONES: Record<KpiTone, string> = {
  default: 'bg-blue-50 text-blue-700 border-blue-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-300',
  red: 'bg-red-100 text-red-800 border-red-200'
};

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  iconTone?: KpiTone;
  tone?: KpiTone;
  hint?: React.ReactNode;
  footer?: React.ReactNode;
  valueClassName?: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Tarjeta KPI unificada del ERP.
 * Superficie blanca limpia, etiqueta uppercase 11px en slate-600, badge de ícono de 32px y cifra tabular-nums.
 */
export function KpiCard({
  label,
  value,
  icon,
  iconTone = 'default',
  tone = 'default',
  hint,
  footer,
  valueClassName = 'text-slate-900',
  active = false,
  onClick,
  className = ''
}: KpiCardProps) {
  const baseClass = `min-w-0 text-left rounded-2xl border shadow-2xs p-4 sm:p-5 transition ${SURFACE_TONES[tone]} ${
    active ? 'ring-2 ring-blue-600 border-blue-600' : ''
  } ${onClick ? 'hover:border-blue-500 hover:shadow-sm cursor-pointer' : ''} ${className}`.trim();

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 leading-snug">
          {label}
        </span>
        {icon && (
          <span
            className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${ICON_TONES[iconTone]}`}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>
      <div className={`mt-2 text-lg sm:text-xl font-bold font-mono tabular-nums tracking-tight ${valueClassName}`}>
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-600 leading-relaxed">{hint}</p>}
      {footer && <div className="mt-3 pt-2.5 border-t border-slate-100">{footer}</div>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={baseClass}>
        {inner}
      </button>
    );
  }

  return <div className={baseClass}>{inner}</div>;
}
