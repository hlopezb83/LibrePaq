import { Search, X } from 'lucide-react';

export interface CfdiFilterBarProps {
  periodScope: 'CURRENT' | 'ALL';
  setPeriodScope: (scope: 'CURRENT' | 'ALL') => void;
  currentPeriod: number;
  currentYear: number;
  countInCurrentPeriod: number;
  totalCfdisCount: number;
  allYearCount?: number;
  tab: 'ALL' | 'EMITIDO' | 'RECIBIDO' | 'PENDING';
  setTab: (tab: 'ALL' | 'EMITIDO' | 'RECIBIDO' | 'PENDING') => void;
  pendingCount: number;
  emitidosCount: number;
  recibidosCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  tipoFilter: 'ALL' | 'I' | 'P' | 'N' | 'RET';
  setTipoFilter: (tf: 'ALL' | 'I' | 'P' | 'N' | 'RET') => void;
  metodoFilter?: 'ALL' | 'PUE' | 'PPD';
  setMetodoFilter?: (mf: 'ALL' | 'PUE' | 'PPD') => void;
  filteredCount: number;
}

export function CfdiFilterBar({
  periodScope,
  setPeriodScope,
  currentPeriod,
  currentYear,
  countInCurrentPeriod,
  totalCfdisCount,
  allYearCount,
  tab,
  setTab,
  pendingCount,
  emitidosCount,
  recibidosCount,
  searchQuery,
  setSearchQuery,
  tipoFilter,
  setTipoFilter,
  metodoFilter = 'ALL',
  setMetodoFilter,
  filteredCount
}: CfdiFilterBarProps) {
  const tabs = [
    { id: 'ALL', label: 'Todos', count: totalCfdisCount, isWarning: false },
    {
      id: 'PENDING',
      label: 'Por Contabilizar',
      count: pendingCount,
      isWarning: pendingCount > 0
    },
    {
      id: 'EMITIDO',
      label: 'Emitidos (Ingreso)',
      count: emitidosCount,
      isWarning: false
    },
    {
      id: 'RECIBIDO',
      label: 'Recibidos (Gasto)',
      count: recibidosCount,
      isWarning: false
    }
  ] as const;

  const tipoFilters = [
    { id: 'ALL', label: 'Todos los Tipos' },
    { id: 'I', label: 'Tipo I (Ingreso/Gasto)' },
    { id: 'P', label: 'Tipo P (REP 2.0)' },
    { id: 'N', label: 'Tipo N (Nómina)' },
    { id: 'RET', label: 'Con Retenciones' }
  ] as const;

  const metodoFilters = [
    { id: 'ALL', label: 'Todos' },
    { id: 'PUE', label: 'PUE (Contado)' },
    { id: 'PPD', label: 'PPD (Crédito)' }
  ] as const;

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-300/90 shadow-2xs space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Filtro de Alcance de Periodo */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-xs shrink-0" role="group" aria-label="Alcance temporal de comprobantes">
            <button
              type="button"
              aria-pressed={periodScope === 'CURRENT'}
              onClick={() => setPeriodScope('CURRENT')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                periodScope === 'CURRENT'
                  ? 'bg-white text-blue-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={`Ver únicamente comprobantes emitidos o recibidos en Periodo P${String(currentPeriod).padStart(2, '0')}/${currentYear}`}
            >
              <span>Periodo P{String(currentPeriod).padStart(2, '0')}</span>
              <span className="font-mono text-[10px] bg-blue-50 text-blue-700 px-1 rounded font-bold">
                {countInCurrentPeriod}
              </span>
            </button>
            <button
              type="button"
              aria-pressed={periodScope === 'ALL'}
              onClick={() => setPeriodScope('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                periodScope === 'ALL'
                  ? 'bg-white text-blue-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Ver todos los comprobantes del ejercicio sin delimitación mensual"
            >
              <span>Todo {currentYear}</span>
              <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1 rounded font-bold">
                {allYearCount ?? totalCfdisCount}
              </span>
            </button>
          </div>

          <div className="h-5 w-px bg-slate-300 mx-0.5 shrink-0" />

          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                tab === t.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  tab === t.id
                    ? 'bg-blue-800 text-white'
                    : t.isWarning
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <search className="relative w-full md:w-80">
          <label htmlFor="add-search" className="visually-hidden">
            Buscar CFDI por UUID, RFC, Razón Social o Concepto
          </label>
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="add-search"
            type="search"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar RFC, emisor, receptor, concepto o UUID..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpiar búsqueda de comprobantes"
              title="Limpiar búsqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </search>
      </div>

      {/* Segunda fila de filtros: Tipo SAT y Método de Pago PUE/PPD */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por tipo SAT">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-0.5">
              Tipo SAT:
            </span>
            {tipoFilters.map((tf) => (
              <button
                key={tf.id}
                type="button"
                aria-pressed={tipoFilter === tf.id}
                onClick={() => setTipoFilter(tf.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                  tipoFilter === tf.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {setMetodoFilter && (
            <>
              <div className="hidden sm:block h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5" role="group" aria-label="Filtrar por método de pago">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-0.5">
                  Método:
                </span>
                {metodoFilters.map((mf) => (
                  <button
                    key={mf.id}
                    type="button"
                    aria-pressed={metodoFilter === mf.id}
                    onClick={() => setMetodoFilter(mf.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      metodoFilter === mf.id
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {mf.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          Mostrando <strong>{filteredCount}</strong> de {totalCfdisCount} comprobantes
        </span>
      </div>
    </div>
  );
}
