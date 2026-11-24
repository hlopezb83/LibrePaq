import type { DragEvent, FormEvent } from 'react';
import {
  FileCode2,
  KeyRound,
  Loader2,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload
} from 'lucide-react';
import { formatShortDate } from '../../lib/formatters';
import type { Company, FielCredentialStatus } from '../../shared/types';
import { AjustesSoapHistoryCard, type SoapHistoryItem } from './AjustesSoapHistoryCard';

function makeFielDropHandlers(
  ext: '.cer' | '.key',
  isReadOnly: boolean,
  onSelect: (file: File | null) => void
) {
  return {
    onDragOver: (e: DragEvent<HTMLLabelElement>) => {
      if (isReadOnly) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDrop: (e: DragEvent<HTMLLabelElement>) => {
      if (isReadOnly) return;
      e.preventDefault();
      const dropped = e.dataTransfer.files?.[0];
      if (dropped && dropped.name.toLowerCase().endsWith(ext)) onSelect(dropped);
    }
  };
}

function getDropzoneClass(isReadOnly: boolean, hasFile: boolean): string {
  const base =
    'relative border-2 border-dashed rounded-xl p-3.5 text-center flex flex-col items-center justify-center gap-1 transition focus-within:outline-2 focus-within:outline-blue-700 focus-within:outline-offset-2 focus-within:border-blue-600';
  if (isReadOnly) return `${base} border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed opacity-70`;
  if (hasFile) return `${base} border-emerald-300 bg-emerald-50/40 text-emerald-900 cursor-pointer`;
  return `${base} border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/30 cursor-pointer`;
}

export interface AjustesEfirmaTabProps {
  activeCompany: Company;
  fielStatus?: FielCredentialStatus | null;
  soapRequests?: SoapHistoryItem[];
  isUploadingFiel: boolean;
  handleGenerateTestFiel: () => void;
  handleUploadFiel: (e: FormEvent) => void;
  cerFile: File | null;
  setCerFile: (f: File | null) => void;
  keyFile: File | null;
  setKeyFile: (f: File | null) => void;
  fielPass: string;
  setFielPass: (p: string) => void;
  showFielPass: boolean;
  setShowFielPass: (s: boolean) => void;
  isReadOnly?: boolean;
}

export function AjustesEfirmaTab({
  activeCompany,
  fielStatus,
  soapRequests,
  isUploadingFiel,
  handleGenerateTestFiel,
  handleUploadFiel,
  cerFile,
  setCerFile,
  keyFile,
  setKeyFile,
  fielPass,
  setFielPass,
  showFielPass,
  setShowFielPass,
  isReadOnly = false
}: AjustesEfirmaTabProps) {
  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Tarjeta de Estado del Certificado Actual */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-700" />
              Estado de la e.firma (FIEL)
            </h2>

            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                fielStatus?.hasCredentials && !fielStatus.isExpired && fielStatus.hasPrivateKey
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : fielStatus?.hasCredentials && !fielStatus.isExpired
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : fielStatus?.isExpired
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {fielStatus?.hasCredentials && !fielStatus.isExpired ? (
                <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${fielStatus.hasPrivateKey ? 'text-emerald-600' : 'text-blue-600'}`} aria-hidden="true" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div>
                <div className="text-xs font-bold uppercase tracking-wide">
                  {fielStatus?.hasCredentials && !fielStatus.isExpired && fielStatus.hasPrivateKey
                    ? 'e.firma Autorizada y Activa para SAT'
                    : fielStatus?.hasCredentials && !fielStatus.isExpired
                      ? 'Certificado Cargado · Falta Contraseña'
                      : fielStatus?.isExpired
                        ? 'Certificado e.firma Expirado'
                        : 'Sin Credenciales e.firma'}
                </div>
                <p className="text-[11px] mt-0.5 opacity-90">
                  {fielStatus?.hasCredentials
                    ? (fielStatus.hasPrivateKey
                        ? `Registrado y firmado digitalmente para ${fielStatus.nombreTitular || activeCompany.name}.`
                        : 'Archivos .cer y .key registrados. Ingresa tu contraseña abajo para activar la descarga del SAT.')
                    : 'Carga los archivos .cer y .key para habilitar la descarga masiva directa del SAT.'}
                </p>
              </div>
            </div>

            {fielStatus?.hasCredentials && (
              <div className="space-y-2.5 text-xs text-slate-700 border-t border-slate-200 pt-3">
                <div>
                  <span className="text-slate-600 block text-[10px] uppercase font-bold">RFC Titular</span>
                  <span className="font-mono font-bold text-slate-900">{fielStatus.rfcTitular}</span>
                </div>
                <div>
                  <span className="text-slate-600 block text-[10px] uppercase font-bold">No. de Serie</span>
                  <span className="font-mono text-slate-800">{fielStatus.numeroSerieCertificado}</span>
                </div>
                <div>
                  <span className="text-slate-600 block text-[10px] uppercase font-bold">Vigencia</span>
                  <span className="text-slate-800">
                    Del {fielStatus.validFrom ? formatShortDate(fielStatus.validFrom) : 'N/A'} al {fielStatus.validTo ? formatShortDate(fielStatus.validTo) : 'N/A'}
                  </span>
                </div>
                {fielStatus.sha1Fingerprint && (
                  <div>
                    <span className="text-slate-600 block text-[10px] uppercase font-bold">Huella del Certificado</span>
                    <span className="font-mono text-[10px] text-slate-600 break-all">{fielStatus.sha1Fingerprint}</span>
                  </div>
                )}
                {fielStatus.rfcTitular && activeCompany.rfc && fielStatus.rfcTitular !== activeCompany.rfc && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-[11px] text-amber-900 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <span className="font-bold block">Aviso de RFC Titular:</span>
                      El certificado cargado pertenece a <strong>{fielStatus.rfcTitular}</strong>, distinto a la empresa activa (<strong>{activeCompany.rfc}</strong>).
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeCompany.name.startsWith('[DEMO]') || activeCompany.rfc === 'CEJ2106158A0' || activeCompany.rfc === 'XAXX010101000' ? (
              <button
                type="button"
                disabled={isUploadingFiel || isReadOnly}
                onClick={handleGenerateTestFiel}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                Cargar e.firma de prueba (Solo Demo)
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  Empresa en Producción
                </span>
                <p>Carga los archivos oficiales emitidos por el SAT para conectar la descarga masiva con la e.firma de tu cliente.</p>
              </div>
            )}
          </div>
        </div>

        {/* Formulario de Carga de e.firma */}
        <div className="lg:col-span-2 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!isReadOnly) handleUploadFiel(e);
            }}
            className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-4"
          >
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-700" aria-hidden="true" />
                Actualizar Certificado Digital del SAT (.cer y .key)
              </h2>
              <p className="text-xs text-slate-600">
                Tus archivos se protegen desde tu navegador antes de enviarse y nunca se comparten con terceros.
              </p>
            </div>

            {isReadOnly && (
              <div role="status" className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950">
                Modo solo consulta: la carga o autorización de archivos e.firma (.cer y .key) está deshabilitada.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="efirma-cer-input"
                  title={isReadOnly ? 'Modo solo lectura: no puedes cargar archivos .cer' : 'Haz clic o arrastra tu archivo .cer'}
                  {...makeFielDropHandlers('.cer', Boolean(isReadOnly), setCerFile)}
                  className={getDropzoneClass(Boolean(isReadOnly), Boolean(cerFile))}
                >
                  <span className="text-xs font-bold text-slate-700 block mb-1">Certificado Público SAT (.cer) *</span>
                  <input
                    id="efirma-cer-input"
                    name="cerFile"
                    type="file"
                    accept=".cer"
                    disabled={isReadOnly}
                    onChange={(e) => setCerFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  <FileCode2 className={`w-5 h-5 ${cerFile ? 'text-emerald-600' : 'text-slate-500'}`} aria-hidden="true" />
                  <span className="text-xs font-bold truncate max-w-full">
                    {cerFile ? cerFile.name : fielStatus?.hasCredentials ? 'Archivo .cer registrado (clic o arrastra)' : 'Seleccionar o arrastrar .cer'}
                  </span>
                  <span className="text-[11px] text-slate-600">
                    {cerFile ? 'Certificado SAT listo para subir' : fielStatus?.hasCredentials ? `Serie ${fielStatus.numeroSerieCertificado || 'SAT'}` : 'Certificado público emitido por el SAT'}
                  </span>
                </label>
              </div>

              <div>
                <label
                  htmlFor="efirma-key-input"
                  title={isReadOnly ? 'Modo solo lectura: no puedes cargar archivos .key' : 'Haz clic o arrastra tu archivo .key'}
                  {...makeFielDropHandlers('.key', Boolean(isReadOnly), setKeyFile)}
                  className={getDropzoneClass(Boolean(isReadOnly), Boolean(keyFile))}
                >
                  <span className="text-xs font-bold text-slate-700 block mb-1">Clave Privada (.key) *</span>
                  <input
                    id="efirma-key-input"
                    name="keyFile"
                    type="file"
                    accept=".key"
                    disabled={isReadOnly}
                    onChange={(e) => setKeyFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  <KeyRound className={`w-5 h-5 ${keyFile || fielStatus?.hasCredentials ? 'text-emerald-600' : 'text-slate-500'}`} aria-hidden="true" />
                  <span className="text-xs font-bold truncate max-w-full">
                    {keyFile ? keyFile.name : fielStatus?.hasCredentials ? 'Archivo .key registrado (clic o arrastra)' : 'Seleccionar o arrastrar .key'}
                  </span>
                  <span className="text-[11px] text-slate-600">
                    {keyFile
                      ? 'Llave privada lista para subir'
                      : fielStatus?.hasCredentials
                        ? (fielStatus.hasPrivateKey ? 'Llave privada descifrada y autorizada' : 'Llave registrada · requiere contraseña')
                        : 'Llave privada cifrada del contribuyente'}
                  </span>
                </label>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="efirma-fiel-pass" className="text-xs font-bold text-slate-700 block">
                  Contraseña de la Clave Privada *
                </label>
                <div className="relative">
                  <input
                    id="efirma-fiel-pass"
                    name="fielPassword"
                    type={showFielPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    disabled={isReadOnly}
                    value={fielPass}
                    onChange={(e) => setFielPass(e.target.value)}
                    placeholder="Ingresa la contraseña de tu e.firma"
                    className="w-full px-3 py-2.5 pr-20 rounded-xl border border-slate-300 text-xs font-mono text-slate-800 focus:outline-blue-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    aria-pressed={showFielPass}
                    aria-label={showFielPass ? 'Ocultar contraseña de clave privada' : 'Mostrar contraseña de clave privada'}
                    onClick={() => setShowFielPass(!showFielPass)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-[11px] text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                  >
                    {showFielPass ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
              {fielStatus?.hasCredentials && !fielStatus?.hasPrivateKey ? (
                <span className="text-xs text-blue-700 font-medium">
                  Tus archivos ya están cargados. Ingresa tu contraseña para autorizar la descarga del SAT.
                </span>
              ) : (
                <span className="text-[11px] text-slate-600">
                  {!fielStatus?.hasCredentials && (!cerFile || !keyFile)
                    ? 'Selecciona tus archivos .cer y .key del SAT'
                    : !fielPass
                      ? 'Ingresa la contraseña de tu e.firma para validar'
                      : 'Credenciales listas para cifrar y validar'}
                </span>
              )}
              <button
                type="submit"
                disabled={isReadOnly || isUploadingFiel || !fielPass || (!fielStatus?.hasCredentials && (!cerFile || !keyFile))}
                aria-busy={isUploadingFiel}
                title={
                  isReadOnly
                    ? 'Solo un Contador o Socio puede modificar la e.firma'
                    : !fielStatus?.hasCredentials && (!cerFile || !keyFile)
                      ? 'Selecciona primero los archivos .cer y .key de tu e.firma SAT'
                      : !fielPass
                        ? 'Ingresa la contraseña de tu clave privada .key'
                        : 'Cifrar y validar credenciales SAT'
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingFiel ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="w-4 h-4" aria-hidden="true" />
                )}
                {isUploadingFiel
                  ? 'Validando con SAT...'
                  : !cerFile && !keyFile && fielStatus?.hasCredentials
                    ? 'Autorizar Llave y Conectar SAT'
                    : 'Guardar y Validar e.firma'}
              </button>
            </div>
          </form>

          {/* Historial de Solicitudes SOAP Recientes */}
          <AjustesSoapHistoryCard
            companyRfc={activeCompany.rfc}
            soapRequests={soapRequests}
          />
        </div>
      </div>
    </section>
  );
}
