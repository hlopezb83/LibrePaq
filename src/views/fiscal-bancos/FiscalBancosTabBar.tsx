import { Landmark } from 'lucide-react';
import { PageHeader, TabBar, type TabBarItem } from '../../components/ui';

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

const TABS: ReadonlyArray<TabBarItem<FiscalBancosTabId>> = [
  { id: 'CONCILIACION', label: 'Conciliación Bancos' },
  { id: 'DIOT', label: 'DIOT (.txt)' },
  { id: 'PADRON_RFC', label: 'Padrón 69-B' },
  { id: 'ACTIVOS_FIJOS', label: 'Activos Fijos (INPC)' },
  { id: 'PAPEL_DIA_17', label: 'Cédula Día 17' },
  { id: 'CXC_CXP', label: 'CxC / CxP (PPD)' },
  { id: 'NOMINA_IMSS', label: 'Nómina / IMSS / ISN' },
  { id: 'INVENTARIO_COSTO', label: 'Inventario / Costo' }
];

export function FiscalBancosTabBar({ activeTab, setActiveTab }: FiscalBancosTabBarProps) {
  return (
    <PageHeader
      icon={<Landmark className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      title="Tesorería, Bancos y Cierre Fiscal"
      subtitle="Conciliación bancaria, declaraciones SAT, control patrimonial, nómina y cierre mensual"
      tabs={
        <TabBar
          tabs={TABS}
          activeId={activeTab}
          onSelect={setActiveTab}
          idPrefix="fb-tab-"
          ariaLabel="Pestañas de Tesorería y Cierre Fiscal"
          panelId={`fb-panel-${activeTab}`}
          className="no-print"
        />
      }
    />
  );
}
