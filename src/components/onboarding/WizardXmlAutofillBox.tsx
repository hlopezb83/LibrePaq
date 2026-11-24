import React, { useState } from 'react';
import { CheckCircle2, FileText, Loader2, Sparkles, UploadCloud } from 'lucide-react';
import type { CfdiCompanyCandidate } from '../../shared/cfdi-company-extractor';

interface WizardXmlAutofillBoxProps {
  candidates: CfdiCompanyCandidate[];
  activeRole: 'EMISOR' | 'RECEPTOR' | null;
  onXmlLoaded: (xmlText: string) => void;
  onFileLoaded?: (file: File) => void | Promise<void>;
  onSelectCandidate: (candidate: CfdiCompanyCandidate) => void;
}

export function WizardXmlAutofillBox({
  candidates,
  activeRole,
  onXmlLoaded,
  onFileLoaded,
  onSelectCandidate
}: WizardXmlAutofillBoxProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = async (file?: File) => {
    if (!file) return;
    setIsProcessing(true);
    try {
      if (onFileLoaded) {
        await onFileLoaded(file);
      } else {
        const text = await file.text();
        onXmlLoaded(text);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    void processFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`rounded-2xl border p-3.5 transition ${
        isDragging
          ? 'border-blue-600 bg-blue-50/90 ring-2 ring-blue-400/30'
          : candidates.length > 0
          ? 'border-emerald-300 bg-emerald-50/50'
          : 'border-dashed border-blue-300 bg-blue-50/40 hover:bg-blue-50/70'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              candidates.length > 0
                ? 'bg-emerald-700 text-white'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            {candidates.length > 0 ? (
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            )}
          </div>
          <div className="text-xs min-w-0">
            <p className="font-bold text-slate-900">
              {candidates.length > 0
                ? '¡Datos fiscales autocompletados con éxito!'
                : '¿Tienes una factura XML o tu Constancia SAT (CSF)? Autocompleta en 1 segundo'}
            </p>
            <p className="text-[11px] text-slate-600">
              {candidates.length > 1
                ? 'Verifica si la empresa a dar de alta es el Emisor o el Receptor del CFDI:'
                : candidates.length === 1
                ? 'Datos fiscales extraídos. Puedes revisarlos y modificarlos en el formulario.'
                : 'Arrastra tu CFDI 4.0 o el PDF de tu Constancia de Situación Fiscal para leer RFC, Razón Social, Régimen y C.P.'}
            </p>
          </div>
        </div>

        <label
          htmlFor="wizard-autofill-file"
          aria-busy={isProcessing}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-blue-700 border border-blue-300 text-xs font-bold shadow-2xs transition cursor-pointer shrink-0 focus-within:outline-2 focus-within:outline-blue-700 ${
            isProcessing ? 'opacity-60 pointer-events-none' : ''
          }`}
        >
          <input
            id="wizard-autofill-file"
            type="file"
            disabled={isProcessing}
            accept=".xml,text/xml,application/xml,.pdf,application/pdf,.png,.jpg,.jpeg,.webp,image/*"
            aria-label="Elegir archivo XML CFDI, PDF o imagen de Constancia de Situación Fiscal"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void processFile(f);
            }}
            className="sr-only"
          />
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : candidates.length > 0 ? (
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>
            {isProcessing
              ? 'Leyendo documento...'
              : candidates.length > 0
              ? 'Cambiar archivo'
              : 'Elegir XML, PDF o Imagen'}
          </span>
        </label>
      </div>

      {candidates.length > 1 && (
        <div className="mt-2.5 pt-2.5 border-t border-emerald-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {candidates.map((cand) => {
            const selected = activeRole === cand.role;
            return (
              <button
                key={cand.role}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectCandidate(cand)}
                className={`p-2 rounded-xl border text-left text-xs transition cursor-pointer ${
                  selected
                    ? 'bg-emerald-600 text-white border-emerald-700 font-bold shadow-2xs'
                    : 'bg-white hover:bg-emerald-50 text-slate-800 border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[10px] uppercase opacity-85">
                    {cand.role === 'EMISOR' ? 'Emisor de la Factura' : 'Receptor de la Factura'}
                  </span>
                  <span className="font-mono font-bold">{cand.rfc}</span>
                </div>
                <div className="truncate text-[11px] mt-0.5 opacity-95">{cand.name}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
