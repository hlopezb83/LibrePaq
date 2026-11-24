import type { ChangeEvent, RefObject } from 'react';
import { AlertTriangle, Database, Download, FileSpreadsheet, FolderTree, Upload } from 'lucide-react';
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
                isRestoringBackup || !canRestoreBackup ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer'
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
                className="visually-hidden"
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
                !canImportCsv ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer'
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
                className="visually-hidden"
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

      {pendingRestore && (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby="confirm-restore-backup-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !isRestoringBackup) {
              e.preventDefault();
              cancelRestoreBackup();
            }
          }}
          className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 space-y-2 text-xs"
        >
          <div id="confirm-restore-backup-title" className="flex items-center gap-2 text-amber-950 font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
            <span>
              Confirmar restauración de respaldo para &ldquo;{pendingRestore.backupName}&rdquo; ({pendingRestore.backupRfc})
            </span>
          </div>
          <p className="text-amber-900">
            Se cargarán <strong>{pendingRestore.polCount} pólizas</strong> y{' '}
            <strong>{pendingRestore.accCount} cuentas</strong>. Los registros actuales de esa empresa serán reemplazados por el estado del respaldo.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              autoFocus
              disabled={isRestoringBackup}
              onClick={cancelRestoreBackup}
              className="px-3 py-1.5 rounded-xl font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isRestoringBackup || !canRestoreBackup}
              aria-busy={isRestoringBackup}
              onClick={confirmRestoreBackup}
              className="px-3.5 py-1.5 rounded-xl font-bold bg-amber-700 hover:bg-amber-800 text-white cursor-pointer disabled:opacity-50"
            >
              {isRestoringBackup ? 'Restaurando empresa...' : 'Confirmar y restaurar respaldo'}
            </button>
          </div>
        </div>
      )}

      {/* Estadísticas de Almacenamiento Contable */}
      <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-700" aria-hidden="true" />
          Métricas de Almacenamiento Contable ({activeCompany.rfc})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Cuentas en Catálogo</span>
            <span className="text-xl font-bold font-mono text-slate-900">{accountsList?.length ?? 0}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Pólizas del Periodo</span>
            <span className="text-xl font-bold font-mono text-slate-900">{polizasData?.length ?? 0}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">CFDIs 4.0 en Bóveda</span>
            <span className="text-xl font-bold font-mono text-slate-900">{cfdisList?.length ?? 0}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Estado de Bóveda</span>
            <span className="text-sm font-bold text-emerald-700 block mt-1">Sincronizado • 100% OK</span>
          </div>
        </div>
      </div>
    </section>
  );
}
