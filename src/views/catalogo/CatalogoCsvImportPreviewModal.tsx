import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet } from 'lucide-react';
import { AlertBanner, Button, ModalShell, Select, StatusBadge } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
import {
  downloadCatalogoTemplateCsv,
  type CatalogoCsvImportPreview
} from './catalogoCsvIo';

const FORMAT_LABELS: Record<NonNullable<CatalogoCsvImportPreview['fileFormat']>, string> = {
  CSV: 'CSV / Excel',
  CONTPAQI_TXT: 'CONTPAQi® TXT (C ...)',
  ANEXO24_CT_XML: 'Anexo 24 CT.xml (Catálogo SAT)',
  ANEXO24_BN_XML: 'Anexo 24 BN.xml (Balanza / Saldos Iniciales)'
};

interface CatalogoCsvImportPreviewModalProps {
  preview: CatalogoCsvImportPreview | null;
  isImporting: boolean;
  hasPolizas?: boolean;
  bnBalanceField?: 'SaldoIni' | 'SaldoFin';
  onChangeBnBalanceField?: (field: 'SaldoIni' | 'SaldoFin') => void;
  replaceBaseCatalog?: boolean;
  onChangeReplaceBaseCatalog?: (replace: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function CatalogoCsvImportPreviewModal({
  preview,
  isImporting,
  hasPolizas = true,
  bnBalanceField = 'SaldoIni',
  onChangeBnBalanceField,
  replaceBaseCatalog = false,
  onChangeReplaceBaseCatalog,
  onClose,
  onConfirm
}: CatalogoCsvImportPreviewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmUnbalanced, setConfirmUnbalanced] = useState(false);

  useEffect(() => {
    setConfirmUnbalanced(false);
  }, [preview]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (preview) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [preview]);

  if (!preview) return null;

  const isUnbalancedBalanza = Boolean(
    preview.balanzaValidation && !preview.balanzaValidation.isBalanced
  );
  const canConfirm =
    preview.allValidRows.length > 0 &&
    !isImporting &&
    (!isUnbalancedBalanza || confirmUnbalanced);

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={Boolean(preview)}
      onClose={onClose}
      busy={isImporting}
      titleId="csv-preview-title"
      title={
        <span className="inline-flex items-center gap-2 flex-wrap">
          <span>Vista Previa de Importación de Catálogo</span>
          {preview.fileFormat && (
            <StatusBadge tone="purple">{FORMAT_LABELS[preview.fileFormat]}</StatusBadge>
          )}
        </span>
      }
      subtitle={preview.fileName}
      icon={<FileSpreadsheet className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      maxWidth="2xl"
      closeLabel="Cerrar vista previa de importación"
      footerJustify="between"
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={downloadCatalogoTemplateCsv}
            leftIcon={<Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />}
          >
            Descargar plantilla CSV
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" disabled={isImporting} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={isImporting}
              disabled={!canConfirm}
              onClick={onConfirm}
              leftIcon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
            >
              {isImporting ? 'Importando...' : `Importar ${preview.allValidRows.length} cuentas`}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 block">Cuentas Nuevas</span>
            <span className="text-lg font-mono tabular-nums font-bold text-emerald-950">
              {preview.toCreate.length}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <span className="text-[11px] font-bold text-blue-800 block">A Actualizar</span>
            <span className="text-lg font-mono tabular-nums font-bold text-blue-950">
              {preview.toUpdate.length}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-[11px] font-bold text-amber-800 block">Filas Omitidas</span>
            <span className="text-lg font-mono tabular-nums font-bold text-amber-950">
              {preview.skipped.length}
            </span>
          </div>
        </div>

        {preview.fechaInicioOperaciones && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-700">
              Periodo detectado en archivo Anexo 24:
            </span>
            <StatusBadge tone="slate" shape="tag" className="text-xs px-2.5 py-0.5">
              {preview.fechaInicioOperaciones}
            </StatusBadge>
          </div>
        )}

        {preview.fileFormat === 'ANEXO24_BN_XML' && onChangeBnBalanceField && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200">
            <label htmlFor="bn-balance-field" className="text-[11px] font-bold text-blue-950">
              Columna de saldo a importar desde BN.xml:
            </label>
            <Select
              id="bn-balance-field"
              size="sm"
              value={bnBalanceField}
              onChange={(e) => onChangeBnBalanceField(e.target.value as 'SaldoIni' | 'SaldoFin')}
              containerClassName="w-auto min-w-[230px]"
            >
              <option value="SaldoIni">SaldoIni (Saldo Inicial del periodo)</option>
              <option value="SaldoFin">SaldoFin (Saldo Final / corte intermedio)</option>
            </Select>
          </div>
        )}

