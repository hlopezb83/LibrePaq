import {
  FileCheck2,
  FileSpreadsheet,
  Download,
  Lock,
  Printer
} from 'lucide-react';
import { Button, PageHeader, StatusBadge, TabBar, type TabBarItem } from '../../components/ui';
import type { Company } from '../../shared/types';

export type ReportTabId =
  | 'BALANZA'
  | 'RESULTADOS'
  | 'BALANCE'
  | 'AUXILIARES'
  | 'FLUJOS_CAPITAL'
  | 'ANUAL'
  | 'ANEXO24'
  | 'ENTREGABLES';

interface ReportesHeaderBarProps {
  company: Company;
  mesNombre: string;
  ejercicio: number;
  activeTab: ReportTabId;
  isPeriodLocked?: boolean;
  onTabChange: (tab: ReportTabId) => void;
  onOpenDeliverables: () => void;
  onExportCsv: () => void;
}

const TABS: ReadonlyArray<TabBarItem<ReportTabId>> = [
  { id: 'BALANZA', label: 'Balanza de Comprobación' },
  { id: 'RESULTADOS', label: 'Estado de Resultados (%)' },
  { id: 'BALANCE', label: 'Balance General (%)' },
  { id: 'AUXILIARES', label: 'Auxiliares y Diario General' },
  { id: 'FLUJOS_CAPITAL', label: 'Flujos y Capital (NIF)' },
  { id: 'ANUAL', label: 'Declaración Anual' },
  { id: 'ANEXO24', label: 'XML SAT Anexo 24' },
  { id: 'ENTREGABLES', label: 'Dossier de Cierre' }
];

export function ReportesHeaderBar({
  company,
  mesNombre,
  ejercicio,
  activeTab,
  isPeriodLocked = false,
  onTabChange,
  onOpenDeliverables,
  onExportCsv
}: ReportesHeaderBarProps) {
  const isBalanzaFallbackCsv =
    activeTab === 'FLUJOS_CAPITAL' ||
    activeTab === 'ANEXO24' ||
    activeTab === 'ENTREGABLES' ||
    activeTab === 'AUXILIARES';
  const csvButtonLabel = isBalanzaFallbackCsv
    ? 'Balanza (.CSV)'
    : activeTab === 'ANUAL'
      ? 'Anual (.CSV)'
      : 'Excel (.CSV)';
  const csvButtonTitle = isBalanzaFallbackCsv
    ? 'Exportar Balanza de Comprobación en formato CSV para Excel'
    : activeTab === 'ANUAL'
      ? 'Exportar resumen de Declaración Anual en formato CSV para Excel'
      : 'Exportar reporte activo en formato CSV para Excel';
  const isPrintDisabled = activeTab === 'ANEXO24' || activeTab === 'AUXILIARES';
  const usesDeliverablePrint = activeTab === 'BALANZA' || activeTab === 'ENTREGABLES';

  return (
    <PageHeader
      icon={<FileSpreadsheet className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      title="Estados Financieros y Balanza de Comprobación SAT"
      titleBadge={
        isPeriodLocked ? (
          <StatusBadge tone="amber" icon={<Lock className="w-3 h-3" aria-hidden="true" />}>
            Periodo Cerrado
          </StatusBadge>
        ) : undefined
      }
      subtitle={`Periodo: ${mesNombre} ${ejercicio} • Análisis Vertical (%) y Formatos Oficiales SAT (${company.rfc})`}
      actions={
        <div className="flex flex-wrap items-center gap-2 no-print">
          <Button
            variant="export-outline"
            size="md"
            onClick={onExportCsv}
            title={csvButtonTitle}
            leftIcon={<Download className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            {csvButtonLabel}
          </Button>

          <Button
            variant="secondary"
            size="md"
            disabled={isPrintDisabled}
            onClick={() => (usesDeliverablePrint ? onOpenDeliverables() : window.print())}
            title={
              activeTab === 'ANEXO24'
                ? 'Usa Descargar .ZIP SAT Oficial o .XML para Contabilidad Electrónica'
                : activeTab === 'AUXILIARES'
                  ? 'Usa el botón Imprimir Libro dentro de Auxiliares y Diario General'
                  : usesDeliverablePrint
                    ? 'Abrir vista previa imprimible completa sin recorte de tabla'
                    : 'Imprimir o guardar como PDF'
            }
            leftIcon={<Printer className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            Imprimir / PDF
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={onOpenDeliverables}
            title="Generar paquete ejecutivo completo en PDF/Excel para el cliente o auditor"
            leftIcon={<FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            Dossier PDF / Excel
          </Button>
        </div>
      }
      tabs={
        <TabBar
          tabs={TABS}
          activeId={activeTab}
          onSelect={onTabChange}
          idPrefix="report-tab-"
          ariaLabel="Secciones de estados financieros y formatos SAT"
          panelId={`report-panel-${activeTab}`}
          className="no-print"
        />
      }
    />
  );
}
