import { downloadCsvFile } from '../../lib/formatters';
import type { Poliza } from '../../shared/types';

export function exportPolizasCsv(
  polizas: Poliza[],
  rfcOrId: string,
  year?: number,
  period?: number
) {
  if (polizas.length === 0) return;
  const headers = [
    'Folio',
    'Fecha',
    'Concepto Póliza',
    'UUID CFDI',
    'Cuenta Código',
    'Cuenta Nombre',
    'Referencia Mov',
    'Concepto Mov',
    'Cargo',
    'Abono'
  ];
  const rows: Array<Array<string | number>> = [];
  for (const pol of polizas) {
    for (const mov of pol.movements) {
      rows.push([
        `${pol.tipo} #${pol.folio}`,
        pol.fecha,
        pol.concepto,
        pol.cfdiUuid || '',
        mov.accountCode,
        mov.accountName,
        mov.referencia,
        mov.concepto,
        mov.cargo,
        mov.abono
      ]);
    }
  }
  const periodStr = period ? `_P${String(period).padStart(2, '0')}` : '';
  downloadCsvFile(
    `Polizas_${rfcOrId}_${year || 2026}${periodStr}.csv`,
    headers,
    rows
  );
}
