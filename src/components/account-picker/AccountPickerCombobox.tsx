import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { useFloating, autoUpdate, offset, flip, shift, size } from '@floating-ui/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Account, AccountWithBalance } from '../../shared/types';
import { AccountPickerDropdown } from './AccountPickerDropdown';

interface AccountPickerComboboxProps {
  accounts: (Account | AccountWithBalance)[];
  value: string;
  onChange: (accountId: string) => void;
  onAdvance?: () => void;
  onInputRef?: (el: HTMLInputElement | null) => void;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}

function AccountPickerComboboxBase({
  accounts,
  value,
  onChange,
  onAdvance,
  onInputRef,
  placeholder = 'Buscar por código o nombre...',
  ariaLabel = 'Cuenta contable',
  autoFocus = false
}: AccountPickerComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === value),
    [accounts, value]
  );

  const filteredAccounts = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.satGroupCode && a.satGroupCode.toLowerCase().includes(q))
    );
  }, [accounts, query]);

  const { refs, floatingStyles } = useFloating({
    strategy: 'fixed',
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(4),
      flip(),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          const maxW = typeof window !== 'undefined' ? Math.max(280, window.innerWidth - 32) : 360;
          Object.assign(elements.floating.style, {
            width: `${Math.min(Math.max(rects.reference.width, 320), maxW)}px`
          });
        }
      })
    ],
    whileElementsMounted: autoUpdate
  });

  const rowVirtualizer = useVirtualizer({
    count: isOpen ? filteredAccounts.length : 0,
    getScrollElement: () => listRef.current,
    estimateSize: () => 36,
    overscan: 6
  });

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    rowVirtualizer.scrollToIndex(highlightedIndex, { align: 'auto' });
  }, [highlightedIndex, isOpen, rowVirtualizer]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!refs.floating.current || !refs.floating.current.contains(target))
      ) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [refs.floating]);

  const handleSelect = (account: Account | AccountWithBalance) => {
    onChange(account.id);
    setIsOpen(false);
    setQuery('');
    if (onAdvance) onAdvance();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) => (prev < filteredAccounts.length - 1 ? prev + 1 : prev));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && filteredAccounts.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        const selected = filteredAccounts[highlightedIndex];
        if (selected) handleSelect(selected);
      }
    } else if (e.key === 'Tab') {
      if (isOpen && filteredAccounts.length > 0) {
        const selected = filteredAccounts[highlightedIndex];
        if (selected) onChange(selected.id);
        setIsOpen(false);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        setQuery('');
      }
    } else if (e.key === 'F2') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  const displayValue = isOpen
    ? query
    : selectedAccount
    ? `${selectedAccount.code} — ${selectedAccount.name}`
    : '';

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        refs.setReference(node);
      }}
      className="relative w-full"
    >
      <div className="relative">
        <Search
          className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={(el) => {
            inputRef.current = el;
            onInputRef?.(el);
          }}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            isOpen && filteredAccounts[highlightedIndex]
              ? `account-opt-${filteredAccounts[highlightedIndex]?.id}`
              : undefined
          }
          aria-label={ariaLabel}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          value={displayValue}
          placeholder={placeholder}
          onFocus={(e) => {
            setIsOpen(true);
            e.target.select();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full pl-8 pr-8 py-1.5 rounded-lg border text-xs font-mono transition focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white ${
            isOpen
              ? 'border-blue-500 ring-1 ring-blue-500/20 shadow-xs'
              : 'border-slate-300 hover:border-slate-400'
          }`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Abrir catálogo de cuentas (F2)"
          onClick={() => {
            setIsOpen((prev) => !prev);
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {isOpen && (
        <AccountPickerDropdown
          floatingRef={refs.setFloating}
          floatingStyles={floatingStyles}
          listRef={listRef}
          listboxId={listboxId}
          query={query}
          value={value}
          highlightedIndex={highlightedIndex}
          setHighlightedIndex={setHighlightedIndex}
          filteredAccounts={filteredAccounts}
          rowVirtualizer={rowVirtualizer}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}

export const AccountPickerCombobox = React.memo(AccountPickerComboboxBase);
