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
import type { Company } from '../../shared/types';

interface DeliverableModalHeaderProps {
  company: Company;
  mesNombre: string;
  year: number;
  copiedSummary: boolean;
  onCopySummary: () => void;
  onExportCsv: () => void;
  onExportXlsx?: () => void;
  isExporting?: boolean;
  onPrint: () => void;
  onClose: () => void;
  activeTab: 'DOSSIER' | 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'DIA17' | 'CONFIG';
  setActiveTab: (tab: 'DOSSIER' | 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'DIA17' | 'CONFIG') => void;
}

export function DeliverableModalHeader({
  company,
  mesNombre,
  year,
  copiedSummary,
  onCopySummary,
  onExportCsv,
  onExportXlsx,
  isExporting,
  onPrint,
  onClose,
  activeTab,
  setActiveTab
}: DeliverableModalHeaderProps) {
  return (
    <>
      <header className="px-4 sm:px-5 py-3.5 bg-[#0A1120] text-white flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-700/60 border border-blue-500/40 flex items-center justify-center text-blue-300 shrink-0">
            <FileCheck2 className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 id="executive-deliverables-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                Centro de Entregables Contables y Fiscales
              </h1>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-900/80 text-blue-200 border border-blue-700">
                Dossier de Cierre
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
            onClick={onCopySummary}
            aria-label="Copiar resumen ejecutivo"
            title="Copiar resumen ejecutivo en texto formal para directores o WhatsApp"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111C35] hover:bg-slate-800 border border-[#1E293B] text-xs font-semibold text-slate-200 transition cursor-pointer"
          >
            {copiedSummary ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Copiar Resumen</span>
              </>
            )}
          </button>

          {onExportXlsx && (
            <button
              type="button"
              disabled={isExporting}
              onClick={onExportXlsx}
              aria-label="Descargar dossier completo en Excel (.xlsx)"
              title="Descargar libro de trabajo completo en formato Excel (.XLSX) con pestañas"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-100" />
              <span className="hidden sm:inline">
                {isExporting ? 'Generando...' : 'Dossier (.XLSX)'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onExportCsv}
            aria-label="Descargar cédulas en formato CSV"
            title="Descargar todas las cédulas en archivos Excel (.CSV)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111C35] hover:bg-slate-800 border border-[#1E293B] text-xs font-semibold text-slate-200 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            type="button"
            onClick={onPrint}
            aria-label="Imprimir o guardar PDF del dossier"
            title="Imprimir o guardar como PDF formal el dossier seleccionado"
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / PDF</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de entregables"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <nav
        aria-label="Selector de documento entregable"
        className="px-4 sm:px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0 no-print text-xs"
      >
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto">
          {([
            { id: 'DOSSIER', label: 'Dossier Completo (Todos)', icon: FileText },
            { id: 'BALANZA', label: '1. Balanza Anexo 24', icon: Scale },
            { id: 'RESULTADOS', label: '2. Estado de Resultados', icon: TrendingUp },
            { id: 'BALANCE', label: '3. Balance General', icon: FileSpreadsheet },
            { id: 'DIA17', label: '4. Cédula Día 17 (SAT)', icon: Sparkles },
            { id: 'CONFIG', label: 'Firmas y Membrete', icon: Settings }
          ] as const).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-blue-700 text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-slate-500 font-mono text-[11px] hidden lg:block">
          Formato: <strong>Hoja Carta (Letter)</strong> • NIF Mexicanas Vigentes
        </div>
      </nav>
    </>
  );
}
