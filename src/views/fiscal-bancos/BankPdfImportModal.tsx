import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Sparkles, Trash2, UploadCloud, X } from 'lucide-react';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { bankN1Client } from '../../lib/bank-n1-client';
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

interface PdfMetaInfo {
  banco: string;
  cuenta: string;
  moneda: string;
  periodo: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  AI_NOT_CONFIGURED: 'El extractor IA no está configurado (falta GEMINI_API_KEY en el servidor).',
  FILE_TOO_LARGE: 'El PDF excede el límite máximo permitido (10 MB en Base64).',
  INVALID_DOCUMENT: 'El archivo no parece ser un estado de cuenta bancario legible.',
  AI_UNAVAILABLE: 'El servicio de IA no respondió a tiempo. Intenta nuevamente.'
};

export function BankPdfImportModal({
  dialogRef, companyId, accountId, isPeriodLocked, isReadOnlyClient = false, onImported, onFeedback
}: BankPdfImportModalProps) {
  const isLocked = isPeriodLocked || isReadOnlyClient;
  const [rows, setRows] = useState<ExtractedBankPdfMovement[]>([]);
  const [meta, setMeta] = useState<PdfMetaInfo | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const activeKey = `${companyId}::${accountId}`;
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  const resetAndClose = useCallback(() => {
    setRows([]);
    setMeta(null);
    setExtractError(null);
    setIsExtracting(false);
    setIsImporting(false);
    if (dialogRef.current?.open) dialogRef.current.close();
  }, [dialogRef]);

  useEffect(() => {
    resetAndClose();
  }, [companyId, accountId, resetAndClose]);

  useDialogLightDismiss(dialogRef, resetAndClose);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isLocked) return;
    if (file.size > 7.5 * 1024 * 1024) {
      setExtractError(ERROR_MESSAGES.FILE_TOO_LARGE ?? 'Archivo demasiado grande.');
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
      setMeta({
        banco: res.banco || 'Banco detectado',
        cuenta: res.cuenta || '—',
        moneda: res.moneda || 'MXN',
        periodo: res.periodo || '—'
      });
      setRows(res.movimientos);
      if (res.movimientos.length === 0) setExtractError('Gemini no detectó movimientos bancarios en el PDF.');
    } catch (err: unknown) {
      if (activeKeyRef.current !== reqKey) return;
      setExtractError(err instanceof Error ? err.message : 'Error leyendo el estado de cuenta PDF.');
    } finally {
      if (activeKeyRef.current === reqKey) {
        setIsExtracting(false);
      }
    }
  };

  const updateRow = (idx: number, field: keyof ExtractedBankPdfMovement, value: string | number) => {
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
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
        rows.map((r) => ({
          fecha: r.fecha,
          referencia: r.referencia,
          descripcion: r.descripcion,
          cargoBanco: Number(r.cargo || 0),
          abonoBanco: Number(r.abono || 0)
        }))
      );
      onImported(targetCompanyId);
      if (activeKeyRef.current !== reqKey) return;
      onFeedback(`Se importaron ${rows.length} movimientos desde PDF bancario con IA.`);
      resetAndClose();
    } catch (err: unknown) {
      if (activeKeyRef.current !== reqKey) return;
      onFeedback(err instanceof Error ? err.message : 'Error al guardar los movimientos importados.', 'error');
    } finally {
      if (activeKeyRef.current === reqKey) {
        setIsImporting(false);
      }
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={resetAndClose}
      aria-labelledby="modal-bank-pdf-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden backdrop:bg-slate-900/60 p-0 m-auto"
    >
      <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="modal-bank-pdf-title" className="text-base font-bold text-slate-900">Importar Estado de Cuenta PDF (IA)</h2>
              <p className="text-xs text-slate-600 mt-0.5">Extrae movimientos con Gemini Flash, revisa o edita antes de guardar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Cerrar modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <label
            htmlFor="bank-pdf-file-input"
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
              isExtracting || isLocked
                ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 cursor-pointer shadow-xs'
            }`}
          >
            <input id="bank-pdf-file-input" type="file" accept="application/pdf,.pdf" disabled={isExtracting || isLocked} onChange={(e) => void handleFileChange(e)} className="visually-hidden" />
            {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <UploadCloud className="w-4 h-4" aria-hidden="true" />}
            <span>{isExtracting ? 'Analizando PDF con IA...' : 'Seleccionar PDF Bancario'}</span>
          </label>

          {meta && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-700">
              <span className="px-2 py-1 rounded-lg bg-white border border-slate-200">
                <FileText className="w-3 h-3 inline mr-1 text-indigo-600" aria-hidden="true" />{meta.banco}
              </span>
              <span className="px-2 py-1 rounded-lg bg-white border border-slate-200">Cta: {meta.cuenta}</span>
              <span className="px-2 py-1 rounded-lg bg-white border border-slate-200">{meta.moneda} · {meta.periodo}</span>
            </div>
          )}
        </div>

        {extractError && (
          <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-medium">{extractError}</div>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto max-h-[340px] overflow-y-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                <tr>
                  <th scope="col" className="py-2 px-2.5 w-[130px]">Fecha</th>
                  <th scope="col" className="py-2 px-2.5 w-[130px]">Referencia</th>
                  <th scope="col" className="py-2 px-2.5 min-w-[200px]">Descripción</th>
                  <th scope="col" className="py-2 px-2.5 w-[110px] text-right">Cargo $</th>
                  <th scope="col" className="py-2 px-2.5 w-[110px] text-right">Abono $</th>
                  <th scope="col" className="py-2 px-2.5 w-[50px] text-center">Quitar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row, idx) => (
                  <tr key={`${idx}-${row.fecha}-${row.referencia}`} className="hover:bg-slate-50">
                    <td className="p-1.5">
                      <input type="date" value={row.fecha} onChange={(e) => updateRow(idx, 'fecha', e.target.value)} aria-label={`Fecha fila ${idx + 1}`} className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono text-xs" />
                    </td>
                    <td className="p-1.5">
                      <input type="text" value={row.referencia} onChange={(e) => updateRow(idx, 'referencia', e.target.value)} aria-label={`Referencia fila ${idx + 1}`} className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono text-xs" />
                    </td>
                    <td className="p-1.5">
                      <input type="text" value={row.descripcion} onChange={(e) => updateRow(idx, 'descripcion', e.target.value)} aria-label={`Descripción fila ${idx + 1}`} className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs" />
                    </td>
                    <td className="p-1.5">
                      <input type="number" min="0" step="0.01" value={row.cargo} onChange={(e) => updateRow(idx, 'cargo', Math.max(0, Number(e.target.value || 0)))} aria-label={`Cargo fila ${idx + 1}`} className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono text-right text-xs tabular-nums" />
                    </td>
                    <td className="p-1.5">
                      <input type="number" min="0" step="0.01" value={row.abono} onChange={(e) => updateRow(idx, 'abono', Math.max(0, Number(e.target.value || 0)))} aria-label={`Abono fila ${idx + 1}`} className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono text-right text-xs tabular-nums" />
                    </td>
                    <td className="p-1.5 text-center">
                      <button type="button" onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))} aria-label={`Descartar fila ${idx + 1}`} className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer">
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={resetAndClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
          <button
            type="button"
            disabled={isImporting || isLocked || rows.length === 0}
            onClick={() => void handleConfirmImport()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isImporting ? 'Importando...' : `Confirmar Importación (${rows.length})`}
          </button>
        </div>
      </div>
    </dialog>
  );
}
