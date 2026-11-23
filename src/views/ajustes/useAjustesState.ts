import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { validateRfcModulo11 } from '../../shared/accounting-engine';
import { useAjustesBackups } from './useAjustesBackups';
import { useAjustesEfirma } from './useAjustesEfirma';

export type AjustesTab = 'directorio' | 'empresa' | 'efirma' | 'fiscal' | 'respaldos' | 'atajos';

export function useAjustesState() {
  const {
    companies,
    activeCompany,
    activeCompanyId,
    setActiveCompanyId
  } = useCompany();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<AjustesTab>(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (
        tabParam === 'efirma' ||
        tabParam === 'empresa' ||
        tabParam === 'fiscal' ||
        tabParam === 'respaldos' ||
        tabParam === 'atajos'
      ) {
        return tabParam;
      }
    }
    return 'directorio';
  });

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

  const { data: fiscalWp, refetch: refetchFiscalWp } = useQuery({
    queryKey: ['fiscal-workpaper', activeCompanyId, currentYear, currentPeriod],
    queryFn: () =>
      activeCompanyId
        ? apiClient.getFiscalWorkpaper(activeCompanyId, currentYear, currentPeriod)
        : null,
    enabled: Boolean(activeCompanyId)
  });

  const [coefUtilidad, setCoefUtilidad] = useState<number>(0.1845);
  const [tcDof, setTcDof] = useState<number>(19.865);
  const [perdidasAnt, setPerdidasAnt] = useState<number>(45000);
  const [pagosAnt, setPagosAnt] = useState<number>(128500);
  const [saldoIvaAnt, setSaldoIvaAnt] = useState<number>(0);

  React.useEffect(() => {
    setCoefUtilidad(0.1845);
    setTcDof(19.865);
    setPerdidasAnt(0);
    setPagosAnt(0);
    setSaldoIvaAnt(0);
  }, [activeCompanyId]);

  React.useEffect(() => {
    if (fiscalWp?.parameters) {
      setCoefUtilidad(fiscalWp.parameters.coeficienteUtilidad);
      setTcDof(fiscalWp.parameters.tipoCambioDofCierre);
      setPerdidasAnt(fiscalWp.parameters.perdidasFiscalesPendientes);
      setPagosAnt(fiscalWp.parameters.pagosProvisionalesAnteriores);
      setSaldoIvaAnt(fiscalWp.parameters.saldoFavorIvaAnterior);
    }
  }, [fiscalWp]);

  const saveFiscalParamsMutation = useMutation({
    mutationFn: () =>
      apiClient.saveTaxParameters({
        companyId: activeCompanyId,
        ejercicio: currentYear,
        coeficienteUtilidad: Number(coefUtilidad),
        tipoCambioDofCierre: Number(tcDof),
        perdidasFiscalesPendientes: Number(perdidasAnt),
        pagosProvisionalesAnteriores: Number(pagosAnt),
        saldoFavorIvaAnterior: Number(saldoIvaAnt)
      }),
    onSuccess: () => {
      toast.success('Parámetros fiscales Día 17 actualizados');
      refetchFiscalWp();
    },
    onError: (err: Error) => {
      toast.error(`Error al guardar parámetros fiscales: ${err.message}`);
    }
  });

  // Tab 4: Respaldos delegados (solo activa las consultas cuando la pestaña está visible)
  const isFiscalDirty = Boolean(
    fiscalWp?.parameters &&
      (Number(coefUtilidad) !== fiscalWp.parameters.coeficienteUtilidad ||
        Number(tcDof) !== fiscalWp.parameters.tipoCambioDofCierre ||
        Number(perdidasAnt) !== fiscalWp.parameters.perdidasFiscalesPendientes ||
        Number(pagosAnt) !== fiscalWp.parameters.pagosProvisionalesAnteriores ||
        Number(saldoIvaAnt) !== fiscalWp.parameters.saldoFavorIvaAnterior)
  );

  const resetFiscalForm = () => {
    if (!fiscalWp?.parameters) return;
    setCoefUtilidad(fiscalWp.parameters.coeficienteUtilidad);
    setTcDof(fiscalWp.parameters.tipoCambioDofCierre);
    setPerdidasAnt(fiscalWp.parameters.perdidasFiscalesPendientes);
    setPagosAnt(fiscalWp.parameters.pagosProvisionalesAnteriores);
    setSaldoIvaAnt(fiscalWp.parameters.saldoFavorIvaAnterior);
  };

  const backups = useAjustesBackups(activeCompany, activeCompanyId, {
    isTabActive: activeTab === 'respaldos'
  });

  return {
    companies,
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
    coefUtilidad,
    setCoefUtilidad,
    tcDof,
    setTcDof,
    perdidasAnt,
    setPerdidasAnt,
    pagosAnt,
    setPagosAnt,
    saldoIvaAnt,
    setSaldoIvaAnt,
    isFiscalDirty,
    resetFiscalForm,
    saveFiscalParamsMutation,
    fiscalWp,
    ...backups,
    toast
  };
}
