import { useState } from 'react';
import { Filter, Search, X } from 'lucide-react';
import {
  CFDI_FORMA_PAGO_FILTERS,
  CFDI_METODO_FILTERS,
  CFDI_STATUS_SAT_FILTERS,
  CFDI_TIPO_FILTERS,
  type CfdiFormaPagoFilter,
  type CfdiMetodoFilter,
  type CfdiStatusSatFilter,
  type CfdiTabFilter,
  type CfdiTipoFilter
} from './filterCfdis';

export interface CfdiFilterBarProps {
  periodScope: 'CURRENT' | 'ALL';
  setPeriodScope: (scope: 'CURRENT' | 'ALL') => void;
  currentPeriod: number;
  currentYear: number;
  countInCurrentPeriod: number;
  totalCfdisCount: number;
  allYearCount?: number;
  tab: CfdiTabFilter;
  setTab: (tab: CfdiTabFilter) => void;
  pendingCount: number;
  emitidosCount: number;
  recibidosCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  tipoFilter: CfdiTipoFilter;
  setTipoFilter: (tf: CfdiTipoFilter) => void;
  metodoFilter?: CfdiMetodoFilter;
  setMetodoFilter?: (mf: CfdiMetodoFilter) => void;
  statusSatFilter?: CfdiStatusSatFilter;
  setStatusSatFilter?: (sf: CfdiStatusSatFilter) => void;
  formaPagoFilter?: CfdiFormaPagoFilter;
  setFormaPagoFilter?: (fp: CfdiFormaPagoFilter) => void;
  filteredCount: number;
  onResetFilters?: () => void;
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
  statusSatFilter = 'ALL',
  setStatusSatFilter,
  formaPagoFilter = 'ALL',
  setFormaPagoFilter,
  filteredCount,
  onResetFilters
}: CfdiFilterBarProps) {
  const [showMobileAdvanced, setShowMobileAdvanced] = useState(false);

  const secondaryActiveCount = [
    tipoFilter !== 'ALL',
    metodoFilter !== 'ALL',
    statusSatFilter !== 'ALL',
    formaPagoFilter !== 'ALL'
  ].filter(Boolean).length;

  const activeFilterCount =
    secondaryActiveCount + (tab !== 'ALL' ? 1 : 0) + (searchQuery.trim().length > 0 ? 1 : 0);

  const tabs = [
    { id: 'ALL', label: 'Todos', count: totalCfdisCount, isWarning: false },
    { id: 'PENDING', label: 'Por Contabilizar', count: pendingCount, isWarning: pendingCount > 0 },
    { id: 'EMITIDO', label: 'Emitidos (Ingreso)', count: emitidosCount, isWarning: false },
    { id: 'RECIBIDO', label: 'Recibidos (Gasto)', count: recibidosCount, isWarning: false }
  ] as const;

  const pillCls = (active: boolean, danger = false) =>
    `px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
      active
        ? danger
          ? 'bg-red-700 text-white shadow-2xs'
          : 'bg-blue-600 text-white shadow-2xs'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`;

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-300/90 shadow-2xs space-y-3 w-full min-w-0 max-w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 w-full min-w-0">
        <div className="flex flex-wrap items-center gap-2 w-full min-w-0 max-w-full">
          <div className="flex flex-wrap items-center gap-1 p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-xs max-w-full" role="group" aria-label="Alcance temporal de comprobantes">
            <button
              type="button"
              aria-pressed={periodScope === 'CURRENT'}
              onClick={() => setPeriodScope('CURRENT')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                periodScope === 'CURRENT'
                  ? 'bg-white text-blue-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={`Ver únicamente comprobantes del Periodo P${String(currentPeriod).padStart(2, '0')}/${currentYear}`}
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
              title={`Ver todos los comprobantes del ejercicio ${currentYear}`}
            >
              <span>Todo {currentYear}</span>
              <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1 rounded font-bold">
                {allYearCount ?? totalCfdisCount}
              </span>
            </button>
          </div>

          <div className="hidden sm:block h-5 w-px bg-slate-300 mx-0.5 shrink-0" aria-hidden="true" />

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto min-w-0" role="group" aria-label="Filtrar por dirección y estatus contable">
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
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
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
        </div>

        <search className="relative w-full md:w-80 shrink-0">
          <label htmlFor="add-search" className="visually-hidden">
            Buscar CFDI por UUID, RFC, Razón Social o Concepto
          </label>
          <Search
            className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
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
            onKeyDown={(e) => {
              if (e.key === 'Escape' && searchQuery) {
                e.preventDefault();
                setSearchQuery('');
              }
            }}
            placeholder="Buscar RFC, emisor, concepto o UUID..."
            className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition shadow-2xs"
          />
          {!searchQuery ? (
            <kbd
              aria-hidden="true"
              className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] bg-slate-100 text-slate-600 border border-slate-300 px-1.5 py-0.5 rounded pointer-events-none"
            >
              /
            </kbd>
          ) : (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpiar búsqueda de comprobantes"
              title="Limpiar búsqueda (Esc)"
              className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-1 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </search>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs">
        <div className="flex flex-wrap items-center gap-2 md:hidden">
          <button
            type="button"
            aria-expanded={showMobileAdvanced}
            aria-controls="cfdi-advanced-filters"
            onClick={() => setShowMobileAdvanced((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-semibold text-xs cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>
              Filtros avanzados{secondaryActiveCount > 0 ? ` (${secondaryActiveCount})` : ''}
            </span>
          </button>
        </div>

        <div
          id="cfdi-advanced-filters"
          className={`${showMobileAdvanced ? 'flex' : 'hidden md:flex'} flex-wrap items-center gap-3 w-full md:w-auto`}
        >
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por tipo SAT">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mr-0.5">
              Tipo SAT:
            </span>
            {CFDI_TIPO_FILTERS.map((tf) => (
              <button
                key={tf.id}
                type="button"
                aria-pressed={tipoFilter === tf.id}
                onClick={() => setTipoFilter(tf.id)}
                className={pillCls(tipoFilter === tf.id)}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {setMetodoFilter && (
            <>
              <div className="hidden sm:block h-4 w-px bg-slate-200" />
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por método de pago">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mr-0.5">
                  Método:
                </span>
                {CFDI_METODO_FILTERS.map((mf) => (
                  <button
                    key={mf.id}
                    type="button"
                    aria-pressed={metodoFilter === mf.id}
                    onClick={() => setMetodoFilter(mf.id)}
                    className={pillCls(metodoFilter === mf.id)}
                  >
                    {mf.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {activeFilterCount > 0 && onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 cursor-pointer transition"
            >
              <X className="w-3 h-3" aria-hidden="true" />
              Limpiar filtros ({activeFilterCount})
            </button>
          )}
          <span role="status" aria-live="polite" className="text-[11px] font-mono text-slate-600">
            Mostrando <strong>{filteredCount}</strong> de {totalCfdisCount} comprobantes
          </span>
        </div>
      </div>

      {(setStatusSatFilter || setFormaPagoFilter) && (
        <div
          className={`${showMobileAdvanced ? 'flex' : 'hidden md:flex'} flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs`}
        >
          {setStatusSatFilter && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por estatus SAT">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-0.5">
                Estatus SAT:
              </span>
              {CFDI_STATUS_SAT_FILTERS.map((sf) => (
                <button
                  key={sf.id}
                  type="button"
                  aria-pressed={statusSatFilter === sf.id}
                  onClick={() => setStatusSatFilter(sf.id)}
                  className={pillCls(
                    statusSatFilter === sf.id,
                    sf.id === 'CANCELADO' || sf.id === 'CANCELADO_CON_POLIZA'
                  )}
                >
                  {sf.label}
                </button>
              ))}
            </div>
          )}

          {setFormaPagoFilter && (
            <>
              <div className="hidden sm:block h-4 w-px bg-slate-200" />
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por forma de pago">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-0.5">
                  Forma Pago:
                </span>
                {CFDI_FORMA_PAGO_FILTERS.map((fp) => (
                  <button
                    key={fp.id}
                    type="button"
                    aria-pressed={formaPagoFilter === fp.id}
                    onClick={() => setFormaPagoFilter(fp.id)}
                    className={pillCls(formaPagoFilter === fp.id)}
                  >
                    {fp.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
