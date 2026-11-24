import { useEffect, useRef, type ChangeEvent, type RefObject } from 'react';
import { AlertTriangle, Database, Download, FileSpreadsheet, FolderTree, Loader2, RefreshCw, Upload } from 'lucide-react';
import { downloadCsvFile } from '../../lib/formatters';
import type { Company, CompanyBackupBundle } from '../../shared/types';

export interface PendingBackupRestore {
  bundle: CompanyBackupBundle;
  backupRfc: string;
  backupName: string;
  polCount: number;
  accCount: number;
}

export interface AjustesRespaldosTabProps {
  activeCompany: Company;
  accountsList?: unknown[];
  polizasData?: unknown[];
  cfdisList?: unknown[];
  isLoadingMetrics?: boolean;
  isErrorMetrics?: boolean;
  refetchMetrics?: () => void;
  isExportingBackup: boolean;
  isRestoringBackup: boolean;
  pendingRestore: PendingBackupRestore | null;
  confirmRestoreBackup: () => void;
  cancelRestoreBackup: () => void;
  handleExportBackup: () => void;
  handleRestoreBackupFile: (e: ChangeEvent<HTMLInputElement>) => void;
  handleImportCsvCatalog: (e: ChangeEvent<HTMLInputElement>) => void;
  restoreInputRef: RefObject<HTMLInputElement | null>;
  csvCatalogInputRef: RefObject<HTMLInputElement | null>;
  canRestoreBackup?: boolean;
  canImportCsv?: boolean;
}

