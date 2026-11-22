import { useRef } from 'react';
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
  const cerFileInputRef = useRef<HTMLInputElement>(null);
  const keyFileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Credenciales Criptográficas (FIEL / e.firma)
          </h3>
          <p className="text-xs text-slate-500">
            Permite la descarga masiva directa de facturas y complementos desde los servidores del SAT.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSkipFiel((prev) => !prev)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
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
              <span id="wizard-fiel-cer-label" className="block text-xs font-bold text-slate-700 mb-1">
                Certificado (.cer) *
              </span>
              <button
                type="button"
                aria-labelledby="wizard-fiel-cer-label"
                onClick={() => cerFileInputRef.current?.click()}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <span className="truncate">{fielCerName || 'Seleccionar .cer...'}</span>
                <FileKey2 className="w-4 h-4 text-blue-700 shrink-0" />
              </button>
              <input
                ref={cerFileInputRef}
                type="file"
                accept=".cer"
                aria-label="Archivo certificado .cer de e.firma"
                onChange={onCerFileChange}
                className="hidden"
              />
            </div>

            <div>
              <span id="wizard-fiel-key-label" className="block text-xs font-bold text-slate-700 mb-1">
                Clave Privada (.key) *
              </span>
              <button
                type="button"
                aria-labelledby="wizard-fiel-key-label"
                onClick={() => keyFileInputRef.current?.click()}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <span className="truncate">{fielKeyName || 'Seleccionar .key...'}</span>
                <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
              </button>
              <input
                ref={keyFileInputRef}
                type="file"
                accept=".key"
                aria-label="Archivo clave privada .key de e.firma"
                onChange={onKeyFileChange}
                className="hidden"
              />
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

          <div className="pt-2 flex items-center justify-between border-t border-slate-200">
            <span className="text-[11px] text-slate-500">¿No tienes los archivos oficiales de e.firma en este dispositivo?</span>
            <span className="text-[11px] font-medium text-slate-600">
              Marca la opción "Configurar e.firma más tarde" arriba para comenzar de inmediato.
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
