import writeXlsx, { type SheetData } from 'write-excel-file/browser';
import { sanitizeSpreadsheetText } from '../../shared/date-utils';
import type { AccountWithBalance, Company } from '../../shared/types';
import { filterBalanzaAccounts, type BalanzaExportFilterOptions } from './reportesCsvExport';

const sCell = (val: string, bold = false) => ({
  type: String as typeof String,
  value: sanitizeSpreadsheetText(val),
  ...(bold ? { fontWeight: 'bold' as const } : {})
});

const nCell = (val: number, bold = false) => ({
  type: Number as typeof Number,
  value: Number.isFinite(val) ? val : 0,
  format: '#,##0.00',
  ...(bold ? { fontWeight: 'bold' as const } : {})
});

/** Exporta la Balanza de Comprobación filtrada (Nivel N2/Todos y Omitir $0.00) a Excel nativo .xlsx. */
export async function exportBalanzaXlsx(params: {
  company: Company;
  ejercicio: number;
  periodo: number;
  mesNombre: string;
  trialBalance: readonly AccountWithBalance[];
  options?: BalanzaExportFilterOptions;
}): Promise<number> {
  const { company, ejercicio, periodo, mesNombre, trialBalance, options } = params;
  const filtered = filterBalanzaAccounts(trialBalance, options);
  const periodCode = `P${String(periodo).padStart(2, '0')}`;
  const scopeLabel =
    options?.levelScope === 'N2' || options?.levelScope === 'SUBCUENTAS'
      ? 'Hasta Nivel 2 (N2)'
      : options?.levelScope === 'MAYOR'
        ? 'Solo Mayor (N1)'
        : options?.levelScope === 'AFECTABLES'
          ? 'Afectables (N3)'
          : 'Todas las cuentas';

  const rows: SheetData = [
    [sCell(`${company.name} (${company.rfc})`, true)],
    [
      sCell(
        `Balanza de Comprobación — ${mesNombre} ${ejercicio} (${periodCode}) · ${scopeLabel}${
          options?.omitZeroAccounts ? ' · Sin cuentas en $0.00' : ''
        }`,
        true
      )
    ],
    [],
    [
      sCell('Código', true),
      sCell('Cuenta', true),
      sCell('Agrupador SAT', true),
      sCell('Naturaleza', true),
      sCell('Nivel', true),
      sCell('Saldo Inicial', true),
      sCell('Cargos (Debe)', true),
      sCell('Abonos (Haber)', true),
      sCell('Saldo Final', true)
    ],
    ...filtered.map((r) => [
      sCell(r.code),
      sCell(r.name),
      sCell(r.satGroupCode),
      sCell(r.nature),
      { type: Number as typeof Number, value: r.level },
      nCell(r.initialBalanceComputed),
      nCell(r.periodCharges),
      nCell(r.periodCredits),
      nCell(r.finalBalance)
    ])
  ];

  await writeXlsx([
    {
      sheet: 'Balanza',
      data: rows,
      columns: [
        { width: 16 },
        { width: 38 },
        { width: 14 },
        { width: 12 },
        { width: 8 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 16 }
      ]
    }
  ]).toFile(`Balanza_${company.rfc}_${ejercicio}_${periodCode}.xlsx`);

  return filtered.length;
}
