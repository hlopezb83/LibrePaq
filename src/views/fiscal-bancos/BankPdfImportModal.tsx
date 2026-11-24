import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileText, Loader2, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { AlertBanner, Button, ModalShell, StatusBadge } from '../../components/ui';
import { bankN1Client } from '../../lib/bank-n1-client';
import { formatCurrency } from '../../lib/formatters';
import { bufferToBase64 } from '../../shared/gemini-csf-extractor';
import type { ExtractedBankPdfMovement } from '../../shared/types/bank-n1.types';

interface BankPdfImportModalProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  companyId: string;
  accountId: string;
  isPeriodLocked: boolean;
  isReadOnlyClient?: boolean;
  onImported: (importedCompanyId: string) => void;
  onFeedback: (msg: string, type?: 'success' | 'error') => void;
}

interface PdfMetaInfo { banco: string; cuenta: string; moneda: string; periodo: string; }
interface EditableBankPdfRow extends ExtractedBankPdfMovement { _rowId: string; }

const ERROR_MESSAGES: Record<string, string> = {
  AI_NOT_CONFIGURED: 'El lector inteligente de PDF no está activo en este servidor. Contacta a soporte.',
  FILE_TOO_LARGE: 'El PDF excede el límite máximo permitido (7.5 MB).',
  INVALID_DOCUMENT: 'El archivo no parece ser un estado de cuenta bancario legible.',
  AI_UNAVAILABLE: 'El lector inteligente de PDF no respondió a tiempo. Intenta nuevamente.'
};

function getRowWarning(row: EditableBankPdfRow) {
  const missingDate = !row.fecha?.trim();
  const cargo = Number(row.cargo || 0);
  const abono = Number(row.abono || 0);
  const zeroBoth = cargo <= 0 && abono <= 0;
  const bothPositive = cargo > 0 && abono > 0;
  return { missingDate, zeroBoth, bothPositive, any: missingDate || zeroBoth || bothPositive };
}

