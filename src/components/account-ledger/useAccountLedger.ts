import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import { downloadCsvFile } from '../../lib/formatters';
import { exportAccountLedgerXlsx } from '../../lib/excel-export';
import { MESES_SAT } from '../../shared/sat-catalog';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';

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
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  useDialogLightDismiss(dialogRef, onClose);

  const prevCompanyIdRef = useRef(companyId);
  useEffect(() => {
    if (prevCompanyIdRef.current !== companyId) {
      prevCompanyIdRef.current = companyId;
      if (accountId) onClose();
    }
  }, [companyId, accountId, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (accountId) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [accountId]);

  const { data, isLoading } = useQuery({
    queryKey: ['account-ledger', companyId, accountId, currentYear, currentPeriod],
    queryFn: () =>
      apiClient.getAccountLedger(companyId, accountId ?? '', currentYear, currentPeriod),
    enabled: Boolean(accountId)
  });

  const mesNombre = data
    ? MESES_SAT.find((m) => m.periodo === data.periodo)?.nombre || `P${data.periodo}`
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
        (e.cfdiUuid && e.cfdiUuid.toLowerCase().includes(q))
    );
  }, [data, ledgerSearch]);

  const handleGoToPoliza = (folio: number) => {
    onClose();
    void navigate({
      to: '/polizas',
      search: { search: String(folio) }
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
      'UUID CFDI',
      'Cargo (Debe)',
      'Abono (Haber)',
      'Saldo Progresivo'
    ];
    const rows: Array<Array<string | number>> = [
      [
        `${data.ejercicio}-${String(data.periodo).padStart(2, '0')}-01`,
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
    downloadCsvFile(
      `Auxiliar_${data.account.code}_${data.ejercicio}_P${String(data.periodo).padStart(2, '0')}.csv`,
      headers,
      rows
    );
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
    mesNombre,
    ledgerSearch,
    setLedgerSearch,
    filteredEntries,
    isExporting,
    handleGoToPoliza,
    handleExportCsv,
    handleExportXlsx
  };
}
