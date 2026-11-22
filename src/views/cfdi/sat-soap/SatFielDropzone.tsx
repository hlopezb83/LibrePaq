import React, { useState, useRef } from 'react';
import { CheckCircle2, FileKey, KeyRound, UploadCloud } from 'lucide-react';
import type { ParsedCerInfo } from '../../../shared/sat-certificate-parser';

export interface SatFielDropzoneProps {
  cerFileName: string;
  keyFileName: string;
  hasCer: boolean;
  hasKey: boolean;
  onFilesSelected: (files: File[]) => Promise<void>;
  cerInputRef: React.RefObject<HTMLInputElement | null>;
  keyInputRef: React.RefObject<HTMLInputElement | null>;
  parsedCerInfo?: ParsedCerInfo | null;
  companyRfc?: string;
}

export function SatFielDropzone({
  cerFileName,
  keyFileName,
  hasCer,
  hasKey,
  onFilesSelected,
  cerInputRef,
  keyInputRef,
  parsedCerInfo,
  companyRfc = ''
}: SatFielDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const combinedInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) {
      await onFilesSelected(droppedFiles);
    }
  };

  const handleCombinedChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      await onFilesSelected(selectedFiles);
    }
    if (combinedInputRef.current) combinedInputRef.current.value = '';
  };

  const bothReady = hasCer && hasKey;
  const isRfcMatch = Boolean(
    parsedCerInfo &&
    companyRfc &&
    parsedCerInfo.rfcTitular.toUpperCase() === companyRfc.toUpperCase()
  );

  return (
    <div className="space-y-3">
      {/* Zona Smart Drag & Drop Unificada */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => combinedInputRef.current?.click()}
        className={`relative p-5 sm:p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2.5 ${
          isDragging
            ? 'border-blue-600 bg-blue-50/90 ring-4 ring-blue-500/20 scale-[1.01]'
            : bothReady
            ? 'border-emerald-400/80 bg-emerald-50/40 hover:bg-emerald-50/70'
            : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/80'
        }`}
      >
        <input
          ref={combinedInputRef}
          type="file"
          accept=".cer,.key,.crt,.der,.pem"
          multiple
          onChange={handleCombinedChange}
          className="hidden"
          aria-label="Cargar archivos de e.firma (.cer y .key)"
        />

        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition shadow-xs ${
          bothReady
            ? 'bg-emerald-600 text-white'
            : isDragging
            ? 'bg-blue-600 text-white animate-bounce'
            : 'bg-indigo-100 text-indigo-700'
        }`}>
          {bothReady ? (
            <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
          ) : (
            <UploadCloud className="w-6 h-6" aria-hidden="true" />
          )}
        </div>

        <div>
          <div className="text-xs sm:text-sm font-bold text-slate-800">
            {bothReady
              ? '¡Ambos archivos de tu e.firma están listos!'
              : 'Arrastra aquí tus archivos .cer y .key de tu e.firma'}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Puedes soltar ambos archivos al mismo tiempo o hacer clic para seleccionarlos juntos
          </p>
        </div>

        {/* Estatus interactivo de los dos archivos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg mt-2 text-left" onClick={(e) => e.stopPropagation()}>
          {/* Badge Certificado (.cer) */}
          <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
            hasCer
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
              : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <FileKey className={`w-4 h-4 shrink-0 ${hasCer ? 'text-emerald-600' : 'text-slate-400'}`} aria-hidden="true" />
              <div className="min-w-0 space-y-0.5">
                <span className="font-bold text-[10px] uppercase block tracking-wider text-slate-500">Certificado (.cer)</span>
                <span className="truncate block font-mono text-[11px] font-semibold text-slate-900">
                  {hasCer ? cerFileName : 'Pendiente de cargar'}
                </span>
                {hasCer && parsedCerInfo && (
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    {isRfcMatch ? (
                      <span className="text-[9px] font-bold text-emerald-800 bg-emerald-200/70 px-1.5 py-0.2 rounded font-mono">
                        ✓ RFC Coincide ({parsedCerInfo.rfcTitular})
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-amber-900 bg-amber-200 px-1.5 py-0.2 rounded font-mono">
                        ⚠️ RFC: {parsedCerInfo.rfcTitular}
                      </span>
                    )}
                    {parsedCerInfo.isExpired ? (
                      <span className="text-[9px] font-bold text-red-800 bg-red-200 px-1.5 py-0.2 rounded">
                        Vencido
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-500 font-mono">
                        Vence: {parsedCerInfo.validTo.slice(0, 10)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => cerInputRef.current?.click()}
              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 shrink-0 cursor-pointer transition shadow-2xs"
            >
              {hasCer ? 'Cambiar' : 'Explorar'}
            </button>
          </div>

          {/* Badge Clave Privada (.key) */}
          <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
            hasKey
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
              : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <KeyRound className={`w-4 h-4 shrink-0 ${hasKey ? 'text-emerald-600' : 'text-slate-400'}`} aria-hidden="true" />
              <div className="min-w-0">
                <span className="font-bold text-[10px] uppercase block tracking-wider text-slate-500">Clave Privada (.key)</span>
                <span className="truncate block font-mono text-[11px] font-semibold text-slate-900">
                  {hasKey ? keyFileName : 'Pendiente de cargar'}
                </span>
                {hasKey && (
                  <span className="text-[9px] text-emerald-700 font-semibold block pt-0.5">
                    ✓ Llave cargada en memoria
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => keyInputRef.current?.click()}
              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 shrink-0 cursor-pointer transition shadow-2xs"
            >
              {hasKey ? 'Cambiar' : 'Explorar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
