import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { getDefaultDateForPeriod, parseBankStatementCsv } from '../../lib/formatters';
import { useToast } from '../../context/ToastContext';
import type { AccountWithBalance } from '../../shared/types';

/**
 * Encapsula consultas, mutaciones y carga CSV del módulo de Conciliación Bancaria.
 */
export function useBancosTabState(params: {
  activeCompanyId: string;
  currentYear?: number;
  currentPeriod?: number;
  accounts: AccountWithBalance[];
  isPeriodLocked: boolean;
  enabled: boolean;
}) {
  const { activeCompanyId, currentYear, currentPeriod, accounts, isPeriodLocked, enabled } = params;
  const queryClient = useQueryClient();
  const toast = useToast();
  const addBankModalRef = useRef<HTMLDialogElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const defaultPeriodDate = getDefaultDateForPeriod(currentYear, currentPeriod);

  const [selectedBankId, setSelectedBankId] = useState<string>('');
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

  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.isAffectable && a.code.startsWith('102')),
    [accounts]
  );

  const effectiveBankId = selectedBankId || bankAccounts[0]?.id || `${activeCompanyId}_102-01-001`;

  const {
    data: reconData,
    isLoading: isLoadingRecon,
    isError: isErrorRecon,
    error: errorRecon,
    refetch: refetchRecon
  } = useQuery({
    queryKey: ['bank-reconciliation', activeCompanyId, effectiveBankId, currentYear, currentPeriod],
    queryFn: () =>
      apiClient.getBankReconciliation(
        activeCompanyId,
        effectiveBankId,
        currentYear,
        currentPeriod
      ),
    enabled: Boolean(activeCompanyId && effectiveBankId) && enabled
  });

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
      invalidateAccountingQueries(queryClient, [
        'bank-reconciliation',
        'polizas',
        'accounts',
        'account-ledger',
        'reports',
        'dashboard'
      ]);
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
    onSuccess: (_data, variables) => {
      invalidateAccountingQueries(queryClient, ['bank-reconciliation', 'dashboard']);
      addBankModalRef.current?.close();
      const count = variables.lines.length;
      toast.success(
        count > 1
          ? `Se importaron ${count} movimientos bancarios desde archivo CSV`
          : 'Movimiento registrado en estado de cuenta bancario'
      );
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsedLines = parseBankStatementCsv(text, defaultPeriodDate);

      if (parsedLines.length > 0) {
        await addBankLineMutation.mutateAsync({
          companyId: activeCompanyId,
          accountId: effectiveBankId,
          lines: parsedLines
        });
      } else {
        toast.error('No se detectaron movimientos válidos en el archivo CSV bancario');
      }
    } catch (err: unknown) {
      toast.error(`Error al importar CSV bancario: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      e.target.value = '';
    }
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
    addBankModalRef,
    csvInputRef,
    selectedBankId,
    setSelectedBankId,
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
    bankAccounts,
    effectiveBankId,
    reconData,
    isLoadingRecon,
    isErrorRecon,
    errorRecon,
    refetchRecon,
    autoMatchMutation,
    createPolizaFromBankMutation,
    unmatchBankLineMutation,
    addBankLineMutation,
    handleCsvUpload,
    reconFormula,
    handleAddBankLineSubmit
  };
}
