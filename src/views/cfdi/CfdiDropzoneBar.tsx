import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  CloudDownload,
  FileCode2,
  Lock,
  Sparkles,
  UploadCloud
} from 'lucide-react';
import {
  Button,
  PageHeader,
  StatusBadge,
  TabBar,
  getButtonClasses,
  type TabBarItem
} from '../../components/ui';
import { CfdiDropzoneSecondaryActions } from './CfdiDropzoneSecondaryActions';
import type { CfdiTabFilter } from './filterCfdis';
import { SatSoapFielPanel } from './sat-soap/SatSoapFielPanel';
import { getFirstDateForPeriod, getLastDateForPeriod } from '../../lib/formatters';
import { isSandboxDemoCompany } from '../../lib/sandbox-demo-seeder';
import type { Company } from '../../shared/types';

export interface CfdiDropzoneBarProps {
  isDragging: boolean;
  setIsDragging: (val: boolean) => void;
  isUploadingFiles?: boolean;
  uploadBatchProgress?: {
    currentBatch: number;
    totalBatches: number;
    processed: number;
    total: number;
  } | null;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pendingCfdisCount: number;
  isPeriodLocked: boolean;
  isReadOnlyClient?: boolean;
  isBatchContabilizarPending: boolean;
  batchProgress?: { current: number; total: number } | null;
  onBatchContabilizarPending: () => void;
  showSoapFielPanel: boolean;
  setShowSoapFielPanel: React.Dispatch<React.SetStateAction<boolean>>;
  onExportCsv: () => void;
  onExportZip?: () => void;
  isExportingZip?: boolean;
  hasVisibleCfdis?: boolean;
  onOpenSimulator: () => void;
  activeCompany?: Company | null;
  activeCompanyId: string;
  currentYear: number;
  currentPeriod: number;
  onSoapDownloadSuccess: (msg: string) => void;
  tab: CfdiTabFilter;
  setTab: (tab: CfdiTabFilter) => void;
  totalCfdisCount: number;
  emitidosCount: number;
  recibidosCount: number;
}

