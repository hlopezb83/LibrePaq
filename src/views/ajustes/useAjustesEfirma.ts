import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';

export function useAjustesEfirma(activeCompanyId: string | null) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: fielStatus, refetch: refetchFiel } = useQuery({
    queryKey: ['fiel-status', activeCompanyId],
    queryFn: () => (activeCompanyId ? apiClient.getFielStatus(activeCompanyId) : null),
    enabled: Boolean(activeCompanyId)
  });

  const { data: soapRequests } = useQuery({
    queryKey: ['sat-requests', activeCompanyId],
    queryFn: () => (activeCompanyId ? apiClient.getSatDownloadRequests(activeCompanyId) : []),
    enabled: Boolean(activeCompanyId)
  });

  const [cerFile, setCerFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [fielPass, setFielPass] = useState('');
  const [showFielPass, setShowFielPass] = useState(false);
  const [isUploadingFiel, setIsUploadingFiel] = useState(false);

  useEffect(() => {
    setCerFile(null);
    setKeyFile(null);
    setFielPass('');
    setShowFielPass(false);
  }, [activeCompanyId]);

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = (reader.result as string) || '';
        const b64 = res.includes(',') ? res.split(',')[1] : res;
        resolve(b64 || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleUploadFiel = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) return;

    if (!fielPass || fielPass.trim().length === 0) {
      toast.error('Debes ingresar la contraseña de la e.firma.');
      return;
    }

    const hasStoredCredentials = Boolean(fielStatus?.hasCredentials);
    if (!hasStoredCredentials && (!cerFile || !keyFile)) {
      toast.error('Debes seleccionar el archivo .cer y el archivo .key.');
      return;
    }

    try {
      setIsUploadingFiel(true);
      let cerBase64: string | undefined;
      let keyBase64: string | undefined;

      if (cerFile && keyFile) {
        const [c64, k64] = await Promise.all([
          readFileAsBase64(cerFile),
          readFileAsBase64(keyFile)
        ]);
        cerBase64 = c64;
        keyBase64 = k64;
      }

      const res = await apiClient.saveFielCredentials({
        companyId: activeCompanyId,
        cerBase64,
        keyBase64,
        passphrase: fielPass.trim()
      });

      toast.success(
        `e.firma autorizada exitosamente: ${res.nombreTitular || res.rfcTitular} (Serie ${res.numeroSerieCertificado}). Conexión al SAT activa.`
      );
      setCerFile(null);
      setKeyFile(null);
      setFielPass('');
      void queryClient.invalidateQueries({ queryKey: ['fiel-status'] });
      void queryClient.invalidateQueries({ queryKey: ['sat-requests'] });
      void refetchFiel();
    } catch (err: unknown) {
      toast.error(`Error de e.firma: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploadingFiel(false);
    }
  };

  const handleGenerateTestFiel = async () => {
    if (!activeCompanyId) return;
    try {
      setIsUploadingFiel(true);
      const res = await apiClient.generateTestFiel(activeCompanyId, 'Contpaq2026');
      toast.success(
        `Certificado criptográfico de prueba generado: ${res.status.nombreTitular} (Serie ${res.status.numeroSerieCertificado})`
      );
      void queryClient.invalidateQueries({ queryKey: ['fiel-status'] });
      void refetchFiel();
    } catch (err: unknown) {
      toast.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploadingFiel(false);
    }
  };

  return {
    fielStatus,
    soapRequests,
    cerFile,
    setCerFile,
    keyFile,
    setKeyFile,
    fielPass,
    setFielPass,
    showFielPass,
    setShowFielPass,
    isUploadingFiel,
    handleUploadFiel,
    handleGenerateTestFiel
  };
}
