import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { useFloating, autoUpdate, offset, flip, shift, size } from '@floating-ui/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Account, AccountWithBalance } from '../../shared/types';
import { AccountPickerDropdown } from './AccountPickerDropdown';
import { filterAccountPickerOptions } from './accountPickerSearch';

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
  const [isTyping, setIsTyping] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === value),
    [accounts, value]
  );

  const filteredAccounts = useMemo(() => {
    const activeQuery = isTyping ? query : '';
    return filterAccountPickerOptions(accounts, activeQuery);
  }, [accounts, query, isTyping]);

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
    if (isTyping && query.trim().length > 0) {
      setHighlightedIndex(0);
    } else if (value) {
      const matchIdx = filteredAccounts.findIndex((a) => a.id === value);
      setHighlightedIndex(matchIdx >= 0 ? matchIdx : 0);
    } else {
      setHighlightedIndex(0);
    }
  }, [query, isTyping, value, filteredAccounts]);

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
        setIsTyping(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [refs.floating]);

  const handleSelect = (account: Account | AccountWithBalance) => {
    onChange(account.id);
    setIsOpen(false);
    setQuery('');
    setIsTyping(false);
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
    } else if (e.key === 'Home') {
      if (isOpen && filteredAccounts.length > 0) {
        e.preventDefault();
        setHighlightedIndex(0);
      }
    } else if (e.key === 'End') {
      if (isOpen && filteredAccounts.length > 0) {
        e.preventDefault();
        setHighlightedIndex(filteredAccounts.length - 1);
      }
    } else if (e.key === 'Enter') {
      if (isOpen && filteredAccounts.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        const selected = filteredAccounts[highlightedIndex];
        if (selected) handleSelect(selected);
      } else if (!isOpen) {
        e.preventDefault();
        onAdvance?.();
      }
    } else if (e.key === 'Tab') {
      if (isOpen && filteredAccounts.length > 0 && ((isTyping && query.trim().length > 0) || !value)) {
        const selected = filteredAccounts[highlightedIndex];
        if (selected) onChange(selected.id);
      }
      setIsOpen(false);
      setQuery('');
      setIsTyping(false);
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        setQuery('');
        setIsTyping(false);
      }
    } else if (e.key === 'F2') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
      setIsTyping(false);
    }
  };

  const displayValue = isTyping
    ? query
    : selectedAccount
    ? `${selectedAccount.code} — ${selectedAccount.name}`
    : query;

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
              ? `${listboxId}-opt-${filteredAccounts[highlightedIndex]?.id}`
              : undefined
          }
          aria-label={ariaLabel}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          value={displayValue}
          placeholder={placeholder}
          onFocus={(e) => {
            setIsOpen(true);
            setIsTyping(false);
            if (value) {
              const matchIdx = accounts.findIndex((a) => a.id === value);
              if (matchIdx >= 0) setHighlightedIndex(matchIdx);
            }
            const target = e.currentTarget;
            requestAnimationFrame(() => target.select());
          }}
          onChange={(e) => {
            setIsTyping(true);
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
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const next = !isOpen;
            setIsOpen(next);
            if (next) inputRef.current?.focus();
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
