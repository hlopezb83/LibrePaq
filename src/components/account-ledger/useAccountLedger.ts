import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import { downloadCsvFile } from '../../lib/formatters';
import { exportAccountLedgerXlsx } from '../../lib/excel-export';
import { MESES_SAT } from '../../shared/sat-constants';
import { fromCents, toCents } from '../../shared/engine/invariants-and-math';
import type { AccountLedgerEntry } from '../../shared/types';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';

export function buildLedgerPeriodSuffix(effectiveFrom: number, effectiveTo: number): string {
  const fromStr = String(effectiveFrom).padStart(2, '0');
  const toStr = String(effectiveTo).padStart(2, '0');
  return effectiveFrom !== effectiveTo ? `P${fromStr}-P${toStr}` : `P${fromStr}`;
}

export function useAccountLedger(
  companyId: string,
  accountId: string | null,
  onClose: () => void
) {
  const { activeCompany } = useCompany();
  const toast = useToast();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;
  const [periodFrom, setPeriodFromState] = useState<number>(currentPeriod ?? 1);
  const [periodTo, setPeriodToState] = useState<number>(currentPeriod ?? 1);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const requestDialogClose = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
      return;
    }
    onClose();
  };

  useDialogLightDismiss(dialogRef, onClose);

  useEffect(() => {
    setLedgerSearch('');
    if (currentPeriod) {
      setPeriodFromState(currentPeriod);
      setPeriodToState(currentPeriod);
    }
  }, [currentPeriod, accountId]);

  const prevCompanyIdRef = useRef(companyId);
  useEffect(() => {
    if (prevCompanyIdRef.current !== companyId) {
      prevCompanyIdRef.current = companyId;
      if (accountId) requestDialogClose();
    }
  }, [companyId, accountId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (accountId) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [accountId]);

  const setPeriodFrom = (nextFrom: number) => {
    setPeriodFromState(nextFrom);
    setPeriodToState((prevTo) => Math.max(prevTo, nextFrom));
  };

  const setPeriodTo = (nextTo: number) => {
    setPeriodToState(nextTo);
    setPeriodFromState((prevFrom) => Math.min(prevFrom, nextTo));
  };

  const applyRangePreset = (preset: 'CURRENT' | 'YTD' | 'FULL_YEAR') => {
    const active = currentPeriod ?? 1;
    if (preset === 'CURRENT') {
      setPeriodFromState(active);
      setPeriodToState(active);
    } else if (preset === 'YTD') {
      setPeriodFromState(1);
      setPeriodToState(active);
    } else {
      setPeriodFromState(1);
      setPeriodToState(13);
    }
  };

  const effectiveFrom = Math.min(periodFrom, periodTo);
  const effectiveTo = Math.max(periodFrom, periodTo);

  const { data: rawData, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['account-ledger', companyId, accountId, currentYear, effectiveFrom, effectiveTo],
    queryFn: () =>
      apiClient.getAccountLedger(
        companyId,
        accountId ?? '',
        currentYear,
        effectiveFrom,
        effectiveTo
      ),
    placeholderData: keepPreviousData,
    enabled: Boolean(accountId)
  });

  const data = useMemo(() => {
    if (!rawData) return undefined;
    const sorted = [...rawData.entries].sort((a, b) => {
      const perCmp = Number(a.periodo ?? 0) - Number(b.periodo ?? 0);
      if (perCmp !== 0) return perCmp;
      const dateCmp = String(a.fecha).localeCompare(String(b.fecha));
      if (dateCmp !== 0) return dateCmp;
      const folioCmp = Number(a.folioPoliza) - Number(b.folioPoliza);
      return folioCmp !== 0 ? folioCmp : String(a.movementId).localeCompare(String(b.movementId));
    });
    let runningCents = toCents(rawData.initialBalance);
    const isDeudora = rawData.account.nature === 'DEUDORA';
    const entries = sorted.map((e) => {
      const c = toCents(e.cargo);
      const a = toCents(e.abono);
      runningCents += isDeudora ? c - a : a - c;
      return { ...e, runningBalance: fromCents(runningCents) };
    });
    return { ...rawData, entries };
  }, [rawData]);

  const mesFromNombre =
    MESES_SAT.find((m) => m.periodo === effectiveFrom)?.corto || `P${effectiveFrom}`;
  const mesToNombre =
    MESES_SAT.find((m) => m.periodo === effectiveTo)?.corto || `P${effectiveTo}`;
  const mesNombre = data
    ? effectiveFrom !== effectiveTo
      ? `${mesFromNombre}–${mesToNombre}`
      : MESES_SAT.find((m) => m.periodo === data.periodo)?.nombre || `P${data.periodo}`
    : '';

  const filteredEntries = useMemo(() => {
    if (!data) return [];
    if (!ledgerSearch.trim()) return data.entries;
    const q = ledgerSearch.toLowerCase().trim();
    return data.entries.filter(
      (e) =>
        e.concepto.toLowerCase().includes(q) ||
        e.referencia.toLowerCase().includes(q) ||
        String(e.folioPoliza).includes(q) ||
        e.tipoPoliza.toLowerCase().includes(q) ||
        `${e.tipoPoliza} #${e.folioPoliza}`.toLowerCase().includes(q) ||
        (e.cfdiUuid && e.cfdiUuid.toLowerCase().includes(q))
    );
  }, [data, ledgerSearch]);

  const handleGoToPoliza = (entry: Pick<AccountLedgerEntry, 'tipoPoliza' | 'folioPoliza' | 'periodo'>) => {
    const queryStr = `${entry.tipoPoliza} #${entry.folioPoliza}`;
    if (entry.periodo && currentPeriod && entry.periodo !== currentPeriod) {
      toast.info(
        `Póliza pertenece a P${String(entry.periodo).padStart(2, '0')}`,
        `Cambia al periodo P${String(entry.periodo).padStart(2, '0')} en el selector superior si no aparece en la vista actual.`
      );
    }
    requestDialogClose();
    void navigate({
      to: '/polizas',
      search: { search: queryStr }
    });
  };

  const handleExportCsv = () => {
    if (!data) return;
    const headers = [
      'Fecha',
      'Póliza',
      'Código Cuenta',
      'Nombre Cuenta',
      'Referencia',
      'Concepto',
      'Folio Fiscal (UUID)',
      'Cargo (Debe)',
      'Abono (Haber)',
      'Saldo Progresivo'
    ];
    const rows: Array<Array<string | number>> = [
      [
        `${data.ejercicio}-${String(effectiveFrom).padStart(2, '0')}-01`,
        'SALDO INICIAL',
        data.account.code,
        data.account.name,
        'APERTURA',
        `Saldo Inicial Acumulado al inicio de ${mesNombre} ${data.ejercicio}`,
        '',
        0,
        0,
        data.initialBalance
      ],
      ...data.entries.map((e) => [
        e.fecha,
        `${e.tipoPoliza} #${e.folioPoliza}`,
        e.accountCode,
        e.accountName,
        e.referencia,
        e.concepto,
        e.cfdiUuid || '',
        e.cargo,
        e.abono,
        e.runningBalance
      ])
    ];
    const rangeSuffix = buildLedgerPeriodSuffix(effectiveFrom, effectiveTo);
    downloadCsvFile(
      `Auxiliar_${data.account.code}_${data.ejercicio}_${rangeSuffix}.csv`,
      headers,
      rows
    );
    toast.success('Auxiliar exportado en CSV', `Archivo Auxiliar_${data.account.code}_${data.ejercicio}_${rangeSuffix}.csv descargado.`);
  };

  const handleExportXlsx = async () => {
    if (!data || isExporting) return;
    try {
      setIsExporting(true);
      await exportAccountLedgerXlsx(data, mesNombre, activeCompany?.rfc || 'XAXX010101000');
    } catch (err) {
      console.warn('[AccountLedgerModal] Falló exportación XLSX, usando respaldo CSV:', err);
      toast.warning('No se pudo generar el archivo .XLSX; se exportó en formato .CSV.');
      handleExportCsv();
    } finally {
      setIsExporting(false);
    }
  };

  return {
    dialogRef,
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    currentPeriod: currentPeriod ?? 1,
    mesNombre,
    periodFrom,
    setPeriodFrom,
    periodTo,
    setPeriodTo,
    effectiveFrom,
    effectiveTo,
    applyRangePreset,
    ledgerSearch,
    setLedgerSearch,
    filteredEntries,
    isExporting,
    requestDialogClose,
    handleGoToPoliza,
    handleExportCsv,
    handleExportXlsx
  };
}
