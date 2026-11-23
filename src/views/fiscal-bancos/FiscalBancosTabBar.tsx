import { Landmark } from 'lucide-react';
import { handleTablistKeyDown } from '../../hooks/useTablistKeyboard';

export type FiscalBancosTabId =
  | 'CONCILIACION'
  | 'DIOT'
  | 'PADRON_RFC'
  | 'ACTIVOS_FIJOS'
  | 'PAPEL_DIA_17';

export interface FiscalBancosTabBarProps {
  activeTab: FiscalBancosTabId;
  setActiveTab: (tab: FiscalBancosTabId) => void;
}

export function FiscalBancosTabBar({
  activeTab,
  setActiveTab
}: FiscalBancosTabBarProps) {
  const tabs = [
    { id: 'CONCILIACION' as const, label: 'Conciliación Bancos' },
    { id: 'DIOT' as const, label: 'DIOT (.txt)' },
    { id: 'PADRON_RFC' as const, label: 'Padrón 69-B' },
    { id: 'ACTIVOS_FIJOS' as const, label: 'Activos Fijos (INPC)' },
    { id: 'PAPEL_DIA_17' as const, label: 'Cédula Día 17' }
  ];

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
            Conciliación bancaria, DIOT batch, Padrón 69-B, Activos Fijos y Cédula Día 17
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Pestañas de Tesorería y Cierre Fiscal"
        className="erp-tab-scroller no-print max-w-full pb-0.5 shrink-0"
      >
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`fb-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`fb-panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTablistKeyDown(e, tabs, activeTab, setActiveTab, 'fb-tab-')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
