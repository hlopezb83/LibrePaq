import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { validateRfcModulo11 } from '../../shared/accounting-engine';
import { checkRfc69BStatus } from '../../shared/sat-69b';
import type { AccountWithBalance, Efos69BStatus, ThirdPartyRecord } from '../../shared/types';

interface UsePadronProveedoresParams {
  companyId: string;
  accounts: AccountWithBalance[];
  isReadOnlyClient?: boolean;
  onFeedback: (msg: string, type?: 'success' | 'error') => void;
}

export function extractThirdPartyDraft(tp: ThirdPartyRecord) {
  return {
    rfc: tp.rfc,
    nombre: tp.nombre,
    rol: tp.rol || ('PROVEEDOR' as const),
    tipoTerceroDiot: (tp.tipoTerceroDiot as '04' | '05' | '15') || '04',
    idFiscal: tp.idFiscal || '',
    pais: tp.pais || '',
    jurisdiccionFiscal: tp.jurisdiccionFiscal || '',
    cuentaContrapartidaCode: tp.cuentaContrapartidaCode || '201-01-001',
    cuentaOperacionCode: tp.cuentaOperacionCode || '601-01-002',
    tasaIvaDefault: (tp.tasaIvaDefault as 16 | 8 | 0) ?? 16,
    tipoOperacionDiot: (tp.tipoOperacionDiot as '03' | '06' | '85') || '03',
    estatus69B: tp.estatus69B || ('LIMPIO' as const)
  };
}

