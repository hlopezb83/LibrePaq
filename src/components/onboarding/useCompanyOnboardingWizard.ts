import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { REGIMENES_FISCALES_SAT } from '../../shared/sat-catalog';
import { validateRfcModulo11 } from '../../shared/accounting-engine';
import {
  extractCompanyCandidatesFromCfdiXml,
  type CfdiCompanyCandidate
} from '../../shared/cfdi-company-extractor';
import {
  parseUploadedCompanyFile,
  extractCompanyFromCsfText,
  convertCsfToCandidate
} from '../../shared/sat-csf-extractor';
import { trackFirstCompanyCreatedConversion } from '../../lib/analytics';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import type { Company } from '../../shared/types';

export interface UseCompanyOnboardingWizardProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  onCompanyCreated: (companyId: string, company?: Company) => void;
}

export function useCompanyOnboardingWizard({
  dialogRef,
  onCompanyCreated
}: UseCompanyOnboardingWizardProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const userScope = user?.id ?? 'demo';

  const defaultYear = new Date().getFullYear();
  const defaultPeriod = new Date().getMonth() + 1;

  const [step, setStep] = useState<number>(1);
  const [personType, setPersonType] = useState<'MORAL' | 'FISICA'>('MORAL');
  const [name, setName] = useState('');
  const [rfc, setRfc] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [regimenFiscal, setRegimenFiscal] = useState<string>(
    REGIMENES_FISCALES_SAT[0] ?? '601 - General de Ley Personas Morales'
  );
  const [currentYear, setCurrentYear] = useState(defaultYear);
  const [currentPeriod, setCurrentPeriod] = useState(defaultPeriod);

  // Step 2: Catálogo Preset
  const [catalogPreset, setCatalogPreset] = useState<'SAT_STANDARD' | 'RESICO_SIMPLIFIED' | 'CUSTOM'>(
    'SAT_STANDARD'
  );

  // Step 3: Tesorería y Bancos (Apagado por defecto para no crear saldos falsos no solicitados)
  const [initialBankName, setInitialBankName] = useState('BBVA México');
  const [initialBankAccount, setInitialBankAccount] = useState('');
  const [initialBankBalance, setInitialBankBalance] = useState<number>(0);
  const [createOpeningEntry, setCreateOpeningEntry] = useState(false);

  // Step 4: e.firma (Omitir por defecto para no frenar el alta inicial)
  const [skipFiel, setSkipFiel] = useState(true);
  const [fielCerBase64, setFielCerBase64] = useState<string | null>(null);
  const [fielCerName, setFielCerName] = useState<string | null>(null);
  const [fielKeyBase64, setFielKeyBase64] = useState<string | null>(null);
  const [fielKeyName, setFielKeyName] = useState<string | null>(null);
  const [fielPassword, setFielPassword] = useState('');

  // Autocompletado desde XML CFDI
  const [xmlCandidates, setXmlCandidates] = useState<CfdiCompanyCandidate[]>([]);
  const [activeXmlRole, setActiveXmlRole] = useState<'EMISOR' | 'RECEPTOR' | null>(null);
  const [creationFlow, setCreationFlow] = useState<'express' | 'wizard' | 'xml_autofill'>('wizard');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showModulo11Breakdown, setShowModulo11Breakdown] = useState(false);
  const [bypassRfcCheckDigit, setBypassRfcCheckDigit] = useState(false);

  const resetForm = () => {
    setStep(1);
    setPersonType('MORAL');
    setName('');
    setRfc('');
    setCodigoPostal('');
    setRegimenFiscal(REGIMENES_FISCALES_SAT[0] ?? '601 - General de Ley Personas Morales');
    setCurrentYear(defaultYear);
    setCurrentPeriod(defaultPeriod);
    setCatalogPreset('SAT_STANDARD');
    setInitialBankName('BBVA México');
    setInitialBankAccount('');
    setInitialBankBalance(0);
    setCreateOpeningEntry(false);
    setSkipFiel(true);
    setFielCerBase64(null); setFielCerName(null);
    setFielKeyBase64(null); setFielKeyName(null);
    setFielPassword('');
    setXmlCandidates([]); setActiveXmlRole(null);
    setCreationFlow('wizard'); setErrorMessage(null);
    setShowModulo11Breakdown(false); setBypassRfcCheckDigit(false);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => resetForm();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [dialogRef]);

  const isRfcValid =
    personType === 'MORAL'
      ? /^[A-Z&Ñ]{3}[0-9]{6}[A-Z0-9]{3}$/.test(rfc)
      : /^[A-Z&Ñ]{4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc);

  const rfcModulo11 = useMemo(() => (rfc ? validateRfcModulo11(rfc) : null), [rfc]);

  const canProceedStep1 =
    name.trim().length >= 3 &&
    isRfcValid &&
    codigoPostal.trim().length === 5 &&
    Boolean(regimenFiscal);

  const applyXmlCandidate = (cand: CfdiCompanyCandidate) => {
    setActiveXmlRole(cand.role);
    setPersonType(cand.personType);
    setName(cand.name);
    setRfc(cand.rfc);
    setRegimenFiscal(cand.regimenFiscal);
    if (cand.codigoPostal.length === 5) {
      setCodigoPostal(cand.codigoPostal);
    }
    if (cand.regimenFiscal.startsWith('626')) {
      setCatalogPreset('RESICO_SIMPLIFIED');
    }
    setCreationFlow('xml_autofill');
    setBypassRfcCheckDigit(false);
    setErrorMessage(null);
  };

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
      toast.warning('El análisis con IA no estuvo disponible. Puedes capturar los datos manualmente.');
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

  const readFileAsBase64 = (file: File, onLoaded: (b64: string | null) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onLoaded((result.includes(',') ? result.split(',')[1] : result) || null);
    };
    reader.readAsDataURL(file);
  };

  const handleCerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFielCerName(f.name);
      readFileAsBase64(f, setFielCerBase64);
    }
  };

  const handleKeyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFielKeyName(f.name);
      readFileAsBase64(f, setFielKeyBase64);
    }
  };

  const createCompanyMutation = useMutation({
    mutationFn: async (flowOverride?: 'express' | 'wizard' | 'xml_autofill') => {
      const resolvedFlow = flowOverride || creationFlow;
      const preset = regimenFiscal.startsWith('626') && resolvedFlow !== 'wizard'
        ? 'RESICO_SIMPLIFIED'
        : catalogPreset;
      const created = await apiClient.createCompany({
        name: name.trim(), rfc: rfc.trim().toUpperCase(), regimenFiscal,
        codigoPostal: codigoPostal.trim(), currentYear, currentPeriod,
        catalogPreset: preset, initialBankName, initialBankAccount, initialBankBalance,
        createOpeningEntry,
        fielCerBase64: skipFiel ? undefined : (fielCerBase64 || undefined),
        fielKeyBase64: skipFiel ? undefined : (fielKeyBase64 || undefined),
        fielPassword: skipFiel ? undefined : (fielPassword || undefined)
      });
      return { created, resolvedFlow };
    },
    onSuccess: ({ created, resolvedFlow }) => {
      queryClient.setQueryData<Company[]>(['companies', userScope], (prev = []) => {
        const filtered = (prev || []).filter((c) => c.id !== created.id);
        return [...filtered, created];
      });
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
      invalidateAccountingQueries(queryClient);
      trackFirstCompanyCreatedConversion({ isDemo: false, creationFlow: resolvedFlow });

      dialogRef.current?.close();
      onCompanyCreated(created.id, created);
      toast.success(`¡Empresa "${created.name}" creada y activada con éxito!`);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message || 'Error al crear la empresa');
    }
  });

  const validateStep1Modulo11 = (): boolean => {
    if (!canProceedStep1) {
      setErrorMessage('Por favor completa Razón Social, RFC válido y Código Postal de 5 dígitos.');
      return false;
    }
    if (rfcModulo11 && !rfcModulo11.isValidCheckDigit && !bypassRfcCheckDigit) {
      setErrorMessage(
        `Advertencia SAT Módulo 11: El dígito verificador ('${rfcModulo11.actualCheckDigit}') no coincide con el cálculo SAT ('${rfcModulo11.expectedCheckDigit}'). Pulsa "Corregir a ${rfcModulo11.expectedCheckDigit}" o vuelve a pulsar para conservar este RFC.`
      );
      setBypassRfcCheckDigit(true);
      return false;
    }
    return true;
  };

  const quickCreateCompany = () => {
    setErrorMessage(null);
    if (!validateStep1Modulo11()) return;
    const flow = activeXmlRole ? 'xml_autofill' : 'express';
    createCompanyMutation.mutate(flow);
  };

  const nextStep = () => {
    setErrorMessage(null);
    if (step === 1 && !validateStep1Modulo11()) return;
    setStep((prev) => Math.min(5, prev + 1));
  };

  const prevStep = () => {
    setErrorMessage(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

  return {
    step,
    personType,
    setPersonType,
    name,
    setName,
    rfc,
    setRfc,
    codigoPostal,
    setCodigoPostal,
    regimenFiscal,
    setRegimenFiscal,
    currentYear,
    setCurrentYear,
    currentPeriod,
    setCurrentPeriod,
    catalogPreset,
    setCatalogPreset,
    initialBankName,
    setInitialBankName,
    initialBankAccount,
    setInitialBankAccount,
    initialBankBalance,
    setInitialBankBalance,
    createOpeningEntry,
    setCreateOpeningEntry,
    skipFiel,
    setSkipFiel,
    fielCerName,
    fielKeyName,
    fielPassword,
    setFielPassword,
    xmlCandidates,
    activeXmlRole,
    handleXmlAutofill,
    handleFileAutofill,
    applyXmlCandidate,
    errorMessage,
    setErrorMessage,
    showModulo11Breakdown,
    setShowModulo11Breakdown,
    setBypassRfcCheckDigit,
    isRfcValid,
    rfcModulo11,
    canProceedStep1,
    handleCerFileChange,
    handleKeyFileChange,
    createCompanyMutation,
    quickCreateCompany,
    nextStep,
    prevStep
  };
}
