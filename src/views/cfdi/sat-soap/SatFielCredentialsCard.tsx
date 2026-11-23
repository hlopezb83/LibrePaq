import React, { useEffect, useState } from 'react';
import {
  Download,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { SatFielDropzone } from './SatFielDropzone';
import { SatFielSecuritySeals } from './SatFielSecuritySeals';
import { triggerDownloadBase64File } from './satSoapHelpers';
import { parseSatCertificate, type ParsedCerInfo } from '../../../shared/sat-certificate-parser';
import type { FielCredentialStatus } from '../../../shared/types';

interface SatFielCredentialsCardProps {
  companyRfc: string;
  fielStatus: FielCredentialStatus | null | undefined;
  cerInputRef: React.RefObject<HTMLInputElement | null>;
  keyInputRef: React.RefObject<HTMLInputElement | null>;
  cerFileName: string;
  keyFileName: string;
  passphrase: string;
  setPassphrase: (v: string) => void;
  cerBase64: string;
  keyBase64: string;
  handleCerSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleKeySelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFilesSelected?: (files: File[]) => Promise<void>;
  generateTestFielMutation: { isPending: boolean; mutate: () => void };
  saveFielMutation: { isPending: boolean; mutate: () => void };
  generatedTestFiles: {
    cerBase64: string;
    keyBase64: string;
    passphrase: string;
  } | null;
  isDemoCompany?: boolean;
  isReadOnlyClient?: boolean;
  onCancelChangeFiel?: () => void;
}

export function SatFielCredentialsCard({
  companyRfc,
  fielStatus,
  cerInputRef,
  keyInputRef,
  cerFileName,
  keyFileName,
  passphrase,
  setPassphrase,
  cerBase64,
  keyBase64,
  handleCerSelect,
  handleKeySelect,
  onFilesSelected,
  generateTestFielMutation,
  saveFielMutation,
  generatedTestFiles,
  isDemoCompany,
  isReadOnlyClient = false,
  onCancelChangeFiel
}: SatFielCredentialsCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [parsedCerInfo, setParsedCerInfo] = useState<ParsedCerInfo | null>(null);

  useEffect(() => {
    if (!cerBase64) {
      setParsedCerInfo(null);
      return;
    }
    void parseSatCertificate(cerBase64, companyRfc).then((info) => {
      setParsedCerInfo(info);
    }).catch(() => {
      setParsedCerInfo(null);
    });
  }, [cerBase64, companyRfc]);

  const fallbackFilesSelected = async (files: File[]) => {
    if (onFilesSelected) {
      await onFilesSelected(files);
      return;
    }
    for (const file of files) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.cer') || lower.endsWith('.crt')) {
        const dummyEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleCerSelect(dummyEvent);
      } else if (lower.endsWith('.key') || lower.endsWith('.der')) {
        const dummyEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleKeySelect(dummyEvent);
      }
    }
  };

  return (
    <div className="w-full p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-300/80 space-y-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            {fielStatus?.hasCredentials
              ? 'Actualizar archivos de tu e.firma (.cer y .key)'
              : '1. Conecta la e.firma de tu Empresa (.cer y .key)'}
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {fielStatus?.hasCredentials
              ? 'Carga los nuevos archivos si renovaste tu certificado ante el SAT.'
              : 'Carga tus archivos oficiales emitidos por el SAT y escribe tu contraseña para autorizar descargas.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isDemoCompany && (
            <button
              type="button"
              disabled={generateTestFielMutation.isPending || isReadOnlyClient}
              onClick={() => generateTestFielMutation.mutate()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
              {generateTestFielMutation.isPending
                ? 'Generando...'
                : 'Generar .cer/.key Demo'}
            </button>
          )}

          {onCancelChangeFiel && (
            <button
              type="button"
              onClick={onCancelChangeFiel}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {fielStatus?.hasCredentials && (
        <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800">{fielStatus.nombreTitular}</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-mono text-[10px] font-bold border border-emerald-200">
              RFC: {fielStatus.rfcTitular}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-600 font-mono pt-0.5">
            <div>Serie: {fielStatus.numeroSerieCertificado}</div>
            <div>Válida hasta: {fielStatus.validTo?.slice(0, 10)}</div>
          </div>
        </div>
      )}

      {/* Hidden file inputs for individual triggers */}
      <input
        ref={cerInputRef}
        type="file"
        accept=".cer,.crt,.pem"
        onChange={handleCerSelect}
        tabIndex={-1}
        aria-label="Seleccionar certificado e.firma (.cer)"
        className="visually-hidden"
      />
      <input
        ref={keyInputRef}
        type="file"
        accept=".key,.der,.pem"
        onChange={handleKeySelect}
        tabIndex={-1}
        aria-label="Seleccionar clave privada e.firma (.key)"
        className="visually-hidden"
      />

      {/* Smart Drag & Drop Zone Unificada */}
      <SatFielDropzone
        cerFileName={cerFileName}
        keyFileName={keyFileName}
        hasCer={Boolean(cerBase64)}
        hasKey={Boolean(keyBase64)}
        onFilesSelected={onFilesSelected || fallbackFilesSelected}
        cerInputRef={cerInputRef}
        keyInputRef={keyInputRef}
        parsedCerInfo={parsedCerInfo}
        companyRfc={companyRfc}
      />

      {/* Input de Contraseña con toggle de visibilidad */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
        <div className="flex-1">
          <label
            htmlFor="fiel-passphrase"
            className="block text-[11px] font-semibold text-slate-700 mb-1"
          >
            Contraseña de Clave Privada (<code>.key</code>) *
          </label>
          <div className="relative">
            <Lock
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="fiel-passphrase"
              type={showPassword ? 'text' : 'password'}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Contraseña de tu e.firma SAT..."
              className="w-full pl-8 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              className="p-1.5 text-slate-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer transition rounded-lg hover:bg-slate-100"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={saveFielMutation.isPending || !cerBase64 || !keyBase64 || !passphrase || isReadOnlyClient}
          onClick={() => saveFielMutation.mutate()}
          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs transition shrink-0"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          {saveFielMutation.isPending ? 'Validando e.firma...' : 'Validar y Guardar e.firma'}
        </button>
      </div>

      {/* Sellos de Seguridad Bancaria y Cifrado */}
      <SatFielSecuritySeals />

      {isDemoCompany && generatedTestFiles && (
        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <span>Descargar tus archivos de prueba generados:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                triggerDownloadBase64File(
                  `${companyRfc}_efirma.cer`,
                  generatedTestFiles.cerBase64
                )
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-mono text-[11px] cursor-pointer"
            >
              <Download className="w-3 h-3 text-blue-700" aria-hidden="true" />
              {companyRfc}.cer
            </button>
            <button
              type="button"
              onClick={() =>
                triggerDownloadBase64File(
                  `${companyRfc}_efirma.key`,
                  generatedTestFiles.keyBase64
                )
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-mono text-[11px] cursor-pointer"
            >
              <Download className="w-3 h-3 text-blue-700" aria-hidden="true" />
              {companyRfc}.key
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
