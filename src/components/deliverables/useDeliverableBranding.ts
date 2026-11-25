import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  DEFAULT_DELIVERABLE_CONFIG,
  hasAnyDefaultSignature,
  loadDeliverableBranding,
  readLocalDeliverableBranding,
  saveDeliverableBranding,
  type DeliverableBrandingConfig
} from '../../lib/supabase/supabase-deliverables-branding';
import { MEXICO_TIMEZONE } from '../../shared/date-utils';
import type { Company } from '../../shared/types';

export { DEFAULT_DELIVERABLE_CONFIG, hasAnyDefaultSignature };

export function useDeliverableBranding(company: Company, isReadOnly: boolean) {
  const toast = useToast();
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  const initialBranding = useMemo(() => readLocalDeliverableBranding(company.id), [company.id]);
  const [cfg, setCfg] = useState<DeliverableBrandingConfig>(initialBranding);
  const [issuanceDate, setIssuanceDate] = useState(() =>
    new Date().toLocaleDateString('es-MX', {
      timeZone: MEXICO_TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  );

  const hasLoadedBrandingRef = useRef(false);
  const isUserDirtyRef = useRef(false);
  const lastPersistedJsonRef = useRef(JSON.stringify(initialBranding));

  const updateField = <K extends keyof DeliverableBrandingConfig>(key: K, val: DeliverableBrandingConfig[K]) => {
    isUserDirtyRef.current = true;
    setCfg((prev) => ({ ...prev, [key]: val }));
  };

  useEffect(() => {
    let active = true;
    hasLoadedBrandingRef.current = false;
    isUserDirtyRef.current = false;
    const local = readLocalDeliverableBranding(company.id);
    lastPersistedJsonRef.current = JSON.stringify(local);
    setCfg(local);

    void loadDeliverableBranding(company.id).then((loaded) => {
      if (!active) return;
      if (!isUserDirtyRef.current) {
        setCfg(loaded);
        lastPersistedJsonRef.current = JSON.stringify(loaded);
      }
      hasLoadedBrandingRef.current = true;
    });
    return () => {
      active = false;
    };
  }, [company.id]);

  useEffect(() => {
    if (isReadOnly || !hasLoadedBrandingRef.current || !isUserDirtyRef.current) return;
    const serialized = JSON.stringify(cfg);
    if (serialized === lastPersistedJsonRef.current) return;
    const timer = setTimeout(() => {
      void saveDeliverableBranding(company.id, cfg, {
        isReadOnly,
        organizationId: company.organizationId ?? null
      }).then(() => {
        lastPersistedJsonRef.current = serialized;
        isUserDirtyRef.current = false;
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [company.id, company.organizationId, cfg, isReadOnly]);

  const handleSaveBranding = async () => {
    if (isReadOnly) return;
    try {
      setIsSavingBranding(true);
      const { savedToCloud } = await saveDeliverableBranding(company.id, cfg, {
        isReadOnly,
        organizationId: company.organizationId ?? null
      });
      lastPersistedJsonRef.current = JSON.stringify(cfg);
      isUserDirtyRef.current = false;
      toast.success(savedToCloud ? 'Membrete y notas guardados en la Nube.' : 'Membrete guardado localmente.');
    } finally {
      setIsSavingBranding(false);
    }
  };

  const isUsingDefaultSignatures = hasAnyDefaultSignature({
    firmName: cfg.firmName,
    auditorName: cfg.auditorName,
    auditorCedula: cfg.auditorCedula,
    legalRepName: cfg.legalRepName
  });

  return {
    isSavingBranding,
    handleSaveBranding,
    isUsingDefaultSignatures,
    firmName: cfg.firmName,
    setFirmName: (v: string) => updateField('firmName', v),
    preparerName: cfg.preparerName,
    setPreparerName: (v: string) => updateField('preparerName', v),
    auditorName: cfg.auditorName,
    setAuditorName: (v: string) => updateField('auditorName', v),
    auditorCedula: cfg.auditorCedula,
    setAuditorCedula: (v: string) => updateField('auditorCedula', v),
    legalRepName: cfg.legalRepName,
    setLegalRepName: (v: string) => updateField('legalRepName', v),
    legalRepTitle: cfg.legalRepTitle,
    setLegalRepTitle: (v: string) => updateField('legalRepTitle', v),
    issuanceCity: cfg.issuanceCity,
    setIssuanceCity: (v: string) => updateField('issuanceCity', v),
    issuanceDate,
    setIssuanceDate,
    logoDataUrl: cfg.logoDataUrl,
    setLogoDataUrl: (v: string) => updateField('logoDataUrl', v),
    accountantNotes: cfg.accountantNotes,
    setAccountantNotes: (v: string) => updateField('accountantNotes', v)
  };
}
