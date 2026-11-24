import type { CSSProperties, RefObject } from 'react';
import { Check } from 'lucide-react';
import type { Virtualizer } from '@tanstack/react-virtual';
import { formatCurrency } from '../../lib/formatters';
import type { Account, AccountWithBalance } from '../../shared/types';

interface AccountPickerDropdownProps {
  floatingRef: (node: HTMLElement | null) => void;
  floatingStyles: CSSProperties;
  listRef: RefObject<HTMLDivElement | null>;
  listboxId: string;
  query: string;
  value: string;
  highlightedIndex: number;
  setHighlightedIndex: (idx: number) => void;
  filteredAccounts: (Account | AccountWithBalance)[];
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  onSelect: (account: Account | AccountWithBalance) => void;
}

export function AccountPickerDropdown({
  floatingRef,
  floatingStyles,
  listRef,
  listboxId,
  query,
  value,
  highlightedIndex,
  setHighlightedIndex,
  filteredAccounts,
  rowVirtualizer,
  onSelect
}: AccountPickerDropdownProps) {
  return (
    <div
      ref={floatingRef}
      style={floatingStyles}
      onMouseDown={(e) => e.preventDefault()}
      className="z-50 rounded-xl border border-slate-300 bg-white shadow-xl overflow-hidden"
    >
      <div className="p-1.5 bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 flex justify-between items-center px-2.5">
        <span>
          {filteredAccounts.length} cuenta{filteredAccounts.length === 1 ? '' : 's'} encontrada
          {filteredAccounts.length === 1 ? '' : 's'}
        </span>
        <span className="font-mono">
          <kbd className="bg-white px-1 py-0.5 rounded border border-slate-200">↑↓</kbd> navegar •{' '}
          <kbd className="bg-white px-1 py-0.5 rounded border border-slate-200">Enter</kbd> elegir
        </span>
      </div>

      {filteredAccounts.length === 0 ? (
        <div className="p-4 text-center text-xs text-slate-500">
          No se encontraron cuentas que coincidan con &ldquo;{query}&rdquo;.
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
                  id={`${listboxId}-opt-${account.id}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(virtualRow.index)}
                  onClick={() => onSelect(account)}
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
                      ? 'bg-blue-700 text-white'
                      : isSelected
                        ? 'bg-blue-50/70 text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span
                      className={`font-mono font-bold shrink-0 ${
                        isHighlighted ? 'text-white' : 'text-blue-900'
                      }`}
                    >
                      {account.code}
                    </span>
                    <span className="truncate">{account.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                    {account.satGroupCode && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] border ${
                          isHighlighted
                            ? 'bg-blue-800 text-white border-blue-400'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
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
                          isHighlighted ? 'text-white' : 'text-slate-700'
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
  );
}
