import {
  FileCheck2,
  FileSpreadsheet,
  Download,
  Printer
} from 'lucide-react';
import type { Company } from '../../shared/types';

export type ReportTabId = 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'ANEXO24' | 'ENTREGABLES';

interface ReportesHeaderBarProps {
  company: Company;
  mesNombre: string;
  ejercicio: number;
  activeTab: ReportTabId;
  onTabChange: (tab: ReportTabId) => void;
  onOpenDeliverables: () => void;
  onExportCsv: () => void;
}

const TABS: { id: ReportTabId; label: string }[] = [
  { id: 'BALANZA', label: 'Balanza de Comprobación' },
  { id: 'RESULTADOS', label: 'Estado de Resultados (%)' },
  { id: 'BALANCE', label: 'Balance General (%)' },
  { id: 'ANEXO24', label: 'XML SAT Anexo 24' },
  { id: 'ENTREGABLES', label: 'Dossier de Cierre' }
];

export function ReportesHeaderBar({
  company,
  mesNombre,
  ejercicio,
  activeTab,
  onTabChange,
  onOpenDeliverables,
  onExportCsv
}: ReportesHeaderBarProps) {
  return (
    <div className="space-y-3.5">
      {/* 1. Encabezado Principal de Reportes y Entregables */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-300/90 shadow-2xs">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              Estados Financieros y Balanza de Comprobación SAT
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Periodo: {mesNombre} {ejercicio} • Análisis Vertical (%) y Formatos Oficiales SAT ({company.rfc})
            </p>
          </div>
        </div>

        {/* Acciones de Exportación e Impresión */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            Excel (.CSV)
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>Imprimir / PDF</span>
          </button>

          <button
            type="button"
            onClick={onOpenDeliverables}
            title="Generar paquete ejecutivo completo en PDF/ZIP para el cliente o auditor"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition cursor-pointer shrink-0"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-blue-100" aria-hidden="true" />
            <span>Generar PDF Folio</span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Navegación entre Estados Financieros */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-300/90 shadow-2xs flex items-center gap-1.5 overflow-x-auto no-print">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === t.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
