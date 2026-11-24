import {
  ListCollapse,
  ReceiptText,
  Search,
  Sparkles,
  X
} from 'lucide-react';
import type { Poliza, PolizaType } from '../../shared/types';
import { hasPolizaCfdi, type PolizaPeriodScope } from './filterPolizas';
import { PolizasAdvancedFilterRow } from './PolizasAdvancedFilterRow';
import { PolizasHeaderActions } from './PolizasHeaderActions';
import { PolizasTotalsBar } from './PolizasTotalsBar';

export interface PolizasFilterBarProps {
  currentYear?: number;
  currentPeriod?: number;
  polizas: Poliza[];
  filteredPolizas: Poliza[];
  filterTipo: 'ALL' | PolizaType;
  setFilterTipo: (t: 'ALL' | PolizaType) => void;
  originFilter: 'ALL' | 'WITH_CFDI' | 'MANUAL';
  setOriginFilter: (o: 'ALL' | 'WITH_CFDI' | 'MANUAL') => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  periodScope?: PolizaPeriodScope;
  setPeriodScope?: (s: PolizaPeriodScope) => void;
  periodFrom?: number;
  setPeriodFrom?: (p: number) => void;
  periodTo?: number;
  setPeriodTo?: (p: number) => void;
  minAmount?: string;
  setMinAmount?: (v: string) => void;
  maxAmount?: string;
  setMaxAmount?: (v: string) => void;
  hasAdvancedFilters?: boolean;
  onClearFilters?: () => void;
  compactMode: boolean;
  setCompactMode: (updater: (prev: boolean) => boolean) => void;
  filteredTotals: { cargos: number; abonos: number };
  isPeriodLocked: boolean;
  isPeriod13Locked?: boolean;
  isReadOnlyClient?: boolean;
  hasPolizasToExport?: boolean;
  onNewPoliza: () => void;
  onOpenPedimentoModal?: () => void;
  onExportCsv: () => void;
  onPrintPdf?: () => void;
  onCloseYear: () => void;
  isCloseYearPending: boolean;
}

