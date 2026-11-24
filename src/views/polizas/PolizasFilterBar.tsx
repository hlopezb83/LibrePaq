import { ListCollapse, ReceiptText, Sparkles } from 'lucide-react';
import {
  ClearFiltersButton,
  PageHeader,
  SearchInput,
  TabBar,
  type TabBarItem
} from '../../components/ui';
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
  const tipoTabs: TabBarItem<'ALL' | PolizaType>[] = [
    { id: 'ALL', label: 'Todas', count: polizas.length },
    { id: 'INGRESO', label: 'Ingresos', count: polizas.filter((p) => p.tipo === 'INGRESO').length },
    { id: 'EGRESO', label: 'Egresos', count: polizas.filter((p) => p.tipo === 'EGRESO').length },
    { id: 'DIARIO', label: 'Diario', count: polizas.filter((p) => p.tipo === 'DIARIO').length }
  ];

  const hasAnyFilter =
    hasAdvancedFilters || filterTipo !== 'ALL' || originFilter !== 'ALL' || searchQuery.trim() !== '';

  return (
    <>
      <PageHeader
        title="Pólizas Contables"
        subtitle={
          <>
            Ingresos, Egresos, Diario y Cierre. Clic en cualquier cuenta para ver su{' '}
            <strong>Libro Mayor</strong>.
          </>
        }
        icon={<ReceiptText className="w-5 h-5" aria-hidden="true" />}
        iconTone="blue"
        actions={
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
        }
      />

      {/* Barra de Filtros, Modo Compacto, Búsqueda y Sumas Iguales */}
      <div className="bg-white p-4 rounded-2xl border border-slate-300/90 shadow-2xs space-y-3 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <TabBar
              mode="group"
              tabs={tipoTabs}
              activeId={filterTipo}
              onSelect={setFilterTipo}
              idPrefix="poliza-tipo-tab-"
              ariaLabel="Filtrar por tipo de póliza"
            />

            <div className="h-4 w-px bg-slate-300 mx-0.5 hidden sm:block" aria-hidden="true" />

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
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                compactMode
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <ListCollapse className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{compactMode ? 'Pólizas Contraídas' : 'Contraer Partidas'}</span>
            </button>

            {hasAnyFilter && (
              <ClearFiltersButton
                onClick={() => {
                  if (onClearFilters) {
                    onClearFilters();
                  } else {
                    setFilterTipo('ALL');
                    setOriginFilter('ALL');
                    setSearchQuery('');
                  }
                }}
              />
            )}
          </div>

          <div className="w-full lg:w-80 shrink-0">
            <label htmlFor="polizas-search" className="visually-hidden">
              Buscar póliza por concepto, cuenta, folio o UUID
            </label>
            <SearchInput
              id="polizas-search"
              value={searchQuery}
              onChange={setSearchQuery}
              clearLabel="Limpiar búsqueda de pólizas"
              placeholder="Buscar concepto, cuenta (102-01) o UUID..."
            />
          </div>
        </div>

        {searchQuery.trim() && (
          <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
              <span>
                Filtro activo: <strong>&quot;{searchQuery}&quot;</strong> ({filteredPolizas.length}{' '}
                coincidencia{filteredPolizas.length === 1 ? '' : 's'})
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
