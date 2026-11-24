import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../../../lib/api-client';
import { useToast } from '../../../context/ToastContext';
import { getTodayLocalIso } from '../../../shared/date-utils';
import { translateSatErrorCode } from './satErrorTranslator';
import { executeSatSoapDownloadWithSummary, fileToBase64 } from './satSoapHelpers';

export interface UseSatSoapFielManagerParams {
  companyId: string;
  companyRfc: string;
  defaultStartDate: string;
  defaultEndDate: string;
  isDemoCompany?: boolean;
  isReadOnlyClient?: boolean;
  onDownloadSuccess?: (message: string) => void;
}

/**
 * Encapsula la gestión de estado, consultas y mutaciones del panel de
 * e.firma y Descarga Masiva SAT (SOAP CFDI 4.0).
 */
export function useSatSoapFielManager({
  companyId,
  companyRfc,
  defaultStartDate,
  defaultEndDate,
  isDemoCompany,
  isReadOnlyClient = false,
  onDownloadSuccess
}: UseSatSoapFielManagerParams) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const cerInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const latestCompanyIdRef = useRef(companyId);
  latestCompanyIdRef.current = companyId;

  const [cerFileName, setCerFileName] = useState('');
  const [keyFileName, setKeyFileName] = useState('');
  const [cerBase64, setCerBase64] = useState('');
  const [keyBase64, setKeyBase64] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showChangeFiel, setShowChangeFiel] = useState(false);
  const [tipoSolicitud, setTipoSolicitud] = useState<'RECIBIDOS' | 'EMITIDOS' | 'AMBOS'>('AMBOS');
  const [fechaInicial, setFechaInicial] = useState(defaultStartDate);
  const [fechaFinal, setFechaFinal] = useState(defaultEndDate);
  const [modoEjecucion, setModoEjecucion] = useState<'SAT_LIVE' | 'SANDBOX_CRYPTO'>('SAT_LIVE');

  const [panelFeedback, setPanelFeedback] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [generatedTestFiles, setGeneratedTestFiles] = useState<{
    cerBase64: string;
    keyBase64: string;
    passphrase: string;
  } | null>(null);

  useEffect(() => {
    const today = getTodayLocalIso();
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
      satRequests
        .filter((r) => r.estadoSolicitud === 'ACEPTADA' || r.estadoSolicitud === 'EN_PROCESO')
        .map((r) => r.id)
    );
    for (const prevId of prevPendingIdsRef.current) {
      if (!pendingSet.has(prevId)) {
        const done = satRequests.find((r) => r.id === prevId && r.estadoSolicitud === 'TERMINADA');
        if (done) {
          toast.success(
            '¡Descarga SAT Completada!',
            `${done.cfdisDescargados || 0} comprobantes integrados a tu Bóveda ADD.`
          );
        }
      }
    }
    prevPendingIdsRef.current = pendingSet;
  }, [satRequests, toast]);

  const verifyPendingMutation = useMutation({
    onMutate: () => ({ targetCompanyId: companyId }),
    mutationFn: async () => {
      if (isReadOnlyClient) throw new Error('Acceso de solo lectura: acción bloqueada.');
      const targetCompanyId = companyId;
      const res = await apiClient.verifyPendingSatRequests(targetCompanyId);
      return { res, targetCompanyId };
    },
    onSuccess: ({ res, targetCompanyId }) => {
      invalidateAccountingQueries(
        queryClient,
        ['cfdis', 'sat-requests', 'dashboard', 'fiscal-workpaper'],
        targetCompanyId
      );
      if (targetCompanyId !== latestCompanyIdRef.current) return;
      if (res.downloadedCount > 0) {
        const msg = `¡Sincronización completada! ${res.downloadedCount} comprobante(s) integrados con éxito a la Bóveda ADD.`;
        setPanelFeedback(msg);
        toast.success('Sincronización SAT Exitosa', msg);
      } else if (
        res.rejectedCount &&
        res.rejectedCount > 0 &&
        (!res.pendingCount || res.pendingCount === 0)
      ) {
        const translated = translateSatErrorCode('5', res.message);
        const msg = res.message || `${translated.title}: ${translated.explanation}`;
        setPanelError(msg);
        toast.warning('Aviso del SAT', msg);
      } else if (res.pendingCount && res.pendingCount > 0) {
        setPanelFeedback(
          'Verificación con el SAT: El paquete sigue preparándose en los servidores del SAT.'
        );
        toast.info('SAT en Proceso', 'El paquete sigue preparándose en los servidores del SAT.');
      } else {
        const msg = res.message || 'Verificación completada: sin solicitudes pendientes.';
        setPanelFeedback(msg);
        toast.info('Verificación SAT', msg);
      }
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.targetCompanyId !== latestCompanyIdRef.current) return;
      const msg = `Error al verificar con el SAT: ${err.message}`;
      setPanelError(msg);
      toast.error('Error SAT', msg);
    }
  });

  const saveFielMutation = useMutation({
    onMutate: () => ({ targetCompanyId: companyId }),
    mutationFn: async () => {
      if (isReadOnlyClient) throw new Error('Acceso de solo lectura: acción bloqueada.');
      const targetCompanyId = companyId;
      const saved = await apiClient.saveFielCredentials({
        companyId: targetCompanyId,
        cerBase64,
        keyBase64,
        passphrase
      });
      return { saved, targetCompanyId };
    },
    onSuccess: ({ saved, targetCompanyId }) => {
      void queryClient.invalidateQueries({ queryKey: ['fiel-status', targetCompanyId] });
      if (targetCompanyId !== latestCompanyIdRef.current) return;
      setPanelError(null);
      setShowChangeFiel(false);
      setPanelFeedback(
        `e.firma de ${saved.nombreTitular || saved.rfcTitular} guardada y validada correctamente (Serie ${saved.numeroSerieCertificado}). Ya puedes descargar comprobantes.`
      );
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.targetCompanyId !== latestCompanyIdRef.current) return;
      setPanelFeedback(null);
      setPanelError(err.message);
    }
  });

  const generateTestFielMutation = useMutation({
    onMutate: () => ({ targetCompanyId: companyId }),
    mutationFn: async () => {
      if (isReadOnlyClient) throw new Error('Acceso de solo lectura: acción bloqueada.');
      const targetCompanyId = companyId;
      const res = await apiClient.generateTestFiel(targetCompanyId, passphrase || 'Contpaq2026');
      return { res, targetCompanyId };
    },
    onSuccess: ({ res, targetCompanyId }) => {
      void queryClient.invalidateQueries({ queryKey: ['fiel-status', targetCompanyId] });
      if (targetCompanyId !== latestCompanyIdRef.current) return;
      setPanelError(null);
      setShowChangeFiel(false);
      setGeneratedTestFiles(res.generatedFiles);
      setCerBase64(res.generatedFiles.cerBase64);
      setKeyBase64(res.generatedFiles.keyBase64);
      setPassphrase(res.generatedFiles.passphrase);
      setCerFileName(`${companyRfc}_efirma_sat.cer`);
      setKeyFileName(`${companyRfc}_efirma_sat.key`);
      setPanelFeedback(
        `Certificados Demo generados e instalados para ${res.status.rfcTitular}. Ya puedes realizar descargas.`
      );
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.targetCompanyId !== latestCompanyIdRef.current) return;
      setPanelFeedback(null);
      setPanelError(err.message);
    }
  });

  const soapDownloadMutation = useMutation({
    onMutate: () => ({ targetCompanyId: companyId }),
    mutationFn: async () => {
      if (isReadOnlyClient) throw new Error('Acceso de solo lectura: acción bloqueada.');
      const targetCompanyId = companyId;
      const outcome = await executeSatSoapDownloadWithSummary({
        companyId: targetCompanyId,
        tipoSolicitud,
        fechaInicial,
        fechaFinal,
        modoEjecucion,
        isDemoCompany
      });
      return { targetCompanyId, ...outcome };
    },
    onSuccess: (res) => {
      invalidateAccountingQueries(
        queryClient,
        ['cfdis', 'sat-requests', 'third-parties', 'dashboard', 'fiscal-workpaper'],
        res.targetCompanyId
      );
      if (res.targetCompanyId !== latestCompanyIdRef.current) return;
      if (res.partialError) {
        setPanelError(`Descarga parcial: ${res.partialError}`);
        toast.warning('Descarga SAT Parcial', res.partialError);
      } else {
        setPanelError(null);
      }
      const desc =
        res.tipoDescarga === 'AMBOS'
          ? 'gastos e ingresos'
          : res.tipoDescarga === 'EMITIDOS'
            ? 'emitidas (ingresos)'
            : 'recibidas (gastos)';
      const foliosLabel =
        res.tipoDescarga === 'AMBOS' && res.receivedRecord && res.emittedRecord
          ? `Folios SAT — Recibidas: ${res.receivedRecord.idSolicitudSat.slice(0, 8)} • Emitidas: ${res.emittedRecord.idSolicitudSat.slice(0, 8)}`
          : `Folio ${res.requestRecord.idSolicitudSat.slice(0, 8)}`;
      const msg = !isDemoCompany
        ? `${foliosLabel}. El SAT está empaquetando tus facturas.${res.requestRecord.mensajeSat ? ` (${res.requestRecord.mensajeSat})` : ''}`
        : res.totalCount === 0
          ? `Sincronización SAT al día: ${res.requestRecord.cfdisDescargados} comprobante(s) de ${desc} ya están en la Bóveda (${foliosLabel}).`
          : `Sincronización exitosa: ${res.totalCount} factura(s) ${desc} integradas a la Bóveda (${foliosLabel}).`;
      setPanelFeedback(msg);
      onDownloadSuccess?.(msg);
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.targetCompanyId !== latestCompanyIdRef.current) return;
      setPanelFeedback(null);
      setPanelError(err.message);
    }
  });

  const readFielFile = async (
    file: File | undefined,
    setName: (v: string) => void,
    setB64: (v: string) => void,
    fallbackMsg: string
  ) => {
    if (!file || isReadOnlyClient) return;
    try {
      setB64(await fileToBase64(file));
      setName(file.name);
      setPanelError(null);
    } catch (err: unknown) {
      setPanelError(err instanceof Error ? err.message : fallbackMsg);
    }
  };

  const handleCerSelect = (e: React.ChangeEvent<HTMLInputElement>) =>
    readFielFile(e.target.files?.[0], setCerFileName, setCerBase64, 'No se pudo leer el archivo .cer');

  const handleKeySelect = (e: React.ChangeEvent<HTMLInputElement>) =>
    readFielFile(e.target.files?.[0], setKeyFileName, setKeyBase64, 'No se pudo leer el archivo .key');

  const handleFilesDrop = async (files: File[]) => {
    if (isReadOnlyClient) return;
    try {
      for (const file of files) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.cer') || lower.endsWith('.crt')) {
          const b64 = await fileToBase64(file);
          setCerFileName(file.name);
          setCerBase64(b64);
        } else if (lower.endsWith('.key') || lower.endsWith('.der')) {
          const b64 = await fileToBase64(file);
          setKeyFileName(file.name);
          setKeyBase64(b64);
        }
      }
      setPanelError(null);
    } catch (err: unknown) {
      setPanelError(err instanceof Error ? err.message : 'Error al leer los archivos de e.firma');
    }
  };

  const handleVerifyPending = () => {
    if (isReadOnlyClient) return;
    toast.info(
      'Consultando al SAT...',
      'Verificando estatus de empaquetado de comprobantes oficiales...'
    );
    verifyPendingMutation.mutate();
  };

  return {
    cerInputRef, keyInputRef, cerFileName, keyFileName, cerBase64, keyBase64,
    passphrase, setPassphrase, showChangeFiel, setShowChangeFiel,
    tipoSolicitud, setTipoSolicitud, fechaInicial, setFechaInicial,
    fechaFinal, setFechaFinal, modoEjecucion, setModoEjecucion,
    panelFeedback, setPanelFeedback, panelError, setPanelError,
    generatedTestFiles, fielStatus, hasCredentials: Boolean(fielStatus?.hasCredentials),
    satRequests, verifyPendingMutation, saveFielMutation, generateTestFielMutation,
    soapDownloadMutation, handleCerSelect, handleKeySelect, handleFilesDrop, handleVerifyPending
  };
}
