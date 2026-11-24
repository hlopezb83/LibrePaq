import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { AlertBanner, Button, Input, StatusBadge } from '../../../components/ui';
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
    void parseSatCertificate(cerBase64, companyRfc)
      .then((info) => setParsedCerInfo(info))
      .catch(() => setParsedCerInfo(null));
  }, [cerBase64, companyRfc]);

  const fallbackFilesSelected = async (files: File[]) => {
    if (onFilesSelected) {
      await onFilesSelected(files);
      return;
    }
    for (const file of files) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.cer') || lower.endsWith('.crt')) {
        const dummyEvent = {
          target: { files: [file] }
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleCerSelect(dummyEvent);
      } else if (lower.endsWith('.key') || lower.endsWith('.der')) {
        const dummyEvent = {
          target: { files: [file] }
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleKeySelect(dummyEvent);
      }
    }
  };

  const isRfcMatch = Boolean(
    parsedCerInfo && companyRfc && parsedCerInfo.rfcTitular.toUpperCase() === companyRfc.toUpperCase()
  );
  const daysToExpire = parsedCerInfo?.validTo
    ? Math.ceil((new Date(parsedCerInfo.validTo).getTime() - Date.now()) / 86_400_000)
    : null;
  const isExpiringSoon = daysToExpire !== null && daysToExpire >= 0 && daysToExpire <= 30;
  const showCertWarning = Boolean(
    parsedCerInfo && ((companyRfc && !isRfcMatch) || parsedCerInfo.isExpired || isExpiringSoon)
  );

  const saveDisabledReason = isReadOnlyClient
    ? 'Modo solo lectura: no puedes guardar credenciales e.firma'
    : saveFielMutation.isPending
    ? 'Validando e.firma ante el SAT...'
    : !cerBase64
    ? 'Carga el archivo de certificado (.cer) primero'
    : !keyBase64
    ? 'Carga el archivo de clave privada (.key) primero'
    : !passphrase
    ? 'Escribe la contraseña de tu clave privada (.key)'
    : undefined;

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
            <Button
              variant="secondary"
              size="sm"
              loading={generateTestFielMutation.isPending}
              disabled={generateTestFielMutation.isPending || isReadOnlyClient}
              title={
                isReadOnlyClient
                  ? 'Modo solo lectura: generación de e.firma demo deshabilitada'
                  : generateTestFielMutation.isPending
                  ? 'Generando certificados demo...'
                  : 'Generar certificado .cer y llave .key de prueba para Sandbox'
              }
              onClick={() => generateTestFielMutation.mutate()}
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />}
            >
              {generateTestFielMutation.isPending ? 'Generando...' : 'Generar .cer/.key Demo'}
            </Button>
          )}

          {onCancelChangeFiel && (
            <Button variant="secondary" size="sm" onClick={onCancelChangeFiel}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {fielStatus?.hasCredentials && (
        <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-1 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-800">{fielStatus.nombreTitular}</span>
            <StatusBadge tone="emerald" shape="tag">
              RFC: {fielStatus.rfcTitular}
            </StatusBadge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 font-mono pt-0.5">
            <div>Serie: {fielStatus.numeroSerieCertificado}</div>
            <div>Válida hasta: {fielStatus.validTo?.slice(0, 10)}</div>
          </div>
        </div>
      )}

      {/* Hidden file inputs for individual triggers */}
      <input
        ref={cerInputRef}
        type="file"
        disabled={isReadOnlyClient}
        accept=".cer,.crt,.pem"
        onChange={handleCerSelect}
        tabIndex={-1}
        aria-label="Seleccionar certificado e.firma (.cer)"
        className="sr-only"
      />
      <input
        ref={keyInputRef}
        type="file"
        disabled={isReadOnlyClient}
        accept=".key,.der,.pem"
        onChange={handleKeySelect}
        tabIndex={-1}
        aria-label="Seleccionar clave privada e.firma (.key)"
        className="sr-only"
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
        isReadOnlyClient={isReadOnlyClient}
      />

      {showCertWarning && parsedCerInfo && (
        <AlertBanner
          tone={(companyRfc && !isRfcMatch) || parsedCerInfo.isExpired ? 'danger' : 'warning'}
          icon={<AlertTriangle className="w-4 h-4" aria-hidden="true" />}
        >
          <div className="space-y-0.5">
            {companyRfc && !isRfcMatch && (
              <p className="font-bold">
                El RFC del certificado ({parsedCerInfo.rfcTitular}) no coincide con el RFC de la
                empresa ({companyRfc}). El SAT rechazará la solicitud con código 5001.
              </p>
            )}
            {parsedCerInfo.isExpired && (
              <p className="font-bold">
                Este certificado venció el {parsedCerInfo.validTo.slice(0, 10)}. Renueva tu e.firma
                ante el SAT antes de continuar.
              </p>
            )}
            {!parsedCerInfo.isExpired && isExpiringSoon && (
              <p className="font-semibold">
                Aviso de vigencia: tu certificado vence pronto ({parsedCerInfo.validTo.slice(0, 10)}
                , en {daysToExpire} día(s)).
              </p>
            )}
          </div>
        </AlertBanner>
      )}

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
            <Input
              id="fiel-passphrase"
              type={showPassword ? 'text' : 'password'}
              disabled={isReadOnlyClient}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Contraseña de tu e.firma SAT..."
              leftAddon={<Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />}
              className="pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              className="p-1.5 text-slate-600 hover:text-slate-900 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer transition rounded-lg hover:bg-slate-100"
            >
              {showPassword ? (
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          loading={saveFielMutation.isPending}
          disabled={
            saveFielMutation.isPending ||
            !cerBase64 ||
            !keyBase64 ||
            !passphrase ||
            isReadOnlyClient
          }
          title={saveDisabledReason}
          onClick={() => saveFielMutation.mutate()}
          leftIcon={<ShieldCheck className="w-4 h-4" aria-hidden="true" />}
        >
          {saveFielMutation.isPending ? 'Validando e.firma...' : 'Validar y Guardar e.firma'}
        </Button>
      </div>

      {/* Sellos de Seguridad Bancaria y Cifrado */}
      <SatFielSecuritySeals />

      {isDemoCompany && generatedTestFiles && (
        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <span>Descargar tus archivos de prueba generados:</span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                triggerDownloadBase64File(
                  `${companyRfc}_efirma.cer`,
                  generatedTestFiles.cerBase64
                )
              }
              leftIcon={<Download className="w-3 h-3 text-blue-700" aria-hidden="true" />}
              className="font-mono"
            >
              {companyRfc}.cer
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                triggerDownloadBase64File(
                  `${companyRfc}_efirma.key`,
                  generatedTestFiles.keyBase64
                )
              }
              leftIcon={<Download className="w-3 h-3 text-blue-700" aria-hidden="true" />}
              className="font-mono"
            >
              {companyRfc}.key
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
