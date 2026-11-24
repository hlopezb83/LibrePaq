import { useEffect, useRef, useState } from 'react';
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Upload
} from 'lucide-react';
import { Button, ModalShell } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
  checkRfcsAgainstCloud69B,
  upsert69BBatchToCloud
} from '../../lib/supabase/supabase-cxc-sat';
import {
  decodeSat69BCsvBytes,
  getLoaded69BDatabase,
  getLoaded69BMeta,
  parseSat69BCsv,
  save69BDatabase,
  type Sat69BParseResult
} from '../../shared/sat-69b';
import { Importar69BStatusPanels } from './Importar69BStatusPanels';

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
  const { isSuperAdmin } = useAuth();
  const { activeCompanyId } = useCompany();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [parseResult, setParseResult] = useState<Sat69BParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const isSyncing = Boolean(syncProgress);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      setParseResult(null);
      setParseError(null);
      setFileName(null);
      setSyncProgress(null);
      setIsDragging(false);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const meta = getLoaded69BMeta();
  const currentDbSize = Math.max(getLoaded69BDatabase().size, meta?.totalCount ?? 0);

  const processCsvFile = (file: File, resetInput?: () => void) => {
    setFileName(file.name);
    setParseError(null);
    setParseResult(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result;
        const text =
          buffer instanceof ArrayBuffer
            ? decodeSat69BCsvBytes(new Uint8Array(buffer))
            : String(buffer ?? '');
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
        resetInput?.();
      }
    };
    reader.onerror = () => {
      setParseError('No se pudo abrir el archivo CSV seleccionado.');
      setIsProcessing(false);
      resetInput?.();
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processCsvFile(file, () => {
      e.target.value = '';
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isSyncing && !isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isSyncing) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      setParseError('Por favor arrastra un archivo en formato CSV (.csv) oficial del SAT.');
      return;
    }
    processCsvFile(file);
  };

  const handleApply = async () => {
    if (!parseResult || syncProgress) return;
    const array = Array.from(parseResult.records.values());
    let cloudSynced = false;

    if (isSuperAdmin && isSupabaseConfigured && supabase) {
      try {
        setParseError(null);
        setSyncProgress({ done: 0, total: array.length });
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          await upsert69BBatchToCloud(array, {
            companyId: activeCompanyId || undefined,
            onProgress: (done, total) => setSyncProgress({ done, total })
          });
          cloudSynced = true;

          if (activeCompanyId) {
            try {
              const cfdis = await apiClient.getCfdis(activeCompanyId, { includeXml: false });
              const rfcs = cfdis.flatMap((c) => [c.emisorRfc, c.receptorRfc]);
              await checkRfcsAgainstCloud69B(rfcs, activeCompanyId);
            } catch {
              // No bloquear el cierre si falla el re-cruce automático de CFDIs
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setParseError(`Error sincronizando padrón 69-B con la nube: ${msg}`);
        toast.error(`Error subiendo padrón 69-B a la nube: ${msg}`);
        setSyncProgress(null);
        return;
      }
    }

    save69BDatabase(array, { cloudSynced });
    setSyncProgress(null);
    onImportComplete(parseResult.total);
    onClose();
  };

  const syncPct = syncProgress && syncProgress.total > 0
    ? Math.min(100, Math.round((syncProgress.done / syncProgress.total) * 100))
    : 0;

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={isOpen}
      onClose={() => { if (!isSyncing) onClose(); }}
      busy={isSyncing}
      title="Padrón Oficial Lista Negra SAT (Art. 69-B CFF)"
      subtitle="Actualiza la base completa de contribuyentes no localizados, presuntos y definitivos"
      icon={<ShieldAlert className="w-5 h-5" aria-hidden="true" />}
      iconTone="red"
      titleId="modal-69b-title"
      maxWidth="xl"
      closeLabel="Cerrar modal de Lista Negra 69-B"
      bodyClassName="space-y-4 text-xs"
      footerJustify="between"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => { if (!isSyncing) onClose(); }}
            disabled={isSyncing}
            title={isSyncing ? 'Sincronización en curso' : 'Cancelar importación'}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={isSyncing}
            disabled={!parseResult || parseResult.total === 0}
            title={
              isSyncing
                ? 'Sincronizando padrón 69-B...'
                : !parseResult || parseResult.total === 0
                  ? 'Selecciona un archivo CSV válido del SAT primero'
                  : isSuperAdmin
                    ? 'Guardar padrón 69-B y sincronizar con la nube'
                    : 'Cargar padrón 69-B para verificación en este navegador'
            }
            onClick={() => void handleApply()}
            leftIcon={
              isSyncing
                ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                : <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            }
          >
            {isSyncing
              ? 'Sincronizando con nube...'
              : isSuperAdmin
                ? `Aplicar y Sincronizar (${parseResult ? parseResult.total.toLocaleString() : 0} RFCs)`
                : `Cargar en este navegador (${parseResult ? parseResult.total.toLocaleString() : 0} RFCs)`}
          </Button>
        </>
      }
    >
      <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-blue-900">Base Activa en LibrePaq:</span>
          <span className="font-mono tabular-nums font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
            {currentDbSize.toLocaleString()} RFCs en lista negra
          </span>
        </div>
        <p className="text-blue-700 text-[11px] leading-relaxed">
          {isSuperAdmin
            ? 'El SAT publica periódicamente el archivo oficial Listado_Completo_69-B.csv. Al importarlo, LibrePaq sincroniza el padrón global en la nube en lotes de 1,000 RFCs y audita automáticamente los CFDIs y proveedores.'
            : 'El padrón global en la nube es administrado centralmente por LibrePaq. Al importar el archivo oficial Listado_Completo_69-B.csv del SAT, actualizarás la verificación local de proveedores y CFDIs en este navegador.'}
        </p>
        <a
          href="https://omawww.sat.gob.mx/cifras_sat/Documents/Listado_Completo_69-B.csv"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-blue-800 hover:text-blue-950 underline text-[11px]"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Descargar archivo oficial más reciente del portal del SAT (abre en nueva pestaña)</span>
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
          isDragging ? 'border-blue-600 bg-blue-50/70' : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70'
        }`}
      >
        <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-500 mb-2" aria-hidden="true" />
        <label
          htmlFor="csv-69b-upload"
          title={isSyncing ? 'Sincronización en progreso' : 'Seleccionar o arrastrar Listado_Completo_69-B.csv'}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 hover:bg-blue-800 focus-within:outline-2 focus-within:outline-blue-600 focus-within:outline-offset-2 text-white mb-1 ${
            isSyncing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <input
            id="csv-69b-upload"
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            disabled={isSyncing}
            onChange={handleFileChange}
            className="visually-hidden"
          />
          <Upload className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Seleccionar archivo Listado_Completo_69-B.csv</span>
        </label>
        <p className="text-[11px] text-slate-600">
          {fileName ? `Archivo: ${fileName}` : 'Arrastra aquí el archivo CSV del SAT o selecciónalo manualmente'}
        </p>
      </div>

      <Importar69BStatusPanels
        parseError={parseError}
        isProcessing={isProcessing}
        syncProgress={syncProgress}
        syncPct={syncPct}
        parseResult={parseResult}
      />
    </ModalShell>
  );
}
