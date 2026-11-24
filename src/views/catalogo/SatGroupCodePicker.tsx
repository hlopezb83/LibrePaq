import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { normalizeSearchText } from '../../components/account-picker/accountPickerSearch';
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

export function filterSatGroupCodes(search: string): SatGroupCodeItem[] {
  const q = normalizeSearchText(search);
  if (!q) return SAT_GROUP_CODES;
  return SAT_GROUP_CODES.filter(
    (s) =>
      normalizeSearchText(s.code).includes(q) ||
      normalizeSearchText(s.name).includes(q) ||
      normalizeSearchText(s.type).includes(q)
  );
}

export function SatGroupCodePicker({ value, onSelect }: SatGroupCodePickerProps) {
  const [search, setSearch] = useState('');
  const lastInternalSelectRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastInternalSelectRef.current === value) {
      lastInternalSelectRef.current = null;
      return;
    }
    setSearch('');
  }, [value]);

  const filtered = useMemo(() => filterSatGroupCodes(search), [search]);

  const currentMatch = useMemo(
    () => SAT_GROUP_CODES.find((s) => s.code === value),
    [value]
  );

  const isValueInFiltered = useMemo(
    () => filtered.some((s) => s.code === value),
    [filtered, value]
  );

  const topFilteredMatch = search.trim() && filtered.length > 0 ? filtered[0] : undefined;

  const applyItem = (item: SatGroupCodeItem | null, rawCode: string) => {
    lastInternalSelectRef.current = rawCode;
    onSelect(item, rawCode);
  };

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
          placeholder="Buscar código SAT (ej. 118.03, comisión, nómina, bancos)..."
          className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-300 text-xs bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Limpiar búsqueda de código SAT"
            title="Limpiar búsqueda"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {search.trim() && filtered.length === 0 ? (
        <div
          role="status"
          className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2"
        >
          <span>Sin coincidencias en Anexo 24 para &ldquo;{search}&rdquo;.</span>
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-[11px] font-bold text-amber-950 underline cursor-pointer shrink-0"
          >
            Ver todos
          </button>
        </div>
      ) : (
        <>
          {topFilteredMatch && topFilteredMatch.code !== value && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-950">
              <span className="truncate">
                Coincidencia principal: <strong className="font-mono">[{topFilteredMatch.code}]</strong> {topFilteredMatch.name}
              </span>
              <button
                type="button"
                onClick={() => applyItem(topFilteredMatch, topFilteredMatch.code)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold cursor-pointer shrink-0"
              >
                <Check className="w-3 h-3" aria-hidden="true" />
                Aplicar
              </button>
            </div>
          )}

          <select
            id="acc-sat"
            value={value}
            onChange={(e) => {
              const val = e.target.value;
              const found = SAT_GROUP_CODES.find((s) => s.code === val) ?? null;
              applyItem(found, val);
            }}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white font-mono"
          >
            {value && !isValueInFiltered && (
              <option value={value}>
                {currentMatch
                  ? `[${currentMatch.code}] ${currentMatch.name} (${currentMatch.nature}) — Actual`
                  : `[${value}] Código SAT personalizado — Actual`}
              </option>
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
        </>
      )}
    </div>
  );
}
