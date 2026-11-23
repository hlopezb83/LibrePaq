import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

  const { data: diotData, isLoading: isLoadingDiot, isError: isErrorDiot, refetch: refetchDiot } =
    useQuery({
      queryKey: ['diot', activeCompanyId, currentYear, currentPeriod],
      queryFn: () => apiClient.getDiotReport(activeCompanyId, currentYear, currentPeriod),
      enabled: Boolean(activeCompanyId) && enabled
    });

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
