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
  period,
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
  const signedBal = (
    a: FinancialStatementsResponse['trialBalance'][number],
    expectedNature: 'DEUDORA' | 'ACREEDORA'
  ) => (a.nature === expectedNature ? a.finalBalance : -a.finalBalance);

  const er = reportsData.incomeStatement;
  const totalIsr = er.totalIsr ?? 0;
  const isrRows: Array<Array<string | number>> =
    totalIsr !== 0 || (er.isrEjercicio && er.isrEjercicio.length > 0)
      ? [
          ...(er.isrEjercicio ?? []).map((a) => {
            const val = signedBal(a, 'DEUDORA');
            return [
              'ISR EJERCICIO',
              a.code,
              a.name,
              val,
              formatVerticalPct(val, er.totalIngresos)
            ];
          }),
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
    ...er.ingresos.map((a) => {
      const val = signedBal(a, 'ACREEDORA');
      return ['INGRESOS', a.code, a.name, val, formatVerticalPct(val, er.totalIngresos)];
    }),
    ['TOTAL INGRESOS', '', 'Ventas Netas del Periodo', er.totalIngresos, '100.0%'],
    ...er.costos.map((a) => {
      const val = signedBal(a, 'DEUDORA');
      return ['COSTOS', a.code, a.name, val, formatVerticalPct(val, er.totalIngresos)];
    }),
    ['TOTAL COSTOS', '', 'Costo de Ventas', er.totalCostos, formatVerticalPct(er.totalCostos, er.totalIngresos)],
    ['UTILIDAD BRUTA', '', 'Utilidad Bruta Operativa', er.utilidadBruta, formatVerticalPct(er.utilidadBruta, er.totalIngresos)],
    ...er.gastos.map((a) => {
      const val = signedBal(a, 'DEUDORA');
      return ['GASTOS', a.code, a.name, val, formatVerticalPct(val, er.totalIngresos)];
    }),
    ['TOTAL GASTOS', '', 'Gastos Generales de Operación', er.totalGastos, formatVerticalPct(er.totalGastos, er.totalIngresos)],
    ...isrRows,
    ['UTILIDAD NETA', '', 'Resultado Neto del Periodo', er.utilidadNeta, formatVerticalPct(er.utilidadNeta, er.totalIngresos)]
  ];

  // 3. Balance General

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
    const d17Rows = buildPapelFiscalCsvRows(company, fiscalData);
    files['Papel_Fiscal.csv'] = strToU8(buildCsvContent(d17Headers, d17Rows));
  }

  const safeRfc = (company.rfc || 'EMPRESA').replace(/[^a-zA-Z0-9_-]/g, '');
  const periodCode = `P${String(period).padStart(2, '0')}`;
  const zipped = zipSync(files, { level: 6 });
  const zipBuffer = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
  downloadBlobFile(`Paquete_CSV_${safeRfc}_${year}_${periodCode}.zip`, zipBuffer, 'application/zip');
}

export function buildPapelFiscalCsvRows(
  company: Company,
  fiscalData: FiscalWorkpaperResponse
): Array<Array<string | number>> {
  const isr = fiscalData.isrProvisional;
  const iva = fiscalData.ivaDefinitivo;
  const cap = fiscalData.resumenLineaCapturaSat;
  const isPersonaFisica = company.rfc.trim().length === 13;
  const isResico = isr.esResico;
  const isResicoPf = isResico && isPersonaFisica;
  const isResicoPm = isResico && !isPersonaFisica;
  const isPfGeneral = isPersonaFisica && !isResico;

  const isrRows: Array<Array<string | number>> = [
    ['Régimen Fiscal', company.regimenFiscal, ''],
    [
      'Ingresos Cobrados / Nominales Periodo',
      isResico ? 'Flujo de Efectivo RESICO' : isPfGeneral ? 'Art. 106 LISR' : 'Art. 16 / 17 LISR',
      isr.ingresosPeriodo
    ],
    ['Ingresos Acumulados del Ejercicio', 'Acumulado Anual', isr.ingresosAcumuladosEjercicio]
  ];

  if (isResicoPm || isPfGeneral) {
    isrRows.push(
      ['(-) Deducciones Autorizadas Periodo', 'Flujo de Efectivo', -isr.deduccionesAutorizadasPeriodo],
      ['(=) Utilidad Fiscal (Ingresos - Deducciones)', 'Base Gravable', isr.utilidadFiscalEstimada]
    );
  } else if (!isResicoPf) {
    isrRows.push(
      ['Coeficiente de Utilidad Aplicado', 'Art. 14 LISR', (isr.coeficienteUtilidadAplicado * 100).toFixed(4) + '%'],
      ['Utilidad Fiscal Estimada', 'Base Gravable', isr.utilidadFiscalEstimada]
    );
  }

  if (!isResicoPf) {
    isrRows.push(['(-) Pérdidas Fiscales Aplicadas', 'Art. 57 LISR', -isr.perdidasFiscalesAplicadas]);
  }

  isrRows.push([
    'ISR Causado Periodo',
    isResico ? `RESICO Tasa ${isr.tasaIsrPct}%` : isPfGeneral ? 'Tarifa Art. 106 LISR' : `Tasa ${isr.tasaIsrPct}% Art. 9 LISR`,
    isr.isrCausado
  ]);

  if (!isResicoPf) {
    isrRows.push(['(-) Pagos Provisionales Previos', 'Acreditamiento', -isr.pagosProvisionalesPrevios]);
  }

  isrRows.push(
    ['(-) ISR Retenido por Terceros', 'Acreditamiento', -isr.isrRetenidoPeriodo],
    ['(=) ISR Neto a Pagar Periodo', 'Línea de Captura Día 17', isr.isrNetoAPagar],
    ['Actos Gravados Cobrados', 'Art. 1 LIVA', iva.actosGravadosCobrado16],
    ['IVA Trasladado Cobrado', 'Art. 1-B LIVA', iva.ivaTrasladadoCobrado],
    ['(-) IVA Acreditable Pagado', 'Art. 4 / 5 LIVA', -iva.ivaAcreditablePagado],
    ['(-) IVA Retenido Acreditable (por Clientes)', 'Art. 1-A LIVA', -(iva.ivaRetenidoAcreditable ?? 0)],
    ['(-) Saldo a Favor IVA Anterior Acreditado', 'Art. 6 LIVA', -iva.saldoFavorIvaAcreditable],
    ['(=) IVA Neto a Pagar', 'Art. 5-D LIVA', iva.ivaNetoAPagar],
    ['Retenciones de ISR por Enterar', 'Art. 96 / 106 / 113-J LISR', cap.retencionesIsrPorEnterar],
    ['Retenciones de IVA por Enterar', 'Art. 1-A LIVA', cap.retencionesIvaPorEnterar],
    ['TOTAL ESTIMADO DÍA 17 (ISR + IVA + Retenciones)', 'Línea de Captura SAT', cap.totalEstimadoDia17]
  );

  return isrRows;
}
