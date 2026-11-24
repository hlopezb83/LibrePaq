import {
  Check,
  Copy,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Printer,
  Scale,
  Settings,
  Sparkles,
  TrendingUp,
  X
} from 'lucide-react';
import { handleTablistKeyDown } from '../../hooks/useTablistKeyboard';
import type { Company } from '../../shared/types';

type DeliverableTabId = 'DOSSIER' | 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'DIA17' | 'CONFIG';

const DELIVERABLE_TABS: ReadonlyArray<{
  id: DeliverableTabId;
  label: string;
  icon: typeof FileText;
}> = [
  { id: 'DOSSIER', label: 'Dossier Completo (Todos)', icon: FileText },
  { id: 'BALANZA', label: '1. Balanza Anexo 24', icon: Scale },
  { id: 'RESULTADOS', label: '2. Estado de Resultados', icon: TrendingUp },
  { id: 'BALANCE', label: '3. Balance General', icon: FileSpreadsheet },
  { id: 'DIA17', label: '4. Cédula Día 17 (SAT)', icon: Sparkles },
  { id: 'CONFIG', label: 'Firmas y Membrete', icon: Settings }
];

interface DeliverableModalHeaderProps {
  company: Company;
  mesNombre: string;
  year: number;
  copiedSummary: boolean;
  isDataReady?: boolean;
  selectedDocsCount?: number;
  onCopySummary: () => void;
  onExportCsv: () => void;
  onExportXlsx?: () => void;
  isExporting?: boolean;
  onPrint: () => void;
  onClose: () => void;
  activeTab: DeliverableTabId;
  setActiveTab: (tab: DeliverableTabId) => void;
}

export function DeliverableModalHeader({
  company,
  mesNombre,
  year,
  copiedSummary,
  isDataReady = true,
  selectedDocsCount = 4,
  onCopySummary,
  onExportCsv,
  onExportXlsx,
  isExporting,
  onPrint,
  onClose,
  activeTab,
  setActiveTab
}: DeliverableModalHeaderProps) {
  const isNoDossierDocs = activeTab === 'DOSSIER' && selectedDocsCount === 0;
  const isPrintDisabled = !isDataReady || activeTab === 'CONFIG' || isNoDossierDocs;

  return (
    <>
      <header className="px-4 sm:px-5 py-2.5 sm:py-3.5 bg-[#0A1120] text-white flex items-start justify-between gap-3 shrink-0 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-700/60 border border-blue-500/40 flex items-center justify-center text-blue-300 shrink-0">
              <FileCheck2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="executive-deliverables-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Centro de Entregables Contables y Fiscales
                </h2>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-900/80 text-blue-200 border border-blue-700">
                  Dossier ({selectedDocsCount}/6)
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate">
                {company.name} • RFC: <span className="font-mono">{company.rfc}</span> • {mesNombre} {year}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!isDataReady}
            onClick={onCopySummary}
            aria-label="Copiar resumen ejecutivo"
            title={
              isDataReady
                ? 'Copiar resumen ejecutivo en texto formal para directores o WhatsApp'
                : 'Esperando cálculo de estados financieros...'
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111C35] hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border border-[#1E293B] text-xs font-semibold text-slate-200 transition cursor-pointer"
          >
            {copiedSummary ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-300">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span className="hidden sm:inline">Copiar Resumen</span>
              </>
            )}
          </button>

          {onExportXlsx && (
            <button
              type="button"
              disabled={isExporting || !isDataReady}
              aria-busy={Boolean(isExporting)}
              onClick={onExportXlsx}
              aria-label="Descargar dossier completo en Excel (.xlsx)"
              title={
                isDataReady
                  ? 'Descargar libro de trabajo completo en formato Excel (.XLSX) con pestañas'
                  : 'Esperando cálculo de estados financieros...'
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-100 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">
                {isExporting ? 'Generando...' : 'Dossier (.XLSX)'}
              </span>
              <span className="sm:hidden text-[11px]">{isExporting ? '...' : 'XLSX'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={!isDataReady}
            onClick={onExportCsv}
            aria-label="Descargar paquete ZIP con cédulas en formato CSV"
            title={
              isDataReady
                ? 'Descargar paquete .ZIP con todas las cédulas en formato CSV para Excel'
                : 'Esperando cálculo de estados financieros...'
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111C35] hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border border-[#1E293B] text-xs font-semibold text-slate-200 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Paquete .ZIP (CSV)</span>
            <span className="sm:hidden text-[11px]">ZIP</span>
          </button>

          <button
            type="button"
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
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Imprimir / PDF</span>
          </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana de entregables"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0 self-start"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </header>

      <nav
        aria-label="Selector de documento entregable"
        className="px-4 sm:px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0 no-print text-xs"
      >
        <div
          role="tablist"
          aria-label="Secciones del paquete entregable"
          className="flex flex-nowrap items-center gap-2 erp-tab-scroller w-full sm:w-auto"
        >
          {DELIVERABLE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`deliv-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`deliv-panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) =>
                  handleTablistKeyDown(e, DELIVERABLE_TABS, activeTab, setActiveTab, 'deliv-tab-')
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-blue-700 text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{tab.id === 'DOSSIER' ? `Dossier (${selectedDocsCount}/6)` : tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-slate-700 font-mono text-[11px] hidden lg:block">
          Formato: <strong>Hoja Carta (Letter)</strong> • NIF Mexicanas Vigentes
        </div>
      </nav>
    </>
  );
}