        {!hasPolizas && onChangeReplaceBaseCatalog && (
          <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={replaceBaseCatalog}
              onChange={(e) => onChangeReplaceBaseCatalog(e.target.checked)}
              className="mt-0.5 rounded border-amber-400 text-amber-700 focus:ring-amber-600"
            />
            <span className="text-[11px] text-amber-950">
              <strong className="block">Reemplazar catálogo base</strong>
              Elimina las cuentas semilla iniciales antes de importar el nuevo catálogo (disponible porque la empresa aún no tiene pólizas).
            </span>
          </label>
        )}

        {preview.balanzaValidation && (
          <AlertBanner
            tone={preview.balanzaValidation.isBalanced ? 'success' : 'danger'}
            title={
              preview.balanzaValidation.isBalanced
                ? `Validación Balanza BN.xml (${bnBalanceField}): Deudor = Acreedor (Cuadrada)`
                : `Descuadre detectado en BN.xml (${formatCurrency(preview.balanzaValidation.difference)})`
            }
            action={
              preview.balanzaValidation.anio && preview.balanzaValidation.mes ? (
                <StatusBadge tone="slate" shape="tag">
                  P{preview.balanzaValidation.mes}/{preview.balanzaValidation.anio}
                </StatusBadge>
              ) : undefined
            }
          >
            <div className="mt-1.5 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums text-[11px]">
                <div>{bnBalanceField === 'SaldoFin' ? 'Saldo Fin Deudor' : 'Saldo Ini Deudor'}: <strong>{formatCurrency(preview.balanzaValidation.totalDeudor)}</strong></div>
                <div>{bnBalanceField === 'SaldoFin' ? 'Saldo Fin Acreedor' : 'Saldo Ini Acreedor'}: <strong>{formatCurrency(preview.balanzaValidation.totalAcreedor)}</strong></div>
                <div>Debe: <strong>{formatCurrency(preview.balanzaValidation.totalDebe)}</strong></div>
                <div>Haber: <strong>{formatCurrency(preview.balanzaValidation.totalHaber)}</strong></div>
              </div>
              {isUnbalancedBalanza && (
                <label className="flex items-start gap-2 pt-1.5 border-t border-red-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmUnbalanced}
                    onChange={(e) => setConfirmUnbalanced(e.target.checked)}
                    className="mt-0.5 rounded border-red-400 text-red-700 focus:ring-red-600"
                  />
                  <span className="text-[11px] font-semibold text-red-950">
                    Confirmo importar esta balanza aun con el descuadre detectado entre Deudor/Acreedor o Debe/Haber.
                  </span>
                </label>
              )}
            </div>
          </AlertBanner>
        )}

        {preview.skipped.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
              <span>Filas omitidas por formato o datos incompletos ({preview.skipped.length})</span>
            </div>
            <ul className="max-h-32 overflow-y-auto space-y-1 text-[11px] text-amber-900 font-mono">
              {preview.skipped.map((item) => (
                <li key={item.lineNumber}>
                  <strong>Línea {item.lineNumber}:</strong> {item.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {preview.allValidRows.length > 0 ? (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 font-bold text-slate-700">
              Muestra de cuentas listas para importar ({preview.allValidRows.length})
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
              {preview.allValidRows.slice(0, 50).map((r) => {
                const isUpdate = preview.toUpdate.some((u) => u.code === r.code);
                return (
                  <div key={r.code} className="px-3 py-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-blue-900 shrink-0">{r.code}</span>
                      <span className="truncate text-slate-800">{r.name}</span>
                      {r.satGroupCode && (
                        <StatusBadge tone="slate" shape="tag" className="shrink-0">
                          SAT {r.satGroupCode}
                        </StatusBadge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono tabular-nums text-[11px] text-slate-700">
                        {formatCurrency(r.initialBalance ?? 0)}
                      </span>
                      <StatusBadge tone={isUpdate ? 'blue' : 'emerald'} shape="tag" className="shrink-0">
                        {isUpdate ? 'Actualizar' : 'Nueva'}
                      </StatusBadge>
                    </div>
                  </div>
                );
              })}
              {preview.allValidRows.length > 50 && (
                <div className="px-3 py-1.5 text-[11px] text-slate-500 text-center">
                  ... y {preview.allValidRows.length - 50} cuentas adicionales
                </div>
              )}
            </div>
          </div>
        ) : (
          <AlertBanner tone="danger">
            No se detectaron filas válidas para importar. Descarga la plantilla CSV oficial para verificar el formato.
          </AlertBanner>
        )}
      </div>
    </ModalShell>
  );
}
