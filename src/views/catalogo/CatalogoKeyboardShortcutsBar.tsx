import type { AccountWithBalance } from '../../shared/types';

export interface CatalogoKeyboardShortcutsBarProps {
  selectedAccount: AccountWithBalance | null;
}

export function CatalogoKeyboardShortcutsBar({
  selectedAccount
}: CatalogoKeyboardShortcutsBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1 bg-slate-50 border-b border-slate-200 text-[10.5px] text-slate-500 font-mono no-print">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1">
          <kbd className="px-1 py-0.2 rounded bg-white border border-slate-300 text-slate-700 shadow-2xs font-bold">F3</kbd>
          <span>Buscar</span>
        </span>
        <span className="text-slate-300">|</span>
        <span className="inline-flex items-center gap-1">
          <kbd className="px-1 py-0.2 rounded bg-white border border-slate-300 text-slate-700 shadow-2xs font-bold">↑↓</kbd>
          <span>Navegar</span>
        </span>
        <span className="text-slate-300">|</span>
        <span className="inline-flex items-center gap-1">
          <kbd className="px-1 py-0.2 rounded bg-white border border-slate-300 text-slate-700 shadow-2xs font-bold">Enter/F2</kbd>
          <span>Editar</span>
        </span>
        <span className="text-slate-300">|</span>
        <span className="inline-flex items-center gap-1">
          <kbd className="px-1 py-0.2 rounded bg-white border border-slate-300 text-slate-700 shadow-2xs font-bold">Insert</kbd>
          <span>+ Subcuenta</span>
        </span>
        <span className="text-slate-300">|</span>
        <span className="inline-flex items-center gap-1">
          <kbd className="px-1 py-0.2 rounded bg-white border border-slate-300 text-slate-700 shadow-2xs font-bold">→</kbd>
          <kbd className="px-1 py-0.2 rounded bg-white border border-slate-300 text-slate-700 shadow-2xs font-bold">←</kbd>
          <span>Plegar/Desplegar</span>
        </span>
        <span className="text-slate-300">|</span>
        <span className="inline-flex items-center gap-1">
          <kbd className="px-1 py-0.2 rounded bg-white border border-slate-300 text-slate-700 shadow-2xs font-bold">Esc</kbd>
          <span>Deseleccionar</span>
        </span>
      </div>

      {selectedAccount ? (
        <div className="flex items-center gap-1.5 font-sans font-medium text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
          <span>
            Seleccionada: <strong className="font-mono">{selectedAccount.code}</strong> - {selectedAccount.name}
          </span>
        </div>
      ) : (
        <span className="text-[10px] text-slate-400 font-sans italic">
          Usa las flechas ↑↓ o haz clic en una fila para seleccionarla
        </span>
      )}
    </div>
  );
}
