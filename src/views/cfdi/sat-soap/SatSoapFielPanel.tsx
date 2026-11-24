import { AlertCircle, CheckCircle2, FileKey2, KeyRound, ShieldCheck } from 'lucide-react';
import { AlertBanner, Button, StatusBadge } from '../../../components/ui';
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
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
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
  isBatchAutoPolizaPending,
  isPeriodLocked = false,
  isReadOnlyClient = false
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
    isReadOnlyClient,
    onDownloadSuccess
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      {/* Encabezado e.firma + Conexión SAT en superficie blanca limpia */}
      <div className="px-5 py-4 bg-white border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <FileKey2 className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Descarga Masiva de Facturas SAT con e.firma (CFDI 4.0)
              </h3>
              <StatusBadge tone="emerald">Conexión Oficial SAT</StatusBadge>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {hasCredentials
                ? 'Sincroniza y descarga automáticamente todas las facturas del periodo directamente del SAT.'
                : 'Conecta los certificados de la empresa para descargar automáticamente todas las facturas del periodo directamente del SAT.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {hasCredentials ? (
            <>
              <StatusBadge
                tone="emerald"
                icon={<ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />}
              >
                <span>e.firma Activa: {fielStatus?.nombreTitular || fielStatus?.rfcTitular}</span>
                <span className="text-[10px] opacity-80 font-mono">
                  (Vigente hasta {fielStatus?.validTo?.slice(0, 10)})
                </span>
              </StatusBadge>
              {!showChangeFiel && !isReadOnlyClient && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowChangeFiel(true)}
                >
                  Cambiar e.firma
                </Button>
              )}
            </>
          ) : (
            <StatusBadge
              tone="amber"
              icon={<KeyRound className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Sin e.firma configurada
            </StatusBadge>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {panelFeedback && (
          <AlertBanner
            tone="success"
            icon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
            onDismiss={() => setPanelFeedback(null)}
            dismissLabel="Cerrar aviso"
          >
            {panelFeedback}
          </AlertBanner>
        )}

        {panelError && (
          <AlertBanner
            tone="danger"
            icon={<AlertCircle className="w-4 h-4" aria-hidden="true" />}
            onDismiss={() => setPanelError(null)}
            dismissLabel="Cerrar aviso"
          >
            {panelError}
          </AlertBanner>
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
            isReadOnlyClient={isReadOnlyClient}
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
          isPeriodLocked={isPeriodLocked}
          isReadOnlyClient={isReadOnlyClient}
          onVerifyPending={handleVerifyPending}
          isVerifyingPending={verifyPendingMutation.isPending}
        />
      </div>
    </div>
  );
}
