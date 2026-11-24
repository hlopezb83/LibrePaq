import type { FlattenedItem } from './useCommandPaletteItems';

interface CommandPaletteResultOptionProps {
  item: FlattenedItem;
  isSelected: boolean;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onSelect: () => void;
  onHover: () => void;
}

export function CommandPaletteResultOption({
  item,
  isSelected,
  buttonRef,
  onSelect,
  onHover
}: CommandPaletteResultOptionProps) {
  const Icon = item.icon;
  return (
    <button
      id={item.id}
      ref={buttonRef}
      type="button"
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer select-none ${
        isSelected ? 'bg-blue-700 text-white shadow-xs font-medium' : 'hover:bg-slate-100 text-slate-800'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          <Icon className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs truncate ${isSelected ? 'font-bold text-white' : 'font-semibold text-slate-900'}`}>
              {item.title}
            </span>
            {item.badge && (
              <span
                className={`text-[9px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${
                  isSelected ? 'bg-white/20 text-white border-white/30' : item.badgeClass || 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {item.badge}
              </span>
            )}
          </div>
          {item.subtitle && (
            <div className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
              {item.subtitle}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.meta && (
          <span className={`text-xs font-mono font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
            {item.meta}
          </span>
        )}
        {item.shortcut && (
          <kbd
            className={`px-1.5 py-0.5 font-mono text-[10px] rounded border ${
              isSelected ? 'bg-white/20 text-white border-white/40 font-bold' : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {item.shortcut}
          </kbd>
        )}
      </div>
    </button>
  );
}
