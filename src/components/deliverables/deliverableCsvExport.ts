import { downloadCsvFile } from '../../lib/formatters';
import type { Company, FinancialStatementsResponse, FiscalWorkpaperResponse } from '../../shared/types';

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
  downloadCsvFile(
    `01_Balanza_Comprobacion_${company.rfc}_${year}_P${String(period).padStart(2, '0')}.csv`,
    balanzaHeaders,
    balanzaRows
  );

  // 2. Estado de Resultados
  const erHeaders = ['Rubro Contable', 'Código', 'Nombre Cuenta', 'Importe MXN', '% s/Ventas'];
  const erRows: Array<Array<string | number>> = [
    ...reportsData.incomeStatement.ingresos.map((a) => [
      'INGRESOS',
      a.code,
      a.name,
      a.finalBalance,
      formatVerticalPct(a.finalBalance, reportsData.incomeStatement.totalIngresos)
    ]),
    ['TOTAL INGRESOS', '', 'Ventas Netas del Periodo', reportsData.incomeStatement.totalIngresos, '100.0%'],
    ...reportsData.incomeStatement.costos.map((a) => [
      'COSTOS',
      a.code,
      a.name,
      a.finalBalance,
      formatVerticalPct(a.finalBalance, reportsData.incomeStatement.totalIngresos)
    ]),
    ['TOTAL COSTOS', '', 'Costo de Ventas', reportsData.incomeStatement.totalCostos, formatVerticalPct(reportsData.incomeStatement.totalCostos, reportsData.incomeStatement.totalIngresos)],
    ['UTILIDAD BRUTA', '', 'Utilidad Bruta Operativa', reportsData.incomeStatement.utilidadBruta, formatVerticalPct(reportsData.incomeStatement.utilidadBruta, reportsData.incomeStatement.totalIngresos)],
    ...reportsData.incomeStatement.gastos.map((a) => [
      'GASTOS',
      a.code,
      a.name,
      a.finalBalance,
      formatVerticalPct(a.finalBalance, reportsData.incomeStatement.totalIngresos)
    ]),
    ['TOTAL GASTOS', '', 'Gastos Generales de Operación', reportsData.incomeStatement.totalGastos, formatVerticalPct(reportsData.incomeStatement.totalGastos, reportsData.incomeStatement.totalIngresos)],
    ['UTILIDAD NETA', '', 'Resultado Neto del Periodo', reportsData.incomeStatement.utilidadNeta, formatVerticalPct(reportsData.incomeStatement.utilidadNeta, reportsData.incomeStatement.totalIngresos)]
  ];
  downloadCsvFile(
    `02_Estado_Resultados_${company.rfc}_${year}_P${String(period).padStart(2, '0')}.csv`,
    erHeaders,
    erRows
  );

  // 3. Balance General
  const bgHeaders = ['Clasificación', 'Código', 'Nombre Cuenta', 'Saldo Final MXN'];
  const bgRows: Array<Array<string | number>> = [
    ...reportsData.balanceSheet.activos.map((a) => ['ACTIVO', a.code, a.name, a.finalBalance]),
    ['TOTAL ACTIVO', '100', 'Total Activo Circulante y No Circulante', reportsData.balanceSheet.totalActivo],
    ...reportsData.balanceSheet.pasivos.map((a) => ['PASIVO', a.code, a.name, a.finalBalance]),
    ['TOTAL PASIVO', '200', 'Total Pasivo Corto y Largo Plazo', reportsData.balanceSheet.totalPasivo],
    ...reportsData.balanceSheet.capital.map((a) => ['CAPITAL', a.code, a.name, a.finalBalance]),
    ['UTILIDAD EJERCICIO', '305', 'Resultado del Ejercicio Actual', reportsData.balanceSheet.utilidadEjercicio],
    ['PASIVO + CAPITAL', '', 'Suma Pasivo y Capital Contable (Ecuación Cuadrada)', reportsData.balanceSheet.totalPasivoMasCapital]
  ];
  downloadCsvFile(
    `03_Balance_General_${company.rfc}_${year}_P${String(period).padStart(2, '0')}.csv`,
    bgHeaders,
    bgRows
  );

  // 4. Cédula Día 17 (si está disponible)
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
    downloadCsvFile(
      `04_Cedula_Dia17_${company.rfc}_${year}_P${String(period).padStart(2, '0')}.csv`,
      d17Headers,
      d17Rows
    );
  }
}
