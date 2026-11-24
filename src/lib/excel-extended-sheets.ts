import writeXlsx, { type SheetData } from 'write-excel-file/browser';
import { sanitizeSpreadsheetText } from '../shared/date-utils';
import type { ExtendedFinancialStatementsResponse } from '../shared/types/extended-statements.types';

const sCell = (val: string | null | undefined, bold = false) => ({
  type: String,
  value: sanitizeSpreadsheetText(val ?? ''),
  fontWeight: bold ? ('bold' as const) : undefined
});

const labelCell = (value: string, bold = false) => ({
  type: String,
  value,
  fontWeight: bold ? ('bold' as const) : undefined
});

const mxnCell = (value: number, bold = false) => ({
  type: Number,
  value,
  format: '$#,##0.00',
  fontWeight: bold ? ('bold' as const) : undefined
});

export function buildCashFlowSheetData(
  data: ExtendedFinancialStatementsResponse,
  mesNombre: string
): SheetData {
  const cf = data.cashFlow;
  const rows: SheetData = [
    [labelCell('LIBREPAQ PRO ERP — ESTADO DE FLUJOS DE EFECTIVO (NIF B-2 MÉTODO INDIRECTO)', true)],
    [sCell(`${data.company.name} | RFC: ${data.company.rfc} | ${mesNombre} ${data.ejercicio}`, true)],
    [labelCell(`Comparativo base: ${data.previousEjercicioLabel} | Cifras en MXN`)],
    [],
    [
      { value: 'Sección NIF B-2', fontWeight: 'bold' },
      { value: 'Código / SAT', fontWeight: 'bold' },
      { value: 'Concepto', fontWeight: 'bold' },
      { value: 'Importe MXN', fontWeight: 'bold', align: 'right' }
    ],
    [labelCell('ACTIVIDADES DE OPERACIÓN', true), sCell('NETO'), labelCell('Utilidad (o Pérdida) Neta del Periodo', true), mxnCell(cf.utilidadNeta, true)],
    ...cf.ajustesPartidasVirtuales.map((item): SheetData[number] => [
      labelCell('Partidas Virtuales'), sCell(item.satReference ?? item.code), sCell(item.label), mxnCell(item.amount)
    ]),
    ...cf.cambiosCapitalTrabajo.map((item): SheetData[number] => [
      labelCell('Capital de Trabajo'), sCell(item.satReference ?? item.code), sCell(item.label), mxnCell(item.amount)
    ]),
    [labelCell('FLUJO NETO DE OPERACIÓN', true), sCell(''), labelCell('Suma de Actividades de Operación', true), mxnCell(cf.flujoNetoOperacion, true)],
    [],
    ...(cf.actividadesInversion.length > 0
      ? cf.actividadesInversion.map((item): SheetData[number] => [
          labelCell('ACTIVIDADES DE INVERSIÓN'), sCell(item.satReference ?? item.code), sCell(item.label), mxnCell(item.amount)
        ])
      : [[labelCell('ACTIVIDADES DE INVERSIÓN'), sCell('15x'), labelCell('Sin movimientos de inversión en el periodo'), mxnCell(0)]]),
    [labelCell('FLUJO NETO DE INVERSIÓN', true), sCell(''), labelCell('Suma de Actividades de Inversión', true), mxnCell(cf.flujoNetoInversion, true)],
    [],
    ...(cf.actividadesFinanciamiento.length > 0
      ? cf.actividadesFinanciamiento.map((item): SheetData[number] => [
          labelCell('ACTIVIDADES DE FINANCIAMIENTO'), sCell(item.satReference ?? item.code), sCell(item.label), mxnCell(item.amount)
        ])
      : [[labelCell('ACTIVIDADES DE FINANCIAMIENTO'), sCell('25x/301'), labelCell('Sin movimientos de financiamiento en el periodo'), mxnCell(0)]]),
    [labelCell('FLUJO NETO DE FINANCIAMIENTO', true), sCell(''), labelCell('Suma de Actividades de Financiamiento', true), mxnCell(cf.flujoNetoFinanciamiento, true)],
    [],
    [labelCell('VARIACIÓN NETA DE EFECTIVO', true), sCell('NIF B-2'), labelCell('Operación + Inversión + Financiamiento', true), mxnCell(cf.variacionNetaEfectivo, true)],
    [labelCell('EFECTIVO AL INICIO DEL PERIODO'), sCell('101/102/103'), labelCell('Efectivo y Equivalentes Iniciales'), mxnCell(cf.efectivoInicial)],
    [labelCell('EFECTIVO AL FINAL DEL PERIODO', true), sCell('101/102/103'), labelCell('Efectivo y Equivalentes Finales', true), mxnCell(cf.efectivoFinal, true)],
    [labelCell('RECONCILIACIÓN NIF B-2', true), sCell(cf.isReconciled ? 'CUADRADO' : 'DIFERENCIA'), labelCell('Diferencia vs Variación de Caja/Bancos'), mxnCell(cf.diferenciaReconciliacion)]
  ];
  return rows;
}

