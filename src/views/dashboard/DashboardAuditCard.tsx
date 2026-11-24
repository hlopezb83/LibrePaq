import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type AuditCardTone = 'neutral' | 'warning' | 'danger' | 'success';

interface DashboardAuditCardProps {
  icon: LucideIcon;
  title: string;
  badgeText: string;
  tone: AuditCardTone;
  description: ReactNode;
  footerLeft: ReactNode;
  footerRight: ReactNode;
}

const TONE_STYLES: Record<
  AuditCardTone,
  { container: string; icon: string; badge: string }
> = {
  neutral: {
    container: 'bg-slate-50 border-slate-200 shadow-2xs',
    icon: 'text-slate-600',
    badge: 'bg-slate-100 text-slate-700 border-slate-300'
  },
  warning: {
    container: 'bg-amber-50/70 border-amber-300/90 shadow-xs',
    icon: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-900 border-amber-300'
  },
  danger: {
    container: 'bg-red-50/70 border-red-300 shadow-xs',
    icon: 'text-red-700',
    badge: 'bg-red-100 text-red-900 border-red-300'
  },
  success: {
    container: 'bg-emerald-50/50 border-emerald-200 shadow-2xs',
    icon: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300'
  }
};

export function DashboardAuditCard({
  icon: Icon,
  title,
  badgeText,
  tone,
  description,
  footerLeft,
  footerRight
}: DashboardAuditCardProps) {
  const styles = TONE_STYLES[tone];

  return (
    <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${styles.container}`}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
          <span className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
            <Icon aria-hidden="true" className={`w-4 h-4 ${styles.icon}`} />
            <span>{title}</span>
          </span>
          <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${styles.badge}`}>
            {badgeText}
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-snug">{description}</p>
      </div>

      <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
        {footerLeft}
        {footerRight}
      </div>
    </div>
  );
}
