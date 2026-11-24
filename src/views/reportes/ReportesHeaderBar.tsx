import {
  ChevronRight,
  FileCheck2,
  FileSpreadsheet,
  Download,
  Lock,
  Printer
} from 'lucide-react';
import { handleTablistKeyDown } from '../../hooks/useTablistKeyboard';
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

const TABS: { id: ReportTabId; label: string }[] = [
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
    <div className="space-y-3.5">
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-300/90 shadow-2xs">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900">
                Estados Financieros y Balanza de Comprobación SAT
              </h1>
              {isPeriodLocked && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <Lock className="w-3 h-3" aria-hidden="true" />
                  Periodo Cerrado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Periodo: {mesNombre} {ejercicio} • Análisis Vertical (%) y Formatos Oficiales SAT ({company.rfc})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
          <button
            type="button"
            onClick={onExportCsv}
            title={csvButtonTitle}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>{csvButtonLabel}</span>
          </button>

          <button
            type="button"
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>Imprimir / PDF</span>
          </button>

          <button
            type="button"
            onClick={onOpenDeliverables}
            title="Generar paquete ejecutivo completo en PDF/Excel para el cliente o auditor"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition cursor-pointer shrink-0"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-blue-100" aria-hidden="true" />
            <span>Dossier PDF / Excel</span>
          </button>
        </div>
      </div>

      <div className="fb-tabbar-shell relative no-print">
        <div
          role="tablist"
          aria-label="Secciones de estados financieros y formatos SAT"
          className="flex flex-nowrap md:flex-wrap md:overflow-visible items-center gap-2 bg-white p-2.5 sm:p-3 pr-8 md:pr-3 rounded-2xl border border-slate-300/90 shadow-2xs erp-tab-scroller"
        >
          {TABS.map((t) => {
            const isSelected = activeTab === t.id;
            return (
              <button
                key={t.id}
                id={`report-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`report-panel-${t.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onTabChange(t.id)}
                onKeyDown={(e) => handleTablistKeyDown(e, TABS, activeTab, onTabChange, 'report-tab-')}
                className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div
          aria-hidden="true"
          className="md:hidden pointer-events-none absolute inset-y-1 right-1 w-8 rounded-r-xl bg-gradient-to-l from-white via-white/90 to-transparent flex items-center justify-end pr-1 text-slate-500"
        >
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
