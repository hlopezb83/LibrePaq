import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { useFloating, autoUpdate, offset, flip, shift, size } from '@floating-ui/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatCurrency } from '../lib/formatters';
import type { Account, AccountWithBalance } from '../shared/types';

interface AccountPickerComboboxProps {
  accounts: (Account | AccountWithBalance)[];
  value: string;
  onChange: (accountId: string) => void;
  onAdvance?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}

function AccountPickerComboboxBase({
  accounts,
  value,
  onChange,
  onAdvance,
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
          ref={inputRef}
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
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          onMouseDown={(e) => e.preventDefault()}
          className="z-50 rounded-xl border border-slate-300 bg-white shadow-xl overflow-hidden"
        >
          <div className="p-1.5 bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 flex justify-between items-center px-2.5">
            <span>
              {filteredAccounts.length} cuenta{filteredAccounts.length === 1 ? '' : 's'} encontrada{filteredAccounts.length === 1 ? '' : 's'}
            </span>
            <span className="font-mono">
              <kbd className="bg-white px-1 py-0.5 rounded border border-slate-200">↑↓</kbd> navegar •{' '}
              <kbd className="bg-white px-1 py-0.5 rounded border border-slate-200">Enter</kbd> elegir
            </span>
          </div>

          {filteredAccounts.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              No se encontraron cuentas que coincidan con "{query}".
            </div>
          ) : (
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              className="max-h-60 overflow-y-auto scrollable-panel py-1"
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative'
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const account = filteredAccounts[virtualRow.index];
                  if (!account) return null;
                  const isSelected = account.id === value;
                  const isHighlighted = virtualRow.index === highlightedIndex;
                  const balance =
                    'finalBalance' in account ? account.finalBalance : account.initialBalance;

                  return (
                    <div
                      key={account.id}
                      id={`account-opt-${account.id}`}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlightedIndex(virtualRow.index)}
                      onClick={() => handleSelect(account)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                      className={`px-3 py-1.5 flex items-center justify-between text-xs cursor-pointer transition ${
                        isHighlighted
                          ? 'bg-blue-600 text-white'
                          : isSelected
                          ? 'bg-blue-50/70 text-slate-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span
                          className={`font-mono font-bold shrink-0 ${
                            isHighlighted ? 'text-blue-100' : 'text-blue-900'
                          }`}
                        >
                          {account.code}
                        </span>
                        <span className="truncate">{account.name}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                        {account.satGroupCode && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] border ${
                              isHighlighted
                                ? 'bg-blue-700 text-blue-100 border-blue-500'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            SAT {account.satGroupCode}
                          </span>
                        )}
                        <span
                          className={`font-semibold ${
                            isHighlighted
                              ? 'text-white'
                              : account.nature === 'DEUDORA'
                              ? 'text-emerald-700'
                              : 'text-blue-700'
                          }`}
                        >
                          [{account.nature.charAt(0)}]
                        </span>
                        {balance !== undefined && (
                          <span
                            className={`font-mono ${
                              isHighlighted ? 'text-blue-100' : 'text-slate-700'
                            }`}
                          >
                            {formatCurrency(balance)}
                          </span>
                        )}
                        {isSelected && (
                          <Check
                            className={`w-3.5 h-3.5 ml-1 ${
                              isHighlighted ? 'text-white' : 'text-blue-600'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const AccountPickerCombobox = React.memo(AccountPickerComboboxBase);
