import { AlertCircle, CheckCircle2, FileKey2, KeyRound, ShieldCheck } from 'lucide-react';
import { SatFielCredentialsCard } from './SatFielCredentialsCard';
import { SatSoapDownloadCard } from './SatSoapDownloadCard';
import { useSatSoapFielManager } from './useSatSoapFielManager';

interface SatSoapFielPanelProps {
  companyId: string;
  companyRfc: string;
  defaultStartDate: string;
  defaultEndDate: string;
  onDownloadSuccess?: (message: string) => void;
  isDemoCompany?: boolean;
  currentYear?: number;
  currentPeriod?: number;
  pendingCfdisCount?: number;
  onBatchAutoPoliza?: () => void;
  isBatchAutoPolizaPending?: boolean;
}

export function SatSoapFielPanel({
  companyId,
  companyRfc,
  defaultStartDate,
  defaultEndDate,
  onDownloadSuccess,
  isDemoCompany,
  currentYear,
  currentPeriod,
  pendingCfdisCount,
  onBatchAutoPoliza,
  isBatchAutoPolizaPending
}: SatSoapFielPanelProps) {
  const {
    cerInputRef,
    keyInputRef,
    cerFileName,
    keyFileName,
    cerBase64,
    keyBase64,
    passphrase,
    setPassphrase,
    showChangeFiel,
    setShowChangeFiel,
    tipoSolicitud,
    setTipoSolicitud,
    fechaInicial,
    setFechaInicial,
    fechaFinal,
    setFechaFinal,
    modoEjecucion,
    setModoEjecucion,
    panelFeedback,
    setPanelFeedback,
    panelError,
    setPanelError,
    generatedTestFiles,
    fielStatus,
    hasCredentials,
    satRequests,
    verifyPendingMutation,
    saveFielMutation,
    generateTestFielMutation,
    soapDownloadMutation,
    handleCerSelect,
    handleKeySelect,
    handleFilesDrop,
    handleVerifyPending
  } = useSatSoapFielManager({
    companyId,
    companyRfc,
    defaultStartDate,
    defaultEndDate,
    isDemoCompany,
    onDownloadSuccess
  });

  return (
    <div className="bg-white rounded-2xl border border-indigo-200 shadow-xs overflow-hidden">
      {/* Encabezado e.firma + Conexión SAT */}
      <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center shrink-0">
            <FileKey2 className="w-5 h-5 text-blue-300" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">Descarga Masiva de Facturas SAT con e.firma (CFDI 4.0)</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Conexión Oficial SAT
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {hasCredentials
                ? 'Sincroniza y descarga automáticamente todas las facturas del periodo directamente del SAT.'
                : 'Conecta los certificados de la empresa para descargar automáticamente todas las facturas del periodo directamente del SAT.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {hasCredentials ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span>e.firma Activa: {fielStatus?.nombreTitular || fielStatus?.rfcTitular}</span>
                <span className="text-[10px] opacity-80 font-mono">
                  (Vigente hasta {fielStatus?.validTo?.slice(0, 10)})
                </span>
              </span>
              {!showChangeFiel && (
                <button
                  type="button"
                  onClick={() => setShowChangeFiel(true)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition cursor-pointer"
                >
                  Cambiar e.firma
                </button>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-200 border border-amber-400/30">
              <KeyRound className="w-4 h-4 text-amber-300" aria-hidden="true" />
              Sin e.firma configurada
            </span>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {panelFeedback && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-950 font-medium"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              {panelFeedback}
            </span>
            <button
              type="button"
              onClick={() => setPanelFeedback(null)}
              className="text-emerald-700 hover:underline font-semibold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {panelError && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-red-900 font-medium"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
              {panelError}
            </span>
            <button
              type="button"
              onClick={() => setPanelError(null)}
              className="text-red-700 hover:underline font-semibold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Si no hay credenciales o el usuario eligió cambiar su e.firma, mostramos el formulario de carga */}
        {(!hasCredentials || showChangeFiel) && (
          <SatFielCredentialsCard
            companyRfc={companyRfc}
            fielStatus={fielStatus}
            cerInputRef={cerInputRef}
            keyInputRef={keyInputRef}
            cerFileName={cerFileName}
            keyFileName={keyFileName}
            passphrase={passphrase}
            setPassphrase={setPassphrase}
            cerBase64={cerBase64}
            keyBase64={keyBase64}
            handleCerSelect={handleCerSelect}
            handleKeySelect={handleKeySelect}
            onFilesSelected={handleFilesDrop}
            generateTestFielMutation={generateTestFielMutation}
            saveFielMutation={saveFielMutation}
            generatedTestFiles={generatedTestFiles}
            isDemoCompany={isDemoCompany}
            onCancelChangeFiel={hasCredentials ? () => setShowChangeFiel(false) : undefined}
          />
        )}

        {/* Tarjeta Ejecutiva de Descarga del SAT */}
        <SatSoapDownloadCard
          tipoSolicitud={tipoSolicitud}
          setTipoSolicitud={setTipoSolicitud}
          fechaInicial={fechaInicial}
          setFechaInicial={setFechaInicial}
          fechaFinal={fechaFinal}
          setFechaFinal={setFechaFinal}
          modoEjecucion={modoEjecucion}
          setModoEjecucion={setModoEjecucion}
          soapDownloadMutation={soapDownloadMutation}
          hasCredentials={hasCredentials}
          satRequests={satRequests}
          isDemoCompany={isDemoCompany}
          currentYear={currentYear}
          currentPeriod={currentPeriod}
          pendingCfdisCount={pendingCfdisCount}
          onBatchAutoPoliza={onBatchAutoPoliza}
          isBatchAutoPolizaPending={isBatchAutoPolizaPending}
          onVerifyPending={handleVerifyPending}
          isVerifyingPending={verifyPendingMutation.isPending}
        />
      </div>
    </div>
  );
}
