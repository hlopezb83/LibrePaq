import type { FormEvent } from 'react';
import {
  FileCode2,
  KeyRound,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload
} from 'lucide-react';
import { formatShortDate } from '../../lib/formatters';
import type { Company, FielCredentialStatus } from '../../shared/types';
import { AjustesSoapHistoryCard, type SoapHistoryItem } from './AjustesSoapHistoryCard';

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
  setShowFielPass
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
                <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${fielStatus.hasPrivateKey ? 'text-emerald-600' : 'text-blue-600'}`} />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
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
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">RFC Titular</span>
                  <span className="font-mono font-bold text-slate-900">{fielStatus.rfcTitular}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">No. de Serie</span>
                  <span className="font-mono text-slate-800">{fielStatus.numeroSerieCertificado}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Vigencia</span>
                  <span className="text-slate-800">
                    Del {fielStatus.validFrom ? formatShortDate(fielStatus.validFrom) : 'N/A'} al {fielStatus.validTo ? formatShortDate(fielStatus.validTo) : 'N/A'}
                  </span>
                </div>
                {fielStatus.sha1Fingerprint && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Huella SHA-1</span>
                    <span className="font-mono text-[10px] text-slate-500 break-all">{fielStatus.sha1Fingerprint}</span>
                  </div>
                )}
                {fielStatus.rfcTitular && activeCompany.rfc && fielStatus.rfcTitular !== activeCompany.rfc && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-[11px] text-amber-900 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
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
                disabled={isUploadingFiel}
                onClick={handleGenerateTestFiel}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                ⚡ Cargar e.firma de prueba (Solo Demo)
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
            onSubmit={handleUploadFiel}
            className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-4"
          >
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-700" />
                Actualizar Certificado Digital del SAT (.cer y .key)
              </h2>
              <p className="text-xs text-slate-500">
                Las credenciales se cifran localmente con AES-256-GCM y nunca se comparten con servidores de terceros.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">Certificado X.509 (.cer) *</span>
                <label
                  htmlFor="efirma-cer-input"
                  className={`relative border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer flex flex-col items-center justify-center gap-1 transition focus-within:outline-2 focus-within:outline-blue-700 focus-within:outline-offset-2 focus-within:border-blue-600 ${
                    cerFile
                      ? 'border-emerald-300 bg-emerald-50/40 text-emerald-900'
                      : 'border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/30'
                  }`}
                >
                  <input
                    id="efirma-cer-input"
                    name="cerFile"
                    type="file"
                    accept=".cer"
                    onChange={(e) => setCerFile(e.target.files?.[0] || null)}
                    className="visually-hidden"
                  />
                  <FileCode2 className={`w-5 h-5 ${cerFile ? 'text-emerald-600' : 'text-slate-400'}`} aria-hidden="true" />
                  <span className="text-xs font-bold truncate max-w-full">
                    {cerFile
                      ? cerFile.name
                      : fielStatus?.hasCredentials
                        ? 'Archivo .cer registrado (clic para cambiar)'
                        : 'Seleccionar archivo .cer'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {cerFile
                      ? 'Certificado SAT listo para subir'
                      : fielStatus?.hasCredentials
                        ? `Certificado actual: Serie ${fielStatus.numeroSerieCertificado || 'SAT'}`
                        : 'Certificado público emitido por el SAT'}
                  </span>
                </label>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">Clave Privada PKCS#8 (.key) *</span>
                <label
                  htmlFor="efirma-key-input"
                  className={`relative border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer flex flex-col items-center justify-center gap-1 transition focus-within:outline-2 focus-within:outline-blue-700 focus-within:outline-offset-2 focus-within:border-blue-600 ${
                    keyFile
                      ? 'border-emerald-300 bg-emerald-50/40 text-emerald-900'
                      : 'border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/30'
                  }`}
                >
                  <input
                    id="efirma-key-input"
                    name="keyFile"
                    type="file"
                    accept=".key"
                    onChange={(e) => setKeyFile(e.target.files?.[0] || null)}
                    className="visually-hidden"
                  />
                  <KeyRound className={`w-5 h-5 ${keyFile || fielStatus?.hasCredentials ? 'text-emerald-600' : 'text-slate-400'}`} aria-hidden="true" />
                  <span className="text-xs font-bold truncate max-w-full">
                    {keyFile
                      ? keyFile.name
                      : fielStatus?.hasCredentials
                        ? 'Archivo .key registrado (clic para cambiar)'
                        : 'Seleccionar archivo .key'}
                  </span>
                  <span className="text-[10px] text-slate-500">
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
                    autoComplete="current-password"
                    value={fielPass}
                    onChange={(e) => setFielPass(e.target.value)}
                    placeholder="Ingresa la contraseña de tu e.firma"
                    className="w-full px-3 py-2.5 pr-20 rounded-xl border border-slate-300 text-xs font-mono text-slate-800 focus:outline-blue-600"
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
                  💡 Tus archivos ya están cargados. Ingresa tu contraseña para autorizar la descarga del SAT.
                </span>
              ) : (
                <span className="text-[11px] text-slate-500">
                  {!fielStatus?.hasCredentials && (!cerFile || !keyFile)
                    ? 'Selecciona tus archivos .cer y .key del SAT'
                    : !fielPass
                      ? 'Ingresa la contraseña de tu e.firma para validar'
                      : 'Credenciales listas para cifrar y validar'}
                </span>
              )}
              <button
                type="submit"
                disabled={isUploadingFiel || !fielPass || (!fielStatus?.hasCredentials && (!cerFile || !keyFile))}
                aria-busy={isUploadingFiel}
                title={
                  !fielStatus?.hasCredentials && (!cerFile || !keyFile)
                    ? 'Selecciona primero los archivos .cer y .key de tu e.firma SAT'
                    : !fielPass
                      ? 'Ingresa la contraseña de tu clave privada .key'
                      : undefined
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
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