export function CfdiDropzoneBar({
  isDragging,
  setIsDragging,
  isUploadingFiles = false,
  uploadBatchProgress = null,
  handleDrop,
  fileInputRef,
  handleFileUpload,
  pendingCfdisCount,
  isPeriodLocked,
  isReadOnlyClient = false,
  isBatchContabilizarPending,
  batchProgress,
  onBatchContabilizarPending,
  showSoapFielPanel,
  setShowSoapFielPanel,
  onExportCsv,
  onExportZip,
  isExportingZip = false,
  hasVisibleCfdis = false,
  onOpenSimulator,
  activeCompany,
  activeCompanyId,
  currentYear,
  currentPeriod,
  onSoapDownloadSuccess,
  tab,
  setTab,
  totalCfdisCount,
  emitidosCount,
  recibidosCount
}: CfdiDropzoneBarProps) {
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;
  const uploadPct = uploadBatchProgress
    ? Math.round((uploadBatchProgress.processed / Math.max(1, uploadBatchProgress.total)) * 100)
    : 0;

  const tabs: ReadonlyArray<TabBarItem<CfdiTabFilter>> = [
    { id: 'ALL', label: 'Todos', count: totalCfdisCount },
    { id: 'PENDING', label: 'Por Contabilizar', count: pendingCfdisCount },
    { id: 'EMITIDO', label: 'Emitidos (Ingreso)', count: emitidosCount },
    { id: 'RECIBIDO', label: 'Recibidos (Gasto)', count: recibidosCount }
  ];

  return (
    <>
      <div
        onDragOver={(e) => {
          if (isReadOnlyClient) return;
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDrop={(e) => {
          if (isReadOnlyClient) {
            e.preventDefault();
            setIsDragging(false);
            return;
          }
          handleDrop(e);
        }}
      >
        <PageHeader
          icon={<FileCode2 className="w-5 h-5" aria-hidden="true" />}
          iconTone="blue"
          title="Bóveda Digital de Comprobantes (ADD CFDI 4.0)"
          subtitle={
            isDragging
              ? '¡Suelta tus archivos .XML o .ZIP aquí para importarlos a la Bóveda ADD!'
              : 'Descarga facturas del mes desde el SAT con e.firma, sube archivos .XML o .ZIP del SAT, o arrástralos aquí'
          }
          className={isDragging ? 'border-2 border-dashed border-blue-600 bg-blue-50/40' : ''}
          actions={
            <>
              {!isReadOnlyClient && pendingCfdisCount > 0 && (
                <Button
                  variant="primary"
                  size="md"
                  loading={isBatchContabilizarPending}
                  disabled={isBatchContabilizarPending || isWriteBlocked}
                  onClick={onBatchContabilizarPending}
                  title={
                    isPeriodLocked
                      ? 'Periodo bloqueado ante el SAT'
                      : 'Contabilizar comprobantes pendientes en lote'
                  }
                  leftIcon={
                    isWriteBlocked ? (
                      <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <Sparkles
                        className={`w-3.5 h-3.5 ${isBatchContabilizarPending ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                    )
                  }
                >
                  {isBatchContabilizarPending
                    ? batchProgress
                      ? `Contabilizando (${batchProgress.current}/${batchProgress.total})...`
                      : 'Contabilizando...'
                    : isPeriodLocked
                    ? 'Periodo Bloqueado'
                    : `Contabilizar (${pendingCfdisCount})`}
                </Button>
              )}

              {!isReadOnlyClient && (
                <>
                  <Button
                    variant={showSoapFielPanel ? 'primary' : 'secondary'}
                    size="md"
                    aria-expanded={showSoapFielPanel}
                    aria-controls="sat-soap-fiel-section"
                    onClick={() => setShowSoapFielPanel((prev) => !prev)}
                    title="Descargar automáticamente facturas emitidas y recibidas del SAT con e.firma"
                    leftIcon={<CloudDownload className="w-4 h-4" aria-hidden="true" />}
                    rightIcon={
                      showSoapFielPanel ? (
                        <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                      )
                    }
                  >
                    <span>Descargar del SAT</span>
                    <StatusBadge
                      tone={showSoapFielPanel ? 'blue' : 'slate'}
                      shape="tag"
                      className={showSoapFielPanel ? 'bg-blue-800/80 text-white border-blue-400/50' : ''}
                    >
                      e.firma
                    </StatusBadge>
                  </Button>

                  <label
                    htmlFor="cfdi-dropzone-upload"
                    aria-busy={isUploadingFiles}
                    title={
                      isUploadingFiles
                        ? 'Importando archivos XML...'
                        : 'Subir archivos XML o ZIP locales a la Bóveda ADD (Alt+U)'
                    }
                    className={`${getButtonClasses('primary', 'md')} focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-1 ${
                      isUploadingFiles ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <input
                      id="cfdi-dropzone-upload"
                      ref={fileInputRef}
                      type="file"
                      disabled={isUploadingFiles}
                      accept=".xml,text/xml,.zip,application/zip,application/x-zip-compressed"
                      multiple
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                    <UploadCloud
                      className={`w-3.5 h-3.5 ${isUploadingFiles ? 'animate-pulse' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{isUploadingFiles ? 'Importando XMLs...' : 'Subir XMLs / ZIP'}</span>
                    <kbd className="hidden sm:inline font-mono text-[9px] bg-blue-800 px-1 py-0.5 rounded border border-blue-400/50 text-blue-100">
                      Alt+U
                    </kbd>
                  </label>
                </>
              )}

              <CfdiDropzoneSecondaryActions
                isReadOnlyClient={isReadOnlyClient}
                isExportingZip={isExportingZip}
                hasVisibleCfdis={hasVisibleCfdis}
                onOpenSimulator={onOpenSimulator}
                onExportCsv={onExportCsv}
                onExportZip={onExportZip}
              />
            </>
          }
          tabs={
            <TabBar
              mode="group"
              idPrefix="cfdi-tab-"
              ariaLabel="Filtrar por dirección y estatus contable"
              tabs={tabs}
              activeId={tab}
              onSelect={setTab}
            />
          }
        />
      </div>

      {/* Banner de progreso y advertencia de permanencia */}
      {uploadBatchProgress && (
        <div
          role="status"
          aria-live="polite"
          className="bg-blue-50 border border-blue-300 rounded-2xl p-3.5 text-xs font-semibold text-blue-950 space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Importando XMLs en lotes secuenciales de 200 ({uploadBatchProgress.currentBatch}/
              {uploadBatchProgress.totalBatches})... Mantén esta pestaña abierta.
            </span>
            <span className="font-mono tabular-nums bg-white px-2 py-0.5 rounded-lg border border-blue-200">
              {uploadBatchProgress.processed} / {uploadBatchProgress.total} archivos XML ({uploadPct}%)
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Progreso de importación de archivos XML"
            aria-valuenow={uploadPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full bg-blue-200/80 rounded-full h-2 overflow-hidden"
          >
            <div
              className="bg-blue-700 h-2 rounded-full transition-all duration-150 ease-out"
              style={{ width: `${Math.max(4, uploadPct)}%` }}
            />
          </div>
        </div>
      )}

      {batchProgress && (
        <div
          role="status"
          aria-live="polite"
          className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 shadow-2xs space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-emerald-950">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-spin shrink-0" aria-hidden="true" />
              <span>Contabilizando comprobantes en lote... Por favor mantén esta pestaña abierta.</span>
            </span>
            <span className="font-mono bg-white px-2 py-0.5 rounded-lg border border-emerald-300 text-emerald-900 shadow-2xs tabular-nums">
              {batchProgress.current} de {batchProgress.total} pólizas (
              {Math.round((batchProgress.current / batchProgress.total) * 100)}%)
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Progreso de contabilización en lote"
            aria-valuenow={Math.round((batchProgress.current / batchProgress.total) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full bg-emerald-200/80 rounded-full h-2.5 overflow-hidden"
          >
            <div
              className="bg-emerald-700 h-2.5 rounded-full transition-all duration-150 ease-out"
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
            isPeriodLocked={isPeriodLocked}
            isReadOnlyClient={isReadOnlyClient}
          />
        </div>
      )}
    </>
  );
}
