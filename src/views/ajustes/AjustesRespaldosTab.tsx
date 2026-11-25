import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, FolderTree, Loader2, Lock, Upload } from 'lucide-react';
import { AlertBanner, Button, FormField, Input, ModalShell } from '../../components/ui';
import { useCompany } from '../../context/CompanyContext';
import { downloadCsvFile } from '../../lib/formatters';
import type { Company, CompanyBackupBundle } from '../../shared/types';
import { AjustesRespaldosMetricsCard } from './AjustesRespaldosMetricsCard';

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
  isImportingCsv?: boolean;
  pendingRestore: PendingBackupRestore | null;
  confirmRestoreBackup: () => void;
  cancelRestoreBackup: () => void;
  handleExportBackup: () => void;
  handleRestoreBackupFile: (e: ChangeEvent<HTMLInputElement>) => void;
  handleImportCsvCatalog: (e: ChangeEvent<HTMLInputElement>) => void;
  restoreInputRef: RefObject<HTMLInputElement | null>;
  csvCatalogInputRef: RefObject<HTMLInputElement | null>;
  canExportBackup?: boolean;
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
  isImportingCsv = false,
  pendingRestore,
  confirmRestoreBackup,
  cancelRestoreBackup,
  handleExportBackup,
  handleRestoreBackupFile,
  handleImportCsvCatalog,
  restoreInputRef,
  csvCatalogInputRef,
  canExportBackup,
  canRestoreBackup = true,
  canImportCsv = true
}: AjustesRespaldosTabProps) {
  const { isReadOnlyClient, effectiveCompanyRole } = useCompany();
  const allowExportBackup = canExportBackup ?? (!isReadOnlyClient && effectiveCompanyRole !== 'CLIENTE_LECTURA');
  const restoreDialogRef = useRef<HTMLDialogElement>(null);
  const [confirmRfcText, setConfirmRfcText] = useState('');

  useEffect(() => {
    setConfirmRfcText('');
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
  const isRfcConfirmMatched =
    !isRfcMismatch || confirmRfcText.trim().toUpperCase() === pendingRestore?.backupRfc;
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
            <div className="p-2 rounded-lg bg-blue-50/60 border border-blue-100 text-[11px] text-blue-900 font-mono tabular-nums break-words">
              {isLoadingMetrics
                ? 'Consultando registros...'
                : `Incluye: ${accountsList?.length ?? 0} cuentas • ${polizasData?.length ?? 0} pólizas • ${cfdisList?.length ?? 0} CFDIs`}
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={isExportingBackup || !allowExportBackup}
            loading={isExportingBackup}
            title={!allowExportBackup ? 'Descarga de respaldo JSON completo restringida para rol Cliente (Solo lectura)' : undefined}
            leftIcon={
              !allowExportBackup
                ? <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
                : <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            }
            onClick={() => {
              if (!allowExportBackup) return;
              handleExportBackup();
            }}
          >
            {!allowExportBackup
              ? 'Respaldo Restringido al Despacho'
              : isExportingBackup
              ? 'Generando archivo...'
              : 'Descargar Respaldo Completo'}
          </Button>
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
              aria-busy={isImportingCsv}
              title={!canImportCsv ? 'Modo solo lectura: no tienes permisos para importar catálogo' : undefined}
              className={`w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition shadow-2xs focus-within:outline-2 focus-within:outline-purple-700 focus-within:outline-offset-2 ${
                !canImportCsv || isImportingCsv ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <input
                ref={csvCatalogInputRef}
                id="ajustes-import-csv-input"
                name="csvCatalogFile"
                type="file"
                accept=".csv,.txt,.xml"
                disabled={!canImportCsv || isImportingCsv}
                onChange={handleImportCsvCatalog}
                className="sr-only"
              />
              {isImportingCsv ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
              ) : (
                <FolderTree className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>{isImportingCsv ? 'Importando catálogo...' : 'Importar CSV / TXT / XML'}</span>
            </label>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-slate-600 hover:text-blue-900 hover:bg-blue-50/50"
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />}
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
            >
              Descargar Plantilla CSV Ejemplo
            </Button>
          </div>
        </div>
      </div>

      <ModalShell
        dialogRef={restoreDialogRef}
        isOpen={Boolean(pendingRestore)}
        onClose={cancelRestoreBackup}
        busy={isRestoringBackup}
        role="alertdialog"
        maxWidth="lg"
        icon={<AlertTriangle className="w-5 h-5" aria-hidden="true" />}
        iconTone={isRfcMismatch ? 'red' : 'amber'}
        titleId="confirm-restore-backup-title"
        title="Confirmar restauración de respaldo"
        subtitle={
          pendingRestore ? (
            <>
              Archivo de <strong className="text-slate-900">{pendingRestore.backupName}</strong> (
              <span className="font-mono font-semibold">{pendingRestore.backupRfc}</span>)
            </>
          ) : undefined
        }
        closeLabel="Cerrar confirmación de restauración"
        bodyClassName="space-y-4 text-xs"
        footer={
          <>
            <Button
              variant="secondary"
              autoFocus
              disabled={isRestoringBackup}
              onClick={cancelRestoreBackup}
            >
              Cancelar
            </Button>
            <Button
              variant={isRfcMismatch ? 'danger' : 'primary'}
              disabled={isRestoringBackup || !canRestoreBackup || !isRfcConfirmMatched}
              loading={isRestoringBackup}
              leftIcon={isRestoringBackup ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : undefined}
              onClick={confirmRestoreBackup}
            >
              {isRestoringBackup ? 'Restaurando empresa...' : 'Confirmar y restaurar respaldo'}
            </Button>
          </>
        }
      >
        {pendingRestore && (
          <>
            {isRfcMismatch && (
              <AlertBanner
                tone="danger"
                title="Alerta: El RFC del respaldo no coincide con la empresa activa"
              >
                <p className="mt-0.5">
                  Respaldo: <span className="font-mono font-bold">{pendingRestore.backupRfc}</span> · Empresa activa:{' '}
                  <span className="font-mono font-bold">{activeCompany.rfc}</span>. Se restaurará la empresa destino indicada en el respaldo.
                </p>
                <div className="mt-2.5">
                  <FormField
                    htmlFor="confirm-restore-rfc-input"
                    label={`Para continuar, escribe el RFC del respaldo (${pendingRestore.backupRfc}):`}
                  >
                    <Input
                      id="confirm-restore-rfc-input"
                      size="sm"
                      type="text"
                      value={confirmRfcText}
                      onChange={(e) => setConfirmRfcText(e.target.value.toUpperCase())}
                      placeholder={pendingRestore.backupRfc}
                      className="font-mono uppercase border-red-300 focus:border-red-600 focus:ring-red-600/20"
                    />
                  </FormField>
                </div>
              </AlertBanner>
            )}

            <p className="text-slate-700 leading-relaxed">
              Se cargarán <strong className="font-mono tabular-nums">{pendingRestore.polCount} pólizas</strong> y{' '}
              <strong className="font-mono tabular-nums">{pendingRestore.accCount} cuentas</strong>. Los registros actuales de esa empresa serán reemplazados por el estado del respaldo.
            </p>
          </>
        )}
      </ModalShell>

      <AjustesRespaldosMetricsCard
        companyRfc={activeCompany.rfc}
        accountsCount={accountsList?.length ?? 0}
        polizasCount={polizasData?.length ?? 0}
        cfdisCount={cfdisList?.length ?? 0}
        isLoadingMetrics={isLoadingMetrics}
        isErrorMetrics={isErrorMetrics}
        refetchMetrics={refetchMetrics}
      />
    </section>
  );
}