export function usePadronProveedores({
  companyId,
  accounts,
  isReadOnlyClient = false,
  onFeedback
}: UsePadronProveedoresParams) {
  const queryClient = useQueryClient();
  const affectableAccounts = accounts.filter((a) => a.isAffectable);

  const {
    data: thirdParties = [],
    isLoading: loadingTp,
    isError: isErrorTp,
    refetch: refetchTp
  } = useQuery({
    queryKey: ['third-parties', companyId],
    queryFn: () => apiClient.getThirdParties(companyId),
    enabled: Boolean(companyId)
  });

  const [tpRfc, setTpRfc] = useState('');
  const [tpNombre, setTpNombre] = useState('');
  const [tpRol, setTpRol] = useState<'PROVEEDOR' | 'CLIENTE' | 'AMBOS'>('PROVEEDOR');
  const [tpTipoTercero, setTpTipoTercero] = useState<'04' | '05' | '15'>('04');
  const [tpIdFiscal, setTpIdFiscal] = useState('');
  const [tpPais, setTpPais] = useState('');
  const [tpJurisdiccionFiscal, setTpJurisdiccionFiscal] = useState('');
  const [tpContrapartidaAcc, setTpContrapartidaAcc] = useState('201-01-001');
  const [tpOperacion, setTpOperacion] = useState<'03' | '06' | '85'>('03');
  const [tpExpenseAcc, setTpExpenseAcc] = useState('601-01-002');
  const [tpIvaRate, setTpIvaRate] = useState<16 | 8 | 0>(16);
  const [tpEfos, setTpEfos] = useState<Efos69BStatus>('LIMPIO');
  const [editingRfc, setEditingRfc] = useState<string | null>(null);
  const [is69BModalOpen, setIs69BModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isEditing = useMemo(
    () => Boolean(editingRfc) || (tpRfc.trim().length >= 12 && thirdParties.some((tp) => tp.rfc === tpRfc.trim())),
    [editingRfc, thirdParties, tpRfc]
  );

  const filteredThirdParties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return thirdParties;
    return thirdParties.filter(
      (tp) =>
        tp.rfc.toLowerCase().includes(q) ||
        tp.nombre.toLowerCase().includes(q) ||
        tp.cuentaOperacionCode.toLowerCase().includes(q)
    );
  }, [thirdParties, searchQuery]);

  const selectThirdPartyForEdit = useCallback((tp: ThirdPartyRecord) => {
    const draft = extractThirdPartyDraft(tp);
    setEditingRfc(draft.rfc);
    setTpRfc(draft.rfc);
    setTpNombre(draft.nombre);
    setTpRol(draft.rol);
    setTpTipoTercero(draft.tipoTerceroDiot);
    setTpIdFiscal(draft.idFiscal);
    setTpPais(draft.pais);
    setTpJurisdiccionFiscal(draft.jurisdiccionFiscal);
    setTpContrapartidaAcc(draft.cuentaContrapartidaCode);
    setTpExpenseAcc(draft.cuentaOperacionCode);
    setTpIvaRate(draft.tasaIvaDefault);
    setTpOperacion(draft.tipoOperacionDiot);
    setTpEfos(draft.estatus69B);
    document.getElementById('tp-nombre')?.focus();
  }, []);

  const resetForm = useCallback(() => {
    setEditingRfc(null);
    setTpRfc('');
    setTpNombre('');
    setTpRol('PROVEEDOR');
    setTpTipoTercero('04');
    setTpIdFiscal('');
    setTpPais('');
    setTpJurisdiccionFiscal('');
    setTpContrapartidaAcc('201-01-001');
    setTpExpenseAcc('601-01-002');
    setTpIvaRate(16);
    setTpOperacion('03');
    setTpEfos('LIMPIO');
  }, []);

  useEffect(() => {
    resetForm();
    setSearchQuery('');
    setIs69BModalOpen(false);
  }, [companyId, resetForm]);

  const tpRfcRes = useMemo(() => {
    if (!tpRfc.trim()) return null;
    return validateRfcModulo11(tpRfc);
  }, [tpRfc]);

  const handleRfcChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
    setTpRfc(clean);
    if (editingRfc && clean !== editingRfc) {
      setEditingRfc(null);
    }
    if (clean.length >= 12) {
      const check = checkRfc69BStatus(clean);
      setTpEfos(check.status);
    } else {
      setTpEfos('LIMPIO');
    }
  };

  const saveThirdPartyMutation = useMutation({
    mutationFn: () => {
      if (isReadOnlyClient) {
        throw new Error('Modo solo lectura: no es posible modificar el padrón de terceros.');
      }
      const paisNorm = tpPais.trim().toUpperCase();
      return apiClient.saveThirdParty({
        companyId,
        rfc: tpRfc,
        nombre: tpNombre,
        rol: tpRol,
        cuentaOperacionCode: tpExpenseAcc,
        cuentaContrapartidaCode: tpContrapartidaAcc,
        tipoTerceroDiot: tpTipoTercero,
        tipoOperacionDiot: tpOperacion,
        tasaIvaDefault: tpIvaRate,
        estatus69B: tpEfos,
        idFiscal: tpTipoTercero === '05' ? tpIdFiscal.trim() || null : null,
        pais: tpTipoTercero === '05' ? paisNorm || null : null,
        jurisdiccionFiscal:
          tpTipoTercero === '05' && paisNorm === 'ZZZ' ? tpJurisdiccionFiscal.trim() || null : null
      });
    },
    onSuccess: (saved) => {
      const targetCompanyId = saved.companyId || companyId;
      void queryClient.invalidateQueries({ queryKey: ['third-parties', targetCompanyId] });
      void queryClient.invalidateQueries({ queryKey: ['diot', targetCompanyId] });
      void queryClient.invalidateQueries({ queryKey: ['fiscal-workpaper', targetCompanyId] });
      resetForm();
      onFeedback(
        `RFC ${saved.rfc} guardado en el Padrón Fiscal con cuenta contable predeterminada ${saved.cuentaOperacionCode}.`
      );
    },
    onError: (err: Error) => {
      onFeedback(`Error al guardar tercero: ${err.message}`, 'error');
    }
  });

  const handle69BImportComplete = (count: number) => {
    if (isReadOnlyClient) return;
    void queryClient.invalidateQueries({ queryKey: ['third-parties', companyId] });
    void queryClient.invalidateQueries({ queryKey: ['diot', companyId] });
    void queryClient.invalidateQueries({ queryKey: ['fiscal-workpaper', companyId] });
    onFeedback(`¡Lista 69-B del SAT actualizada con éxito! (${count.toLocaleString()} RFCs procesados)`);
  };

  return {
    affectableAccounts,
    thirdParties,
    filteredThirdParties,
    searchQuery,
    setSearchQuery,
    selectThirdPartyForEdit,
    resetForm,
    isEditing,
    loadingTp,
    isErrorTp,
    refetchTp,
    tpRfc,
    setTpRfc: handleRfcChange,
    tpNombre,
    setTpNombre,
    tpRol,
    setTpRol,
    tpTipoTercero,
    setTpTipoTercero,
    tpIdFiscal,
    setTpIdFiscal,
    tpPais,
    setTpPais,
    tpJurisdiccionFiscal,
    setTpJurisdiccionFiscal,
    tpContrapartidaAcc,
    setTpContrapartidaAcc,
    tpOperacion,
    setTpOperacion,
    tpExpenseAcc,
    setTpExpenseAcc,
    tpIvaRate,
    setTpIvaRate,
    tpEfos,
    setTpEfos,
    is69BModalOpen,
    setIs69BModalOpen,
    tpRfcRes,
    handleRfcChange,
    handle69BImportComplete,
    saveThirdPartyMutation
  };
}
