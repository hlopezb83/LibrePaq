import { useEffect, useRef } from 'react';
import { Landmark } from 'lucide-react';
import { handleTablistKeyDown } from '../../hooks/useTablistKeyboard';

export type FiscalBancosTabId =
  | 'CONCILIACION'
  | 'DIOT'
  | 'PADRON_RFC'
  | 'ACTIVOS_FIJOS'
  | 'PAPEL_DIA_17'
  | 'CXC_CXP'
  | 'NOMINA_IMSS'
  | 'INVENTARIO_COSTO';

export interface FiscalBancosTabBarProps {
  activeTab: FiscalBancosTabId;
  setActiveTab: (tab: FiscalBancosTabId) => void;
}

const TABS: ReadonlyArray<{ id: FiscalBancosTabId; label: string }> = [
  { id: 'CONCILIACION', label: 'Conciliación Bancos' },
  { id: 'DIOT', label: 'DIOT (.txt)' },
  { id: 'PADRON_RFC', label: 'Padrón 69-B' },
  { id: 'ACTIVOS_FIJOS', label: 'Activos Fijos (INPC)' },
  { id: 'PAPEL_DIA_17', label: 'Cédula Día 17' },
  { id: 'CXC_CXP', label: 'CxC / CxP (PPD)' },
  { id: 'NOMINA_IMSS', label: 'Nómina / IMSS / ISN' },
  { id: 'INVENTARIO_COSTO', label: 'Inventario / Costo' }
];

export function FiscalBancosTabBar({
  activeTab,
  setActiveTab
}: FiscalBancosTabBarProps) {
  const tabRefs = useRef<Partial<Record<FiscalBancosTabId, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el && typeof el.scrollIntoView === 'function' && typeof window !== 'undefined' && window.innerWidth < 640) {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-300/90 shadow-2xs">
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
          <Landmark className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-900">
            Tesorería, Bancos y Cierre Fiscal
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Conciliación bancaria, declaraciones SAT, control patrimonial, nómina y cierre mensual
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Pestañas de Tesorería y Cierre Fiscal"
        className="erp-tab-scroller no-print flex flex-nowrap sm:grid sm:grid-cols-4 items-center gap-1.5 min-w-0 max-w-full pb-0.5 sm:pb-0"
      >
        {TABS.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              id={`fb-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`fb-panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTablistKeyDown(e, TABS, activeTab, setActiveTab, 'fb-tab-')}
              className={`shrink-0 sm:min-w-0 sm:truncate min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap text-center transition cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white border border-blue-700 shadow-xs'
                  : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
