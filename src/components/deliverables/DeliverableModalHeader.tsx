import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Scale,
  Settings,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { Button, TabBar, type TabBarItem } from '../ui';

export type DeliverableTabId = 'DOSSIER' | 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'DIA17' | 'CONFIG';

interface DeliverableHeaderActionsProps {
  copiedSummary: boolean;
  isDataReady?: boolean;
  selectedDocsCount?: number;
  onCopySummary: () => void;
  onExportCsv: () => void;
  onExportXlsx?: () => void;
  isExporting?: boolean;
  onPrint: () => void;
}

export function DeliverableHeaderActions({
  copiedSummary,
  isDataReady = true,
  selectedDocsCount = 4,
  onCopySummary,
  onExportCsv,
  onExportXlsx,
  isExporting,
  onPrint,
  activeTab
}: DeliverableHeaderActionsProps & { activeTab: DeliverableTabId }) {
  const isNoDossierDocs = activeTab === 'DOSSIER' && selectedDocsCount === 0;
  const isPrintDisabled = !isDataReady || activeTab === 'CONFIG' || isNoDossierDocs;
  const isCsvDisabled = !isDataReady || selectedDocsCount === 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={!isDataReady}
        onClick={onCopySummary}
        aria-label="Copiar resumen ejecutivo"
        title={
          isDataReady
            ? 'Copiar resumen ejecutivo en texto formal para directores o WhatsApp'
            : 'Esperando cálculo de estados financieros...'
        }
        leftIcon={
          copiedSummary ? (
            <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          )
        }
      >
        {copiedSummary ? (
          <span className="text-emerald-800">Copiado</span>
        ) : (
          <span className="hidden sm:inline">Copiar Resumen</span>
        )}
      </Button>

      {onExportXlsx && (
        <Button
          variant="export"
          size="sm"
          loading={Boolean(isExporting)}
          disabled={!isDataReady}
          onClick={onExportXlsx}
          aria-label="Descargar dossier completo en Excel (.xlsx)"
          title={
            isDataReady
              ? 'Descargar libro de trabajo completo en formato Excel (.XLSX) con pestañas'
              : 'Esperando cálculo de estados financieros...'
          }
          leftIcon={<Download className="w-3.5 h-3.5" aria-hidden="true" />}
        >
          <span className="hidden sm:inline">
            {isExporting ? 'Generando...' : 'Dossier (.XLSX)'}
          </span>
          <span className="sm:hidden text-[11px]">{isExporting ? '...' : 'XLSX'}</span>
        </Button>
      )}

      <Button
        variant="export-outline"
        size="sm"
        disabled={isCsvDisabled}
        onClick={onExportCsv}
        aria-label="Descargar paquete ZIP con cédulas en formato CSV"
        title={
          !isDataReady
            ? 'Esperando cálculo de estados financieros...'
            : selectedDocsCount === 0
              ? 'Selecciona al menos una cédula del dossier para exportar el paquete ZIP'
              : 'Descargar paquete .ZIP con todas las cédulas seleccionadas en formato CSV para Excel'
        }
        leftIcon={<Download className="w-3.5 h-3.5" aria-hidden="true" />}
      >
        <span className="hidden sm:inline">Paquete .ZIP (CSV)</span>
        <span className="sm:hidden text-[11px]">ZIP</span>
      </Button>

      <Button
        variant="primary"
        size="sm"
        disabled={isPrintDisabled}
        onClick={onPrint}
        aria-label="Imprimir o guardar PDF del dossier"
        title={
          !isDataReady
            ? 'Esperando cálculo de estados financieros...'
            : activeTab === 'CONFIG'
              ? 'Selecciona un documento del dossier (no la pestaña de Firmas) para imprimir o guardar PDF'
              : isNoDossierDocs
                ? 'Selecciona al menos un documento del dossier para imprimir'
                : 'Imprimir o guardar como PDF formal el dossier seleccionado'
        }
        leftIcon={<Printer className="w-3.5 h-3.5" aria-hidden="true" />}
      >
        <span>Imprimir / PDF</span>
      </Button>
    </div>
  );
}

export function DeliverableModalHeader({
  selectedDocsCount = 4,
  activeTab,
  setActiveTab
}: {
  selectedDocsCount?: number;
  activeTab: DeliverableTabId;
  setActiveTab: (tab: DeliverableTabId) => void;
}) {
  const tabs: ReadonlyArray<TabBarItem<DeliverableTabId>> = [
    {
      id: 'DOSSIER',
      label: `Dossier (${selectedDocsCount}/6)`,
      icon: <FileText className="w-3.5 h-3.5" aria-hidden="true" />
    },
    {
      id: 'BALANZA',
      label: '1. Balanza Anexo 24',
      icon: <Scale className="w-3.5 h-3.5" aria-hidden="true" />
    },
    {
      id: 'RESULTADOS',
      label: '2. Estado de Resultados',
      icon: <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
    },
    {
      id: 'BALANCE',
      label: '3. Balance General',
      icon: <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
    },
    {
      id: 'DIA17',
      label: '4. Cédula Día 17 (SAT)',
      icon: <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
    },
    {
      id: 'CONFIG',
      label: 'Firmas y Membrete',
      icon: <Settings className="w-3.5 h-3.5" aria-hidden="true" />
    }
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 no-print">
      <TabBar
        tabs={tabs}
        activeId={activeTab}
        onSelect={setActiveTab}
        idPrefix="deliv-tab-"
        panelId={`deliv-panel-${activeTab}`}
        ariaLabel="Secciones del paquete entregable"
        className="flex-1 min-w-0"
      />
      <div className="text-slate-600 font-mono text-[11px] hidden xl:block shrink-0">
        Formato: <strong className="text-slate-800">Hoja Carta (Letter)</strong> • NIF Mexicanas Vigentes
      </div>
    </div>
  );
}
