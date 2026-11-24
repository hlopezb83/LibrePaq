import type React from 'react';

export type BadgeTone = 'slate' | 'blue' | 'emerald' | 'amber' | 'red' | 'sky' | 'purple';

const BADGE_TONES: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-300',
  red: 'bg-red-50 text-red-800 border-red-200',
  sky: 'bg-sky-50 text-sky-800 border-sky-200',
  purple: 'bg-purple-50 text-purple-800 border-purple-200'
};

export interface StatusBadgeProps {
  tone?: BadgeTone;
  shape?: 'pill' | 'tag';
  icon?: React.ReactNode;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

const DOT_TONES: Record<BadgeTone, string> = {
  slate: 'bg-slate-500',
  blue: 'bg-blue-600',
  emerald: 'bg-emerald-600',
  amber: 'bg-amber-500',
  red: 'bg-red-600',
  sky: 'bg-sky-600',
  purple: 'bg-purple-600'
};

/**
 * Insignia de estatus y etiquetas fiscales canónica.
 * `pill` para estados operativos/fiscales; `tag` monoespaciado para claves SAT, RFC o códigos.
 */
export function StatusBadge({
  tone = 'slate',
  shape = 'pill',
  icon,
  dot = false,
  children,
  className = ''
}: StatusBadgeProps) {
  const shapeClass =
    shape === 'tag'
      ? 'rounded-md px-1.5 py-0.5 text-[10px] font-bold font-mono'
      : 'rounded-full px-2 py-0.5 text-[11px] font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1 border whitespace-nowrap ${shapeClass} ${BADGE_TONES[tone]} ${className}`.trim()}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_TONES[tone]}`} aria-hidden="true" />}
      {icon}
      {children}
    </span>
  );
}
