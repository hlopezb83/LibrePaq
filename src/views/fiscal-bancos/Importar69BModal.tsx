import { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X
} from 'lucide-react';
import {
  getLoaded69BDatabase,
  parseSat69BCsv,
  save69BDatabase,
  type Sat69BParseResult
} from '../../shared/sat-69b';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';

export interface Importar69BModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
}

export function Importar69BModal({
  isOpen,
  onClose,
  onImportComplete
}: Importar69BModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [parseResult, setParseResult] = useState<Sat69BParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  useDialogLightDismiss(dialogRef, onClose, { isOpen });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      setParseResult(null);
      setParseError(null);
      setFileName(null);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentDbSize = getLoaded69BDatabase().size;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setParseResult(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string) || '';
        const parsed = parseSat69BCsv(text);
        if (parsed.total === 0) {
          setParseError('No se encontraron registros 69-B válidos en el CSV seleccionado.');
        }
        setParseResult(parsed);
      } catch (err: unknown) {
        setParseError(
          `No se pudo leer el archivo CSV: ${err instanceof Error ? err.message : 'Formato inválido'}`
        );
      } finally {
        setIsProcessing(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      setParseError('No se pudo abrir el archivo CSV seleccionado.');
      setIsProcessing(false);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleApply = () => {
    if (!parseResult) return;
    const array = Array.from(parseResult.records.values());
    save69BDatabase(array);
    onImportComplete(parseResult.total);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="modal-69b-title"
      className="bg-white rounded-2xl shadow-xl border border-slate-300 w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden backdrop:bg-slate-900/60 p-0 m-auto"
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700">
            <ShieldAlert className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 id="modal-69b-title" className="text-sm font-bold text-slate-900">
              Padrón Oficial Lista Negra SAT (Art. 69-B CFF)
            </h3>
            <p className="text-xs text-slate-600">
              Actualiza la base de contribuyentes no localizados, presuntos y definitivos
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar modal de Lista Negra 69-B"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-5 space-y-4 text-xs overflow-y-auto">
        <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-blue-900">Base Activa en LibrePaq:</span>
            <span className="font-mono font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
              {currentDbSize.toLocaleString()} RFCs en lista negra
            </span>
          </div>
          <p className="text-blue-700 text-[11px] leading-relaxed">
            El SAT publica periódicamente el archivo oficial <code>Listado_Completo_69-B.csv</code>. Al importarlo, LibrePaq auditará automáticamente las facturas del ADD y el catálogo de proveedores para prevenir deducciones indebidas.
          </p>
          <a
            href="https://omawww.sat.gob.mx/cifras_sat/Documents/Listado_Completo_69-B.csv"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-blue-800 hover:text-blue-950 underline text-[11px]"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Descargar archivo oficial más reciente del portal del SAT
          </a>
        </div>

        <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center bg-slate-50 hover:bg-slate-100/70 transition-colors">
          <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-500 mb-2" aria-hidden="true" />
          <label
            htmlFor="csv-69b-upload"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 focus-within:outline-2 focus-within:outline-blue-600 focus-within:outline-offset-2 text-white cursor-pointer mb-1"
          >
            <input
              id="csv-69b-upload"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="visually-hidden"
            />
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Seleccionar archivo Listado_Completo_69-B.csv</span>
          </label>
          <p className="text-[11px] text-slate-600">
            {fileName ? `Archivo: ${fileName}` : 'Formato oficial de texto separado por comas o punto y coma'}
          </p>
        </div>

        {parseError && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 font-medium"
          >
            {parseError}
          </div>
        )}

          {isProcessing && (
            <div role="status" aria-live="polite" aria-busy="true" className="text-center py-2 text-slate-600 font-semibold">
              Procesando y clasificando registros oficiales del SAT...
            </div>
          )}

          {parseResult && !isProcessing && (
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2.5">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>Resumen del Archivo Importado:</span>
                <span className="font-mono text-slate-900 font-bold">
                  {parseResult.total.toLocaleString()} contribuyentes
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-red-100/70 border border-red-200 rounded-lg p-2 text-red-900">
                  <div className="font-bold">Definitivos</div>
                  <div className="font-mono text-base font-extrabold">{parseResult.definitivos}</div>
                </div>
                <div className="bg-amber-100/70 border border-amber-200 rounded-lg p-2 text-amber-900">
                  <div className="font-bold">Presuntos</div>
                  <div className="font-mono text-base font-extrabold">{parseResult.presuntos}</div>
                </div>
                <div className="bg-blue-100/70 border border-blue-200 rounded-lg p-2 text-blue-900">
                  <div className="font-bold">Desvirtuados</div>
                  <div className="font-mono text-base font-extrabold">{parseResult.desvirtuados}</div>
                </div>
                <div className="bg-emerald-100/70 border border-emerald-200 rounded-lg p-2 text-emerald-900">
                  <div className="font-bold">Sentencia Fav.</div>
                  <div className="font-mono text-base font-extrabold">{parseResult.favorables}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!parseResult || parseResult.total === 0}
            onClick={handleApply}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            Aplicar y Sincronizar ({parseResult ? parseResult.total.toLocaleString() : 0} RFCs)
          </button>
        </div>
    </dialog>
  );
}
