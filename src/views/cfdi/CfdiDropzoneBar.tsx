import React from 'react';
import {
  CloudDownload,
  FileCode2,
  FilePlus2,
  FileSpreadsheet,
  Lock,
  Sparkles,
  UploadCloud
} from 'lucide-react';
import { SatSoapFielPanel } from './sat-soap/SatSoapFielPanel';
import { getFirstDateForPeriod, getLastDateForPeriod } from '../../lib/formatters';
import { isSandboxDemoCompany } from '../../lib/sandbox-demo-seeder';
import type { Company } from '../../shared/types';

export interface CfdiDropzoneBarProps {
  isDragging: boolean;
  setIsDragging: (val: boolean) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pendingCfdisCount: number;
  isPeriodLocked: boolean;
  isBatchContabilizarPending: boolean;
  batchProgress?: { current: number; total: number } | null;
  onBatchContabilizarPending: () => void;
  showSoapFielPanel: boolean;
  setShowSoapFielPanel: React.Dispatch<React.SetStateAction<boolean>>;
  onExportCsv: () => void;
  onOpenSimulator: () => void;
  activeCompany?: Company | null;
  activeCompanyId: string;
  currentYear: number;
  currentPeriod: number;
  onSoapDownloadSuccess: (msg: string) => void;
}

export function CfdiDropzoneBar({
  isDragging,
  setIsDragging,
  handleDrop,
  fileInputRef,
  handleFileUpload,
  pendingCfdisCount,
  isPeriodLocked,
  isBatchContabilizarPending,
  batchProgress,
  onBatchContabilizarPending,
  showSoapFielPanel,
  setShowSoapFielPanel,
  onExportCsv,
  onOpenSimulator,
  activeCompany,
  activeCompanyId,
  currentYear,
  currentPeriod,
  onSoapDownloadSuccess
}: CfdiDropzoneBarProps) {
  return (
    <>
      {/* Encabezado del ADD + Zona Drag & Drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 bg-white p-4 sm:p-5 rounded-2xl border transition shadow-2xs ${
          isDragging
            ? 'border-2 border-dashed border-blue-600 bg-blue-50/40'
            : 'border-slate-300/90'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <FileCode2 className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              Bóveda Digital de Comprobantes (ADD CFDI 4.0)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isDragging
                ? '¡Suelta tus archivos .XML aquí para importarlos a la Bóveda ADD!'
                : 'Descarga tus facturas del mes directamente del SAT con e.firma, sube archivos .XML o arrástralos aquí'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,text/xml,.zip,application/zip,application/x-zip-compressed"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          {pendingCfdisCount > 0 && (
            <button
              type="button"
              disabled={isBatchContabilizarPending || isPeriodLocked}
              onClick={onBatchContabilizarPending}
              title={
                isPeriodLocked
                  ? 'Periodo bloqueado ante el SAT'
                  : 'Contabilizar comprobantes pendientes en lote'
              }
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition ${
                isPeriodLocked
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer ring-1 ring-emerald-500'
              }`}
            >
              {isPeriodLocked ? (
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              ) : isBatchContabilizarPending ? (
                <Sparkles className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {isBatchContabilizarPending
                ? batchProgress
                  ? `Contabilizando (${batchProgress.current}/${batchProgress.total})...`
                  : 'Contabilizando...'
                : isPeriodLocked
                ? 'Periodo Bloqueado'
                : `Contabilizar (${pendingCfdisCount})`}
            </button>
          )}

          {/* 1. Botón Destacado: Descargar del SAT (Superpoder con e.firma) */}
          <button
            type="button"
            aria-expanded={showSoapFielPanel}
            aria-controls="sat-soap-fiel-section"
            onClick={() => setShowSoapFielPanel((prev) => !prev)}
            title="Descargar automáticamente facturas emitidas y recibidas del SAT con e.firma"
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer border ${
              showSoapFielPanel
                ? 'bg-indigo-700 text-white border-indigo-800 ring-2 ring-indigo-400 ring-offset-1'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700'
            }`}
          >
            <CloudDownload className="w-4 h-4 text-indigo-100" aria-hidden="true" />
            <span>Descargar del SAT</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-800/90 text-indigo-100">
              e.firma
            </span>
            <span className="text-[10px] text-indigo-200 font-mono" aria-hidden="true">
              {showSoapFielPanel ? '▲' : '▼'}
            </span>
          </button>

          {/* 2. Botón Primario: Subir XMLs Locales */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Subir archivos XML locales a la Bóveda ADD (Alt+U)"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-2xs transition cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5 text-blue-100" aria-hidden="true" />
            <span>Subir XMLs</span>
            <kbd className="hidden sm:inline font-mono text-[9px] bg-blue-800 px-1 py-0.5 rounded border border-blue-400/50 text-blue-100">
              Alt+U
            </kbd>
          </button>

          {/* 3. Botón Secundario: Captura Manual CFDI */}
          <button
            type="button"
            onClick={onOpenSimulator}
            title="Registrar comprobante o retención manual (Alt+S)"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            <FilePlus2 className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>Captura Manual</span>
            <kbd className="hidden sm:inline font-mono text-[9px] bg-white px-1 py-0.5 rounded border border-slate-300 text-slate-500">
              Alt+S
            </kbd>
          </button>

          {/* 4. Botón Reporte: Exportar a Excel */}
          <button
            type="button"
            onClick={onExportCsv}
            title="Exportar comprobantes visibles a formato Excel / CSV"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Banner de progreso y advertencia de permanencia */}
      {batchProgress && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 shadow-2xs space-y-2 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-emerald-950">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-spin shrink-0" aria-hidden="true" />
              <span>Contabilizando comprobantes en lote... Por favor mantén esta pestaña abierta.</span>
            </span>
            <span className="font-mono bg-white px-2 py-0.5 rounded-lg border border-emerald-300 text-emerald-900 shadow-2xs">
              {batchProgress.current} de {batchProgress.total} pólizas ({Math.round((batchProgress.current / batchProgress.total) * 100)}%)
            </span>
          </div>
          <div className="w-full bg-emerald-200/80 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-600 h-2.5 rounded-full transition-all duration-150 ease-out"
              style={{
                width: `${Math.max(3, Math.round((batchProgress.current / batchProgress.total) * 100))}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Panel de Descarga Masiva del SAT con e.firma */}
      {showSoapFielPanel && activeCompany && (
        <div id="sat-soap-fiel-section" className="space-y-2">
          <SatSoapFielPanel
            companyId={activeCompanyId}
            companyRfc={activeCompany.rfc}
            defaultStartDate={getFirstDateForPeriod(currentYear, currentPeriod)}
            defaultEndDate={getLastDateForPeriod(currentYear, currentPeriod)}
            onDownloadSuccess={onSoapDownloadSuccess}
            isDemoCompany={isSandboxDemoCompany(activeCompany)}
            currentYear={currentYear}
            currentPeriod={currentPeriod}
            pendingCfdisCount={pendingCfdisCount}
            onBatchAutoPoliza={onBatchContabilizarPending}
            isBatchAutoPolizaPending={isBatchContabilizarPending}
          />
        </div>
      )}
    </>
  );
}
