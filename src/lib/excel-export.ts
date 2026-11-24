import writeXlsx, { type SheetData } from 'write-excel-file/browser';
import { sanitizeSpreadsheetText } from '../shared/date-utils';
import type { Company, FinancialStatementsResponse, FiscalWorkpaperResponse } from '../shared/types';
import type { ExtendedFinancialStatementsResponse } from '../shared/types/extended-statements.types';
import {
  buildBalanceGeneralSheetData,
  buildBalanzaSheetData,
  buildDia17SheetData,
  buildEstadoResultadosSheetData
} from './excel-deliverable-sheets';
import {
  buildCashFlowSheetData,
  buildComparativeSheetData,
  buildEquityChangesSheetData,
  exportExtendedStatementsXlsx
} from './excel-extended-sheets';

export { exportExtendedStatementsXlsx };

interface AccountLedgerEntry {
  fecha: string;
  tipoPoliza: string;
  folioPoliza: number;
  accountCode: string;
  accountName: string;
  referencia: string;
  concepto: string;
  cfdiUuid?: string | null;
  cargo: number;
  abono: number;
  runningBalance: number;
}

export interface AccountLedgerData {
  companyId?: string;
  ejercicio: number;
  periodo: number;
  initialBalance: number;
  account: { code: string; name: string };
  entries: AccountLedgerEntry[];
}

export interface WorkbookSheetSpec {
  sheet: string;
  data: SheetData;
  columns: Array<{ width: number }>;
}

const sCell = (val: string | null | undefined) => ({
  type: String,
  value: sanitizeSpreadsheetText(val ?? '')
});

export async function exportAccountLedgerXlsx(
  data: AccountLedgerData,
  mesNombre: string,
  companyRfc: string
): Promise<void> {
  const safeRfc = sanitizeSpreadsheetText(companyRfc);
  const safeAccName = sanitizeSpreadsheetText(data.account.name);
  const rows: SheetData = [
    [{ value: 'LIBREPAQ PRO ERP — TARJETA AUXILIAR DE MAYOR', fontWeight: 'bold' }],
    [{ value: `Empresa RFC: ${safeRfc} | Periodo: ${mesNombre} ${data.ejercicio}`, fontWeight: 'bold' }],
    [{ value: `Cuenta: ${data.account.code} - ${safeAccName}`, fontWeight: 'bold' }],
    [],
    [
      { value: 'Fecha', fontWeight: 'bold', align: 'center' },
      { value: 'Póliza', fontWeight: 'bold', align: 'center' },
      { value: 'Código Cuenta', fontWeight: 'bold' },
      { value: 'Nombre Cuenta', fontWeight: 'bold' },
      { value: 'Referencia', fontWeight: 'bold' },
      { value: 'Concepto', fontWeight: 'bold' },
      { value: 'UUID CFDI', fontWeight: 'bold' },
      { value: 'Cargo (Debe)', fontWeight: 'bold', align: 'right' },
      { value: 'Abono (Haber)', fontWeight: 'bold', align: 'right' },
      { value: 'Saldo Progresivo', fontWeight: 'bold', align: 'right' }
    ],
    [
      sCell(`${data.ejercicio}-${String(data.periodo).padStart(2, '0')}-01`),
      sCell('SALDO INICIAL'),
      sCell(data.account.code),
      sCell(data.account.name),
      sCell('APERTURA'),
      sCell(`Saldo Inicial al inicio de ${mesNombre} ${data.ejercicio}`),
      sCell(''),
      { type: Number, value: 0, format: '$#,##0.00' },
      { type: Number, value: 0, format: '$#,##0.00' },
      { type: Number, value: data.initialBalance, format: '$#,##0.00', fontWeight: 'bold' }
    ]
  ];

  let totalCargos = 0;
  let totalAbonos = 0;

  for (const e of data.entries) {
    totalCargos += e.cargo;
    totalAbonos += e.abono;
    rows.push([
      sCell(e.fecha),
      sCell(`${e.tipoPoliza} #${e.folioPoliza}`),
      sCell(e.accountCode),
      sCell(e.accountName),
      sCell(e.referencia),
      sCell(e.concepto),
      sCell(e.cfdiUuid || ''),
      { type: Number, value: e.cargo, format: '$#,##0.00' },
      { type: Number, value: e.abono, format: '$#,##0.00' },
      { type: Number, value: e.runningBalance, format: '$#,##0.00' }
    ]);
  }

  rows.push([
    { type: String, value: 'TOTALES DEL PERIODO', fontWeight: 'bold' },
    sCell(''), sCell(''), sCell(''), sCell(''), sCell(''), sCell(''),
    { type: Number, value: totalCargos, format: '$#,##0.00', fontWeight: 'bold' },
    { type: Number, value: totalAbonos, format: '$#,##0.00', fontWeight: 'bold' },
    {
      type: Number,
      value: data.entries.length > 0 ? (data.entries[data.entries.length - 1]?.runningBalance ?? 0) : data.initialBalance,
      format: '$#,##0.00',
      fontWeight: 'bold'
    }
  ]);

  const fileName = `Mayor_${data.account.code.replace(/[^a-zA-Z0-9-]/g, '_')}_${data.ejercicio}_P${String(data.periodo).padStart(2, '0')}.xlsx`;
  await writeXlsx([
    {
      sheet: 'Mayor',
      data: rows,
      columns: [
        { width: 14 }, { width: 16 }, { width: 16 }, { width: 28 }, { width: 16 },
        { width: 36 }, { width: 38 }, { width: 18 }, { width: 18 }, { width: 18 }
      ]
    }
  ]).toFile(fileName);
}

