import type React from 'react';
import { FileKey2, KeyRound } from 'lucide-react';

interface WizardStep4FielProps {
  skipFiel: boolean;
  setSkipFiel: (val: boolean | ((prev: boolean) => boolean)) => void;
  fielCerName: string | null;
  fielKeyName: string | null;
  fielPassword: string;
  setFielPassword: (password: string) => void;
  onCerFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function WizardStep4Fiel({
  skipFiel,
  setSkipFiel,
  fielCerName,
  fielKeyName,
  fielPassword,
  setFielPassword,
  onCerFileChange,
  onKeyFileChange
}: WizardStep4FielProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Credenciales Criptográficas (FIEL / e.firma)
          </h3>
          <p className="text-xs text-slate-500">
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
        <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="wizard-fiel-cer-input"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Certificado (.cer) *
              </label>
              <label
                htmlFor="wizard-fiel-cer-input"
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
              <label
                htmlFor="wizard-fiel-key-input"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Clave Privada (.key) *
              </label>
              <label
                htmlFor="wizard-fiel-key-input"
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
              Contraseña de Clave Privada (.key)
            </label>
            <input
              id="wizard-fiel-pass"
              type="password"
              value={fielPassword}
              onChange={(e) => setFielPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:border-blue-700"
            />
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200">
            <span className="text-[11px] text-slate-600">¿No tienes los archivos oficiales de e.firma en este dispositivo?</span>
            <span className="text-[11px] font-medium text-slate-600">
              Usa el botón &quot;Configurar después&quot; arriba para comenzar de inmediato.
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
