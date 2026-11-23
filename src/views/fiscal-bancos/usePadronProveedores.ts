import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { validateRfcModulo11 } from '../../shared/accounting-engine';
import { checkRfc69BStatus } from '../../shared/sat-69b';
import type { AccountWithBalance, Efos69BStatus, ThirdPartyRecord } from '../../shared/types';

interface UsePadronProveedoresParams {
  companyId: string;
  accounts: AccountWithBalance[];
  onFeedback: (msg: string, type?: 'success' | 'error') => void;
}

export function usePadronProveedores({
  companyId,
  accounts,
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
  const [tpOperacion, setTpOperacion] = useState<'03' | '06' | '85'>('03');
  const [tpExpenseAcc, setTpExpenseAcc] = useState('601-01-002');
  const [tpIvaRate, setTpIvaRate] = useState<16 | 8 | 0>(16);
  const [tpEfos, setTpEfos] = useState<Efos69BStatus>('LIMPIO');
  const [is69BModalOpen, setIs69BModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const selectThirdPartyForEdit = (tp: ThirdPartyRecord) => {
    setTpRfc(tp.rfc);
    setTpNombre(tp.nombre);
    setTpExpenseAcc(tp.cuentaOperacionCode || '601-01-002');
    setTpIvaRate((tp.tasaIvaDefault as 16 | 8 | 0) ?? 16);
    setTpOperacion((tp.tipoOperacionDiot as '03' | '06' | '85') || '03');
    setTpEfos(tp.estatus69B || 'LIMPIO');
    document.getElementById('tp-nombre')?.focus();
  };

  const resetForm = () => {
    setTpRfc('');
    setTpNombre('');
    setTpExpenseAcc('601-01-002');
    setTpIvaRate(16);
    setTpOperacion('03');
    setTpEfos('LIMPIO');
  };

  const tpRfcRes = useMemo(() => {
    if (!tpRfc.trim()) return null;
    return validateRfcModulo11(tpRfc);
  }, [tpRfc]);

  const handleRfcChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
    setTpRfc(clean);
    if (clean.length >= 12) {
      const check = checkRfc69BStatus(clean);
      setTpEfos(check.status);
    } else {
      setTpEfos('LIMPIO');
    }
  };

  const saveThirdPartyMutation = useMutation({
    mutationFn: () =>
      apiClient.saveThirdParty({
        companyId,
        rfc: tpRfc,
        nombre: tpNombre,
        rol: 'PROVEEDOR',
        cuentaOperacionCode: tpExpenseAcc,
        cuentaContrapartidaCode: '201-01-001',
        tipoTerceroDiot: '04',
        tipoOperacionDiot: tpOperacion,
        tasaIvaDefault: tpIvaRate,
        estatus69B: tpEfos
      }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['third-parties', companyId] });
      setTpRfc('');
      setTpNombre('');
      setTpEfos('LIMPIO');
      onFeedback(
        `RFC ${saved.rfc} guardado en el Padrón Fiscal con cuenta contable predeterminada ${saved.cuentaOperacionCode}.`
      );
    },
    onError: (err: Error) => {
      onFeedback(`Error al guardar tercero: ${err.message}`, 'error');
    }
  });

  const handle69BImportComplete = (count: number) => {
    queryClient.invalidateQueries({ queryKey: ['third-parties', companyId] });
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
    loadingTp,
    isErrorTp,
    refetchTp,
    tpRfc,
    tpNombre,
    setTpNombre,
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
