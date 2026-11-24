import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { SAT_GROUP_CODES, type SatGroupCodeItem } from '../../shared/sat-constants';
import type { AccountType } from '../../shared/types';

interface SatGroupCodePickerProps {
  value: string;
  onSelect: (item: SatGroupCodeItem | null, rawCode: string) => void;
}

const GROUPS: ReadonlyArray<AccountType> = [
  'ACTIVO',
  'PASIVO',
  'CAPITAL',
  'INGRESOS',
  'COSTOS',
  'GASTOS'
];

export function SatGroupCodePicker({ value, onSelect }: SatGroupCodePickerProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SAT_GROUP_CODES;
    return SAT_GROUP_CODES.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q)
    );
  }, [search]);

  const currentMatch = useMemo(
    () => SAT_GROUP_CODES.find((s) => s.code === value),
    [value]
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="acc-sat" className="block text-xs font-semibold text-slate-700">
          Código Agrupador del SAT (Anexo 24) *
        </label>
        <span className="text-[10px] font-mono text-slate-500">
          {filtered.length} de {SAT_GROUP_CODES.length} códigos
        </span>
      </div>

      <div className="relative">
        <Search
          className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Buscar código agrupador SAT"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar código SAT (ej. 118.03, 216.10, 601, combustible, bancos)..."
          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
        />
      </div>

      <select
        id="acc-sat"
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          const found = SAT_GROUP_CODES.find((s) => s.code === val) ?? null;
          onSelect(found, val);
        }}
        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white font-mono"
      >
        {!currentMatch && value && (
          <option value={value}>[{value}] Código SAT personalizado</option>
        )}
        {GROUPS.map((grp) => {
          const items = filtered.filter((s) => s.type === grp);
          if (items.length === 0) return null;
          return (
            <optgroup key={grp} label={grp}>
              {items.map((s) => (
                <option key={s.code} value={s.code}>
                  [{s.code}] {s.name} ({s.nature})
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}