export function PolizasFilterBar({
  currentYear,
  currentPeriod,
  polizas,
  filteredPolizas,
  filterTipo,
  setFilterTipo,
  originFilter,
  setOriginFilter,
  searchQuery,
  setSearchQuery,
  periodScope = 'CURRENT',
  setPeriodScope,
  periodFrom = 1,
  setPeriodFrom,
  periodTo = 12,
  setPeriodTo,
  minAmount = '',
  setMinAmount,
  maxAmount = '',
  setMaxAmount,
  hasAdvancedFilters = false,
  onClearFilters,
  compactMode,
  setCompactMode,
  filteredTotals,
  isPeriodLocked,
  isPeriod13Locked = false,
  isReadOnlyClient = false,
  hasPolizasToExport = true,
  onNewPoliza,
  onOpenPedimentoModal,
  onExportCsv,
  onPrintPdf,
  onCloseYear,
  isCloseYearPending
}: PolizasFilterBarProps) {
  return (
    <>
      {/* Encabezado Principal y Acciones */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-300/90 shadow-2xs">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <ReceiptText className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              Pólizas Contables
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Ingresos, Egresos, Diario y Cierre. Clic en cualquier cuenta para ver su <strong>Libro Mayor</strong>.
            </p>
          </div>
        </div>

        <PolizasHeaderActions
          currentYear={currentYear}
          isPeriodLocked={isPeriodLocked}
          isPeriod13Locked={isPeriod13Locked}
          isReadOnlyClient={isReadOnlyClient}
          isCloseYearPending={isCloseYearPending}
          hasPolizasToExport={hasPolizasToExport}
          onNewPoliza={onNewPoliza}
          onOpenPedimentoModal={onOpenPedimentoModal}
          onExportCsv={onExportCsv}
          onPrintPdf={onPrintPdf}
          onCloseYear={onCloseYear}
        />
      </div>

      {/* Barra de Filtros, Modo Compacto, Búsqueda y Sumas Iguales */}
      <div className="bg-white p-4 rounded-2xl border border-slate-300/90 shadow-2xs space-y-3 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Filtrar por tipo de póliza y origen"
          >
            {[
              { id: 'ALL' as const, label: `Todas (${polizas.length})` },
              {
                id: 'INGRESO' as const,
                label: `Ingresos (${polizas.filter((p) => p.tipo === 'INGRESO').length})`
              },
              {
                id: 'EGRESO' as const,
                label: `Egresos (${polizas.filter((p) => p.tipo === 'EGRESO').length})`
              },
              {
                id: 'DIARIO' as const,
                label: `Diario (${polizas.filter((p) => p.tipo === 'DIARIO').length})`
              }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={filterTipo === t.id}
                onClick={() => setFilterTipo(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  filterTipo === t.id
                    ? 'bg-blue-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                {t.label}
              </button>
            ))}

            <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

            <div
              className="inline-flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs"
              role="group"
              aria-label="Filtrar por comprobante digital"
            >
              {[
                { id: 'ALL' as const, label: 'Todas' },
                {
                  id: 'WITH_CFDI' as const,
                  label: `Con CFDI (${polizas.filter(hasPolizaCfdi).length})`
                },
                {
                  id: 'MANUAL' as const,
                  label: `Manuales (${polizas.filter((p) => !hasPolizaCfdi(p)).length})`
                }
              ].map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={originFilter === o.id}
                  onClick={() => setOriginFilter(o.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    originFilter === o.id
                      ? 'bg-white text-blue-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCompactMode((prev) => !prev)}
              aria-pressed={compactMode}
              className={`ml-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                compactMode
                  ? 'bg-[#0A1120] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <ListCollapse className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{compactMode ? 'Pólizas Contraídas' : 'Contraer Partidas'}</span>
            </button>

            {(hasAdvancedFilters || filterTipo !== 'ALL' || originFilter !== 'ALL' || searchQuery.trim() !== '') && (
              <button
                type="button"
                onClick={() => {
                  if (onClearFilters) {
                    onClearFilters();
                  } else {
                    setFilterTipo('ALL');
                    setOriginFilter('ALL');
                    setSearchQuery('');
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 cursor-pointer transition"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <search className="relative w-full md:w-80">
            <label htmlFor="polizas-search" className="visually-hidden">
              Buscar póliza por concepto, cuenta, folio o UUID
            </label>
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="polizas-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar concepto, cuenta (102-01) o UUID..."
              className="w-full pl-9.5 pr-8 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda de pólizas"
                title="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </search>
        </div>

        {searchQuery.trim() && (
          <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
              <span>
                Filtro activo: <strong>"{searchQuery}"</strong> ({filteredPolizas.length} coincidencia{filteredPolizas.length === 1 ? '' : 's'})
              </span>
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
            >
              Ver todas las pólizas
            </button>
          </div>
        )}

        <PolizasAdvancedFilterRow
          currentPeriod={currentPeriod}
          periodScope={periodScope}
          setPeriodScope={setPeriodScope}
          periodFrom={periodFrom}
          setPeriodFrom={setPeriodFrom}
          periodTo={periodTo}
          setPeriodTo={setPeriodTo}
          minAmount={minAmount}
          setMinAmount={setMinAmount}
          maxAmount={maxAmount}
          setMaxAmount={setMaxAmount}
        />

        {/* Sumas Iguales y Balance del Periodo */}
        <PolizasTotalsBar
          totalCount={polizas.length}
          filteredCount={filteredPolizas.length}
          totals={filteredTotals}
          periodScope={periodScope}
          currentPeriod={currentPeriod}
          periodFrom={periodFrom}
          periodTo={periodTo}
        />
      </div>
    </>
  );
}