export function AjustesRespaldosTab({
  activeCompany,
  accountsList,
  polizasData,
  cfdisList,
  isLoadingMetrics = false,
  isErrorMetrics = false,
  refetchMetrics,
  isExportingBackup,
  isRestoringBackup,
  pendingRestore,
  confirmRestoreBackup,
  cancelRestoreBackup,
  handleExportBackup,
  handleRestoreBackupFile,
  handleImportCsvCatalog,
  restoreInputRef,
  csvCatalogInputRef,
  canRestoreBackup = true,
  canImportCsv = true
}: AjustesRespaldosTabProps) {
  const restoreDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = restoreDialogRef.current;
    if (!dlg) return;
    if (pendingRestore && !dlg.open) {
      dlg.showModal();
    } else if (!pendingRestore && dlg.open) {
      dlg.close();
    }
  }, [pendingRestore]);

  const isRfcMismatch = Boolean(
    pendingRestore && pendingRestore.backupRfc !== activeCompany.rfc.toUpperCase()
  );
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Tarjeta 1: Exportar Respaldo Completo */}
        <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3 flex flex-col justify-between min-w-0">
          <div className="space-y-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
              <Download className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Respaldar Empresa Completa</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Exporta todas tus cuentas, pólizas, movimientos, CFDIs, terceros y parámetros en un archivo portátil de respaldo LibrePaq.
            </p>
            <div className="p-2 rounded-lg bg-blue-50/60 border border-blue-100 text-[11px] text-blue-900 font-mono break-words">
              Incluye: {accountsList?.length ?? 0} cuentas • {polizasData?.length ?? 0} pólizas • {cfdisList?.length ?? 0} CFDIs
            </div>
          </div>

          <button
            type="button"
            disabled={isExportingBackup}
            aria-busy={isExportingBackup}
            onClick={handleExportBackup}
            className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            {isExportingBackup ? 'Generando archivo...' : 'Descargar Respaldo Completo'}
          </button>
        </div>

        {/* Tarjeta 2: Restaurar Respaldo */}
        <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3 flex flex-col justify-between min-w-0">
          <div className="space-y-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <Upload className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Restaurar Respaldo Existente</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Carga un archivo de respaldo previo para restaurar la contabilidad completa de cualquier empresa sin afectar las demás.
            </p>
            <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100 text-[11px] text-emerald-900 break-words">
              Compatible con respaldos portátiles generados en LibrePaq
            </div>
          </div>

          <div>
            <label
              htmlFor="ajustes-restore-backup-input"
              title={!canRestoreBackup ? 'Solo el Titular o Socio puede restaurar respaldos' : undefined}
              className={`w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition shadow-2xs focus-within:outline-2 focus-within:outline-blue-700 focus-within:outline-offset-2 ${
                isRestoringBackup || !canRestoreBackup ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <input
                ref={restoreInputRef}
                id="ajustes-restore-backup-input"
                name="restoreBackupFile"
                type="file"
                accept=".json"
                disabled={isRestoringBackup || !canRestoreBackup}
                onChange={handleRestoreBackupFile}
                className="sr-only"
              />
              <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{isRestoringBackup ? 'Restaurando empresa...' : 'Seleccionar Archivo de Respaldo'}</span>
            </label>
          </div>
        </div>

        {/* Tarjeta 3: Importar Catálogo CONTPAQi CSV */}
        <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3 flex flex-col justify-between min-w-0">
          <div className="space-y-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center">
              <FolderTree className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Migrador de Catálogo CONTPAQi</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Importa hasta miles de cuentas desde Excel / CSV con las columnas estándar de CONTPAQi Contabilidad.
            </p>
            <div
              className="p-2 rounded-lg bg-purple-50/60 border border-purple-100 text-[10px] text-purple-900 font-mono break-words"
              title="Código, Nombre, Padre, Tipo, Naturaleza, AgrupadorSAT, Afectable, SaldoInicial"
            >
              Cols: Código, Nombre, Padre, Tipo, Naturaleza...
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="ajustes-import-csv-input"
              title={!canImportCsv ? 'Modo solo lectura: no tienes permisos para importar catálogo' : undefined}
              className={`w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition shadow-2xs focus-within:outline-2 focus-within:outline-purple-700 focus-within:outline-offset-2 ${
                !canImportCsv ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <input
                ref={csvCatalogInputRef}
                id="ajustes-import-csv-input"
                name="csvCatalogFile"
                type="file"
                accept=".csv,.txt"
                disabled={!canImportCsv}
                onChange={handleImportCsvCatalog}
                className="sr-only"
              />
              <FolderTree className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Importar Catálogo CSV</span>
            </label>
            <button
              type="button"
              onClick={() => {
                downloadCsvFile(
                  'plantilla_catalogo_cuentas_contpaqi.csv',
                  ['Código', 'Nombre', 'Padre', 'Tipo', 'Naturaleza', 'AgrupadorSAT', 'Afectable', 'SaldoInicial'],
                  [
                    ['100-00-000', 'ACTIVO', '', 'ACTIVO', 'DEUDORA', '100', 0, 0],
                    ['102-00-000', 'Bancos Nacionales', '100-00-000', 'ACTIVO', 'DEUDORA', '102', 0, 0],
                    ['102-01-001', 'BBVA México Cta Principal', '102-00-000', 'ACTIVO', 'DEUDORA', '102.01', 1, 0],
                    ['200-00-000', 'PASIVO', '', 'PASIVO', 'ACREEDORA', '200', 0, 0],
                    ['201-00-000', 'Proveedores Nacionales', '200-00-000', 'PASIVO', 'ACREEDORA', '201', 0, 0],
                    ['300-00-000', 'CAPITAL CONTABLE', '', 'CAPITAL', 'ACREEDORA', '300', 0, 0],
                    ['400-00-000', 'INGRESOS', '', 'INGRESOS', 'ACREEDORA', '400', 0, 0],
                    ['500-00-000', 'COSTOS', '', 'COSTOS', 'DEUDORA', '500', 0, 0],
                    ['600-00-000', 'GASTOS GENERALES', '', 'GASTOS', 'DEUDORA', '600', 0, 0]
                  ]
                );
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-slate-600 hover:text-purple-900 hover:bg-purple-50/50 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600 shrink-0" aria-hidden="true" />
              Descargar Plantilla CSV Ejemplo
            </button>
          </div>
        </div>
      </div>

      <dialog
        ref={restoreDialogRef}
        closedby={isRestoringBackup ? 'none' : 'any'}
        aria-labelledby="confirm-restore-backup-title"
        onCancel={(e) => {
          if (isRestoringBackup) {
            e.preventDefault();
            return;
          }
          cancelRestoreBackup();
        }}
        className="m-auto w-full max-w-lg rounded-2xl border border-slate-300 bg-white p-0 shadow-2xl backdrop:bg-slate-900/50"
      >
        {pendingRestore && (
          <div className="p-5 sm:p-6 space-y-4 text-xs">
            <div className="flex items-start gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isRfcMismatch ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 id="confirm-restore-backup-title" className="text-sm font-bold text-slate-900">
                  Confirmar restauración de respaldo
                </h3>
                <p className="text-slate-600">
                  Archivo de <strong className="text-slate-900">{pendingRestore.backupName}</strong> (<span className="font-mono font-semibold">{pendingRestore.backupRfc}</span>)
                </p>
              </div>
            </div>

            {isRfcMismatch && (
              <div role="alert" className="p-3 rounded-xl border border-red-300 bg-red-50 text-red-950 space-y-1">
                <p className="font-bold">Alerta: El RFC del respaldo no coincide con la empresa activa</p>
                <p>
                  Respaldo: <span className="font-mono font-bold">{pendingRestore.backupRfc}</span> · Empresa activa:{' '}
                  <span className="font-mono font-bold">{activeCompany.rfc}</span>. Se restaurará la empresa destino indicada en el respaldo.
                </p>
              </div>
            )}

            <p className="text-slate-700 leading-relaxed">
              Se cargarán <strong className="tabular-nums">{pendingRestore.polCount} pólizas</strong> y{' '}
              <strong className="tabular-nums">{pendingRestore.accCount} cuentas</strong>. Los registros actuales de esa empresa serán reemplazados por el estado del respaldo.
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                autoFocus
                disabled={isRestoringBackup}
                onClick={cancelRestoreBackup}
                className="px-3.5 py-2 rounded-xl font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isRestoringBackup || !canRestoreBackup}
                aria-busy={isRestoringBackup}
                onClick={confirmRestoreBackup}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isRfcMismatch ? 'bg-red-700 hover:bg-red-800' : 'bg-amber-700 hover:bg-amber-800'
                }`}
              >
                {isRestoringBackup && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                <span>{isRestoringBackup ? 'Restaurando empresa...' : 'Confirmar y restaurar respaldo'}</span>
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* Estadísticas de Almacenamiento Contable */}
      <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-700" aria-hidden="true" />
            Métricas de Almacenamiento Contable ({activeCompany.rfc})
          </h3>
          {isErrorMetrics && refetchMetrics && (
            <button
              type="button"
              onClick={refetchMetrics}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              Reintentar métricas
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Cuentas en Catálogo</span>
            <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {isLoadingMetrics ? '...' : isErrorMetrics ? '—' : (accountsList?.length ?? 0)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Pólizas del Periodo</span>
            <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {isLoadingMetrics ? '...' : isErrorMetrics ? '—' : (polizasData?.length ?? 0)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">CFDIs 4.0 en Bóveda</span>
            <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {isLoadingMetrics ? '...' : isErrorMetrics ? '—' : (cfdisList?.length ?? 0)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Estado de Bóveda</span>
            {isLoadingMetrics ? (
              <span className="text-xs font-bold text-slate-600 block mt-1.5">Consultando...</span>
            ) : isErrorMetrics ? (
              <span className="text-xs font-bold text-red-700 block mt-1.5">Error al consultar</span>
            ) : (
              <span className="text-sm font-bold text-emerald-700 block mt-1">Sincronizado • 100% OK</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
