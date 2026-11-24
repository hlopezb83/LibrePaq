import type React from 'react';
import {
  extractCompanyCandidatesFromCfdiXml,
  type CfdiCompanyCandidate
} from '../../shared/cfdi-company-extractor';
import {
  convertCsfToCandidate,
  extractCompanyFromCsfText,
  parseUploadedCompanyFile
} from '../../shared/sat-csf-extractor';

interface UseOnboardingAutofillParams {
  setXmlCandidates: (candidates: CfdiCompanyCandidate[]) => void;
  applyXmlCandidate: (candidate: CfdiCompanyCandidate) => void;
  setFielCerName: (name: string | null) => void;
  setFielCerBase64: (b64: string | null) => void;
  setFielKeyName: (name: string | null) => void;
  setFielKeyBase64: (b64: string | null) => void;
  toast: {
    info: (msg: string) => void;
    success: (msg: string) => void;
    warning: (msg: string) => void;
    error: (msg: string) => void;
  };
}

/**
 * Encapsula la extracción automática de datos fiscales desde archivos CFDI XML /
 * Constancia de Situación Fiscal (CSF) y la lectura Base64 de llaves e.firma (.cer/.key).
 */
export function useOnboardingAutofill({
  setXmlCandidates,
  applyXmlCandidate,
  setFielCerName,
  setFielCerBase64,
  setFielKeyName,
  setFielKeyBase64,
  toast
}: UseOnboardingAutofillParams) {
  const handleFileAutofill = async (file: File) => {
    if (file.name.toLowerCase().endsWith('.pdf') || file.type.startsWith('image/')) {
      toast.info('Analizando Constancia de Situación Fiscal (CSF)...');
    }
    try {
      const { primary, candidates, source } = await parseUploadedCompanyFile(file);
      if (!primary) {
        toast.warning(
          source === 'CSF'
            ? 'No se pudieron extraer datos automáticamente. Puedes capturar los datos manualmente.'
            : 'No se encontró un RFC válido en el archivo XML seleccionado.'
        );
        return;
      }
      setXmlCandidates(candidates);
      applyXmlCandidate(primary);
      toast.success(
        source === 'CSF'
          ? `Constancia SAT (CSF) cargada: ${primary.rfc}`
          : `Datos fiscales cargados desde CFDI (${primary.rfc})`
      );
    } catch {
      toast.warning(
        'No fue posible leer automáticamente el documento. Puedes capturar los datos manualmente.'
      );
    }
  };

  const handleXmlAutofill = (xmlOrText: string) => {
    if (xmlOrText.includes('<Comprobante') || xmlOrText.includes('<cfdi:Comprobante')) {
      const { primary, candidates } = extractCompanyCandidatesFromCfdiXml(xmlOrText);
      if (!primary) {
        toast.warning('No se encontró un RFC válido en el archivo XML seleccionado.');
        return;
      }
      setXmlCandidates(candidates);
      applyXmlCandidate(primary);
      toast.success(`Datos fiscales cargados desde CFDI (${primary.rfc})`);
      return;
    }

    const csf = extractCompanyFromCsfText(xmlOrText);
    if (csf && csf.rfc) {
      const candidate = convertCsfToCandidate(csf);
      setXmlCandidates([candidate]);
      applyXmlCandidate(candidate);
      toast.success(`Datos fiscales cargados desde Constancia SAT (${csf.rfc})`);
      return;
    }

    toast.warning('No se encontró un RFC válido en el documento o texto proporcionado.');
  };

  const readFileAsBase64 = (
    file: File,
    onLoaded: (b64: string | null) => void,
    onError: () => void
  ) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = (result.includes(',') ? result.split(',')[1] : result) || null;
      if (!base64) {
        onError();
        return;
      }
      onLoaded(base64);
    };
    reader.onerror = () => {
      onError();
    };
    reader.readAsDataURL(file);
  };

  const processCerFile = (f: File) => {
    setFielCerName(f.name);
    readFileAsBase64(f, setFielCerBase64, () => {
      setFielCerName(null);
      setFielCerBase64(null);
      toast.error(`No se pudo leer el certificado .cer (${f.name}). Verifica el archivo e inténtalo de nuevo.`);
    });
  };

  const processKeyFile = (f: File) => {
    setFielKeyName(f.name);
    readFileAsBase64(f, setFielKeyBase64, () => {
      setFielKeyName(null);
      setFielKeyBase64(null);
      toast.error(`No se pudo leer la llave privada .key (${f.name}). Verifica el archivo e inténtalo de nuevo.`);
    });
  };

  const handleCerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processCerFile(f);
  };

  const handleKeyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processKeyFile(f);
  };

  const handleFielDrop = (files: FileList) => {
    let invalidCount = 0;
    Array.from(files).forEach((f) => {
      const lower = f.name.toLowerCase();
      if (lower.endsWith('.cer')) processCerFile(f);
      else if (lower.endsWith('.key')) processKeyFile(f);
      else invalidCount += 1;
    });
    if (invalidCount > 0) {
      toast.warning('Solo se aceptan archivos .cer y .key de tu e.firma SAT.');
    }
  };

  return {
    handleFileAutofill,
    handleXmlAutofill,
    handleCerFileChange,
    handleKeyFileChange,
    handleFielDrop
  };
}
