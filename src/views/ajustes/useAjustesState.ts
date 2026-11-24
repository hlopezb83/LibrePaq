import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { validateRfcModulo11 } from '../../shared/accounting-engine';
import { useAjustesBackups } from './useAjustesBackups';
import { useAjustesEfirma } from './useAjustesEfirma';
import { useAjustesFiscalParams } from './useAjustesFiscalParams';

export type AjustesTab = 'directorio' | 'empresa' | 'efirma' | 'fiscal' | 'respaldos' | 'atajos' | 'equipo';

const VALID_AJUSTES_TABS: readonly AjustesTab[] = [
  'directorio',
  'empresa',
  'efirma',
  'fiscal',
  'respaldos',
  'atajos',
  'equipo'
];

function resolveAjustesTab(raw: unknown): AjustesTab | null {
  if (typeof raw !== 'string') return null;
  const tab = raw.toLowerCase() as AjustesTab;
  return VALID_AJUSTES_TABS.includes(tab) ? tab : null;
}

export function useAjustesState() {
  const {
    companies,
    activeCompany,
    activeCompanyId,
    setActiveCompanyId,
    isLoading: companiesLoading,
    isReadOnlySupportMode,
    isReadOnlyClient,
    effectiveCompanyRole
  } = useCompany();
  const isReadOnly = isReadOnlySupportMode || isReadOnlyClient;
  const canEditFiscalConfig =
    !isReadOnly &&
    (effectiveCompanyRole === 'OWNER' ||
      effectiveCompanyRole === 'SOCIO' ||
      effectiveCompanyRole === 'CONTADOR');
  const canDeleteOrRestore =
    !isReadOnly && (effectiveCompanyRole === 'OWNER' || effectiveCompanyRole === 'SOCIO');
  const canWriteAccounts =
    !isReadOnly && effectiveCompanyRole !== 'CLIENTE_LECTURA' && effectiveCompanyRole !== null;
  const queryClient = useQueryClient();
  const toast = useToast();

  const urlTab = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)?.tab
  });

  const [activeTab, setActiveTab] = useState<AjustesTab>(() => {
    const fromRouter = resolveAjustesTab(urlTab);
    if (fromRouter) return fromRouter;
    if (typeof window !== 'undefined' && window.location.search) {
      const fromUrl = resolveAjustesTab(new URLSearchParams(window.location.search).get('tab'));
      if (fromUrl) return fromUrl;
    }
    return 'directorio';
  });

  React.useEffect(() => {
    const next = resolveAjustesTab(urlTab);
    if (next) setActiveTab(next);
  }, [urlTab]);

  // Tab 1: Empresa
  const [compName, setCompName] = useState(activeCompany?.name ?? '');
  const [compRfc, setCompRfc] = useState(activeCompany?.rfc ?? '');
  const [compRegimen, setCompRegimen] = useState(
    activeCompany?.regimenFiscal ?? '601 - General de Ley Personas Morales'
  );
  const [compCp, setCompCp] = useState(activeCompany?.codigoPostal ?? '64000');
  const [compMask, setCompMask] = useState(activeCompany?.maskFormat ?? 'XXX-XX-XXX');

  React.useEffect(() => {
    if (activeCompany) {
      setCompName(activeCompany.name);
      setCompRfc(activeCompany.rfc);
      setCompRegimen(activeCompany.regimenFiscal);
      setCompCp(activeCompany.codigoPostal);
      setCompMask(activeCompany.maskFormat || 'XXX-XX-XXX');
    }
  }, [activeCompany]);

  const rfcClean = compRfc.trim().toUpperCase();
  const isPersonaMoral = rfcClean.length === 12;
  const isPersonaFisica = rfcClean.length === 13;
  const isRfcValid =
    (isPersonaMoral && /^[A-Z&Ñ]{3}[0-9]{6}[A-Z0-9]{3}$/.test(rfcClean)) ||
    (isPersonaFisica && /^[A-Z&Ñ]{4}[0-9]{6}[A-Z0-9]{3}$/.test(rfcClean));
  const isCpValid = /^\d{5}$/.test(compCp.trim());

  const isCompanyDirty = Boolean(
    activeCompany &&
      (compName.trim() !== activeCompany.name ||
        rfcClean !== activeCompany.rfc ||
        compRegimen.trim() !== activeCompany.regimenFiscal ||
        compCp.trim() !== activeCompany.codigoPostal)
  );

  const resetCompanyForm = () => {
    if (!activeCompany) return;
    setCompName(activeCompany.name);
    setCompRfc(activeCompany.rfc);
    setCompRegimen(activeCompany.regimenFiscal);
    setCompCp(activeCompany.codigoPostal);
    setCompMask(activeCompany.maskFormat || 'XXX-XX-XXX');
  };

  const rfcModulo11 = React.useMemo(() => {
    if (!rfcClean) return null;
    return validateRfcModulo11(rfcClean);
  }, [rfcClean]);

  const updateCompanyMutation = useMutation({
    mutationFn: async () => {
      if (!canEditFiscalConfig) throw new Error('Solo un Contador o Socio puede modificar los datos fiscales.');
      if (!activeCompanyId) throw new Error('No hay empresa activa seleccionada');
      if (!isRfcValid) {
        throw new Error(
          'El RFC no cumple la estructura oficial del SAT (12 caracteres para Moral, 13 para Física).'
        );
      }
      if (!isCpValid) {
        throw new Error('El Código Postal Fiscal (CSF) debe contener exactamente 5 dígitos.');
      }
      return apiClient.updateCompany(activeCompanyId, {
        name: compName.trim(),
        rfc: rfcClean,
        regimenFiscal: compRegimen.trim(),
        codigoPostal: compCp.trim()
      });
    },
    onSuccess: (updated) => {
      toast.success(`Datos de ${updated.name} guardados correctamente`);
      invalidateAccountingQueries(queryClient, ['companies']);
    },
    onError: (err: Error) => {
      toast.error(`Error al actualizar empresa: ${err.message}`);
    }
  });

  const [confirmDeleteCompany, setConfirmDeleteCompany] = useState(false);

  const deleteCompanyMutation = useMutation({
    mutationFn: (companyId: string) => apiClient.deleteCompany(companyId),
    onSuccess: (_data, deletedCompanyId) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      invalidateAccountingQueries(queryClient);
      const remaining = companies.filter((c) => c.id !== deletedCompanyId);
      if (deletedCompanyId === activeCompanyId && remaining[0]) {
        setActiveCompanyId(remaining[0].id);
      }
      setConfirmDeleteCompany(false);
      toast.warning('Empresa eliminada del sistema');
    },
    onError: (err: Error) => {
      toast.error(`Error al eliminar empresa: ${err.message}`);
    }
  });

  // Candado Fiscal
  const { data: periodLock } = useQuery({
    queryKey: [
      'period-lock',
      activeCompanyId,
      activeCompany?.currentYear,
      activeCompany?.currentPeriod
    ],
    queryFn: () =>
      activeCompany
        ? apiClient.getPeriodLock(
            activeCompany.id,
            activeCompany.currentYear,
            activeCompany.currentPeriod
          )
        : null,
    enabled: Boolean(activeCompany)
  });

  const togglePeriodLockMutation = useMutation({
    mutationFn: async (isLocked: boolean) => {
      if (!canEditFiscalConfig) throw new Error('Solo un Contador o Socio puede modificar el candado fiscal.');
      if (!activeCompany) return;
      return apiClient.setPeriodLock({
        companyId: activeCompany.id,
        ejercicio: activeCompany.currentYear,
        periodo: activeCompany.currentPeriod,
        isLocked,
        notes: 'Modificado desde Ajustes y Configuración'
      });
    },
    onSuccess: (result) => {
      if (result) {
        toast.info(
          result.isLocked
            ? `Periodo P${String(result.periodo).padStart(2, '0')}/${result.ejercicio} BLOQUEADO contra cambios`
            : `Periodo P${String(result.periodo).padStart(2, '0')}/${result.ejercicio} ABIERTO para captura contable`
        );
        void queryClient.invalidateQueries({ queryKey: ['period-lock'] });
      }
    },
    onError: (err: Error) => {
      toast.error(`Error de candado: ${err.message}`);
    }
  });

  // Tab 2: e.firma
  const efirma = useAjustesEfirma(activeCompanyId);

  // Tab 3: Parámetros Fiscales
  const currentYear = activeCompany?.currentYear ?? 2026;
  const currentPeriod = activeCompany?.currentPeriod ?? 10;
  const fiscalParams = useAjustesFiscalParams(
    activeCompanyId,
    currentYear,
    currentPeriod,
    canEditFiscalConfig,
    toast
  );

  // Tab 4: Respaldos delegados (solo activa las consultas cuando la pestaña está visible)
  const backups = useAjustesBackups(activeCompany, activeCompanyId, {
    isTabActive: activeTab === 'respaldos'
  });

  return {
    companies,
    companiesLoading,
    isReadOnlySupportMode,
    isReadOnlyClient,
    effectiveCompanyRole,
    canEditFiscalConfig,
    canDeleteOrRestore,
    canWriteAccounts,
    activeCompany,
    activeCompanyId,
    setActiveCompanyId,
    activeTab,
    setActiveTab,
    compName,
    setCompName,
    compRfc,
    setCompRfc,
    compRegimen,
    setCompRegimen,
    compCp,
    setCompCp,
    compMask,
    isRfcValid,
    isCpValid,
    isCompanyDirty,
    resetCompanyForm,
    isPersonaMoral,
    rfcModulo11,
    updateCompanyMutation,
    confirmDeleteCompany,
    setConfirmDeleteCompany,
    deleteCompanyMutation,
    periodLock,
    togglePeriodLockMutation,
    ...efirma,
    currentYear,
    currentPeriod,
    ...fiscalParams,
    ...backups,
    toast
  };
}
