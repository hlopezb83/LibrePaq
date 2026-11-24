import type React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type AlertBannerTone = 'info' | 'blue' | 'warning' | 'danger' | 'success';

const TONE_CLASSES: Record<AlertBannerTone, string> = {
  info: 'bg-sky-50 border-sky-200 text-sky-950',
  blue: 'bg-blue-50 border-blue-200 text-blue-950',
  warning: 'bg-amber-50 border-amber-300 text-amber-950',
  danger: 'bg-red-50 border-red-300 text-red-950',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-950'
};

const ICON_BADGE_CLASSES: Record<AlertBannerTone, string> = {
  info: 'bg-sky-100 text-sky-800',
  blue: 'bg-blue-100 text-blue-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  success: 'bg-emerald-100 text-emerald-800'
};

function DefaultAlertIcon({ tone }: { tone: AlertBannerTone }) {
  if (tone === 'danger') return <XCircle className="w-4 h-4" aria-hidden="true" />;
  if (tone === 'warning') return <AlertTriangle className="w-4 h-4" aria-hidden="true" />;
  if (tone === 'success') return <CheckCircle2 className="w-4 h-4" aria-hidden="true" />;
  return <Info className="w-4 h-4" aria-hidden="true" />;
}

export interface AlertBannerProps {
  tone?: AlertBannerTone;
  variant?: 'card' | 'bar';
  title?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Banner de estado o alerta institucional único para avisos globales del shell y advertencias contextuales.
 */
export function AlertBanner({
  tone = 'info',
  variant = 'card',
  title,
  icon,
  action,
  onDismiss,
  dismissLabel = 'Ocultar aviso',
  children,
  className = ''
}: AlertBannerProps) {
  const role = tone === 'danger' || tone === 'warning' ? 'alert' : 'status';
  const shellWrap =
    variant === 'bar'
      ? `border-b px-3 sm:px-5 py-2 ${TONE_CLASSES[tone]} ${className}`.trim()
      : `rounded-xl border px-4 py-3 shadow-2xs ${TONE_CLASSES[tone]} ${className}`.trim();

  const content = (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
        <span
          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${ICON_BADGE_CLASSES[tone]}`}
          aria-hidden="true"
        >
          {icon ?? <DefaultAlertIcon tone={tone} />}
        </span>
        <div className="text-xs leading-relaxed min-w-0">
          {title && <span className="font-bold mr-1.5">{title}</span>}
          {children}
        </div>
      </div>
      {(action || onDismiss) && (
        <div className="flex items-center gap-2 shrink-0">
          {action}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={dismissLabel}
              className="min-h-[28px] min-w-[28px] inline-flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div role={role} className={shellWrap}>
      {variant === 'bar' ? <div className="max-w-[1800px] mx-auto">{content}</div> : content}
    </div>
  );
}
