import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import {
  downloadCsvFile,
  getDefaultDateForPeriod,
  parseBankStatementCsv
} from '../../lib/formatters';
import { useToast } from '../../context/ToastContext';
import type { FiscalBancosTabId } from './FiscalBancosTabBar';

export function useDiotBancosManager() {
  const { activeCompany, activeCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const addBankModalRef = useRef<HTMLDialogElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;
  const defaultPeriodDate = getDefaultDateForPeriod(currentYear, currentPeriod);
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<FiscalBancosTabId>('CONCILIACION');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [copiedBatch, setCopiedBatch] = useState(false);

  // Estado para agregar línea bancaria manual
  const [bFecha, setBFecha] = useState(() => defaultPeriodDate);
  const [bRef, setBRef] = useState('COM-BANC');
  const [bDesc, setBDesc] = useState('COMISION BANCARIA SPEI E IVA');
  const [bTipo, setBTipo] = useState<'CARGO' | 'ABONO'>('CARGO');
  const [bMonto, setBMonto] = useState(580);

  useEffect(() => {
    setSelectedBankId('');
    setBFecha(defaultPeriodDate);
    if (addBankModalRef.current?.open) {
      addBankModalRef.current.close();
    }
  }, [activeCompanyId, defaultPeriodDate]);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getAccounts(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId)
  });

  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.isAffectable && a.code.startsWith('102')),
    [accounts]
  );

  const effectiveBankId = selectedBankId || bankAccounts[0]?.id || `${activeCompanyId}_102-01-001`;

  const { data: reconData, isLoading: isLoadingRecon } = useQuery({
    queryKey: ['bank-reconciliation', activeCompanyId, effectiveBankId, currentYear, currentPeriod],
    queryFn: () =>
      apiClient.getBankReconciliation(
        activeCompanyId,
        effectiveBankId,
        currentYear,
        currentPeriod
      ),
    enabled: Boolean(activeCompanyId && effectiveBankId) && activeTab === 'CONCILIACION'
  });

  const { data: diotData, isLoading: isLoadingDiot, isError: isErrorDiot, refetch: refetchDiot } = useQuery({
    queryKey: ['diot', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getDiotReport(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId) && activeTab === 'DIOT'
  });

  // Candado Fiscal de Periodo
  const { data: periodLock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });
  const isPeriodLocked = Boolean(periodLock?.isLocked);

  const autoMatchMutation = useMutation({
    mutationFn: () =>
      apiClient.autoMatchBankReconciliation(
        activeCompanyId,
        effectiveBankId,
        currentYear,
        currentPeriod
      ),
    onSuccess: (res) => {
      invalidateAccountingQueries(queryClient, ['bank-reconciliation', 'dashboard']);
      if (res.matchedCount > 0) {
        toast.success(
          `¡Conciliación automática exitosa! Se cruzaron ${res.matchedCount} movimientos con la contabilidad`
        );
      } else {
        toast.info('Todos los movimientos coincidentes en importe ya se encuentran conciliados');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const createPolizaFromBankMutation = useMutation({
    mutationFn: (lineId: string) => {
      if (isPeriodLocked) {
        throw new Error('Periodo bloqueado ante el SAT. No se pueden generar pólizas desde banco.');
      }
      return apiClient.createPolizaFromBankLine(lineId, { desglosarIva: true });
    },
    onSuccess: () => {
      invalidateAccountingQueries(queryClient, ['bank-reconciliation', 'polizas', 'accounts', 'account-ledger', 'reports', 'dashboard']);
      toast.success(
        '¡Póliza contable generada desde estado de cuenta (desglose IVA 16%) y partida conciliada!'
      );
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const unmatchBankLineMutation = useMutation({
    mutationFn: (lineId: string) => {
      if (isPeriodLocked) {
        throw new Error('Periodo bloqueado ante el SAT. No es posible alterar la conciliación.');
      }
      return apiClient.unmatchBankLine(lineId);
    },
    onSuccess: () => {
      invalidateAccountingQueries(queryClient, ['bank-reconciliation', 'dashboard']);
      toast.info('Movimiento bancario desconciliado. Disponible para nueva correspondencia.');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const addBankLineMutation = useMutation({
    mutationFn: (payload: Parameters<typeof apiClient.addBankStatementLines>[0]) => {
      if (isPeriodLocked) {
        throw new Error('Periodo bloqueado ante el SAT. No se pueden agregar movimientos.');
      }
      return apiClient.addBankStatementLines(payload);
    },
    onSuccess: () => {
      invalidateAccountingQueries(queryClient, ['bank-reconciliation', 'dashboard']);
      addBankModalRef.current?.close();
      toast.success('Movimiento registrado en estado de cuenta bancario');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsedLines = parseBankStatementCsv(text, defaultPeriodDate);

    if (parsedLines.length > 0) {
      await addBankLineMutation.mutateAsync({
        companyId: activeCompanyId,
        accountId: effectiveBankId,
        lines: parsedLines
      });
      toast.success(`Se importaron ${parsedLines.length} movimientos bancarios desde archivo CSV`);
    } else {
      toast.error('No se detectaron movimientos válidos en el archivo CSV bancario');
    }
    e.target.value = '';
  };

  const handleDownloadDiotTxt = () => {
    if (!diotData) return;
    const blob = new Blob([diotData.batchTxtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = diotData.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDiotCsv = () => {
    if (!diotData) return;
    const headers = [
      'Tipo Tercero',
      'Tipo Operación',
      'RFC Proveedor',
      'Nombre / Razón Social',
      'Actos Pagados 16%',
      'IVA Acreditable Pagado 16%',
      'IVA Retenido',
      'ISR Retenido',
      'Total Pagado',
      'CFDIs',
      'Línea Batch SAT'
    ];
    const rows = diotData.rows.map((r) => [
      r.tipoTercero,
      r.tipoOperacion,
      r.rfc,
      r.nombre,
      r.actosPagados16,
      r.ivaAcreditable16,
      r.ivaRetenido,
      r.isrRetenido,
      r.totalPagado,
      r.cfdiCount,
      r.batchLine
    ]);
    downloadCsvFile(
      `Cedula_DIOT_${diotData.company.rfc}_${diotData.ejercicio}_P${String(
        diotData.periodo
      ).padStart(2, '0')}.csv`,
      headers,
      rows
    );
  };

  const reconFormula = useMemo(() => {
    if (!reconData) return null;
    const cargosBancoNoRegistrados = reconData.statementLines
      .filter((l) => !l.matchedMovementId)
      .reduce((s: number, l) => s + l.cargoBanco, 0);
    const depositosBancoNoRegistrados = reconData.statementLines
      .filter((l) => !l.matchedMovementId)
      .reduce((s: number, l) => s + l.abonoBanco, 0);
    const cargosContablesEnTransito = reconData.bookMovements
      .filter((b) => !b.isMatched)
      .reduce((s: number, b) => s + b.cargoContable, 0);
    const abonosContablesEnTransito = reconData.bookMovements
      .filter((b) => !b.isMatched)
      .reduce((s: number, b) => s + b.abonoContable, 0);

    const saldoConciliadoEstimado =
      reconData.summary.saldoFinalLibros +
      depositosBancoNoRegistrados -
      cargosBancoNoRegistrados;

    return {
      cargosBancoNoRegistrados,
      depositosBancoNoRegistrados,
      cargosContablesEnTransito,
      abonosContablesEnTransito,
      saldoConciliadoEstimado
    };
  }, [reconData]);

  const handleAddBankLineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addBankLineMutation.mutate({
      companyId: activeCompanyId,
      accountId: effectiveBankId,
      lines: [
        {
          fecha: bFecha,
          referencia: bRef,
          descripcion: bDesc,
          cargoBanco: bTipo === 'CARGO' ? bMonto : 0,
          abonoBanco: bTipo === 'ABONO' ? bMonto : 0
        }
      ]
    });
  };

  return {
    activeCompany,
    activeCompanyId,
    currentYear,
    currentPeriod,
    addBankModalRef,
    csvInputRef,
    toast,
    activeTab,
    setActiveTab,
    selectedBankId,
    setSelectedBankId,
    copiedBatch,
    setCopiedBatch,
    bFecha,
    setBFecha,
    bRef,
    setBRef,
    bDesc,
    setBDesc,
    bTipo,
    setBTipo,
    bMonto,
    setBMonto,
    accounts,
    bankAccounts,
    effectiveBankId,
    reconData,
    isLoadingRecon,
    diotData,
    isLoadingDiot,
    isErrorDiot,
    refetchDiot,
    isPeriodLocked,
    autoMatchMutation,
    createPolizaFromBankMutation,
    unmatchBankLineMutation,
    addBankLineMutation,
    handleCsvUpload,
    handleDownloadDiotTxt,
    handleExportDiotCsv,
    reconFormula,
    handleAddBankLineSubmit
  };
}