export interface ExportDeliverablesXlsxParams {
  reportsData: FinancialStatementsResponse | null | undefined;
  fiscalData: FiscalWorkpaperResponse | null | undefined;
  company: Company;
  year: number;
  period: number;
  formatVerticalPct: (amount: number, base: number) => string;
  extendedStatements?: ExtendedFinancialStatementsResponse | null;
  mesNombre?: string;
  hideZeroAccounts?: boolean;
  includeBalanza?: boolean;
  includeResultados?: boolean;
  includeBalance?: boolean;
  includeDia17?: boolean;
  includeNifAging?: boolean;
}

export function buildDeliverablesSheets(params: ExportDeliverablesXlsxParams): WorkbookSheetSpec[] {
  const {
    reportsData, fiscalData, company, year, period, formatVerticalPct,
    extendedStatements, mesNombre,
    hideZeroAccounts = false, includeBalanza = true, includeResultados = true,
    includeBalance = true, includeDia17 = true, includeNifAging = true
  } = params;
  if (!reportsData) return [];

  const mesLabel = mesNombre || `Periodo ${String(period).padStart(2, '0')}`;
  const sheets: WorkbookSheetSpec[] = [];

  if (includeBalanza) {
    sheets.push({
      sheet: 'Balanza',
      data: buildBalanzaSheetData(reportsData, company, year, period, mesLabel, hideZeroAccounts),
      columns: [
        { width: 16 }, { width: 38 }, { width: 14 }, { width: 12 }, { width: 8 },
        { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }
      ]
    });
  }
  if (includeResultados) {
    sheets.push({
      sheet: 'Estado de Resultados',
      data: buildEstadoResultadosSheetData(reportsData, company, year, period, mesLabel, formatVerticalPct, hideZeroAccounts),
      columns: [
        { width: 28 }, { width: 16 }, { width: 40 }, { width: 18 }, { width: 20 }, { width: 14 }
      ]
    });
  }
  if (includeBalance) {
    sheets.push({
      sheet: 'Balance General',
      data: buildBalanceGeneralSheetData(reportsData, company, year, period, mesLabel, hideZeroAccounts),
      columns: [
        { width: 28 }, { width: 16 }, { width: 40 }, { width: 20 }, { width: 20 }
      ]
    });
  }
  if (includeDia17) {
    sheets.push({
      sheet: 'Papel Dia 17',
      data: buildDia17SheetData(fiscalData, company, year, period, mesLabel),
      columns: [{ width: 42 }, { width: 30 }, { width: 22 }]
    });
  }
  if (extendedStatements && includeNifAging) {
    sheets.push(
      {
        sheet: 'Flujos NIF B-2',
        data: buildCashFlowSheetData(extendedStatements, mesLabel),
        columns: [{ width: 28 }, { width: 22 }, { width: 44 }, { width: 18 }]
      },
      {
        sheet: 'Cambios Capital NIF B-4',
        data: buildEquityChangesSheetData(extendedStatements, mesLabel),
        columns: [{ width: 48 }, { width: 20 }, { width: 20 }, { width: 24 }, { width: 26 }, { width: 24 }]
      },
      {
        sheet: 'Comparativo Anual',
        data: buildComparativeSheetData(extendedStatements, mesLabel),
        columns: [{ width: 16 }, { width: 38 }, { width: 12 }, { width: 14 }, { width: 18 }, { width: 24 }, { width: 18 }, { width: 14 }]
      }
    );
  }
  return sheets;
}

export async function exportDeliverablesXlsx(params: ExportDeliverablesXlsxParams): Promise<void> {
  const sheets = buildDeliverablesSheets(params);
  if (sheets.length === 0) return;
  const safeFileRfc = params.company.rfc.replace(/[^a-zA-Z0-9]/g, '');
  const fileName = `Dossier_Ejecutivo_${safeFileRfc}_${params.year}_P${String(params.period).padStart(2, '0')}.xlsx`;
  await writeXlsx(sheets).toFile(fileName);
}
