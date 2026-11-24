import type React from 'react';
import { useState } from 'react';
import { Eye, EyeOff, FileKey2, KeyRound, Lock, ShieldCheck, UploadCloud } from 'lucide-react';

interface WizardStep4FielProps {
  skipFiel: boolean;
  setSkipFiel: (val: boolean | ((prev: boolean) => boolean)) => void;
  fielCerName: string | null;
  fielKeyName: string | null;
  fielPassword: string;
  setFielPassword: (password: string) => void;
  onCerFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFielDrop?: (files: FileList) => void;
}

export function WizardStep4Fiel({
  skipFiel,
  setSkipFiel,
  fielCerName,
  fielKeyName,
  fielPassword,
  setFielPassword,
  onCerFileChange,
  onKeyFileChange,
  onFielDrop
}: WizardStep4FielProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Credenciales Criptográficas (FIEL / e.firma)
          </h3>
          <p className="text-xs text-slate-600">
            Permite la descarga masiva directa de facturas y complementos desde los servidores del SAT.
          </p>
        </div>
        <button
          type="button"
          aria-pressed={skipFiel}
          onClick={() => setSkipFiel((prev) => !prev)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shrink-0 ${
            skipFiel
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
          }`}
        >
          {skipFiel ? 'e.firma omitida (Clic para configurar)' : 'Configurar después'}
        </button>
      </div>

      {!skipFiel ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files?.length) {
              onFielDrop?.(e.dataTransfer.files);
            }
          }}
          className={`space-y-3.5 p-4 rounded-2xl border transition ${
            isDragging
              ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-400/30'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-slate-700 bg-white border border-dashed border-blue-300 rounded-xl px-3 py-2">
            <UploadCloud className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
            <span>
              Arrastra juntos tus archivos <strong className="font-mono">.cer</strong> y{' '}
              <strong className="font-mono">.key</strong> aquí, o selecciónalos manualmente:
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <span
                id="wizard-fiel-cer-label"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Certificado (.cer) *
              </span>
              <label
                htmlFor="wizard-fiel-cer-input"
                aria-labelledby="wizard-fiel-cer-label"
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50 cursor-pointer focus-within:outline-2 focus-within:outline-blue-700"
              >
                <span className="truncate">{fielCerName || 'Seleccionar .cer...'}</span>
                <FileKey2 className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
                <input
                  id="wizard-fiel-cer-input"
                  type="file"
                  accept=".cer"
                  onChange={onCerFileChange}
                  className="visually-hidden"
                />
              </label>
            </div>

            <div>
              <span
                id="wizard-fiel-key-label"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Clave Privada (.key) *
              </span>
              <label
                htmlFor="wizard-fiel-key-input"
                aria-labelledby="wizard-fiel-key-label"
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50 cursor-pointer focus-within:outline-2 focus-within:outline-blue-700"
              >
                <span className="truncate">{fielKeyName || 'Seleccionar .key...'}</span>
                <KeyRound className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                <input
                  id="wizard-fiel-key-input"
                  type="file"
                  accept=".key"
                  onChange={onKeyFileChange}
                  className="visually-hidden"
                />
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="wizard-fiel-pass" className="block text-xs font-bold text-slate-700 mb-1">
              Contraseña de Clave Privada (.key) *
            </label>
            <div className="relative">
              <input
                id="wizard-fiel-pass"
                type={showPassword ? 'text' : 'password'}
                value={fielPassword}
                onChange={(e) => setFielPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2 pr-10 rounded-xl border border-slate-300 bg-white text-sm focus:border-blue-700"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Ocultar contraseña de clave privada' : 'Mostrar contraseña de clave privada'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 min-h-[28px] min-w-[28px] inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 text-[11px] text-emerald-900 font-semibold">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
              <Lock className="w-3 h-3 text-emerald-700" aria-hidden="true" />
              Cifrado Local en Memoria
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-900">
              <ShieldCheck className="w-3 h-3 text-blue-700" aria-hidden="true" />
              Canal HTTPS WS-Security · Art. 17-D CFF
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          Podrás cargar tu certificado y clave privada en cualquier momento desde la <strong>Bóveda ADD</strong> para realizar descargas masivas de facturas.
        </div>
      )}
    </div>
  );
}
