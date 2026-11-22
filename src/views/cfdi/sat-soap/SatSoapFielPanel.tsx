import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, FileKey2, KeyRound, ShieldCheck } from 'lucide-react';
import { apiClient, invalidateAccountingQueries } from '../../../lib/api-client';
import { useToast } from '../../../context/ToastContext';
import { fileToBase64 } from './satSoapHelpers';
import { SatFielCredentialsCard } from './SatFielCredentialsCard';
import { SatSoapDownloadCard } from './SatSoapDownloadCard';

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
  companyId, companyRfc, defaultStartDate, defaultEndDate,
  onDownloadSuccess, isDemoCompany, currentYear, currentPeriod,
  pendingCfdisCount, onBatchAutoPoliza, isBatchAutoPolizaPending
}: SatSoapFielPanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const cerInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  const [cerFileName, setCerFileName] = useState(''); const [keyFileName, setKeyFileName] = useState('');
  const [cerBase64, setCerBase64] = useState(''); const [keyBase64, setKeyBase64] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showChangeFiel, setShowChangeFiel] = useState(false);
  const [tipoSolicitud, setTipoSolicitud] = useState<'RECIBIDOS' | 'EMITIDOS' | 'AMBOS'>('AMBOS');
  const [fechaInicial, setFechaInicial] = useState(defaultStartDate);
  const [fechaFinal, setFechaFinal] = useState(defaultEndDate);
  const [modoEjecucion, setModoEjecucion] = useState<'SAT_LIVE' | 'SANDBOX_CRYPTO'>('SAT_LIVE');

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setFechaInicial(defaultStartDate);
    setFechaFinal(defaultEndDate > today ? today : defaultEndDate);
  }, [defaultStartDate, defaultEndDate]);

  useEffect(() => {
    setCerFileName('');
    setKeyFileName('');
    setCerBase64('');
    setKeyBase64('');
    setPassphrase('');
    setShowChangeFiel(false);
    setPanelFeedback(null);
    setPanelError(null);
    setGeneratedTestFiles(null);
  }, [companyId]);

  const [panelFeedback, setPanelFeedback] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [generatedTestFiles, setGeneratedTestFiles] = useState<{
    cerBase64: string;
    keyBase64: string;
    passphrase: string;
  } | null>(null);

  const { data: fielStatus } = useQuery({
    queryKey: ['fiel-status', companyId],
    queryFn: () => apiClient.getFielStatus(companyId),
    enabled: Boolean(companyId)
  });

  const { data: satRequests = [] } = useQuery({
    queryKey: ['sat-requests', companyId],
    queryFn: () => apiClient.getSatDownloadRequests(companyId),
    enabled: Boolean(companyId),
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasPending = data?.some(
        (r) => r.estadoSolicitud === 'ACEPTADA' || r.estadoSolicitud === 'EN_PROCESO'
      );
      return hasPending ? 30000 : false;
    }
  });

  const prevPendingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pendingSet = new Set(
      satRequests.filter((r) => r.estadoSolicitud === 'ACEPTADA' || r.estadoSolicitud === 'EN_PROCESO').map((r) => r.id)
    );
    for (const prevId of prevPendingIdsRef.current) {
      if (!pendingSet.has(prevId)) {
        const done = satRequests.find((r) => r.id === prevId && r.estadoSolicitud === 'TERMINADA');
        if (done) {
          toast.success('¡Descarga SAT Completada!', `${done.cfdisDescargados || 0} comprobantes integrados a tu Bóveda ADD.`);
        }
      }
    }
    prevPendingIdsRef.current = pendingSet;
  }, [satRequests, toast]);

  const verifyPendingMutation = useMutation({
    mutationFn: () => apiClient.verifyPendingSatRequests(companyId),
    onSuccess: (res) => {
      invalidateAccountingQueries(queryClient, ['cfdis', 'sat-requests', 'dashboard', 'fiscal-workpaper']);
      if (res.downloadedCount > 0) {
        const msg = `¡Sincronización completada! ${res.downloadedCount} comprobante(s) integrados con éxito a la Bóveda ADD.`;
        setPanelFeedback(msg);
        toast.success('Sincronización SAT Exitosa', msg);
      } else if (res.rejectedCount && res.rejectedCount > 0 && (!res.pendingCount || res.pendingCount === 0)) {
        const msg = res.message || 'El SAT reportó solicitud rechazada (Código 5: posible duplicidad o periodo ya descargado).';
        setPanelError(msg);
        toast.warning('Aviso del SAT', msg);
      } else if (res.pendingCount && res.pendingCount > 0) {
        setPanelFeedback('Verificación con el SAT: El paquete sigue preparándose en los servidores del SAT.');
        toast.info('SAT en Proceso', 'El paquete sigue preparándose en los servidores del SAT.');
      } else {
        const msg = res.message || 'Verificación completada: sin solicitudes pendientes.';
        setPanelFeedback(msg);
        toast.info('Verificación SAT', msg);
      }
    },
    onError: (err: Error) => {
      const msg = `Error al verificar con el SAT: ${err.message}`;
      setPanelError(msg);
      toast.error('Error SAT', msg);
    }
  });

  const saveFielMutation = useMutation({
    mutationFn: () => apiClient.saveFielCredentials({ companyId, cerBase64, keyBase64, passphrase }),
    onSuccess: (saved) => {
      setPanelError(null);
      setShowChangeFiel(false);
      setPanelFeedback(`e.firma de ${saved.nombreTitular || saved.rfcTitular} guardada y validada correctamente (Serie ${saved.numeroSerieCertificado}). Ya puedes descargar comprobantes.`);
      void queryClient.invalidateQueries({ queryKey: ['fiel-status', companyId] });
    },
    onError: (err: Error) => {
      setPanelFeedback(null);
      setPanelError(err.message);
    }
  });

  const generateTestFielMutation = useMutation({
    mutationFn: () => apiClient.generateTestFiel(companyId, passphrase || 'Contpaq2026'),
    onSuccess: (res) => {
      setPanelError(null);
      setShowChangeFiel(false);
      setGeneratedTestFiles(res.generatedFiles);
      setCerBase64(res.generatedFiles.cerBase64);
      setKeyBase64(res.generatedFiles.keyBase64);
      setPassphrase(res.generatedFiles.passphrase);
      setCerFileName(`${companyRfc}_efirma_sat.cer`);
      setKeyFileName(`${companyRfc}_efirma_sat.key`);
      setPanelFeedback(`Certificados Demo generados e instalados para ${res.status.rfcTitular}. Ya puedes realizar descargas.`);
      void queryClient.invalidateQueries({ queryKey: ['fiel-status', companyId] });
    },
    onError: (err: Error) => {
      setPanelFeedback(null);
      setPanelError(err.message);
    }
  });

  const soapDownloadMutation = useMutation({
    mutationFn: async () => {
      const exec = (tipo: 'RECIBIDOS' | 'EMITIDOS') =>
        apiClient.executeSatSoapDownload({
          companyId,
          tipoSolicitud: tipo,
          fechaInicial,
          fechaFinal,
          modoEjecucion,
          isDemoCompany
        });
      if (tipoSolicitud === 'AMBOS') {
        const rRec = await exec('RECIBIDOS');
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const rEmit = await exec('EMITIDOS');
        return {
          requestRecord: rEmit.requestRecord,
          receivedRecord: rRec.requestRecord,
          totalCount: rRec.downloadedCfdis.length + rEmit.downloadedCfdis.length,
          tipoDescarga: 'AMBOS' as const
        };
      }
      const res = await exec(tipoSolicitud);
      return { requestRecord: res.requestRecord, totalCount: res.downloadedCfdis.length, tipoDescarga: tipoSolicitud };
    },
    onSuccess: (res) => {
      setPanelError(null);
      const desc = res.tipoDescarga === 'AMBOS' ? 'gastos e ingresos' : res.tipoDescarga === 'EMITIDOS' ? 'emitidas (ingresos)' : 'recibidas (gastos)';
      const msg = !isDemoCompany
        ? (res.requestRecord.mensajeSat || `Solicitud transmitida con Folio ${res.requestRecord.idSolicitudSat.slice(0, 8)}. El SAT está empaquetando tus facturas.`)
        : res.totalCount === 0
        ? `Sincronización SAT al día: ${res.requestRecord.cfdisDescargados} comprobante(s) de ${desc} ya están en la Bóveda.`
        : `Sincronización exitosa: ${res.totalCount} factura(s) ${desc} integradas a la Bóveda.`;
      setPanelFeedback(msg);
      invalidateAccountingQueries(queryClient, ['cfdis', 'sat-requests', 'third-parties', 'dashboard', 'fiscal-workpaper']);
      onDownloadSuccess?.(msg);
    },
    onError: (err: Error) => { setPanelFeedback(null); setPanelError(err.message); }
  });

  const handleCerSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setCerFileName(file.name); setCerBase64(await fileToBase64(file)); }
  };

  const handleKeySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setKeyFileName(file.name); setKeyBase64(await fileToBase64(file)); }
  };

  const handleFilesDrop = async (files: File[]) => {
    for (const file of files) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.cer') || lower.endsWith('.crt')) {
        setCerFileName(file.name);
        setCerBase64(await fileToBase64(file));
      } else if (lower.endsWith('.key') || lower.endsWith('.der')) {
        setKeyFileName(file.name);
        setKeyBase64(await fileToBase64(file));
      }
    }
  };

  const hasCredentials = Boolean(fielStatus?.hasCredentials);

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
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
              <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>e.firma Activa: {fielStatus?.nombreTitular || fielStatus?.rfcTitular}</span>
              <span className="text-[10px] opacity-80 font-mono">(Vigente hasta {fielStatus?.validTo?.slice(0, 10)})</span>
            </span>
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
          <div role="status" className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-950 font-medium">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              {panelFeedback}
            </span>
            <button type="button" onClick={() => setPanelFeedback(null)} className="text-emerald-700 hover:underline font-semibold cursor-pointer">
              Cerrar
            </button>
          </div>
        )}

        {panelError && (
          <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-red-900 font-medium">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
              {panelError}
            </span>
            <button type="button" onClick={() => setPanelError(null)} className="text-red-700 hover:underline font-semibold cursor-pointer">
              Cerrar
            </button>
          </div>
        )}

        {/* Si no hay credenciales o el usuario eligió cambiar su e.firma, mostramos el formulario de carga */}
        {(!hasCredentials || showChangeFiel) && (
          <SatFielCredentialsCard
            companyRfc={companyRfc} fielStatus={fielStatus}
            cerInputRef={cerInputRef} keyInputRef={keyInputRef}
            cerFileName={cerFileName} keyFileName={keyFileName}
            passphrase={passphrase} setPassphrase={setPassphrase}
            cerBase64={cerBase64} keyBase64={keyBase64}
            handleCerSelect={handleCerSelect} handleKeySelect={handleKeySelect}
            onFilesSelected={handleFilesDrop} generateTestFielMutation={generateTestFielMutation}
            saveFielMutation={saveFielMutation} generatedTestFiles={generatedTestFiles}
            isDemoCompany={isDemoCompany}
            onCancelChangeFiel={hasCredentials ? () => setShowChangeFiel(false) : undefined}
          />
        )}

        {/* Tarjeta Ejecutiva de Descarga del SAT */}
        <SatSoapDownloadCard
          tipoSolicitud={tipoSolicitud} setTipoSolicitud={setTipoSolicitud}
          fechaInicial={fechaInicial} setFechaInicial={setFechaInicial}
          fechaFinal={fechaFinal} setFechaFinal={setFechaFinal}
          modoEjecucion={modoEjecucion} setModoEjecucion={setModoEjecucion}
          soapDownloadMutation={soapDownloadMutation} hasCredentials={hasCredentials}
          satRequests={satRequests} isDemoCompany={isDemoCompany}
          currentYear={currentYear} currentPeriod={currentPeriod}
          pendingCfdisCount={pendingCfdisCount} onBatchAutoPoliza={onBatchAutoPoliza}
          isBatchAutoPolizaPending={isBatchAutoPolizaPending}
          onVerifyPending={() => {
            toast.info('Consultando al SAT...', 'Verificando estatus de empaquetado de comprobantes oficiales...');
            verifyPendingMutation.mutate();
          }}
          isVerifyingPending={verifyPendingMutation.isPending}
        />
      </div>
    </div>
  );
}
