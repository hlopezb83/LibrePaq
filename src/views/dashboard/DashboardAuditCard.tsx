import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { StatusBadge, type BadgeTone } from '../../components/ui';

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
  { container: string; icon: string; badgeTone: BadgeTone }
> = {
  neutral: {
    container: 'bg-slate-50 border-slate-200 shadow-2xs',
    icon: 'text-slate-600',
    badgeTone: 'slate'
  },
  warning: {
    container: 'bg-amber-50/70 border-amber-300/90 shadow-xs',
    icon: 'text-amber-700',
    badgeTone: 'amber'
  },
  danger: {
    container: 'bg-red-50/70 border-red-300 shadow-xs',
    icon: 'text-red-700',
    badgeTone: 'red'
  },
  success: {
    container: 'bg-emerald-50/50 border-emerald-200 shadow-2xs',
    icon: 'text-emerald-700',
    badgeTone: 'emerald'
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
    <div
      className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${styles.container}`}
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
          <span className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
            <Icon aria-hidden="true" className={`w-4 h-4 ${styles.icon}`} />
            <span>{title}</span>
          </span>
          <StatusBadge tone={styles.badgeTone} className="font-mono">
            {badgeText}
          </StatusBadge>
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
