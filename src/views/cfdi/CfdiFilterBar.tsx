import { useState } from 'react';
import { Filter } from 'lucide-react';
import { ClearFiltersButton, SearchInput, Select } from '../../components/ui';
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

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-300/90 shadow-2xs space-y-3 w-full min-w-0 max-w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 w-full min-w-0">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <div
            className="flex flex-wrap items-center gap-1 p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-xs max-w-full"
            role="group"
            aria-label="Alcance temporal de comprobantes"
          >
            <button
              type="button"
              aria-pressed={periodScope === 'CURRENT'}
              onClick={() => setPeriodScope('CURRENT')}
              className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                periodScope === 'CURRENT'
                  ? 'bg-white text-blue-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={`Ver únicamente comprobantes del Periodo P${String(currentPeriod).padStart(2, '0')}/${currentYear}`}
            >
              <span>Periodo P{String(currentPeriod).padStart(2, '0')}</span>
              <span className="font-mono text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold tabular-nums">
                {countInCurrentPeriod}
              </span>
            </button>
            <button
              type="button"
              aria-pressed={periodScope === 'ALL'}
              onClick={() => setPeriodScope('ALL')}
              className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                periodScope === 'ALL'
                  ? 'bg-white text-blue-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={`Ver todos los comprobantes del ejercicio ${currentYear}`}
            >
              <span>Todo {currentYear}</span>
              <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold tabular-nums">
                {allYearCount ?? totalCfdisCount}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              aria-expanded={showMobileAdvanced}
              aria-controls="cfdi-advanced-filters"
              onClick={() => setShowMobileAdvanced((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-semibold text-xs cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
              <span>
                Filtros{secondaryActiveCount > 0 ? ` (${secondaryActiveCount})` : ''}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <label htmlFor="add-search" className="visually-hidden">
            Buscar CFDI por UUID, RFC, Razón Social o Concepto
          </label>
          <SearchInput
            id="add-search"
            value={searchQuery}
            onChange={setSearchQuery}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            hintKey="/"
            placeholder="Buscar RFC, emisor, concepto o UUID..."
            clearLabel="Limpiar búsqueda de comprobantes"
            containerClassName="w-full md:w-80 shrink-0"
          />
        </div>
      </div>

      <div
        id="cfdi-advanced-filters"
        className={`${showMobileAdvanced ? 'grid' : 'hidden md:grid'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2.5 border-t border-slate-100`}
      >
        <div>
          <label
            htmlFor="cfdi-filter-tipo"
            className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1"
          >
            Tipo SAT
          </label>
          <Select
            id="cfdi-filter-tipo"
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value as CfdiTipoFilter)}
          >
            {CFDI_TIPO_FILTERS.map((tf) => (
              <option key={tf.id} value={tf.id}>
                {tf.label}
              </option>
            ))}
          </Select>
        </div>

        {setMetodoFilter && (
          <div>
            <label
              htmlFor="cfdi-filter-metodo"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1"
            >
              Método de Pago
            </label>
            <Select
              id="cfdi-filter-metodo"
              value={metodoFilter}
              onChange={(e) => setMetodoFilter(e.target.value as CfdiMetodoFilter)}
            >
              {CFDI_METODO_FILTERS.map((mf) => (
                <option key={mf.id} value={mf.id}>
                  {mf.label}
                </option>
              ))}
            </Select>
          </div>
        )}

        {setStatusSatFilter && (
          <div>
            <label
              htmlFor="cfdi-filter-status-sat"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1"
            >
              Estatus SAT
            </label>
            <Select
              id="cfdi-filter-status-sat"
              value={statusSatFilter}
              onChange={(e) => setStatusSatFilter(e.target.value as CfdiStatusSatFilter)}
            >
              {CFDI_STATUS_SAT_FILTERS.map((sf) => (
                <option key={sf.id} value={sf.id}>
                  {sf.label}
                </option>
              ))}
            </Select>
          </div>
        )}

        {setFormaPagoFilter && (
          <div>
            <label
              htmlFor="cfdi-filter-forma-pago"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1"
            >
              Forma de Pago
            </label>
            <Select
              id="cfdi-filter-forma-pago"
              value={formaPagoFilter}
              onChange={(e) => setFormaPagoFilter(e.target.value as CfdiFormaPagoFilter)}
            >
              {CFDI_FORMA_PAGO_FILTERS.map((fp) => (
                <option key={fp.id} value={fp.id}>
                  {fp.label}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
        <span role="status" aria-live="polite" className="text-[11px] font-mono text-slate-600">
          Mostrando <strong className="text-slate-900 tabular-nums">{filteredCount}</strong> de{' '}
          <span className="tabular-nums">{totalCfdisCount}</span> comprobantes
        </span>

        {activeFilterCount > 0 && onResetFilters && (
          <ClearFiltersButton count={activeFilterCount} onClick={onResetFilters} />
        )}
      </div>
    </div>
  );
}
