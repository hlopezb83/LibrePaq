import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import { downloadCsvFile } from '../../lib/formatters';

/**
 * Encapsula la consulta y exportación de la cédula DIOT (TXT Batch SAT y CSV).
 */
export function useDiotTabState(params: {
  activeCompanyId: string;
  currentYear?: number;
  currentPeriod?: number;
  enabled: boolean;
}) {
  const { activeCompanyId, currentYear, currentPeriod, enabled } = params;
  const [copiedBatch, setCopiedBatch] = useState(false);
  const toast = useToast();

  const { data: diotData, isLoading: isLoadingDiot, isError: isErrorDiot, refetch: refetchDiot } =
    useQuery({
      queryKey: ['diot', activeCompanyId, currentYear, currentPeriod],
      queryFn: () => apiClient.getDiotReport(activeCompanyId, currentYear, currentPeriod),
      enabled: Boolean(activeCompanyId) && enabled
    });

  const handleDownloadDiotTxt = () => {
    if (!diotData || diotData.rows.length === 0) return;
    const blob = new Blob([diotData.batchTxtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = diotData.filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Archivo ${diotData.filename} descargado para carga batch SAT.`);
  };

  const handleExportDiotCsv = () => {
    if (!diotData || diotData.rows.length === 0) return;
    const headers = [
      'Tipo Tercero',
      'Tipo Operación',
      'RFC Proveedor',
      'Nombre / Razón Social',
      'Actos Pagados 16%',
      'Actos Pagados 8%',
      'Actos Pagados 0%',
      'Actos Exentos',
      'IEPS Pagado',
      'IVA Acreditable Pagado',
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
      r.actosPagados8 ?? 0,
      r.actosPagados0 ?? 0,
      r.actosExentos ?? 0,
      r.iepsPagado ?? 0,
      r.ivaAcreditable16,
      r.ivaRetenido,
      r.isrRetenido,
      r.totalPagado,
      r.cfdiCount,
      r.batchLine
    ]);
    const csvFilename = `Cedula_DIOT_${diotData.company.rfc}_${diotData.ejercicio}_P${String(
      diotData.periodo
    ).padStart(2, '0')}.csv`;
    downloadCsvFile(csvFilename, headers, rows);
    toast.success(`Cédula DIOT exportada en Excel (.CSV): ${csvFilename}`);
  };

  return {
    copiedBatch,
    setCopiedBatch,
    diotData,
    isLoadingDiot,
    isErrorDiot,
    refetchDiot,
    handleDownloadDiotTxt,
    handleExportDiotCsv
  };
}
