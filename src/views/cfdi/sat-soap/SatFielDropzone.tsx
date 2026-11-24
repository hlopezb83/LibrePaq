import React, { useState, useRef } from 'react';
import { CheckCircle2, FileKey, KeyRound, UploadCloud } from 'lucide-react';
import { Button, StatusBadge } from '../../../components/ui';
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
  isReadOnlyClient?: boolean;
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
  companyRfc = '',
  isReadOnlyClient = false
}: SatFielDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const combinedInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReadOnlyClient) return;
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
    if (isReadOnlyClient) return;

    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) {
      await onFilesSelected(droppedFiles);
    }
  };

  const handleCombinedChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnlyClient) return;
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
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative p-4 sm:p-5 rounded-2xl border-2 border-dashed transition-all space-y-3 ${
        isReadOnlyClient
          ? 'border-slate-200 bg-slate-100/70 opacity-75'
          : isDragging
          ? 'border-blue-600 bg-blue-50/90 ring-4 ring-blue-500/20'
          : bothReady
          ? 'border-emerald-400/80 bg-emerald-50/40'
          : 'border-slate-300 hover:border-blue-400 bg-white'
      }`}
    >
      <input
        ref={combinedInputRef}
        type="file"
        disabled={isReadOnlyClient}
        accept=".cer,.key,.crt,.der,.pem"
        multiple
        onChange={handleCombinedChange}
        tabIndex={-1}
        className="sr-only"
        aria-label="Cargar archivos de e.firma (.cer y .key)"
      />

      {/* Área interactiva principal (sin botones anidados) */}
      <button
        type="button"
        disabled={isReadOnlyClient}
        title={isReadOnlyClient ? 'Modo solo lectura: carga de e.firma deshabilitada' : undefined}
        aria-label="Seleccionar o arrastrar archivos .cer y .key de tu e.firma"
        onClick={() => combinedInputRef.current?.click()}
        className="w-full text-center flex flex-col items-center justify-center gap-2 rounded-xl py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed cursor-pointer"
      >
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition shadow-xs ${
            bothReady
              ? 'bg-emerald-600 text-white'
              : isDragging
              ? 'bg-blue-600 text-white'
              : 'bg-indigo-100 text-indigo-700'
          }`}
        >
          {bothReady ? (
            <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
          ) : (
            <UploadCloud className="w-6 h-6" aria-hidden="true" />
          )}
        </div>

        <div>
          <div className="text-xs sm:text-sm font-bold text-slate-800">
            {isReadOnlyClient
              ? 'Carga de e.firma deshabilitada en modo solo lectura'
              : bothReady
              ? '¡Ambos archivos de tu e.firma están listos!'
              : 'Arrastra aquí tus archivos .cer y .key de tu e.firma'}
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Puedes soltar ambos archivos al mismo tiempo o hacer clic para seleccionarlos juntos
          </p>
        </div>
      </button>

      {/* Estatus interactivo hermano de los dos archivos (fuera del button principal) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg mx-auto text-left">
        {/* Badge Certificado (.cer) */}
        <div
          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
            hasCer
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <FileKey className={`w-4 h-4 shrink-0 ${hasCer ? 'text-emerald-600' : 'text-slate-500'}`} aria-hidden="true" />
            <div className="min-w-0 space-y-0.5">
              <span className="font-bold text-[11px] uppercase block tracking-wider text-slate-600">
                Certificado (.cer)
              </span>
              <span className="truncate block font-mono text-[11px] font-semibold text-slate-900">
                {hasCer ? cerFileName : 'Pendiente de cargar'}
              </span>
              {hasCer && parsedCerInfo && (
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  {isRfcMatch ? (
                    <StatusBadge
                      tone="emerald"
                      shape="tag"
                      icon={<CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
                    >
                      RFC Coincide ({parsedCerInfo.rfcTitular})
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="amber" shape="tag">
                      RFC: {parsedCerInfo.rfcTitular}
                    </StatusBadge>
                  )}
                  {parsedCerInfo.isExpired ? (
                    <StatusBadge tone="red" shape="tag">
                      Vencido
                    </StatusBadge>
                  ) : (
                    <span className="text-[11px] text-slate-600 font-mono">
                      Vence: {parsedCerInfo.validTo.slice(0, 10)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={isReadOnlyClient}
            aria-label={hasCer ? 'Cambiar archivo de certificado (.cer)' : 'Explorar y seleccionar certificado (.cer)'}
            title={isReadOnlyClient ? 'Modo solo lectura: carga deshabilitada' : undefined}
            onClick={() => cerInputRef.current?.click()}
          >
            {hasCer ? 'Cambiar' : 'Explorar'}
          </Button>
        </div>

        {/* Badge Clave Privada (.key) */}
        <div
          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
            hasKey
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <KeyRound className={`w-4 h-4 shrink-0 ${hasKey ? 'text-emerald-600' : 'text-slate-500'}`} aria-hidden="true" />
            <div className="min-w-0">
              <span className="font-bold text-[11px] uppercase block tracking-wider text-slate-600">
                Clave Privada (.key)
              </span>
              <span className="truncate block font-mono text-[11px] font-semibold text-slate-900">
                {hasKey ? keyFileName : 'Pendiente de cargar'}
              </span>
              {hasKey && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold pt-0.5">
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                  Llave cargada en memoria
                </span>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={isReadOnlyClient}
            aria-label={hasKey ? 'Cambiar archivo de clave privada (.key)' : 'Explorar y seleccionar clave privada (.key)'}
            title={isReadOnlyClient ? 'Modo solo lectura: carga deshabilitada' : undefined}
            onClick={() => keyInputRef.current?.click()}
          >
            {hasKey ? 'Cambiar' : 'Explorar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
