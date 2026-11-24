import type React from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'danger-outline'
  | 'export'
  | 'export-outline';

export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-blue-700 hover:bg-blue-800 text-white border border-transparent shadow-2xs',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-transparent',
  danger: 'bg-red-700 hover:bg-red-800 text-white border border-transparent shadow-2xs',
  'danger-outline': 'bg-white hover:bg-red-50 text-red-700 border border-red-300 shadow-2xs',
  export: 'bg-emerald-700 hover:bg-emerald-800 text-white border border-transparent shadow-2xs',
  'export-outline': 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-3.5 py-2 text-xs rounded-xl gap-1.5',
  lg: 'px-4 py-2.5 text-xs sm:text-sm rounded-xl gap-2'
};

export function getButtonClasses(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  extraClassName = ''
): string {
  return [
    'inline-flex items-center justify-center font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    extraClassName
  ]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Botón institucional unificado del ERP LibrePaq Pro.
 * Estandariza radio, pesos tipográficos, contraste WCAG AA y estados de carga.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={Boolean(disabled || loading)}
      aria-busy={loading || undefined}
      className={getButtonClasses(variant, size, className)}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}