export function BankPdfImportModal({
  dialogRef, companyId, accountId, isPeriodLocked, isReadOnlyClient = false, onImported, onFeedback
}: BankPdfImportModalProps) {
  const isLocked = isPeriodLocked || isReadOnlyClient;
  const [rows, setRows] = useState<EditableBankPdfRow[]>([]);
  const [meta, setMeta] = useState<PdfMetaInfo | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const activeKey = `${companyId}::${accountId}`;
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;
  const fallbackCounterRef = useRef(0);

  const resetAndClose = useCallback(() => {
    setRows([]);
    setMeta(null);
    setExtractError(null);
    setIsExtracting(false);
    setIsImporting(false);
    setConfirmDiscard(false);
    if (dialogRef.current?.open) dialogRef.current.close();
  }, [dialogRef]);

  const handleSafeClose = useCallback(() => {
    if (isImporting) return;
    if (rows.length > 0 && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    resetAndClose();
  }, [isImporting, rows.length, confirmDiscard, resetAndClose]);

  useEffect(() => { resetAndClose(); }, [companyId, accountId, resetAndClose]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isLocked) return;
    if (file.size > 7.5 * 1024 * 1024) {
      setExtractError(ERROR_MESSAGES.FILE_TOO_LARGE ?? 'El PDF excede el límite máximo permitido (7.5 MB).');
      return;
    }

    const reqKey = activeKeyRef.current;
    const reqCompanyId = companyId;
    setIsExtracting(true);
    setExtractError(null);
    try {
      const base64 = bufferToBase64(await file.arrayBuffer());
      if (activeKeyRef.current !== reqKey) return;
      const res = await bankN1Client.extractBankPdfStatement(reqCompanyId, base64, file.type || 'application/pdf');
      if (activeKeyRef.current !== reqKey) return;
      if (!res.ok || !res.movimientos) {
        setExtractError((res.code && ERROR_MESSAGES[res.code]) || res.error || 'No se pudo extraer el PDF.');
        return;
      }
      setMeta({ banco: res.banco || 'Banco detectado', cuenta: res.cuenta || '—', moneda: res.moneda || 'MXN', periodo: res.periodo || '—' });
      const hydrated = res.movimientos.map((m) => ({
        ...m,
        _rowId: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID() : `pdf-row-${++fallbackCounterRef.current}`
      }));
      setRows(hydrated);
      if (hydrated.length === 0) setExtractError('El lector inteligente de PDF no detectó movimientos bancarios en el archivo.');
    } catch (err: unknown) {
      if (activeKeyRef.current !== reqKey) return;
      setExtractError(err instanceof Error ? err.message : 'Error leyendo el estado de cuenta PDF.');
    } finally {
      if (activeKeyRef.current === reqKey) setIsExtracting(false);
    }
  };

  const updateRow = (rowId: string, field: keyof ExtractedBankPdfMovement, value: string | number) => {
    setRows((prev) => prev.map((row) => (row._rowId === rowId ? { ...row, [field]: value } : row)));
  };

  const handleConfirmImport = async () => {
    if (isLocked || rows.length === 0) return;
    const reqKey = activeKeyRef.current;
    const targetCompanyId = companyId;
    const targetAccountId = accountId;
    setIsImporting(true);
    try {
      await bankN1Client.importBankPdfLines(
        targetCompanyId,
        targetAccountId,
        rows.map((r) => ({ fecha: r.fecha, referencia: r.referencia, descripcion: r.descripcion, cargoBanco: Number(r.cargo || 0), abonoBanco: Number(r.abono || 0) }))
      );
      onImported(targetCompanyId);
      if (activeKeyRef.current !== reqKey) return;
      onFeedback(`Se importaron ${rows.length} movimientos desde PDF bancario.`);
      resetAndClose();
    } catch (err: unknown) {
      if (activeKeyRef.current !== reqKey) return;
      onFeedback(err instanceof Error ? err.message : 'Error al guardar los movimientos importados.', 'error');
    } finally {
      if (activeKeyRef.current === reqKey) setIsImporting(false);
    }
  };

  const totalCargos = rows.reduce((sum, r) => sum + Number(r.cargo || 0), 0);
  const totalAbonos = rows.reduce((sum, r) => sum + Number(r.abono || 0), 0);
  const warningCount = rows.filter((r) => getRowWarning(r).any).length;
  const lockReason = isReadOnlyClient ? 'Modo solo lectura' : 'Periodo bloqueado ante el SAT';

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={true}
      onClose={handleSafeClose}
      deferClose={true}
      busy={isImporting}
      title="Importar Estado de Cuenta PDF"
      subtitle="Extrae movimientos con el lector inteligente de PDF, revisa o edita antes de guardar"
      icon={<Sparkles className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      titleId="modal-bank-pdf-title"
      maxWidth="4xl"
      closeLabel="Cerrar modal"
      bodyClassName="space-y-4 scrollable-panel"
      footer={
        <>
          <Button variant="secondary" onClick={handleSafeClose} disabled={isImporting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={isImporting}
            disabled={isLocked || rows.length === 0}
            title={isLocked ? lockReason : rows.length === 0 ? 'Selecciona un archivo PDF con movimientos primero' : 'Guardar los movimientos detectados en el estado de cuenta bancario'}
            onClick={() => void handleConfirmImport()}
            leftIcon={isImporting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : undefined}
          >
            {isImporting ? 'Importando...' : `Confirmar Importación (${rows.length})`}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <label
          htmlFor="bank-pdf-file-input"
          title={isLocked ? lockReason : 'Seleccionar archivo PDF del estado de cuenta bancario (máx. 7.5 MB)'}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition focus-within:outline-2 focus-within:outline-blue-600 focus-within:outline-offset-2 ${
            isExtracting || isLocked
              ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200'
              : 'bg-blue-700 hover:bg-blue-800 text-white border-blue-700 cursor-pointer shadow-xs'
          }`}
        >
          <input id="bank-pdf-file-input" type="file" accept="application/pdf,.pdf" disabled={isExtracting || isLocked} onChange={(e) => void handleFileChange(e)} className="visually-hidden" />
          {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <UploadCloud className="w-4 h-4" aria-hidden="true" />}
          <span>{isExtracting ? 'Analizando PDF...' : 'Seleccionar PDF Bancario'}</span>
        </label>

        {meta && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-700">
            <span className="px-2 py-1 rounded-lg bg-white border border-slate-200">
              <FileText className="w-3 h-3 inline mr-1 text-blue-700" aria-hidden="true" />{meta.banco}
            </span>
            <span className="px-2 py-1 rounded-lg bg-white border border-slate-200">Cta: {meta.cuenta}</span>
            <span className="px-2 py-1 rounded-lg bg-white border border-slate-200">{meta.moneda} · {meta.periodo}</span>
          </div>
        )}
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {isExtracting ? 'Analizando estado de cuenta PDF...' : rows.length > 0 ? `${rows.length} movimientos detectados en el estado de cuenta PDF.` : ''}
      </div>

      {extractError && <AlertBanner tone="danger">{extractError}</AlertBanner>}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div><span className="text-slate-600">Movimientos: </span><strong className="font-mono text-slate-900">{rows.length}</strong></div>
              <div><span className="text-slate-600">Total Cargos: </span><strong className="font-mono text-slate-900 tabular-nums">{formatCurrency(totalCargos)}</strong></div>
              <div><span className="text-slate-600">Total Abonos: </span><strong className="font-mono text-slate-900 tabular-nums">{formatCurrency(totalAbonos)}</strong></div>
            </div>
            {warningCount > 0 && (
              <StatusBadge tone="amber" icon={<AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />}>
                {warningCount} {warningCount === 1 ? 'fila por revisar' : 'filas por revisar'}
              </StatusBadge>
            )}
          </div>

          {warningCount > 0 && (
            <AlertBanner tone="warning">
              Hay <strong>{warningCount}</strong> {warningCount === 1 ? 'movimiento con fecha faltante o importes en $0.00/duplicados' : 'movimientos con fecha faltante o importes en $0.00/duplicados'}. Revísalos antes de confirmar la importación.
            </AlertBanner>
          )}

          <div className="overflow-x-auto max-h-[340px] overflow-y-auto border border-slate-200 rounded-xl scrollable-panel">
            <table className="w-full text-left border-collapse text-xs">
              <caption className="visually-hidden">Movimientos extraídos del estado de cuenta bancario PDF</caption>
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600 z-10">
                <tr>
                  <th scope="col" className="py-2 px-2.5 min-w-[130px]">Fecha</th>
                  <th scope="col" className="py-2 px-2.5 min-w-[130px]">Referencia</th>
                  <th scope="col" className="py-2 px-2.5 min-w-[200px]">Descripción</th>
                  <th scope="col" className="py-2 px-2.5 min-w-[130px] text-right">Cargo $</th>
                  <th scope="col" className="py-2 px-2.5 min-w-[130px] text-right">Abono $</th>
                  <th scope="col" className="py-2 px-2.5 min-w-[56px] text-center">Quitar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row, idx) => {
                  const warn = getRowWarning(row);
                  const amountWarnTitle = warn.zeroBoth ? 'Cargo y Abono en $0.00' : warn.bothPositive ? 'Solo Cargo o Abono debe ser mayor a $0.00' : undefined;
                  const amountCls = warn.zeroBoth || warn.bothPositive ? 'border-amber-500 ring-1 ring-amber-400' : 'border-slate-300';
                  return (
                    <tr key={row._rowId} className={warn.any ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-slate-50'}>
                      <td className="p-1.5">
                        <input type="date" value={row.fecha} onChange={(e) => updateRow(row._rowId, 'fecha', e.target.value)} aria-label={`Fecha fila ${idx + 1}`} title={warn.missingDate ? 'Falta fecha válida' : undefined} className={`w-full px-2 py-1 rounded-lg border font-mono text-xs bg-white ${warn.missingDate ? 'border-amber-500 ring-1 ring-amber-400' : 'border-slate-300'}`} />
                      </td>
                      <td className="p-1.5">
                        <input type="text" value={row.referencia} onChange={(e) => updateRow(row._rowId, 'referencia', e.target.value)} aria-label={`Referencia fila ${idx + 1}`} className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono text-xs bg-white" />
                      </td>
                      <td className="p-1.5">
                        <input type="text" value={row.descripcion} onChange={(e) => updateRow(row._rowId, 'descripcion', e.target.value)} aria-label={`Descripción fila ${idx + 1}`} className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs bg-white" />
                      </td>
                      <td className="p-1.5">
                        <input type="number" min="0" step="0.01" value={row.cargo} onChange={(e) => updateRow(row._rowId, 'cargo', Math.max(0, Number(e.target.value || 0)))} aria-label={`Cargo fila ${idx + 1}`} title={amountWarnTitle} className={`w-full px-2 py-1 rounded-lg border font-mono text-right text-xs tabular-nums bg-white ${amountCls}`} />
                      </td>
                      <td className="p-1.5">
                        <input type="number" min="0" step="0.01" value={row.abono} onChange={(e) => updateRow(row._rowId, 'abono', Math.max(0, Number(e.target.value || 0)))} aria-label={`Abono fila ${idx + 1}`} title={amountWarnTitle} className={`w-full px-2 py-1 rounded-lg border font-mono text-right text-xs tabular-nums bg-white ${amountCls}`} />
                      </td>
                      <td className="p-1.5 text-center">
                        <button type="button" onClick={() => setRows((prev) => prev.filter((r) => r._rowId !== row._rowId))} aria-label={`Descartar fila ${idx + 1}`} className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 cursor-pointer">
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {confirmDiscard && (
        <AlertBanner
          tone="warning"
          action={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setConfirmDiscard(false)}>
                Seguir revisando
              </Button>
              <Button size="sm" variant="danger" onClick={resetAndClose}>
                Descartar y cerrar
              </Button>
            </div>
          }
        >
          Tienes {rows.length} movimientos extraídos sin importar. ¿Descartarlos y cerrar?
        </AlertBanner>
      )}
    </ModalShell>
  );
}