export function buildEquityChangesSheetData(
  data: ExtendedFinancialStatementsResponse,
  mesNombre: string
): SheetData {
  const eq = data.equityChanges;
  return [
    [labelCell('LIBREPAQ PRO ERP — ESTADO DE CAMBIOS EN EL CAPITAL CONTABLE (NIF B-4)', true)],
    [sCell(`${data.company.name} | RFC: ${data.company.rfc} | ${mesNombre} ${data.ejercicio}`, true)],
    [labelCell(`Cuadre vertical/horizontal: ${eq.isBalanced ? 'VERIFICADO' : 'REVISAR'} | Cifras en MXN`)],
    [],
    [
      { value: 'Concepto / Movimiento', fontWeight: 'bold' },
      { value: 'Capital Social (301)', fontWeight: 'bold', align: 'right' },
      { value: 'Reserva Legal (303)', fontWeight: 'bold', align: 'right' },
      { value: 'Resultados Acumulados (304)', fontWeight: 'bold', align: 'right' },
      { value: 'Resultado del Ejercicio (302/Neto)', fontWeight: 'bold', align: 'right' },
      { value: 'Total Capital Contable', fontWeight: 'bold', align: 'right' }
    ],
    ...eq.rows.map((row): SheetData[number] => {
      const bold = row.rowType !== 'MOVEMENT';
      return [
        sCell(row.concepto, bold),
        mxnCell(row.capitalSocial, bold),
        mxnCell(row.reservaLegal, bold),
        mxnCell(row.resultadosAcumulados, bold),
        mxnCell(row.resultadoEjercicio, bold),
        mxnCell(row.total, true)
      ];
    })
  ];
}

export function buildComparativeSheetData(
  data: ExtendedFinancialStatementsResponse,
  mesNombre: string
): SheetData {
  return [
    [labelCell('LIBREPAQ PRO ERP — ANÁLISIS COMPARATIVO INTERANUAL', true)],
    [sCell(`${data.company.name} | RFC: ${data.company.rfc} | ${mesNombre} ${data.ejercicio}`, true)],
    [sCell(`Comparativo: Ejercicio ${data.ejercicio} vs ${data.previousEjercicioLabel}`)],
    [],
    [
      { value: 'Código', fontWeight: 'bold' },
      { value: 'Nombre de la Cuenta', fontWeight: 'bold' },
      { value: 'Tipo', fontWeight: 'bold' },
      { value: 'Agrupador SAT', fontWeight: 'bold' },
      { value: `Ejercicio ${data.ejercicio}`, fontWeight: 'bold', align: 'right' },
      { value: data.previousEjercicioLabel, fontWeight: 'bold', align: 'right' },
      { value: 'Variación $ MXN', fontWeight: 'bold', align: 'right' },
      { value: 'Variación %', fontWeight: 'bold', align: 'right' }
    ],
    ...data.comparative.map((row): SheetData[number] => {
      const bold = row.level <= 2;
      return [
        sCell(row.code, bold),
        sCell(row.name, bold),
        sCell(row.type),
        sCell(row.satGroupCode),
        mxnCell(row.currentBalance, bold),
        mxnCell(row.previousBalance, bold),
        mxnCell(row.varianceAmount, bold),
        row.variancePct === null
          ? labelCell('N/A', bold)
          : { type: Number, value: row.variancePct / 100, format: '0.00%', fontWeight: bold ? ('bold' as const) : undefined }
      ];
    })
  ];
}

export async function exportExtendedStatementsXlsx({
  data,
  mesNombre
}: {
  data: ExtendedFinancialStatementsResponse;
  mesNombre: string;
}): Promise<void> {
  const safeFileRfc = data.company.rfc.replace(/[^a-zA-Z0-9]/g, '');
  const fileName = `Estados_Financieros_NIF_${safeFileRfc}_${data.ejercicio}_P${String(data.periodo).padStart(2, '0')}.xlsx`;
  await writeXlsx([
    { sheet: 'Flujos NIF B-2', data: buildCashFlowSheetData(data, mesNombre), columns: [{ width: 26 }, { width: 22 }, { width: 44 }, { width: 18 }] },
    { sheet: 'Cambios Capital NIF B-4', data: buildEquityChangesSheetData(data, mesNombre), columns: [{ width: 48 }, { width: 20 }, { width: 20 }, { width: 24 }, { width: 26 }, { width: 24 }] },
    { sheet: 'Comparativo Anual', data: buildComparativeSheetData(data, mesNombre), columns: [{ width: 16 }, { width: 38 }, { width: 12 }, { width: 14 }, { width: 18 }, { width: 22 }, { width: 18 }, { width: 14 }] }
  ]).toFile(fileName);
}
