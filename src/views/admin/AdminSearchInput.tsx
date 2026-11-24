import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';

export interface AdminSearchInputProps {
  id: string;
  label: string;
  value: string;
  onDebouncedChange: (value: string) => void;
  placeholder: string;
  clearAriaLabel: string;
  isFetching?: boolean;
  className?: string;
}

export function AdminSearchInput({
  id,
  label,
  value,
  onDebouncedChange,
  placeholder,
  clearAriaLabel,
  isFetching = false,
  className = 'w-full sm:w-64'
}: AdminSearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const onDebouncedChangeRef = useRef(onDebouncedChange);

  useEffect(() => {
    onDebouncedChangeRef.current = onDebouncedChange;
  }, [onDebouncedChange]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== value) {
        onDebouncedChangeRef.current(inputValue);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [inputValue, value]);

  const handleClear = () => {
    setInputValue('');
    onDebouncedChangeRef.current('');
    inputRef.current?.focus();
  };

  return (
    <search className={`relative ${className}`}>
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      {isFetching ? (
        <Loader2
          className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none animate-spin"
          aria-hidden="true"
        />
      ) : (
        <Search
          className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
      )}
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && inputValue) {
            e.preventDefault();
            handleClear();
          }
        }}
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-600 [&::-webkit-search-cancel-button]:appearance-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      />
      {inputValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={clearAriaLabel}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-7 min-w-7 inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </search>
  );
}
