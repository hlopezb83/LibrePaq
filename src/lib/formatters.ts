import { sanitizeSpreadsheetText } from '../shared/date-utils';

const mxnFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatCurrency(amount: number | undefined | null): string {
  return mxnFormatter.format(Number(amount || 0));
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  if (!y || !m || !d) return dateStr;
  const meses = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic'
  ];
  const idx = Math.max(0, Math.min(11, parseInt(m, 10) - 1));
  return `${d} ${meses[idx]} ${y}`;
}

export {
  getFirstDateForPeriod,
  getLastDateForPeriod,
  getDefaultDateForPeriod
} from '../shared/date-utils';

export {
  splitCsvLine,
  parseBankStatementCsv,
  type ParsedBankStatementRow
} from '../shared/csv-bank-parser';

export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): void {
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'number' ? String(val) : sanitizeSpreadsheetText(String(val));
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(','))
  ];
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBlobFile(
  filename: string,
  content: BlobPart,
  mimeType = 'application/octet-stream'
): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
