import type React from 'react';
import { ChevronDown, X } from 'lucide-react';

export const LABEL_CLASS = 'block text-xs font-semibold text-slate-700 mb-1';

const FOCUS_CONTRACT =
  'focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

export const INPUT_BASE_CLASS = `w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-500 transition-colors disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${FOCUS_CONTRACT}`;

export const INPUT_SM_CLASS = `w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-500 transition-colors disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${FOCUS_CONTRACT}`;

export interface FormFieldProps {
  label: React.ReactNode;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Envuelve controles de formulario con etiqueta uniforme `text-xs font-semibold` y ayuda/error opcional.
 */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className = '',
  children
}: FormFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={LABEL_CLASS}>
        {label}
        {required && <span className="text-red-700 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-[11px] font-medium text-red-700">
          {error}
        </p>
      )}
      {!error && hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'md' | 'sm';
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

/** Input de texto/numérico estándar con soporte para prefijos o sufijos centrados verticalmente. */
export function Input({
  size = 'md',
  leftAddon,
  rightAddon,
  className = '',
  ...rest
}: InputProps) {
  const base = size === 'sm' ? INPUT_SM_CLASS : INPUT_BASE_CLASS;
  if (!leftAddon && !rightAddon) {
    return <input className={`${base} ${className}`.trim()} {...rest} />;
  }
  return (
    <div className="relative">
      {leftAddon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
          {leftAddon}
        </span>
      )}
      <input
        className={`${base} ${leftAddon ? 'pl-8' : ''} ${rightAddon ? 'pr-8' : ''} ${className}`.trim()}
        {...rest}
      />
      {rightAddon && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
          {rightAddon}
        </span>
      )}
    </div>
  );
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'md' | 'sm';
  containerClassName?: string;
}

/** `<select>` estilizado de manera uniforme con flecha `ChevronDown` de Lucide. */
export function Select({
  size = 'md',
  containerClassName = '',
  className = '',
  children,
  ...rest
}: SelectProps) {
  const base = size === 'sm' ? INPUT_SM_CLASS : INPUT_BASE_CLASS;
  return (
    <div className={`relative ${containerClassName}`.trim()}>
      <select className={`${base} appearance-none pr-8 cursor-pointer ${className}`.trim()} {...rest}>
        {children}
      </select>
      <ChevronDown
        className="w-3.5 h-3.5 text-slate-500 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
        aria-hidden="true"
      />
    </div>
  );
}

export interface ClearFiltersButtonProps {
  onClick: () => void;
  count?: number;
  label?: string;
  className?: string;
}

/** Botón uniforme para limpiar filtros activos en barras de búsqueda y tablas. */
export function ClearFiltersButton({
  onClick,
  count,
  label = 'Limpiar filtros',
  className = ''
}: ClearFiltersButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${className}`.trim()}
    >
      <X className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{count !== undefined && count > 0 ? `${label} (${count})` : label}</span>
    </button>
  );
}
