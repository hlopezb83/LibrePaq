import type React from 'react';
import { Search, X } from 'lucide-react';
import { INPUT_BASE_CLASS, INPUT_SM_CLASS } from './FormControls';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'size'> {
  value: string;
  onChange: (value: string) => void;
  clearLabel?: string;
  size?: 'md' | 'sm';
  containerClassName?: string;
  hintKey?: string;
}

/**
 * Buscador estandarizado del ERP con landmark `<search>`, supresión del botón `×` nativo de WebKit,
 * atajo `Esc` para limpiar y botón accesorio de limpieza `28x28px`.
 */
export function SearchInput({
  value,
  onChange,
  clearLabel = 'Limpiar búsqueda',
  size = 'md',
  containerClassName = '',
  hintKey,
  className = '',
  onKeyDown,
  ...rest
}: SearchInputProps) {
  const controlSize = size === 'sm' ? INPUT_SM_CLASS : INPUT_BASE_CLASS;
  const hasValue = value.length > 0;

  return (
    <search className={`relative ${containerClassName}`.trim()}>
      <Search
        className="w-4 h-4 text-slate-500 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && hasValue) {
            e.preventDefault();
            e.stopPropagation();
            onChange('');
          }
          onKeyDown?.(e);
        }}
        className={`${controlSize} pl-9 ${hasValue ? 'pr-9' : hintKey ? 'pr-9' : 'pr-3'} [&::-webkit-search-cancel-button]:appearance-none ${className}`.trim()}
        {...rest}
      />
      {!hasValue && hintKey && (
        <kbd
          aria-hidden="true"
          className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-md pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
        >
          {hintKey}
        </kbd>
      )}
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={clearLabel}
          title={clearLabel}
          className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer absolute right-1.5 top-1/2 -translate-y-1/2"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </search>
  );
}
