import { strToU8, zipSync } from 'fflate';
import { downloadBlobFile } from '../../lib/formatters';
import { sanitizeSpreadsheetText } from '../../shared/date-utils';
import type { Company, FinancialStatementsResponse, FiscalWorkpaperResponse } from '../../shared/types';

function buildCsvContent(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'number' ? String(val) : sanitizeSpreadsheetText(String(val));
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))];
  return '\uFEFF' + lines.join('\r\n');
}

export function exportAllDeliverablesCsv({
  reportsData,
  fiscalData,
  company,
  year,
  period: _period,
  formatVerticalPct
}: {
  reportsData: FinancialStatementsResponse | null | undefined;
  fiscalData: FiscalWorkpaperResponse | null | undefined;
  company: Company;
  year: number;
  period: number;
  formatVerticalPct: (amount: number, base: number) => string;
}) {
  if (!reportsData) return;

  // 1. Balanza de Comprobación
  const balanzaHeaders = [
    'Código Cuenta',
    'Nombre de la Cuenta',
    'Agrupador SAT',
    'Naturaleza',
    'Nivel',
    'Saldo Inicial',
    'Cargos (Debe)',
    'Abonos (Haber)',
    'Saldo Final'
  ];
  const balanzaRows = reportsData.trialBalance.map((r) => [
    r.code,
    r.name,
    r.satGroupCode,
    r.nature,
    r.level,
    r.initialBalanceComputed,
    r.periodCharges,
    r.periodCredits,
    r.finalBalance
  ]);

  // 2. Estado de Resultados
  const er = reportsData.incomeStatement;
  const totalIsr = er.totalIsr ?? 0;
  const isrRows: Array<Array<string | number>> =
    totalIsr !== 0 || (er.isrEjercicio && er.isrEjercicio.length > 0)
      ? [
          ...(er.isrEjercicio ?? []).map((a) => [
            'ISR EJERCICIO',
            a.code,
            a.name,
            a.finalBalance,
            formatVerticalPct(a.finalBalance, er.totalIngresos)
          ]),
          [
            'IMPUESTOS A LA UTILIDAD (ISR)',
            '',
            'Provisión ISR del Ejercicio (NIF D-4)',
            totalIsr,
            formatVerticalPct(totalIsr, er.totalIngresos)
          ]
        ]
      : [];

  const erHeaders = ['Rubro Contable', 'Código', 'Nombre Cuenta', 'Importe MXN', '% s/Ventas'];
  const erRows: Array<Array<string | number>> = [
    ...er.ingresos.map((a) => [
      'INGRESOS',
      a.code,
      a.name,
      a.finalBalance,
      formatVerticalPct(a.finalBalance, er.totalIngresos)
    ]),
    ['TOTAL INGRESOS', '', 'Ventas Netas del Periodo', er.totalIngresos, '100.0%'],
    ...er.costos.map((a) => [
      'COSTOS',
      a.code,
      a.name,
      a.finalBalance,
      formatVerticalPct(a.finalBalance, er.totalIngresos)
    ]),
    ['TOTAL COSTOS', '', 'Costo de Ventas', er.totalCostos, formatVerticalPct(er.totalCostos, er.totalIngresos)],
    ['UTILIDAD BRUTA', '', 'Utilidad Bruta Operativa', er.utilidadBruta, formatVerticalPct(er.utilidadBruta, er.totalIngresos)],
    ...er.gastos.map((a) => [
      'GASTOS',
      a.code,
      a.name,
      a.finalBalance,
      formatVerticalPct(a.finalBalance, er.totalIngresos)
    ]),
    ['TOTAL GASTOS', '', 'Gastos Generales de Operación', er.totalGastos, formatVerticalPct(er.totalGastos, er.totalIngresos)],
    ...isrRows,
    ['UTILIDAD NETA', '', 'Resultado Neto del Periodo', er.utilidadNeta, formatVerticalPct(er.utilidadNeta, er.totalIngresos)]
  ];

  // 3. Balance General
  const signedBal = (
    a: FinancialStatementsResponse['trialBalance'][number],
    expectedNature: 'DEUDORA' | 'ACREEDORA'
  ) => (a.nature === expectedNature ? a.finalBalance : -a.finalBalance);

  const bgHeaders = ['Clasificación', 'Código', 'Nombre Cuenta', 'Saldo Final MXN'];
  const bgRows: Array<Array<string | number>> = [
    ...reportsData.balanceSheet.activos.map((a) => ['ACTIVO', a.code, a.name, signedBal(a, 'DEUDORA')]),
    ['TOTAL ACTIVO', '100', 'Total Activo Circulante y No Circulante', reportsData.balanceSheet.totalActivo],
    ...reportsData.balanceSheet.pasivos.map((a) => ['PASIVO', a.code, a.name, signedBal(a, 'ACREEDORA')]),
    ['TOTAL PASIVO', '200', 'Total Pasivo Corto y Largo Plazo', reportsData.balanceSheet.totalPasivo],
    ...reportsData.balanceSheet.capital.map((a) => ['CAPITAL', a.code, a.name, signedBal(a, 'ACREEDORA')]),
    ['UTILIDAD EJERCICIO', '305', 'Resultado del Ejercicio Actual', reportsData.balanceSheet.utilidadEjercicio],
    ['PASIVO + CAPITAL', '', 'Suma Pasivo y Capital Contable (Ecuación Cuadrada)', reportsData.balanceSheet.totalPasivoMasCapital]
  ];

  const files: Record<string, Uint8Array> = {
    'Balanza_Comprobacion.csv': strToU8(buildCsvContent(balanzaHeaders, balanzaRows)),
    'Estado_Resultados.csv': strToU8(buildCsvContent(erHeaders, erRows)),
    'Balance_General.csv': strToU8(buildCsvContent(bgHeaders, bgRows))
  };

  // 4. Papel Fiscal / Cédula Día 17 (si está disponible)
  if (fiscalData) {
    const d17Headers = ['Concepto Fiscal', 'Fundamento Legal / Base', 'Importe Determinado MXN'];
    const d17Rows: Array<Array<string | number>> = [
      ['Régimen Fiscal', company.regimenFiscal, ''],
      ['Ingresos Acumulables Periodo', 'Art. 16 / 17 LISR', fiscalData.isrProvisional.ingresosPeriodo],
      ['Coeficiente de Utilidad Aplicado', 'Art. 14 LISR', (fiscalData.isrProvisional.coeficienteUtilidadAplicado * 100).toFixed(4) + '%'],
      ['Utilidad Fiscal Estimada', 'Base Gravable', fiscalData.isrProvisional.utilidadFiscalEstimada],
      ['ISR Causado Periodo', 'Tasa 30% Art. 9 LISR', fiscalData.isrProvisional.isrCausado],
      ['(-) Pagos Provisionales Previos', 'Acreditamiento', fiscalData.isrProvisional.pagosProvisionalesPrevios],
      ['(=) ISR Neto a Pagar Periodo', 'Línea de Captura Día 17', fiscalData.isrProvisional.isrNetoAPagar],
      ['Actos Gravados IVA 16%', 'Art. 1 LIVA', fiscalData.ivaDefinitivo.actosGravadosCobrado16],
      ['IVA Trasladado Cobrado 16%', 'Art. 1 LIVA', fiscalData.ivaDefinitivo.ivaTrasladadoCobrado],
      ['(-) IVA Acreditable Pagado 16%', 'Art. 4 / 5 LIVA', fiscalData.ivaDefinitivo.ivaAcreditablePagado],
      ['(=) IVA Neto a Pagar', 'Art. 5-D LIVA', fiscalData.ivaDefinitivo.ivaNetoAPagar],
      ['TOTAL ESTIMADO DÍA 17 (ISR + IVA + Retenciones)', 'Línea de Captura SAT', fiscalData.resumenLineaCapturaSat.totalEstimadoDia17]
    ];
    files['Papel_Fiscal.csv'] = strToU8(buildCsvContent(d17Headers, d17Rows));
  }

  const safeRfc = (company.rfc || 'EMPRESA').replace(/[^a-zA-Z0-9_-]/g, '');
  const zipped = zipSync(files, { level: 6 });
  const zipBuffer = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
  downloadBlobFile(`Paquete_CSV_${safeRfc}_${year}.zip`, zipBuffer, 'application/zip');
}
